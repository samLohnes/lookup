"""Integration test: POST /passes with query='starlink' returns
empty `passes` when the recent-launch sats don't cluster from the
observer's vantage point.

No fallback, no auto-switch, no error -- just an empty list. UI handles
the empty-state rendering separately.

The synthetic Celestrak response here contains a single launch (19030)
with three sats spaced 30 degrees apart in mean anomaly (~5 minutes
along track at 15.5 rev/day). The recent-launch filter keeps them (they
are the only launch in the response), predict_passes runs, but the rises
fall well outside group_into_trains' 60-second clustering window, so
the discovery yields zero TrainPass items.
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


def _synthetic_dispersed_starlink_3le() -> str:
    """Build a Celestrak 3LE response with sats that won't cluster.

    Three sats from a single launch (2019-030) spaced 30 degrees apart in
    mean anomaly. At 15.5 rev/day that's roughly 5 minutes along track --
    far outside the 60-second clustering window in group_into_trains, so
    each sat passes individually and discover_trains drops the size-1
    clusters, returning an empty list.

    Epoch 26100.5 (April 10, 2026 12:00 UTC) sits inside the test's 2-day
    window starting April 10.
    """
    line2_template = (
        "2 {norad:5d}  53.0000 100.0000 0001000  90.0000 {ma:8.4f} 15.50000000 12345"
    )
    sats: list[str] = []
    for norad, piece, ma in (
        (44713, "A", 100.0),
        (44714, "B", 130.0),
        (44715, "C", 200.0),
    ):
        name = f"STARLINK-OLD-{norad}"
        # Layout matches real 69-char TLE line1: 3 spaces after the
        # 6-char international designator (e.g. "19030A   26100...").
        line1 = (
            f"1 {norad:5d}U 19030{piece}   26100.50000000 "
            f" .00012345  00000-0  12345-3 0  9999"
        )
        line2 = line2_template.format(norad=norad, ma=ma)
        sats.append(f"0 {name}\n{line1}\n{line2}")
    return "\n".join(sats) + "\n"


def _starlink_mock_transport() -> httpx.MockTransport:
    """Return a MockTransport serving the dispersed synthetic batch for GROUP=starlink."""
    body = _synthetic_dispersed_starlink_3le()

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
    """TestClient wired with the dispersed-starlink MockTransport and flat terrain."""
    app = create_app(Settings(cache_root=str(tmp_path)))

    tle_client = CelestrakClient(transport=_starlink_mock_transport())
    app.dependency_overrides[get_tle_fetcher] = lambda: TLEFetcher(
        client=tle_client, cache_root=tmp_path,
    )
    app.dependency_overrides[get_terrain_fetcher] = lambda: fake_terrain
    app.dependency_overrides[get_timescale] = lambda: timescale
    app.dependency_overrides[get_ephemeris] = lambda: ephemeris
    return TestClient(app)


def test_train_query_empty_returns_no_passes(client: TestClient):
    """End-to-end: query='starlink' resolves to train_query but yields no clusters."""
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
    assert data["passes"] == []
