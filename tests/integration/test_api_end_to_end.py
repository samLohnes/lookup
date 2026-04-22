"""End-to-end: POST /passes with mocked upstream HTTP, real engine stack."""
from __future__ import annotations

from datetime import timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock

import httpx
import pytest
from fastapi.testclient import TestClient
from skyfield.api import load

from api.app import create_app
from api.deps import get_ephemeris, get_terrain_fetcher, get_timescale, get_tle_fetcher
from api.settings import Settings
from core._types import HorizonMask
from core.catalog.celestrak import CelestrakClient
from core.catalog.fetcher import TLEFetcher
from core.catalog.tle_parser import parse_tle_file

CELESTRAK_FIX = Path(__file__).resolve().parents[1] / "fixtures" / "celestrak" / "iss_single.json"
TLE_PATH = Path(__file__).resolve().parents[1] / "fixtures" / "tle" / "iss_25544.txt"


def _fake_transport_from(path: Path) -> httpx.MockTransport:
    """Build an httpx MockTransport that always returns the given file's content."""
    body = path.read_text()
    return httpx.MockTransport(lambda req: httpx.Response(200, text=body))


def _fake_terrain() -> MagicMock:
    """Return a terrain fetcher mock with a flat (zero-elevation) horizon mask."""
    fake = MagicMock()
    fake.get_horizon_mask.return_value = HorizonMask(
        samples_deg=tuple(0.0 for _ in range(360)),
    )
    return fake


@pytest.fixture
def client(tmp_path):
    """TestClient wired with a real TLEFetcher (fake HTTP) and mocked terrain."""
    app = create_app(Settings(cache_root=str(tmp_path)))

    tle_client = CelestrakClient(transport=_fake_transport_from(CELESTRAK_FIX))
    app.dependency_overrides[get_tle_fetcher] = lambda: TLEFetcher(
        client=tle_client, cache_root=tmp_path,
    )
    app.dependency_overrides[get_terrain_fetcher] = _fake_terrain
    app.dependency_overrides[get_timescale] = lambda: load.timescale()
    app.dependency_overrides[get_ephemeris] = lambda: load("de421.bsp")
    return TestClient(app)


def test_post_passes_end_to_end_iss_24h(client: TestClient):
    """Full fetch → parse → cache → predict → filter → serialize pipeline over 24h."""
    tle = parse_tle_file(TLE_PATH)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=24)

    response = client.post("/passes", json={
        "lat": 40.7128,
        "lng": -74.0060,
        "elevation_m": 10,
        "query": "ISS",
        "from_utc": start.isoformat(),
        "to_utc": end.isoformat(),
        "mode": "line-of-sight",
    })

    assert response.status_code == 200
    body = response.json()
    assert body["resolved_name"] == "ISS (ZARYA)"
    assert len(body["passes"]) >= 2
    for p in body["passes"]:
        assert p["kind"] == "single"
        assert p["norad_id"] == 25544
        assert 0.0 <= p["peak"]["elevation_deg"] <= 90.0
