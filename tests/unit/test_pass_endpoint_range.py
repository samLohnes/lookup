"""PassEndpoint carries observer-to-satellite range_km for rise/peak/set."""
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
def test_range_km_populated_on_all_endpoints(timescale):
    tle = parse_tle_file(FIXTURES / "tle" / "iss_25544.txt")
    nyc = Observer(lat=40.7128, lng=-74.0060, elevation_m=10.0)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=24)
    passes = predict_passes(tle, nyc, start, end, timescale=timescale)
    assert passes
    for p in passes:
        # ISS apparent range from observer is between ~350 km (overhead)
        # and ~2500 km (low horizon) — comfortable bound.
        assert 300.0 < p.rise.range_km < 3000.0
        assert 300.0 < p.peak.range_km < 3000.0
        assert 300.0 < p.set.range_km < 3000.0
        # Peak should be the closest of the three for typical passes.
        assert p.peak.range_km <= p.rise.range_km
        assert p.peak.range_km <= p.set.range_km
