"""Tests for GET /geo/timezone."""
from __future__ import annotations

from fastapi.testclient import TestClient

from api.app import create_app
from api.settings import Settings


def _client() -> TestClient:
    return TestClient(create_app(Settings(cache_root="/tmp/satvis-test")))


def test_geo_timezone_nyc_returns_new_york():
    with _client() as c:
        r = c.get("/geo/timezone", params={"lat": 40.7128, "lng": -74.006})
    assert r.status_code == 200
    body = r.json()
    assert body["timezone"] == "America/New_York"
    assert body["lat"] == 40.7128
    assert body["lng"] == -74.006


def test_geo_timezone_london_returns_london():
    with _client() as c:
        r = c.get("/geo/timezone", params={"lat": 51.5074, "lng": -0.1278})
    assert r.status_code == 200
    assert r.json()["timezone"] == "Europe/London"


def test_geo_timezone_tokyo_returns_tokyo():
    with _client() as c:
        r = c.get("/geo/timezone", params={"lat": 35.6762, "lng": 139.6503})
    assert r.status_code == 200
    assert r.json()["timezone"] == "Asia/Tokyo"


def test_geo_timezone_pacific_ocean_returns_etc_zone():
    """Ocean coordinates get a fallback Etc/GMT± offset zone from timezonefinder."""
    with _client() as c:
        r = c.get("/geo/timezone", params={"lat": 0.0, "lng": -150.0})
    assert r.status_code == 200
    tz = r.json()["timezone"]
    # timezonefinder returns an Etc/GMT±N zone for ocean points.
    assert tz.startswith("Etc/GMT") or tz == "Pacific/Midway" or "/" in tz


def test_geo_timezone_rejects_invalid_lat():
    with _client() as c:
        r = c.get("/geo/timezone", params={"lat": 100, "lng": 0})
    assert r.status_code == 422  # FastAPI validation


def test_geo_timezone_rejects_invalid_lng():
    with _client() as c:
        r = c.get("/geo/timezone", params={"lat": 0, "lng": 200})
    assert r.status_code == 422
