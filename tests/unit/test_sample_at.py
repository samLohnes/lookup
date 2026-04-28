"""Tests for core.orbital.tracking.sample_at."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from skyfield.api import Timescale
from skyfield.jpllib import SpiceKernel

from core._types import Observer
from core.catalog.tle_parser import parse_tle_file
from core.orbital.tracking import sample_at, sample_track

TLE_PATH = Path(__file__).resolve().parents[1] / "fixtures" / "tle" / "iss_25544.txt"
NYC = Observer(lat=40.7128, lng=-74.0060, elevation_m=10.0)


def test_sample_at_matches_sample_track_first_sample(
    timescale: Timescale, ephemeris: SpiceKernel,
):
    """sample_at(t) must equal sample_track(t, t+1s, dt=1)[0]."""
    tle = parse_tle_file(TLE_PATH)
    when = tle.epoch.astimezone(timezone.utc) + timedelta(minutes=30)

    one = sample_at(tle, NYC, when, timescale=timescale, ephemeris=ephemeris)
    many = sample_track(
        tle, NYC, when, when + timedelta(seconds=1),
        timescale=timescale, ephemeris=ephemeris, dt_seconds=1,
    )
    assert one == many[0]


def test_sample_at_returns_track_sample_with_populated_fields(
    timescale: Timescale, ephemeris: SpiceKernel,
):
    """Returned sample carries lat, lng, alt_km, az, el, range_km, velocity_km_s."""
    tle = parse_tle_file(TLE_PATH)
    when = tle.epoch.astimezone(timezone.utc)

    s = sample_at(tle, NYC, when, timescale=timescale, ephemeris=ephemeris)
    assert -90.0 <= s.lat <= 90.0
    assert -180.0 <= s.lng <= 180.0
    assert s.alt_km > 200.0  # ISS altitude floor
    assert 0.0 <= s.az <= 360.0
    assert -90.0 <= s.el <= 90.0
    assert s.range_km > 0.0
    assert s.velocity_km_s > 0.0


def test_sample_at_requires_timezone_aware_when(
    timescale: Timescale, ephemeris: SpiceKernel,
):
    """Naive datetime should raise (consistency with sample_track)."""
    tle = parse_tle_file(TLE_PATH)
    when_naive = datetime(2025, 1, 24, 12, 0, 0)
    with pytest.raises(ValueError):
        sample_at(tle, NYC, when_naive, timescale=timescale, ephemeris=ephemeris)
