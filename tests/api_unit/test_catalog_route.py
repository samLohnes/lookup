"""Tests for GET /catalog/search."""
from __future__ import annotations

from fastapi.testclient import TestClient

from api.app import create_app
from api.settings import Settings


def _client() -> TestClient:
    app = create_app(Settings(cache_root="/tmp/satvis-test"))
    return TestClient(app)


def test_catalog_search_returns_iss_for_iss_query():
    with _client() as c:
        r = c.get("/catalog/search", params={"q": "iss"})
    assert r.status_code == 200
    hits = r.json()
    assert hits, "expected at least one hit"
    assert hits[0]["display_name"] == "ISS (ZARYA)"
    assert hits[0]["match_type"] == "satellite"
    assert 25544 in hits[0]["norad_ids"]


def test_catalog_search_returns_group_for_stations_query():
    with _client() as c:
        r = c.get("/catalog/search", params={"q": "stations"})
    assert r.status_code == 200
    hits = r.json()
    group_hit = next(
        (h for h in hits if h["match_type"] == "group" and h["display_name"] == "stations"),
        None,
    )
    assert group_hit is not None, "expected stations group hit"
    assert 25544 in group_hit["norad_ids"]
    assert 48274 in group_hit["norad_ids"]


def test_catalog_search_empty_query_returns_empty_list():
    with _client() as c:
        r = c.get("/catalog/search", params={"q": ""})
    # FastAPI rejects the empty param via the Query min_length constraint (422).
    assert r.status_code == 422


def test_catalog_search_no_match_returns_empty_list():
    with _client() as c:
        r = c.get("/catalog/search", params={"q": "ZZZNOMATCH12345"})
    assert r.status_code == 200
    assert r.json() == []


def test_catalog_search_respects_limit():
    with _client() as c:
        r = c.get("/catalog/search", params={"q": "s", "limit": 3})
    assert r.status_code == 200
    assert len(r.json()) <= 3
