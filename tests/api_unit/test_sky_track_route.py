"""Tests for POST /sky-track."""
from __future__ import annotations

from datetime import timedelta, timezone
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from skyfield.api import Timescale
from skyfield.jpllib import SpiceKernel

from api.app import create_app
from api.deps import get_ephemeris, get_terrain_fetcher, get_timescale, get_tle_fetcher
from api.settings import Settings
from core.catalog.tle_parser import parse_tle_file

TLE_PATH = "tests/fixtures/tle/iss_25544.txt"


def _fake_tle_fetcher():
    tle = parse_tle_file(TLE_PATH)
    fake = MagicMock()
    fake.get_tle.return_value = (tle, 100.0)
    return fake


def _build_client(timescale: Timescale, ephemeris: SpiceKernel) -> TestClient:
    app = create_app(Settings(cache_root="/tmp/satvis-test"))
    app.dependency_overrides[get_tle_fetcher] = _fake_tle_fetcher
    app.dependency_overrides[get_terrain_fetcher] = lambda: MagicMock()
    app.dependency_overrides[get_timescale] = lambda: timescale
    app.dependency_overrides[get_ephemeris] = lambda: ephemeris
    return TestClient(app)


def test_sky_track_returns_samples_for_short_window(timescale, ephemeris):
    client = _build_client(timescale, ephemeris)
    tle = parse_tle_file(TLE_PATH)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(seconds=30)

    response = client.post("/sky-track", json={
        "lat": 40.7128, "lng": -74.0060, "elevation_m": 10,
        "query": "ISS",
        "from_utc": start.isoformat(),
        "to_utc": end.isoformat(),
        "dt_seconds": 10,
    })

    assert response.status_code == 200
    body = response.json()
    assert len(body["samples"]) == 3  # 0, 10, 20 seconds
    first = body["samples"][0]
    assert "az" in first and "el" in first and "range_km" in first
