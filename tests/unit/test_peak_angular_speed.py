"""peak_angular_speed_deg_s reports degrees/second across the sky at peak."""
from __future__ import annotations

from datetime import timedelta, timezone
from pathlib import Path

import pytest

from core._types import Observer
from core.catalog.tle_parser import parse_tle_file
from core.orbital.passes import predict_passes

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


@pytest.mark.skipif(
    not (FIXTURES / "tle" / "iss_25544.txt").exists(),
    reason="ISS fixture TLE not present",
)
def test_iss_angular_speed_at_peak_in_expected_range(timescale):
    """ISS sweeps the sky at ~0.4°/s near the horizon, ~1.5°/s overhead."""
    tle = parse_tle_file(FIXTURES / "tle" / "iss_25544.txt")
    nyc = Observer(lat=40.7128, lng=-74.0060, elevation_m=10.0)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=24)
    passes = predict_passes(tle, nyc, start, end, timescale=timescale)
    assert passes
    for p in passes:
        assert 0.1 < p.peak_angular_speed_deg_s < 2.5, (
            f"angular speed {p.peak_angular_speed_deg_s}°/s outside ISS bounds"
        )
