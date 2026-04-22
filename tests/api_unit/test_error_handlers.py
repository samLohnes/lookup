"""Tests for upstream-error exception handlers in the API layer.

These errors would otherwise surface as FastAPI's generic "Internal Server
Error" response, which hides the fact that the user just needs to set an
API key or that an upstream service is misbehaving.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from api.app import create_app
from api.deps import get_ephemeris, get_terrain_fetcher, get_timescale, get_tle_fetcher
from api.settings import Settings
from core.catalog.celestrak import CelestrakError
from core.terrain.opentopo import OpenTopoError


def _passes_body(start: datetime, end: datetime) -> dict:
    return {
        "lat": 40.7128,
        "lng": -74.0060,
        "elevation_m": 10,
        "query": "ISS",
        "from_utc": start.isoformat(),
        "to_utc": end.isoformat(),
        "mode": "line-of-sight",
    }


def test_opentopo_error_on_passes_returns_500_with_detail(timescale, ephemeris):
    """Missing API key → clear 500 with the key-setup message, not 'Internal Server Error'."""
    app = create_app(Settings(cache_root="/tmp/satvis-test"))

    fake_terrain = MagicMock()
    fake_terrain.get_horizon_mask.side_effect = OpenTopoError(
        "OpenTopography API key not set. Register a free key at "
        "https://portal.opentopography.org/ and set OPENTOPOGRAPHY_API_KEY."
    )
    app.dependency_overrides[get_terrain_fetcher] = lambda: fake_terrain
    app.dependency_overrides[get_tle_fetcher] = lambda: MagicMock()
    app.dependency_overrides[get_timescale] = lambda: timescale
    app.dependency_overrides[get_ephemeris] = lambda: ephemeris

    start = datetime(2026, 5, 1, tzinfo=timezone.utc)
    end = start + timedelta(hours=1)

    with TestClient(app) as client:
        response = client.post("/passes", json=_passes_body(start, end))

    assert response.status_code == 500
    detail = response.json()["detail"]
    assert "API key" in detail
    assert "OPENTOPOGRAPHY_API_KEY" in detail


def test_opentopo_error_on_horizon_returns_500_with_detail():
    app = create_app(Settings(cache_root="/tmp/satvis-test"))

    fake_terrain = MagicMock()
    fake_terrain.get_horizon_mask.side_effect = OpenTopoError(
        "OpenTopography API key not set."
    )
    app.dependency_overrides[get_terrain_fetcher] = lambda: fake_terrain

    with TestClient(app) as client:
        response = client.get("/horizon", params={"lat": 40.7128, "lng": -74.0060})

    assert response.status_code == 500
    assert "API key" in response.json()["detail"]


def test_celestrak_error_on_tle_freshness_returns_500_with_detail():
    app = create_app(Settings(cache_root="/tmp/satvis-test"))

    fake_tle = MagicMock()
    fake_tle.get_tle.side_effect = CelestrakError("HTTP 500 from Celestrak: upstream down")
    app.dependency_overrides[get_tle_fetcher] = lambda: fake_tle

    with TestClient(app) as client:
        response = client.get("/tle-freshness", params={"query": "ISS"})

    assert response.status_code == 500
    assert "Celestrak" in response.json()["detail"]
