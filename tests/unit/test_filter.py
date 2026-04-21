"""Tests for core.visibility.filter."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from core._types import Observer
from core.catalog.tle_parser import parse_tle_file
from core.orbital.passes import predict_passes
from core.visibility.filter import filter_passes

NYC = Observer(lat=40.7128, lng=-74.0060, elevation_m=10.0, name="NYC")


def _iss_passes_72h(timescale, iss_tle_path):
    tle = parse_tle_file(iss_tle_path)
    start = datetime(2024, 4, 10, 0, 0, 0, tzinfo=timezone.utc)
    end = start + timedelta(days=3)
    return tle, predict_passes(tle, NYC, start, end, timescale=timescale)


def test_line_of_sight_mode_preserves_all_passes(timescale, ephemeris, iss_tle_path):
    tle, passes = _iss_passes_72h(timescale, iss_tle_path)
    filtered = filter_passes(
        passes, tle, NYC, mode="line-of-sight",
        timescale=timescale, ephemeris=ephemeris,
    )
    assert len(filtered) == len(passes)


def test_naked_eye_mode_is_a_subset(timescale, ephemeris, iss_tle_path):
    tle, passes = _iss_passes_72h(timescale, iss_tle_path)
    los = filter_passes(
        passes, tle, NYC, mode="line-of-sight",
        timescale=timescale, ephemeris=ephemeris,
    )
    ne = filter_passes(
        passes, tle, NYC, mode="naked-eye",
        timescale=timescale, ephemeris=ephemeris,
    )
    assert len(ne) <= len(los)


def test_naked_eye_passes_have_magnitude_and_sunlit_fraction(timescale, ephemeris, iss_tle_path):
    tle, passes = _iss_passes_72h(timescale, iss_tle_path)
    ne = filter_passes(
        passes, tle, NYC, mode="naked-eye",
        timescale=timescale, ephemeris=ephemeris,
    )
    for p in ne:
        assert p.max_magnitude is not None
        assert 0.0 < p.sunlit_fraction <= 1.0


def test_min_magnitude_filter_excludes_faint_passes(timescale, ephemeris, iss_tle_path):
    tle, passes = _iss_passes_72h(timescale, iss_tle_path)
    ne_all = filter_passes(
        passes, tle, NYC, mode="naked-eye",
        timescale=timescale, ephemeris=ephemeris,
    )
    ne_bright = filter_passes(
        passes, tle, NYC, mode="naked-eye", min_magnitude=-2.0,
        timescale=timescale, ephemeris=ephemeris,
    )
    assert len(ne_bright) <= len(ne_all)
    for p in ne_bright:
        assert p.max_magnitude is not None
        assert p.max_magnitude <= -2.0


def test_empty_input_yields_empty_output(timescale, ephemeris, iss_tle_path):
    tle = parse_tle_file(iss_tle_path)
    assert filter_passes(
        [], tle, NYC, mode="naked-eye",
        timescale=timescale, ephemeris=ephemeris,
    ) == []
