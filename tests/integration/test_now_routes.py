"""Integration tests for POST /now-positions and POST /now-tracks."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock

import httpx
import pytest
from fastapi.testclient import TestClient
from skyfield.api import Timescale
from skyfield.jpllib import SpiceKernel

from api.app import create_app
from api.deps import get_ephemeris, get_terrain_fetcher, get_timescale, get_tle_fetcher
from api.settings import Settings
from core.catalog.celestrak import CelestrakClient
from core.catalog.fetcher import TLEFetcher

CELESTRAK_FIX = Path(__file__).resolve().parents[1] / "fixtures" / "celestrak" / "iss_single.txt"


def _fake_transport_from(path: Path) -> httpx.MockTransport:
    """Serve the ISS fixture for CATNR=25544; return empty body otherwise.

    An empty Celestrak body causes `fetch_single` to raise `CelestrakError`,
    which the route surfaces as HTTP 404 — exercising the unknown-NORAD path.
    """
    body = path.read_text()

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.params.get("CATNR") == "25544":
            return httpx.Response(200, text=body)
        return httpx.Response(200, text="")

    return httpx.MockTransport(handler)


@pytest.fixture
def client(
    tmp_path,
    timescale: Timescale,
    ephemeris: SpiceKernel,
    fake_terrain: MagicMock,
):
    app = create_app(Settings(cache_root=str(tmp_path)))
    tle_client = CelestrakClient(transport=_fake_transport_from(CELESTRAK_FIX))
    app.dependency_overrides[get_tle_fetcher] = lambda: TLEFetcher(
        client=tle_client, cache_root=tmp_path,
    )
    app.dependency_overrides[get_terrain_fetcher] = lambda: fake_terrain
    app.dependency_overrides[get_timescale] = lambda: timescale
    app.dependency_overrides[get_ephemeris] = lambda: ephemeris
    return TestClient(app)


def test_now_positions_returns_one_entry_per_norad(client: TestClient):
    response = client.post("/now-positions", json={
        "lat": 40.7128, "lng": -74.0060, "elevation_m": 10,
        "norad_ids": [25544],
    })
    assert response.status_code == 200
    body = response.json()
    assert len(body["entries"]) == 1
    entry = body["entries"][0]
    assert entry["norad_id"] == 25544
    assert "sample" in entry
    assert entry["sample"]["alt_km"] > 200.0
    assert entry["sample"]["velocity_km_s"] > 0.0
    sample_t = datetime.fromisoformat(entry["sample"]["time"].replace("Z", "+00:00"))
    delta = abs((datetime.now(timezone.utc) - sample_t).total_seconds())
    assert delta < 10.0


def test_now_positions_unknown_norad_returns_404(client: TestClient):
    response = client.post("/now-positions", json={
        "lat": 40.7128, "lng": -74.0060, "elevation_m": 10,
        "norad_ids": [999999],
    })
    assert response.status_code == 404
    assert "999999" in response.json()["detail"]


def test_now_positions_rejects_empty_norad_list(client: TestClient):
    response = client.post("/now-positions", json={
        "lat": 40.7128, "lng": -74.0060, "elevation_m": 10,
        "norad_ids": [],
    })
    assert response.status_code == 422


def test_now_tracks_returns_samples_over_window(client: TestClient):
    response = client.post("/now-tracks", json={
        "lat": 40.7128, "lng": -74.0060, "elevation_m": 10,
        "norad_ids": [25544],
        "tail_minutes": 10,
        "dt_seconds": 30,
    })
    assert response.status_code == 200
    body = response.json()
    assert len(body["entries"]) == 1
    entry = body["entries"][0]
    assert entry["norad_id"] == 25544
    assert 18 <= len(entry["samples"]) <= 21
    times = [
        datetime.fromisoformat(s["time"].replace("Z", "+00:00"))
        for s in entry["samples"]
    ]
    for i in range(1, len(times)):
        assert times[i] > times[i - 1]
    delta = abs((datetime.now(timezone.utc) - times[-1]).total_seconds())
    assert delta < 60.0


def test_now_tracks_respects_tail_minutes(client: TestClient):
    response = client.post("/now-tracks", json={
        "lat": 40.7128, "lng": -74.0060, "elevation_m": 10,
        "norad_ids": [25544],
        "tail_minutes": 5,
        "dt_seconds": 60,
    })
    assert response.status_code == 200
    body = response.json()
    assert 4 <= len(body["entries"][0]["samples"]) <= 6
