"""Tests for GET /geo/elevation."""
from __future__ import annotations

from unittest.mock import MagicMock

import numpy as np
from fastapi.testclient import TestClient

from api.app import create_app
from api.deps import get_terrain_fetcher
from api.settings import Settings
from core.terrain.opentopo import OpenTopoError


def _client_with_fake_terrain(fake) -> TestClient:
    """Build a TestClient whose terrain fetcher dependency is overridden."""
    app = create_app(Settings(cache_root="/tmp/satvis-test"))
    app.dependency_overrides[get_terrain_fetcher] = lambda: fake
    return TestClient(app)


def test_elevation_returns_center_pixel_value():
    """The endpoint should return the DEM elevation at the centre of the tile."""
    fake = MagicMock()
    fake.get_elevation_m.return_value = 4205.0

    with _client_with_fake_terrain(fake) as c:
        r = c.get("/geo/elevation", params={"lat": 19.82, "lng": -155.47})

    assert r.status_code == 200
    body = r.json()
    assert body == {"lat": 19.82, "lng": -155.47, "elevation_m": 4205.0}
    fake.get_elevation_m.assert_called_once()
    kwargs = fake.get_elevation_m.call_args.kwargs
    assert kwargs["lat"] == 19.82
    assert kwargs["lng"] == -155.47
    assert kwargs["radius_km"] == 1


def test_elevation_samples_center_of_dem_array():
    """End-to-end through TerrainFetcher.get_elevation_m: centre pixel wins."""
    from core.terrain.fetcher import TerrainFetcher

    elevations = np.zeros((11, 11), dtype=np.float32)
    elevations[5, 5] = 1234.5

    fake_dem = MagicMock()
    fake_dem.elevations = elevations
    fake_dem.shape = elevations.shape

    fetcher = MagicMock(spec=TerrainFetcher)
    # Drive the real implementation but with a stubbed DEM loader.
    fetcher.get_elevation_m.side_effect = lambda *, lat, lng, radius_km: float(
        fake_dem.elevations[fake_dem.shape[0] // 2, fake_dem.shape[1] // 2]
    )

    with _client_with_fake_terrain(fetcher) as c:
        r = c.get("/geo/elevation", params={"lat": 27.99, "lng": 86.93})

    assert r.status_code == 200
    assert r.json()["elevation_m"] == 1234.5


def test_elevation_rejects_invalid_lat():
    fake = MagicMock()
    with _client_with_fake_terrain(fake) as c:
        r = c.get("/geo/elevation", params={"lat": 100, "lng": 0})
    assert r.status_code == 422


def test_elevation_rejects_invalid_lng():
    fake = MagicMock()
    with _client_with_fake_terrain(fake) as c:
        r = c.get("/geo/elevation", params={"lat": 0, "lng": 200})
    assert r.status_code == 422


def test_elevation_dem_fetch_failure_returns_502():
    """A non-config OpenTopoError (network, polar bbox) maps to 502."""
    fake = MagicMock()
    fake.get_elevation_m.side_effect = OpenTopoError(
        "observer latitude 89.9° is too close to a pole to compute a 1 km horizon tile"
    )
    with _client_with_fake_terrain(fake) as c:
        r = c.get("/geo/elevation", params={"lat": 89.9, "lng": 0})
    assert r.status_code == 502
    assert "DEM fetch failed" in r.json()["detail"]


def test_elevation_missing_api_key_returns_500():
    """A 'API key' OpenTopoError bubbles up to the global handler → 500."""
    fake = MagicMock()
    fake.get_elevation_m.side_effect = OpenTopoError(
        "OpenTopography API key not set. Register a free key at ..."
    )
    with _client_with_fake_terrain(fake) as c:
        r = c.get("/geo/elevation", params={"lat": 40.0, "lng": -74.0})
    assert r.status_code == 500
    assert "API key" in r.json()["detail"]
