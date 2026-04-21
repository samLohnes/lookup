"""Golden test — ISS passes over NYC, 24 h window from TLE epoch, frozen fixture TLE.

Asserts the engine's output is stable (regression guard) within the spec's
accuracy tolerances (±1 s on time, ±0.1° on azimuth/elevation).

The fixture uses a real ISS TLE with realistic orbital elements. The expected
values are engine-derived; this test catches regressions, not absolute accuracy.
Cross-check against Heavens-Above before making accuracy claims.

Any change to the engine that perturbs these values must be either a real
accuracy improvement (update the fixture) or a regression (fix the bug).
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from core._types import Observer
from core.catalog.tle_parser import parse_tle_file
from core.orbital.passes import predict_passes

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
EXPECTED = FIXTURES / "expected" / "iss_nyc_passes.json"

NYC = Observer(lat=40.7128, lng=-74.0060, elevation_m=10.0, name="NYC")

TIME_TOLERANCE_S = 1.0
ANGLE_TOLERANCE_DEG = 0.1


@pytest.mark.golden
def test_iss_nyc_24h_matches_hand_verified(timescale):
    """Assert ISS passes over NYC match the frozen fixture within tolerance."""
    tle = parse_tle_file(FIXTURES / "tle" / "iss_25544.txt")
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=24)

    passes = predict_passes(tle, NYC, start, end, timescale=timescale)
    expected = json.loads(EXPECTED.read_text())

    assert len(passes) == len(expected), (
        f"pass count mismatch: got {len(passes)}, expected {len(expected)}"
    )

    for got, exp in zip(passes, expected):
        got_rise = got.rise.time
        exp_rise = datetime.fromisoformat(exp["rise_utc"])
        assert abs((got_rise - exp_rise).total_seconds()) <= TIME_TOLERANCE_S, (
            f"rise time off: {got_rise} vs {exp_rise}"
        )

        got_peak = got.peak.time
        exp_peak = datetime.fromisoformat(exp["peak_utc"])
        assert abs((got_peak - exp_peak).total_seconds()) <= TIME_TOLERANCE_S, (
            f"peak time off: {got_peak} vs {exp_peak}"
        )

        got_set = got.set.time
        exp_set = datetime.fromisoformat(exp["set_utc"])
        assert abs((got_set - exp_set).total_seconds()) <= TIME_TOLERANCE_S, (
            f"set time off: {got_set} vs {exp_set}"
        )

        assert abs(got.peak.position.azimuth_deg - exp["peak_az"]) <= ANGLE_TOLERANCE_DEG
        assert abs(got.peak.position.elevation_deg - exp["peak_el"]) <= ANGLE_TOLERANCE_DEG
        assert abs(got.rise.position.azimuth_deg - exp["rise_az"]) <= ANGLE_TOLERANCE_DEG
        assert abs(got.set.position.azimuth_deg - exp["set_az"]) <= ANGLE_TOLERANCE_DEG
