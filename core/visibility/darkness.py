"""Observer-darkness test for naked-eye visibility.

"Dark" = sun is below a configurable altitude threshold at the observer.
Default is civil twilight (-6°), which matches most casual satellite-tracking
conventions. Use `ASTRONOMICAL_TWILIGHT_DEG` for strict astrophotography.
"""
from __future__ import annotations

from datetime import datetime

from skyfield.api import Timescale, wgs84
from skyfield.jpllib import SpiceKernel

from core._types import Observer

CIVIL_TWILIGHT_DEG = -6.0
NAUTICAL_TWILIGHT_DEG = -12.0
ASTRONOMICAL_TWILIGHT_DEG = -18.0


def is_observer_in_darkness(
    time: datetime,
    observer: Observer,
    timescale: Timescale,
    ephemeris: SpiceKernel,
    *,
    threshold_deg: float = CIVIL_TWILIGHT_DEG,
) -> bool:
    """Return True if the sun is below `threshold_deg` at the observer.

    Args:
        time: UTC datetime to evaluate.
        observer: Observation location.
        timescale: Skyfield Timescale (share one per process).
        ephemeris: Skyfield planetary ephemeris (DE421 or similar).
        threshold_deg: Sun altitude threshold in degrees. Default -6° (civil
            twilight). Use -12° for nautical or -18° for astronomical.

    Returns:
        True if the sun's altitude (from observer, in degrees) is strictly less
        than `threshold_deg`. Equal-to is considered not-dark.
    """
    t = timescale.from_datetime(time)
    earth = ephemeris["earth"]
    sun = ephemeris["sun"]
    topos = wgs84.latlon(observer.lat, observer.lng, elevation_m=observer.elevation_m)

    observer_pos = earth + topos
    alt, _, _ = observer_pos.at(t).observe(sun).apparent().altaz()
    return bool(alt.degrees < threshold_deg)
