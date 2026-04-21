"""Satellite sunlit/eclipsed test.

Delegates to skyfield's `is_sunlit()` which does the Earth-shadow cone
geometry in ECI coordinates.
"""
from __future__ import annotations

from datetime import datetime

from skyfield.api import EarthSatellite, Timescale
from skyfield.jpllib import SpiceKernel


def is_satellite_sunlit(
    satellite: EarthSatellite,
    time: datetime,
    timescale: Timescale,
    ephemeris: SpiceKernel,
) -> bool:
    """Return True if the satellite is illuminated by the Sun at `time`.

    Args:
        satellite: A skyfield EarthSatellite (build one from a TLE).
        time: UTC datetime.
        timescale: Skyfield Timescale.
        ephemeris: Planetary ephemeris containing 'sun'. Used internally
            by skyfield's `is_sunlit`.

    Returns:
        True if the satellite is in direct sunlight; False if eclipsed by Earth.
    """
    t = timescale.from_datetime(time)
    return bool(satellite.at(t).is_sunlit(ephemeris))
