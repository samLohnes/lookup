"""Refraction is applied when computing observer-relative altaz."""
from __future__ import annotations

from datetime import timedelta, timezone
from pathlib import Path

import pytest
from skyfield.api import EarthSatellite, wgs84

from core._types import Observer
from core.catalog.tle_parser import parse_tle_file
from core.orbital.tracking import sample_track

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


@pytest.mark.skipif(
    not (FIXTURES / "tle" / "iss_25544.txt").exists(),
    reason="ISS fixture TLE not present",
)
def test_sample_track_lifts_low_elevation_above_geometric(timescale, ephemeris):
    """sample_track should apply Bennett refraction in its reported elevations.

    Verify by recomputing geometric altitude (no pressure/temp kwargs) for a
    low-elevation sample and asserting `sample.el` is higher than geometric.
    Refraction lifts ~5–34′ at low altitude and ~0″ at zenith.
    """
    tle = parse_tle_file(FIXTURES / "tle" / "iss_25544.txt")
    nyc = Observer(lat=40.7128, lng=-74.0060, elevation_m=10.0)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=24)

    samples = sample_track(
        tle, nyc, start, end,
        timescale=timescale, ephemeris=ephemeris, dt_seconds=60,
    )
    # Find a low above-horizon sample where refraction effect is largest.
    low_samples = [s for s in samples if 0.5 < s.el < 5.0]
    if not low_samples:
        pytest.skip("no low-elevation samples in this window")
    sample = low_samples[0]

    # Recompute geometric (un-refracted) altitude at the same time.
    satellite = EarthSatellite(tle.line1, tle.line2, tle.name, timescale)
    topos = wgs84.latlon(nyc.lat, nyc.lng, elevation_m=nyc.elevation_m)
    t = timescale.from_datetime(sample.time)
    geometric_alt, _, _ = (satellite - topos).at(t).altaz()
    geometric_deg = float(geometric_alt.degrees)

    assert sample.el > geometric_deg, (
        f"sample.el ({sample.el}°) should be lifted above geometric "
        f"({geometric_deg}°) by refraction"
    )
    # Sanity: lift should be a few arcminutes at this altitude, not degrees.
    lift_arcmin = (sample.el - geometric_deg) * 60.0
    assert 1.0 < lift_arcmin < 60.0, (
        f"refraction lift of {lift_arcmin}' outside expected band at el={sample.el}°"
    )
