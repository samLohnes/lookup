"""Tests for core.orbital.passes."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from core._types import HorizonMask, Observer
from core.catalog.tle_parser import parse_tle_file
from core.orbital.passes import predict_passes

NYC = Observer(lat=40.7128, lng=-74.0060, elevation_m=10.0, name="NYC")


def test_returns_list_of_passes(timescale, iss_tle_path):
    tle = parse_tle_file(iss_tle_path)
    start = datetime(2024, 4, 10, 0, 0, 0, tzinfo=timezone.utc)
    end = start + timedelta(days=1)

    passes = predict_passes(tle, NYC, start, end, timescale=timescale)

    assert isinstance(passes, list)
    # ISS typically has 4-8 passes per 24 h at 40°N
    assert 2 <= len(passes) <= 12


def test_passes_sorted_by_rise_time(timescale, iss_tle_path):
    tle = parse_tle_file(iss_tle_path)
    start = datetime(2024, 4, 10, 0, 0, 0, tzinfo=timezone.utc)
    end = start + timedelta(days=1)

    passes = predict_passes(tle, NYC, start, end, timescale=timescale)

    rises = [p.rise.time for p in passes]
    assert rises == sorted(rises)


def test_pass_rise_peak_set_ordering(timescale, iss_tle_path):
    tle = parse_tle_file(iss_tle_path)
    start = datetime(2024, 4, 10, 0, 0, 0, tzinfo=timezone.utc)
    end = start + timedelta(days=1)

    passes = predict_passes(tle, NYC, start, end, timescale=timescale)

    for p in passes:
        assert p.rise.time < p.peak.time < p.set.time
        assert p.peak.position.elevation_deg >= p.rise.position.elevation_deg
        assert p.peak.position.elevation_deg >= p.set.position.elevation_deg
        assert p.duration_s > 0


def test_min_elevation_filters_low_passes(timescale, iss_tle_path):
    tle = parse_tle_file(iss_tle_path)
    start = datetime(2024, 4, 10, 0, 0, 0, tzinfo=timezone.utc)
    end = start + timedelta(days=3)

    all_passes = predict_passes(tle, NYC, start, end, timescale=timescale, min_elevation_deg=0.0)
    high_passes = predict_passes(tle, NYC, start, end, timescale=timescale, min_elevation_deg=40.0)

    assert len(high_passes) <= len(all_passes)
    for p in high_passes:
        assert p.peak.position.elevation_deg >= 40.0


def test_passes_empty_when_window_is_before_tle_epoch_minus_week(timescale, iss_tle_path):
    """Propagating a TLE far into the past is invalid; we expect no crash, possibly 0 passes."""
    tle = parse_tle_file(iss_tle_path)
    # Fixture TLE epoch is 2024-04-10 12:00 UTC; try a window far before that.
    start = datetime(2000, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    # We tolerate empty list; the point is no exception.
    passes = predict_passes(tle, NYC, start, end, timescale=timescale)
    assert isinstance(passes, list)


def test_tle_epoch_surfaced_on_each_pass(timescale, iss_tle_path):
    tle = parse_tle_file(iss_tle_path)
    start = datetime(2024, 4, 10, 0, 0, 0, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    passes = predict_passes(tle, NYC, start, end, timescale=timescale)
    for p in passes:
        assert p.tle_epoch == tle.epoch


def test_horizon_mask_blocks_passes(timescale, iss_tle_path):
    """A mask that sets every azimuth to 90° should filter out all passes."""
    tle = parse_tle_file(iss_tle_path)
    start = datetime(2024, 4, 10, 0, 0, 0, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    all_mask = HorizonMask(samples_deg=tuple(90.0 for _ in range(360)))
    passes = predict_passes(
        tle, NYC, start, end, timescale=timescale, horizon_mask=all_mask
    )
    assert passes == []
