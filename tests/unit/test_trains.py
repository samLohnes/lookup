"""Tests for core.trains.clustering."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from core._types import AngularPosition, Pass, PassEndpoint, TrainPass
from core.trains.clustering import group_into_trains


def _pass(norad_id: int, rise_time: datetime, peak_az: float) -> Pass:
    return Pass(
        id=f"{norad_id}-{rise_time.strftime('%Y%m%d%H%M%S')}",
        norad_id=norad_id,
        name=f"STARLINK-{norad_id}",
        rise=PassEndpoint(time=rise_time, position=AngularPosition(peak_az - 90.0, 5.0)),
        peak=PassEndpoint(time=rise_time + timedelta(minutes=3), position=AngularPosition(peak_az, 60.0)),
        set=PassEndpoint(time=rise_time + timedelta(minutes=6), position=AngularPosition(peak_az + 90.0, 5.0)),
        duration_s=360,
        max_magnitude=4.0,
        sunlit_fraction=1.0,
        tle_epoch=rise_time,
        terrain_blocked_ranges=(),
    )


def test_no_passes_returns_empty():
    assert group_into_trains([]) == []


def test_single_pass_is_not_clustered():
    base = datetime(2026, 5, 1, 2, 0, 0, tzinfo=timezone.utc)
    result = group_into_trains([_pass(44713, base, 180.0)])
    assert len(result) == 1
    assert isinstance(result[0], Pass)


def test_co_flying_passes_become_one_trainpass():
    base = datetime(2026, 5, 1, 2, 0, 0, tzinfo=timezone.utc)
    passes = [
        _pass(44713, base, 180.0),
        _pass(44714, base + timedelta(seconds=5), 180.5),
        _pass(44715, base + timedelta(seconds=10), 181.0),
    ]

    result = group_into_trains(passes, time_window_s=60, angle_window_deg=2)

    assert len(result) == 1
    tp = result[0]
    assert isinstance(tp, TrainPass)
    assert tp.member_norad_ids == (44713, 44714, 44715)
    assert len(tp.member_passes) == 3
    # Envelope: earliest rise + latest set
    assert tp.rise.time == passes[0].rise.time
    assert tp.set.time == passes[-1].set.time


def test_passes_outside_time_window_are_not_clustered():
    base = datetime(2026, 5, 1, 2, 0, 0, tzinfo=timezone.utc)
    passes = [
        _pass(44713, base, 180.0),
        _pass(44714, base + timedelta(minutes=10), 180.5),  # 10 minutes later
    ]

    result = group_into_trains(passes, time_window_s=60)

    assert len(result) == 2
    assert all(isinstance(p, Pass) for p in result)


def test_passes_outside_azimuth_window_are_not_clustered():
    base = datetime(2026, 5, 1, 2, 0, 0, tzinfo=timezone.utc)
    passes = [
        _pass(44713, base, 180.0),
        _pass(44714, base + timedelta(seconds=5), 210.0),  # 30° different azimuth
    ]

    result = group_into_trains(passes, angle_window_deg=2)

    assert len(result) == 2
    assert all(isinstance(p, Pass) for p in result)


def test_mixed_clusters_and_singletons():
    base = datetime(2026, 5, 1, 2, 0, 0, tzinfo=timezone.utc)
    passes = [
        # Cluster 1 (three members)
        _pass(44713, base, 180.0),
        _pass(44714, base + timedelta(seconds=5), 180.5),
        _pass(44715, base + timedelta(seconds=10), 181.0),
        # Singleton, different time
        _pass(25544, base + timedelta(hours=1), 90.0),
        # Cluster 2 (two members)
        _pass(44800, base + timedelta(hours=2), 0.0),
        _pass(44801, base + timedelta(hours=2, seconds=15), 1.0),
    ]

    result = group_into_trains(passes)

    # Preserves time order of clusters
    assert [type(x).__name__ for x in result] == ["TrainPass", "Pass", "TrainPass"]
    assert result[0].member_norad_ids == (44713, 44714, 44715)  # type: ignore[union-attr]
    assert result[2].member_norad_ids == (44800, 44801)  # type: ignore[union-attr]
