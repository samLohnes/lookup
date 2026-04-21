"""Tests for core.orbital.tracking."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from core._types import Observer
from core.catalog.tle_parser import parse_tle_file
from core.orbital.tracking import sample_track

NYC = Observer(lat=40.7128, lng=-74.0060, elevation_m=10.0, name="NYC")


def test_samples_have_monotonic_time(timescale, ephemeris, iss_tle_path):
    tle = parse_tle_file(iss_tle_path)
    start = datetime(2024, 4, 10, 12, 0, 0, tzinfo=timezone.utc)
    end = start + timedelta(seconds=60)

    samples = sample_track(tle, NYC, start, end, timescale=timescale, ephemeris=ephemeris, dt_seconds=10)

    times = [s.time for s in samples]
    assert times == sorted(times)


def test_sample_count_matches_dt(timescale, ephemeris, iss_tle_path):
    tle = parse_tle_file(iss_tle_path)
    start = datetime(2024, 4, 10, 12, 0, 0, tzinfo=timezone.utc)
    end = start + timedelta(seconds=60)

    samples = sample_track(tle, NYC, start, end, timescale=timescale, ephemeris=ephemeris, dt_seconds=10)

    # start inclusive, end exclusive via step — 6 samples at dt=10s over 60s
    assert len(samples) == 6


def test_sample_fields_plausible(timescale, ephemeris, iss_tle_path):
    tle = parse_tle_file(iss_tle_path)
    start = datetime(2024, 4, 10, 12, 0, 0, tzinfo=timezone.utc)
    end = start + timedelta(seconds=30)

    samples = sample_track(tle, NYC, start, end, timescale=timescale, ephemeris=ephemeris, dt_seconds=30)

    s = samples[0]
    # ISS altitude is ~400 km ± 50 km
    assert 300.0 <= s.alt_km <= 500.0
    # velocity ~7.66 km/s
    assert 6.5 <= s.velocity_km_s <= 8.5
    # lat/lng within range
    assert -90.0 <= s.lat <= 90.0
    assert -180.0 <= s.lng <= 180.0
    # sunlit, observer_dark are bools
    assert isinstance(s.sunlit, bool)
    assert isinstance(s.observer_dark, bool)


def test_empty_range_returns_empty(timescale, ephemeris, iss_tle_path):
    tle = parse_tle_file(iss_tle_path)
    t = datetime(2024, 4, 10, 12, 0, 0, tzinfo=timezone.utc)
    samples = sample_track(tle, NYC, t, t, timescale=timescale, ephemeris=ephemeris, dt_seconds=1)
    assert samples == []
