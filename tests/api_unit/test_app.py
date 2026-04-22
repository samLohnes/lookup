"""Smoke tests for the FastAPI app factory + settings."""
from __future__ import annotations

from fastapi.testclient import TestClient

from api.app import create_app
from api.settings import Settings


def test_app_starts_and_health_endpoint_returns_ok():
    """App factory wires the /health endpoint and it responds 200."""
    app = create_app(Settings(cache_root="/tmp/satvis-test"))
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_settings_has_expected_defaults():
    """Default settings match documented values."""
    s = Settings()
    assert s.cache_root.endswith(".satvis")
    assert s.tle_max_age_hours == 24
    assert s.horizon_radius_km == 50
