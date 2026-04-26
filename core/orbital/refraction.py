"""Atmospheric-refraction constants applied to observer-relative geometry.

Skyfield's `topocentric.altaz()` accepts `pressure_mbar` and `temperature_C`
to apply Bennett's refraction formula. Pass-prediction and track-sampling
both call `altaz()` and are wired to use these constants so that reported
altitudes are *apparent* (refracted), not geometric.

`HORIZON_REFRACTION_DEG` is the IAU/USNO convention for horizon depression:
a satellite at geometric altitude −0.5667° is, after refraction, exactly at
the apparent horizon. We use this as an offset to skyfield's `find_events`
altitude threshold so rise/set events fire at apparent-horizon crossings.
"""
from __future__ import annotations

STANDARD_PRESSURE_MBAR: float = 1010.0
STANDARD_TEMPERATURE_C: float = 10.0
HORIZON_REFRACTION_DEG: float = 0.5667
