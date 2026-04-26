"""Rise events fire at apparent (refracted) horizon, not geometric horizon."""
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
def test_rise_set_use_apparent_horizon(timescale):
    """With horizon depression of -0.5667° applied to find_events AND
    refraction applied to altaz reporting, rise altitude should sit near
    0° (within tens of arcminutes)."""
    tle = parse_tle_file(FIXTURES / "tle" / "iss_25544.txt")
    nyc = Observer(lat=40.7128, lng=-74.0060, elevation_m=10.0)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=24)

    passes = predict_passes(tle, nyc, start, end, timescale=timescale)

    assert passes, "expected at least one ISS pass"

    # Without horizon depression, find_events fires at *geometric* el=0,
    # which post-refraction sits at apparent el ≈ +0.5667°. With depression
    # at -0.5667°, find_events fires at apparent el ≈ 0°. The bound below
    # passes only with depression applied.
    for p in passes:
        assert abs(p.rise.position.elevation_deg) < 0.1, (
            f"rise apparent el {p.rise.position.elevation_deg}° not near 0° — "
            f"horizon-depression offset missing in find_events"
        )
        assert abs(p.set.position.elevation_deg) < 0.1, (
            f"set apparent el {p.set.position.elevation_deg}° similar issue"
        )
