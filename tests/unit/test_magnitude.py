"""Tests for core.visibility.magnitude."""
from __future__ import annotations

import math

from core.visibility.magnitude import (
    ISS_INTRINSIC_MAGNITUDE,
    compute_magnitude,
)


def test_iss_overhead_at_low_phase_is_bright():
    """Right overhead (~400 km range), low phase angle → very bright."""
    m = compute_magnitude(
        range_km=400.0,
        phase_angle_deg=10.0,
        intrinsic_magnitude=ISS_INTRINSIC_MAGNITUDE,
    )
    # Expected roughly -3.5 to -4 for near-zenith ISS at favorable phase
    assert -4.5 < m < -2.5


def test_iss_far_range_is_dimmer():
    """At 2000 km range (low-horizon pass), magnitude is dimmer."""
    m_near = compute_magnitude(400.0, 50.0, ISS_INTRINSIC_MAGNITUDE)
    m_far = compute_magnitude(2000.0, 50.0, ISS_INTRINSIC_MAGNITUDE)
    assert m_far > m_near  # dimmer = higher mag number


def test_phase_angle_180_is_dimmer_than_0():
    """Phase 0 = fully lit from observer's POV; phase 180 = back-lit."""
    m_full = compute_magnitude(500.0, 0.0, ISS_INTRINSIC_MAGNITUDE)
    m_back = compute_magnitude(500.0, 170.0, ISS_INTRINSIC_MAGNITUDE)
    assert m_back > m_full


def test_magnitude_is_finite_at_zero_phase():
    m = compute_magnitude(500.0, 0.0, ISS_INTRINSIC_MAGNITUDE)
    assert math.isfinite(m)


def test_magnitude_monotonic_in_range():
    """Fixing phase, magnitude increases monotonically with range."""
    phase = 50.0
    mags = [
        compute_magnitude(r, phase, ISS_INTRINSIC_MAGNITUDE)
        for r in (300.0, 500.0, 1000.0, 1500.0, 2000.0)
    ]
    assert mags == sorted(mags)


def test_iss_intrinsic_magnitude_constant():
    """Sanity: ISS intrinsic magnitude is around -1.3 (published value)."""
    assert -1.5 < ISS_INTRINSIC_MAGNITUDE < -1.0


def test_sample_track_default_intrinsic_is_conservative(timescale, ephemeris, iss_tle_path):
    """sample_track's default `intrinsic_magnitude` is the conservative
    DEFAULT_INTRINSIC_MAGNITUDE (4.0), not ISS's -1.3.

    This locks in the fix where every non-ISS satellite was being silently
    assigned ISS brightness. With the new default, sunlit ISS samples come
    out *dimmer* than they would under the ISS override.
    """
    from datetime import timedelta, timezone

    from core._types import Observer
    from core.catalog.tle_parser import parse_tle_file
    from core.orbital.tracking import sample_track
    from core.visibility.magnitude import (
        DEFAULT_INTRINSIC_MAGNITUDE,
        ISS_INTRINSIC_MAGNITUDE,
    )

    tle = parse_tle_file(iss_tle_path)
    nyc = Observer(lat=40.7128, lng=-74.0060, elevation_m=10.0)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=24)

    default_samples = sample_track(
        tle, nyc, start, end,
        timescale=timescale, ephemeris=ephemeris, dt_seconds=60,
    )
    iss_samples = sample_track(
        tle, nyc, start, end,
        timescale=timescale, ephemeris=ephemeris, dt_seconds=60,
        intrinsic_magnitude=ISS_INTRINSIC_MAGNITUDE,
    )

    default_mags = [s.magnitude for s in default_samples if s.magnitude is not None]
    iss_mags = [s.magnitude for s in iss_samples if s.magnitude is not None]
    assert default_mags, "expected at least one sunlit sample"
    assert len(default_mags) == len(iss_mags)

    expected_offset = DEFAULT_INTRINSIC_MAGNITUDE - ISS_INTRINSIC_MAGNITUDE
    for d, i in zip(default_mags, iss_mags):
        assert abs((d - i) - expected_offset) < 1e-6, (
            f"default magnitude {d} should be exactly {expected_offset} dimmer than "
            f"ISS-overridden {i}"
        )
