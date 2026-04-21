"""Pass prediction.

Given a TLE, an observer, and a time window, return all visibility
windows (passes) where the satellite rises above a minimum elevation.
Delegates the heavy lifting — SGP4 propagation and rise/set finding — to
`skyfield`'s `EarthSatellite.find_events()`.
"""
from __future__ import annotations

from datetime import datetime, timezone

from skyfield.api import EarthSatellite, Timescale, wgs84

from core._types import (
    AngularPosition,
    HorizonMask,
    Observer,
    Pass,
    PassEndpoint,
    TLE,
)

EVENT_RISE = 0
EVENT_CULMINATE = 1
EVENT_SET = 2


def _observe_altaz(
    satellite: EarthSatellite,
    topos,
    t,
) -> AngularPosition:
    """Return AngularPosition (az_deg, el_deg) of `satellite` from `topos` at `t`."""
    difference = satellite - topos
    topocentric = difference.at(t)
    alt, az, _ = topocentric.altaz()
    return AngularPosition(azimuth_deg=float(az.degrees) % 360.0, elevation_deg=float(alt.degrees))


def _pass_id(norad_id: int, rise_time: datetime) -> str:
    """Stable ID for a pass, unique within a given satellite + day.

    Format: `<norad>-<YYYYMMDDHHMMSS>`.
    """
    return f"{norad_id}-{rise_time.strftime('%Y%m%d%H%M%S')}"


def _passes_above_horizon_mask(peak_pos: AngularPosition, mask: HorizonMask) -> bool:
    """Return True if peak elevation exceeds the terrain mask at that azimuth."""
    return peak_pos.elevation_deg >= mask.min_elevation_at(peak_pos.azimuth_deg)


def predict_passes(
    tle: TLE,
    observer: Observer,
    start: datetime,
    end: datetime,
    *,
    timescale: Timescale,
    min_elevation_deg: float = 0.0,
    horizon_mask: HorizonMask | None = None,
) -> list[Pass]:
    """Predict satellite passes over `observer` between `start` and `end`.

    Args:
        tle: Orbital elements as a `TLE`.
        observer: Observation location.
        start: Inclusive window start (UTC).
        end: Exclusive window end (UTC).
        timescale: Skyfield Timescale (shared across calls).
        min_elevation_deg: Minimum peak elevation to include a pass.
            Used as the `altitude_degrees` parameter to skyfield.
        horizon_mask: Optional 360° mask; if provided, passes whose peak
            elevation does not exceed the mask at their peak azimuth are
            discarded.

    Returns:
        List of `Pass` sorted by rise time.
    """
    if start.tzinfo is None or end.tzinfo is None:
        raise ValueError("start and end must be timezone-aware (UTC)")

    satellite = EarthSatellite(tle.line1, tle.line2, tle.name, timescale)
    topos = wgs84.latlon(observer.lat, observer.lng, elevation_m=observer.elevation_m)

    t0 = timescale.from_datetime(start.astimezone(timezone.utc))
    t1 = timescale.from_datetime(end.astimezone(timezone.utc))

    times, events = satellite.find_events(topos, t0, t1, altitude_degrees=min_elevation_deg)

    passes: list[Pass] = []
    pending_rise: tuple[datetime, AngularPosition] | None = None
    pending_peak: tuple[datetime, AngularPosition] | None = None

    for t, e in zip(times, events):
        dt = t.utc_datetime().replace(tzinfo=timezone.utc)
        pos = _observe_altaz(satellite, topos, t)

        if e == EVENT_RISE:
            pending_rise = (dt, pos)
            pending_peak = None
        elif e == EVENT_CULMINATE:
            pending_peak = (dt, pos)
        elif e == EVENT_SET:
            if pending_rise is None or pending_peak is None:
                # Partial pass at window boundary — skip.
                pending_rise = None
                pending_peak = None
                continue
            rise_dt, rise_pos = pending_rise
            peak_dt, peak_pos = pending_peak

            if horizon_mask is not None and not _passes_above_horizon_mask(peak_pos, horizon_mask):
                pending_rise = None
                pending_peak = None
                continue

            duration = int(round((dt - rise_dt).total_seconds()))
            passes.append(
                Pass(
                    id=_pass_id(tle.norad_id, rise_dt),
                    norad_id=tle.norad_id,
                    name=tle.name,
                    rise=PassEndpoint(time=rise_dt, position=rise_pos),
                    peak=PassEndpoint(time=peak_dt, position=peak_pos),
                    set=PassEndpoint(time=dt, position=pos),
                    duration_s=duration,
                    max_magnitude=None,   # populated by visibility.filter_passes
                    sunlit_fraction=0.0,  # populated by visibility.filter_passes
                    tle_epoch=tle.epoch,
                    terrain_blocked_ranges=(),
                )
            )
            pending_rise = None
            pending_peak = None

    passes.sort(key=lambda p: p.rise.time)
    return passes
