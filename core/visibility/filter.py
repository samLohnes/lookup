"""Filter passes by visibility mode.

For `line-of-sight` mode, passes are preserved as-is (they were already
elevation-filtered by `predict_passes`).

For `naked-eye` mode, each pass is sampled; a pass is kept only if at
least one sample has `sunlit=True AND observer_dark=True`. The pass's
`max_magnitude` and `sunlit_fraction` are populated from the sample set.
"""
from __future__ import annotations

from dataclasses import replace

from skyfield.api import Timescale
from skyfield.jpllib import SpiceKernel

from core._types import Observer, Pass, TLE, VisibilityMode
from core.orbital.tracking import sample_track


def _sunlit_and_dark_samples(samples) -> list:
    """Return samples where the satellite is sunlit and the observer is in darkness."""
    return [s for s in samples if s.sunlit and s.observer_dark]


def filter_passes(
    passes: list[Pass],
    tle: TLE,
    observer: Observer,
    *,
    mode: VisibilityMode,
    timescale: Timescale,
    ephemeris: SpiceKernel,
    min_magnitude: float | None = None,
    sample_dt_seconds: int = 5,
) -> list[Pass]:
    """Filter + annotate passes by visibility mode.

    Args:
        passes: List from `predict_passes`.
        tle: TLE matching those passes.
        observer: Observation location.
        mode: `"line-of-sight"` or `"naked-eye"`.
        timescale: Skyfield Timescale.
        ephemeris: Planetary ephemeris.
        min_magnitude: If set, drop passes whose `max_magnitude` exceeds
            this value (exceed = dimmer; remember magnitude is inverse).
        sample_dt_seconds: Sampling interval for the naked-eye test.

    Returns:
        Filtered list of `Pass`, possibly annotated with magnitude info.
    """
    if mode == "line-of-sight":
        return list(passes)

    result: list[Pass] = []
    for p in passes:
        samples = sample_track(
            tle,
            observer,
            p.rise.time,
            p.set.time,
            timescale=timescale,
            ephemeris=ephemeris,
            dt_seconds=sample_dt_seconds,
        )
        if not samples:
            continue
        visible = _sunlit_and_dark_samples(samples)
        if not visible:
            continue
        mags = [s.magnitude for s in visible if s.magnitude is not None]
        if not mags:
            continue
        max_mag = min(mags)  # brightest = smallest magnitude number
        sunlit_fraction = len(visible) / len(samples)

        if min_magnitude is not None and max_mag > min_magnitude:
            continue

        result.append(
            replace(
                p,
                max_magnitude=max_mag,
                sunlit_fraction=sunlit_fraction,
            )
        )
    return result
