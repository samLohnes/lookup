"""Integration test: POST /passes with query='starlink' returns
>= 1 TrainPassResponse and zero PassResponse items.

Regression guard for the original M1 placeholder bug -- the hardcoded
5-NORAD starlink group never produced a TrainPass. Here a synthetic
Celestrak fixture serves a co-orbital recent batch through MockTransport;
the route runs real skyfield SGP4 propagation and group_into_trains and
must yield at least one train.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import httpx
import pytest
from fastapi.testclient import TestClient
from skyfield.api import Timescale
from skyfield.jpllib import SpiceKernel

from api.app import create_app
from api.deps import get_ephemeris, get_terrain_fetcher, get_timescale, get_tle_fetcher
from api.settings import Settings
from core.catalog.celestrak import CelestrakClient
from core.catalog.fetcher import TLEFetcher


def _synthetic_starlink_3le() -> str:
    """Build a Celestrak 3LE response with a co-orbital recent batch.

    Five sats from launch 2026-010 with very close orbital elements so
    they cluster within group_into_trains' 60s rise-time + 2-degree
    azimuth predicate.

    Mean motion 15.50 rev/day and inclination 53 degrees match real
    Starlink; epoch 26100.5 (April 10, 2026 12:00 UTC) sits inside the
    test's 2-day window starting April 10.

    Mean-anomaly stepping of 0.05 degrees per sat (~5 seconds along
    track at 15.5 rev/day) keeps the train within the clustering
    predicate.
    """
    line2_template = (
        "2 {norad:5d}  53.0000 100.0000 0001000  90.0000 {ma:8.4f} 15.50000000 12345"
    )
    sats: list[str] = []
    for norad, piece, ma in (
        (90001, "A", 270.0000),
        (90002, "B", 270.0500),
        (90003, "C", 270.1000),
        (90004, "D", 270.1500),
        (90005, "E", 270.2000),
    ):
        name = f"STARLINK-TEST-{norad}"
        # Layout matches real 69-char TLE line1: 3 spaces after the
        # 6-char international designator (e.g. "26010A   26100...").
        line1 = (
            f"1 {norad:5d}U 26010{piece}   26100.50000000 "
            f" .00012345  00000-0  12345-3 0  9999"
        )
        line2 = line2_template.format(norad=norad, ma=ma)
        sats.append(f"0 {name}\n{line1}\n{line2}")
    return "\n".join(sats) + "\n"


def _starlink_mock_transport() -> httpx.MockTransport:
    """Return a MockTransport that serves the synthetic batch for GROUP=starlink."""
    body = _synthetic_starlink_3le()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.params.get("GROUP") == "starlink":
            return httpx.Response(200, text=body)
        return httpx.Response(
            404, text=f"unexpected request in test: {request.url}"
        )

    return httpx.MockTransport(handler)


@pytest.fixture
def client(
    tmp_path,
    timescale: Timescale,
    ephemeris: SpiceKernel,
    fake_terrain: MagicMock,
):
    """TestClient wired with a TLEFetcher whose CelestrakClient uses the
    synthetic-starlink MockTransport, plus a flat terrain mock."""
    app = create_app(Settings(cache_root=str(tmp_path)))

    tle_client = CelestrakClient(transport=_starlink_mock_transport())
    app.dependency_overrides[get_tle_fetcher] = lambda: TLEFetcher(
        client=tle_client, cache_root=tmp_path,
    )
    app.dependency_overrides[get_terrain_fetcher] = lambda: fake_terrain
    app.dependency_overrides[get_timescale] = lambda: timescale
    app.dependency_overrides[get_ephemeris] = lambda: ephemeris
    return TestClient(app)


def test_train_query_returns_train(client: TestClient):
    """End-to-end: query='starlink' resolves to the train_query and yields >=1 train."""
    now = datetime(2026, 4, 10, tzinfo=timezone.utc)
    body = {
        "lat": 40.7128,
        "lng": -74.0060,
        "elevation_m": 10.0,
        "query": "starlink",
        "from_utc": now.isoformat(),
        "to_utc": (now + timedelta(days=2)).isoformat(),
        "mode": "line-of-sight",
    }
    resp = client.post("/passes", json=body)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["resolved_name"] == "starlink (trains)"

    train_passes = [p for p in data["passes"] if p["kind"] == "train"]
    single_passes = [p for p in data["passes"] if p["kind"] == "single"]
    assert train_passes, f"expected >= 1 TrainPass, got {data['passes']}"
    assert single_passes == [], "train_query response must contain only TrainPass items"
