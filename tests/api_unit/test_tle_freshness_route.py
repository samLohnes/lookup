"""Tests for GET /tle-freshness."""
from __future__ import annotations

from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from api.app import create_app
from api.deps import get_tle_fetcher
from api.settings import Settings
from core.catalog.tle_parser import parse_tle_file

TLE_PATH = "tests/fixtures/tle/iss_25544.txt"


def test_tle_freshness_returns_age_for_single_query():
    app = create_app(Settings(cache_root="/tmp/satvis-test"))
    tle = parse_tle_file(TLE_PATH)

    fake = MagicMock()
    fake.get_tle.return_value = (tle, 3600.0)
    app.dependency_overrides[get_tle_fetcher] = lambda: fake

    with TestClient(app) as client:
        response = client.get("/tle-freshness", params={"query": "ISS"})

    assert response.status_code == 200
    body = response.json()
    assert body[0]["norad_id"] == 25544
    assert body[0]["fetched_age_seconds"] == 3600.0


def test_tle_freshness_returns_404_for_unknown_query():
    app = create_app(Settings(cache_root="/tmp/satvis-test"))
    app.dependency_overrides[get_tle_fetcher] = lambda: MagicMock()

    with TestClient(app) as client:
        response = client.get("/tle-freshness", params={"query": "XYZZY_NO_MATCH_12345"})

    assert response.status_code == 404
