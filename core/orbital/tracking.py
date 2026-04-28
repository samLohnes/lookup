"""Dense sampling of a satellite's trajectory during a pass.

Emits `TrackSample` entries at fixed `dt_seconds` intervals over a window.
Each sample carries both the observer-relative geometry (az/el/range) and
the satellite's ground-track position and altitude.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import numpy as np
from skyfield.api import EarthSatellite, Timescale, wgs84
from skyfield.jpllib import SpiceKernel

from core._types import Observer, TLE, TrackSample
from core.orbital.refraction import (
    STANDARD_PRESSURE_MBAR,
    STANDARD_TEMPERATURE_C,
)
from core.visibility.darkness import is_observer_in_darkness
from core.visibility.magnitude import DEFAULT_INTRINSIC_MAGNITUDE, compute_magnitude


def _phase_angle_deg(topocentric, sun_apparent) -> float:
    """Sun-satellite-observer phase angle (vertex at satellite), in degrees.

    Phase 0° = fully front-lit (sun behind observer); 180° = back-lit.

    Args:
        topocentric: result of `(satellite - topos).at(t)`. Its `.position`
            is the observer→satellite vector.
        sun_apparent: result of `(earth + topos).at(t).observe(sun).apparent()`.
            Its `.position` is the observer→sun vector.
    """
    obs_to_sat = np.asarray(topocentric.position.km, dtype=float)
    obs_to_sun = np.asarray(sun_apparent.position.km, dtype=float)

    sat_to_obs = -obs_to_sat
    sat_to_sun = obs_to_sun - obs_to_sat

    denom = np.linalg.norm(sat_to_obs) * np.linalg.norm(sat_to_sun)
    if denom == 0.0:
        return 0.0

    cos_phi = float(sat_to_obs.dot(sat_to_sun) / denom)
    cos_phi = max(-1.0, min(1.0, cos_phi))
    return float(np.degrees(np.arccos(cos_phi)))


def sample_track(
    tle: TLE,
    observer: Observer,
    start: datetime,
    end: datetime,
    *,
    timescale: Timescale,
    ephemeris: SpiceKernel,
    dt_seconds: int = 1,
    intrinsic_magnitude: float = DEFAULT_INTRINSIC_MAGNITUDE,
) -> list[TrackSample]:
    """Sample a satellite's track at `dt_seconds` intervals.

    Args:
        tle: Orbital elements.
        observer: Observation location.
        start: Inclusive window start (UTC).
        end: Exclusive window end (UTC).
        timescale: Skyfield Timescale.
        ephemeris: Planetary ephemeris (for sun position + sunlit test).
        dt_seconds: Sampling interval in seconds.
        intrinsic_magnitude: Used by `compute_magnitude`. Defaults to
            `DEFAULT_INTRINSIC_MAGNITUDE` (4.0) — a conservative dim
            fallback. Callers should pass an explicit value (e.g.
            `ISS_INTRINSIC_MAGNITUDE`) when the satellite is known to
            be brighter than the default.

    Returns:
        List of `TrackSample`, earliest first. Empty if `start >= end`.
    """
    if start.tzinfo is None or end.tzinfo is None:
        raise ValueError("start and end must be timezone-aware (UTC)")
    if start >= end:
        return []

    satellite = EarthSatellite(tle.line1, tle.line2, tle.name, timescale)
    topos = wgs84.latlon(observer.lat, observer.lng, elevation_m=observer.elevation_m)
    earth = ephemeris["earth"]
    sun = ephemeris["sun"]

    samples: list[TrackSample] = []
    cur = start
    step = timedelta(seconds=dt_seconds)

    while cur < end:
        t = timescale.from_datetime(cur.astimezone(timezone.utc))

        # Observer-relative geometry (apparent altitude — refraction applied).
        topocentric = (satellite - topos).at(t)
        alt, az, dist = topocentric.altaz(
            pressure_mbar=STANDARD_PRESSURE_MBAR,
            temperature_C=STANDARD_TEMPERATURE_C,
        )

        # Ground-track sub-point
        geocentric = satellite.at(t)
        subpoint = wgs84.subpoint_of(geocentric)
        alt_km = wgs84.height_of(geocentric).km

        # Velocity magnitude (km/s)
        velocity_km_s = float(np.linalg.norm(geocentric.velocity.km_per_s))

        sunlit = bool(geocentric.is_sunlit(ephemeris))
        obs_dark = is_observer_in_darkness(cur, observer, timescale, ephemeris)

        # Phase angle for magnitude
        sun_apparent = (earth + topos).at(t).observe(sun).apparent()
        phase = _phase_angle_deg(topocentric, sun_apparent)
        mag = (
            compute_magnitude(float(dist.km), phase, intrinsic_magnitude)
            if sunlit
            else None
        )

        samples.append(
            TrackSample(
                time=cur,
                lat=float(subpoint.latitude.degrees),
                lng=float(subpoint.longitude.degrees),
                alt_km=float(alt_km),
                az=float(az.degrees) % 360.0,
                el=float(alt.degrees),
                range_km=float(dist.km),
                velocity_km_s=velocity_km_s,
                magnitude=mag,
                sunlit=sunlit,
                observer_dark=obs_dark,
            )
        )
        cur += step

    return samples


def sample_at(
    tle: TLE,
    observer: Observer,
    when: datetime,
    *,
    timescale: Timescale,
    ephemeris: SpiceKernel,
    intrinsic_magnitude: float = DEFAULT_INTRINSIC_MAGNITUDE,
) -> TrackSample:
    """Compute one TrackSample at a single instant.

    Equivalent to `sample_track(when, when + 1s, dt=1)[0]` — used by
    /now-positions for instantaneous polls. Wraps the same propagation
    logic; reuses the same refraction model, magnitude calculation,
    and sun-sunlit logic.

    Args:
        tle: Orbital elements.
        observer: Observation location.
        when: Instant to sample (UTC, must be timezone-aware).
        timescale: Skyfield Timescale.
        ephemeris: Planetary ephemeris.
        intrinsic_magnitude: Intrinsic visual magnitude. Defaults to
            DEFAULT_INTRINSIC_MAGNITUDE.

    Returns:
        A single TrackSample for the requested instant.
    """
    samples = sample_track(
        tle, observer, when, when + timedelta(seconds=1),
        timescale=timescale, ephemeris=ephemeris,
        dt_seconds=1, intrinsic_magnitude=intrinsic_magnitude,
    )
    return samples[0]
