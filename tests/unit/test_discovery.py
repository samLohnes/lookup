"""Tests for core.trains.discovery."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest

from core._types import (
    AngularPosition,
    Observer,
    Pass,
    PassEndpoint,
    TLE,
    TrainPass,
)
from core.trains.discovery import discover_trains, _filter_to_recent_launches


def _line1_with_designator(norad_id: int, designator: str) -> str:
    padded = designator.ljust(8)[:8]
    return f"1 {norad_id:5d}U {padded} 25024.50000000  .00012345  00000-0  12345-3 0  9999"


def _make_tle(*, norad_id: int, designator: str, name: str | None = None) -> TLE:
    return TLE(
        norad_id=norad_id,
        name=name or f"TEST-{norad_id}",
        line1=_line1_with_designator(norad_id, designator),
        line2="2 12345  53.0000 100.0000 0001000  90.0000 270.0000 15.50000000 12345",
        epoch=datetime(2025, 1, 24, tzinfo=timezone.utc),
    )


def _make_pass(*, norad_id: int, rise_offset_s: int) -> Pass:
    rise = datetime(2026, 4, 26, 22, 0, 0, tzinfo=timezone.utc) + timedelta(seconds=rise_offset_s)
    return Pass(
        id=f"{norad_id}-{rise.strftime('%Y%m%d%H%M%S')}",
        norad_id=norad_id,
        name=f"TEST-{norad_id}",
        rise=PassEndpoint(time=rise, position=AngularPosition(azimuth_deg=180.0, elevation_deg=0.0), range_km=1500.0),
        peak=PassEndpoint(time=rise + timedelta(minutes=4), position=AngularPosition(azimuth_deg=180.0, elevation_deg=60.0), range_km=500.0),
        set=PassEndpoint(time=rise + timedelta(minutes=8), position=AngularPosition(azimuth_deg=180.0, elevation_deg=0.0), range_km=1500.0),
        duration_s=480,
        max_magnitude=-1.0,
        sunlit_fraction=1.0,
        tle_epoch=datetime(2025, 1, 24, tzinfo=timezone.utc),
        peak_angular_speed_deg_s=0.74,
        naked_eye_visible="yes",
    )


# -- _filter_to_recent_launches ------------------------------------------------

def test_filter_keeps_top_n_launches():
    """Sats from the highest (year, launch_number) keys are kept; older drop."""
    tles = [
        _make_tle(norad_id=1, designator="25001A  "),  # old
        _make_tle(norad_id=2, designator="26001A  "),  # mid
        _make_tle(norad_id=3, designator="26001B  "),  # mid (same launch as 2)
        _make_tle(norad_id=4, designator="26010A  "),  # new
        _make_tle(norad_id=5, designator="26010B  "),  # new (same launch as 4)
    ]
    kept = _filter_to_recent_launches(tles, n_recent_launches=2)
    kept_ids = {t.norad_id for t in kept}
    # Should keep launches 26010 + 26001 (top 2), drop 25001.
    assert kept_ids == {2, 3, 4, 5}


def test_filter_one_launch_only():
    tles = [
        _make_tle(norad_id=1, designator="26001A  "),
        _make_tle(norad_id=2, designator="26002A  "),
        _make_tle(norad_id=3, designator="26003A  "),
    ]
    kept = _filter_to_recent_launches(tles, n_recent_launches=1)
    assert {t.norad_id for t in kept} == {3}


def test_filter_drops_unparseable_designators():
    tles = [
        _make_tle(norad_id=1, designator="26001A  "),
        TLE(norad_id=2, name="bad", line1="garbage", line2="garbage", epoch=datetime(2025, 1, 1, tzinfo=timezone.utc)),
    ]
    kept = _filter_to_recent_launches(tles, n_recent_launches=5)
    assert {t.norad_id for t in kept} == {1}


# -- discover_trains -----------------------------------------------------------

@pytest.fixture
def stub_deps(monkeypatch):
    """Stub TLEFetcher, predict_passes, and group_into_trains to isolate
    discover_trains' orchestration logic from skyfield calls."""
    fetcher = MagicMock()
    timescale = MagicMock()
    ephemeris = MagicMock()
    return fetcher, timescale, ephemeris


def test_unknown_query_kind_raises(stub_deps):
    fetcher, ts, eph = stub_deps
    with pytest.raises(ValueError, match="unknown train query_kind"):
        discover_trains(
            "iridium", Observer(lat=40.7, lng=-74.0, elevation_m=10.0),
            datetime(2026, 4, 26, tzinfo=timezone.utc),
            datetime(2026, 4, 27, tzinfo=timezone.utc),
            tle_fetcher=fetcher, timescale=ts, ephemeris=eph,
        )


def test_returns_only_trains(stub_deps, monkeypatch):
    """Verifies: fetch → recency filter → predict per-sat → cluster → return TrainPass only."""
    fetcher, ts, eph = stub_deps
    # Fetcher returns one recent batch (4 sats from same launch) + 1 old straggler.
    fetcher.get_group_tles.return_value = (
        [
            _make_tle(norad_id=1, designator="26010A  "),
            _make_tle(norad_id=2, designator="26010B  "),
            _make_tle(norad_id=3, designator="26010C  "),
            _make_tle(norad_id=4, designator="26010D  "),
            _make_tle(norad_id=99, designator="20030A  "),  # old, should be filtered
        ],
        0.0,
    )
    # Mock predict_passes: each sat in the recent batch returns one tightly-clustered pass.
    pass_by_norad = {
        1: [_make_pass(norad_id=1, rise_offset_s=0)],
        2: [_make_pass(norad_id=2, rise_offset_s=10)],
        3: [_make_pass(norad_id=3, rise_offset_s=20)],
        4: [_make_pass(norad_id=4, rise_offset_s=30)],
        99: [_make_pass(norad_id=99, rise_offset_s=600)],
    }
    monkeypatch.setattr(
        "core.trains.discovery.predict_passes",
        lambda tle, observer, start, end, **_: pass_by_norad[tle.norad_id],
    )

    obs = Observer(lat=40.7, lng=-74.0, elevation_m=10.0)
    out = discover_trains(
        "starlink", obs,
        datetime(2026, 4, 26, tzinfo=timezone.utc),
        datetime(2026, 4, 27, tzinfo=timezone.utc),
        tle_fetcher=fetcher, timescale=ts, ephemeris=eph,
        n_recent_launches=1,  # only 26010 batch
    )
    # Old sat 99 should never have predict_passes called for it.
    assert all(isinstance(item, TrainPass) for item in out)
    assert len(out) == 1, "expected exactly 1 train from the 4 clustered sats"
    assert set(out[0].member_norad_ids) == {1, 2, 3, 4}


def test_recent_but_dispersed_returns_empty(stub_deps, monkeypatch):
    """Recent-launch sats whose passes don't satisfy the clustering predicate
    return [] — clustering verification drops them."""
    fetcher, ts, eph = stub_deps
    fetcher.get_group_tles.return_value = (
        [
            _make_tle(norad_id=1, designator="26010A  "),
            _make_tle(norad_id=2, designator="26010B  "),
        ],
        0.0,
    )
    # Wide rise gap (10 min apart) — fails the 60s clustering predicate.
    pass_by_norad = {
        1: [_make_pass(norad_id=1, rise_offset_s=0)],
        2: [_make_pass(norad_id=2, rise_offset_s=600)],
    }
    monkeypatch.setattr(
        "core.trains.discovery.predict_passes",
        lambda tle, observer, start, end, **_: pass_by_norad[tle.norad_id],
    )

    obs = Observer(lat=40.7, lng=-74.0, elevation_m=10.0)
    out = discover_trains(
        "starlink", obs,
        datetime(2026, 4, 26, tzinfo=timezone.utc),
        datetime(2026, 4, 27, tzinfo=timezone.utc),
        tle_fetcher=fetcher, timescale=ts, ephemeris=eph,
    )
    assert out == []


def test_empty_celestrak_response(stub_deps):
    """Empty TLE list returns [] cleanly."""
    fetcher, ts, eph = stub_deps
    fetcher.get_group_tles.return_value = ([], 0.0)
    obs = Observer(lat=40.7, lng=-74.0, elevation_m=10.0)
    out = discover_trains(
        "starlink", obs,
        datetime(2026, 4, 26, tzinfo=timezone.utc),
        datetime(2026, 4, 27, tzinfo=timezone.utc),
        tle_fetcher=fetcher, timescale=ts, ephemeris=eph,
    )
    assert out == []
