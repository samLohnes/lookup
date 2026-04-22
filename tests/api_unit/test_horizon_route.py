"""Tests for GET /horizon."""
from __future__ import annotations

from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from api.app import create_app
from api.deps import get_terrain_fetcher
from api.settings import Settings
from core._types import HorizonMask


def test_horizon_returns_360_samples():
    app = create_app(Settings(cache_root="/tmp/satvis-test"))

    fake = MagicMock()
    fake.get_horizon_mask.return_value = HorizonMask(
        samples_deg=tuple(float(i) * 0.1 for i in range(360)),
    )
    app.dependency_overrides[get_terrain_fetcher] = lambda: fake

    with TestClient(app) as client:
        response = client.get("/horizon", params={
            "lat": 40.7128, "lng": -74.0060, "elevation_m": 10,
        })

    assert response.status_code == 200
    body = response.json()
    assert len(body["samples_deg"]) == 360
    assert body["lat"] == 40.7128
    assert body["samples_deg"][0] == 0.0
