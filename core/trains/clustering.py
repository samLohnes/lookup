"""Heuristic: cluster near-simultaneous + near-parallel passes into `TrainPass`.

A "train" is a group of satellites launched together that are still
co-flying — their passes happen within seconds of each other along
essentially the same ground track. The heuristic:

    - Sort passes by rise time.
    - For each pass, if it fits into the current cluster (rise time within
      `time_window_s` of the last member AND peak azimuth within
      `angle_window_deg`), add it. Otherwise, close the current cluster
      and start a new one with this pass.
    - Clusters of size 1 emit the original `Pass`. Clusters of size >1
      emit a `TrainPass`.
"""
from __future__ import annotations

from typing import Union

from core._types import Pass, PassEndpoint, TrainPass

_DEFAULT_TIME_WINDOW_S = 60.0
_DEFAULT_ANGLE_WINDOW_DEG = 2.0


def _az_diff(a: float, b: float) -> float:
    """Smallest absolute azimuth difference in degrees, accounting for wrap."""
    d = abs((a - b) % 360.0)
    return min(d, 360.0 - d)


def _trainpass_from_cluster(cluster: list[Pass]) -> TrainPass:
    """Envelope a cluster of Pass objects into one TrainPass."""
    rises = sorted(cluster, key=lambda p: p.rise.time)
    sets = sorted(cluster, key=lambda p: p.set.time)
    peaks_by_el = sorted(cluster, key=lambda p: p.peak.position.elevation_deg, reverse=True)

    earliest_rise = rises[0].rise
    latest_set = sets[-1].set
    # Representative peak: the member whose peak elevation is highest.
    rep_peak: PassEndpoint = peaks_by_el[0].peak

    magnitudes = [p.max_magnitude for p in cluster if p.max_magnitude is not None]
    max_mag = min(magnitudes) if magnitudes else None

    # ID derived from the earliest rise for stability.
    first = rises[0]
    id_ = f"train-{first.rise.time.strftime('%Y%m%d%H%M%S')}"

    names = sorted({p.name.split("-")[0] for p in cluster})  # e.g. {"STARLINK"}
    if len(names) == 1:
        train_name = f"{names[0]} train ({len(cluster)} objects)"
    else:
        train_name = f"Mixed train ({len(cluster)} objects)"

    duration_s = int(round((latest_set.time - earliest_rise.time).total_seconds()))

    return TrainPass(
        id=id_,
        name=train_name,
        member_norad_ids=tuple(p.norad_id for p in rises),
        rise=earliest_rise,
        peak=rep_peak,
        set=latest_set,
        duration_s=duration_s,
        max_magnitude=max_mag,
        member_passes=tuple(rises),
    )


def group_into_trains(
    passes: list[Pass],
    *,
    time_window_s: float = _DEFAULT_TIME_WINDOW_S,
    angle_window_deg: float = _DEFAULT_ANGLE_WINDOW_DEG,
) -> list[Union[Pass, TrainPass]]:
    """Cluster co-flying passes into `TrainPass`, leave outliers as `Pass`.

    Args:
        passes: List of individual `Pass` objects; need not be pre-sorted.
        time_window_s: Max gap between consecutive rises within a cluster.
        angle_window_deg: Max peak-azimuth spread within a cluster.

    Returns:
        Mixed list of `Pass` and `TrainPass`, sorted by rise time.
    """
    if not passes:
        return []

    sorted_passes = sorted(passes, key=lambda p: p.rise.time)

    out: list[Union[Pass, TrainPass]] = []
    cluster: list[Pass] = [sorted_passes[0]]

    for p in sorted_passes[1:]:
        last = cluster[-1]
        time_gap = (p.rise.time - last.rise.time).total_seconds()
        az_gap = _az_diff(p.peak.position.azimuth_deg, last.peak.position.azimuth_deg)

        if time_gap <= time_window_s and az_gap <= angle_window_deg:
            cluster.append(p)
        else:
            if len(cluster) == 1:
                out.append(cluster[0])
            else:
                out.append(_trainpass_from_cluster(cluster))
            cluster = [p]

    # Flush the final cluster.
    if len(cluster) == 1:
        out.append(cluster[0])
    else:
        out.append(_trainpass_from_cluster(cluster))

    return out
