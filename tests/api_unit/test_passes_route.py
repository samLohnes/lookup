"""Tests for POST /passes route (with mocked upstream fetchers)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from skyfield.api import load

from api.app import create_app
from api.deps import get_ephemeris, get_terrain_fetcher, get_timescale, get_tle_fetcher
from api.settings import Settings
from core._types import HorizonMask
from core.catalog.tle_parser import parse_tle_file

TLE_PATH = "tests/fixtures/tle/iss_25544.txt"


def _fake_tle_fetcher():
    tle = parse_tle_file(TLE_PATH)
    fake = MagicMock()
    fake.get_tle.return_value = (tle, 120.0)
    fake.get_group_tles.return_value = ([tle], 120.0)
    return fake


def _fake_terrain_fetcher():
    # No blockage — zero-elevation mask.
    fake = MagicMock()
    fake.get_horizon_mask.return_value = HorizonMask(samples_deg=tuple(0.0 for _ in range(360)))
    return fake


def _build_client() -> TestClient:
    app = create_app(Settings(cache_root="/tmp/satvis-test"))
    app.dependency_overrides[get_tle_fetcher] = _fake_tle_fetcher
    app.dependency_overrides[get_terrain_fetcher] = _fake_terrain_fetcher
    app.dependency_overrides[get_timescale] = lambda: load.timescale()
    app.dependency_overrides[get_ephemeris] = lambda: load("de421.bsp")
    return TestClient(app)


def test_passes_returns_passes_for_iss():
    client = _build_client()
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
    assert body["passes"][0]["kind"] == "single"
    assert body["tle_age_seconds"] == 120.0


def test_passes_returns_404_when_query_unresolvable():
    client = _build_client()
    tle = parse_tle_file(TLE_PATH)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=1)

    response = client.post("/passes", json={
        "lat": 0.0, "lng": 0.0, "elevation_m": 0,
        "query": "NOTAREALSATELLITE",
        "from_utc": start.isoformat(),
        "to_utc": end.isoformat(),
        "mode": "line-of-sight",
    })

    assert response.status_code == 404
