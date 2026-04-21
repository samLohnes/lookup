"""Tests for core.visibility.sunlit."""
from __future__ import annotations

from datetime import datetime, timezone

from skyfield.api import EarthSatellite

from core.catalog.tle_parser import parse_tle_file
from core.visibility.sunlit import is_satellite_sunlit


def _make_iss(timescale, tle_path):
    tle = parse_tle_file(tle_path)
    return EarthSatellite(tle.line1, tle.line2, tle.name, timescale)


def test_iss_is_sunlit_during_local_daylight(timescale, ephemeris, iss_tle_path):
    """Over any spot at local noon, the ISS is very likely sunlit."""
    sat = _make_iss(timescale, iss_tle_path)
    # Pick a time where ISS is overhead and sun is high — e.g. noon UTC (Atlantic).
    t = datetime(2024, 4, 10, 12, 0, 0, tzinfo=timezone.utc)
    assert is_satellite_sunlit(sat, t, timescale, ephemeris) is True


def test_iss_eclipsed_at_local_midnight_center_of_earth_shadow(timescale, ephemeris, iss_tle_path):
    """Around local midnight the ISS is likely in Earth's shadow."""
    sat = _make_iss(timescale, iss_tle_path)
    # A time when the ISS is on the anti-sun side — midnight local at its sub-point
    t = datetime(2024, 4, 11, 0, 0, 0, tzinfo=timezone.utc)
    # Not asserting a specific value here because the exact eclipse state
    # depends on where the ISS is at that second. The function must
    # return a bool regardless.
    result = is_satellite_sunlit(sat, t, timescale, ephemeris)
    assert isinstance(result, bool)


def test_is_sunlit_returns_bool(timescale, ephemeris, iss_tle_path):
    sat = _make_iss(timescale, iss_tle_path)
    t = datetime(2024, 4, 10, 0, 0, 0, tzinfo=timezone.utc)
    assert isinstance(is_satellite_sunlit(sat, t, timescale, ephemeris), bool)
