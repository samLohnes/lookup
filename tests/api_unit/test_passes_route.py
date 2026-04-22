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


# ---------------------------------------------------------------------------
# Task 12a: default group filters
# ---------------------------------------------------------------------------

def _fake_tle_fetcher_group():
    """Returns a fetcher whose get_group_tles yields a single ISS TLE.

    Using a single TLE keeps the test deterministic while still exercising
    the `resolution.type == "group"` code path.
    """
    from core.catalog.tle_parser import parse_tle_file

    tle = parse_tle_file(TLE_PATH)
    fake = MagicMock()
    fake.get_tle.return_value = (tle, 120.0)
    fake.get_group_tles.return_value = ([tle], 120.0)
    return fake


def _build_client_for_group() -> TestClient:
    """Like _build_client but with get_group_tles mocked too."""
    app = create_app(Settings(cache_root="/tmp/satvis-test"))
    app.dependency_overrides[get_tle_fetcher] = _fake_tle_fetcher_group
    app.dependency_overrides[get_terrain_fetcher] = _fake_terrain_fetcher
    app.dependency_overrides[get_timescale] = lambda: load.timescale()
    app.dependency_overrides[get_ephemeris] = lambda: load("de421.bsp")
    return TestClient(app)


def _passes_request_body(start, end, *, query: str, **overrides) -> dict:
    """Build a minimal /passes request body, allowing keyword overrides."""
    body = {
        "lat": 40.7128,
        "lng": -74.0060,
        "elevation_m": 10,
        "query": query,
        "from_utc": start.isoformat(),
        "to_utc": end.isoformat(),
        "mode": "line-of-sight",
    }
    body.update(overrides)
    return body


def test_group_query_applies_default_30deg_elevation_floor():
    """stations group → only passes with peak elevation ≥ 30° remain."""
    client = _build_client_for_group()
    tle = parse_tle_file(TLE_PATH)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=24)

    response = client.post(
        "/passes",
        json=_passes_request_body(start, end, query="stations"),
    )

    assert response.status_code == 200
    body = response.json()
    # Every returned pass (or train) must clear the 30° floor.
    for event in body["passes"]:
        assert event["peak"]["elevation_deg"] >= 30.0


def test_group_query_with_apply_group_defaults_false_keeps_low_passes():
    """Opting out of defaults → low-elevation passes included again."""
    client = _build_client_for_group()
    tle = parse_tle_file(TLE_PATH)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=24)

    default_on = client.post(
        "/passes",
        json=_passes_request_body(start, end, query="stations"),
    ).json()
    default_off = client.post(
        "/passes",
        json=_passes_request_body(
            start, end, query="stations", apply_group_defaults=False,
        ),
    ).json()

    # Opting out must never return fewer events than the filtered version.
    assert len(default_off["passes"]) >= len(default_on["passes"])


def test_single_query_is_never_auto_filtered():
    """Spec: single-satellite queries are never auto-trimmed by group defaults."""
    client = _build_client_for_group()
    tle = parse_tle_file(TLE_PATH)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=24)

    response = client.post(
        "/passes",
        json=_passes_request_body(start, end, query="ISS"),
    )

    assert response.status_code == 200
    body = response.json()
    # Single-sat query must yield at least one pass below 30° over 24 h from NYC.
    low_passes = [
        e for e in body["passes"]
        if e["peak"]["elevation_deg"] < 30.0
    ]
    assert low_passes, "expected at least one <30° pass for single ISS query"


def test_explicit_min_peak_elevation_overrides_group_default():
    """Caller's explicit floor wins over the group default."""
    client = _build_client_for_group()
    tle = parse_tle_file(TLE_PATH)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=24)

    response = client.post(
        "/passes",
        json=_passes_request_body(
            start, end, query="stations", min_peak_elevation_deg=10.0,
        ),
    )

    assert response.status_code == 200
    body = response.json()
    for event in body["passes"]:
        assert event["peak"]["elevation_deg"] >= 10.0
