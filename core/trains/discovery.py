"""Train discovery — resolve a train_query at runtime via live TLE state.

Pipeline:
    1. Map query_kind → Celestrak group name (e.g. "starlink" → "starlink").
    2. Fetch the live group via TLEFetcher.get_group_tles (24h-cached).
    3. Filter to the N most recent launches by international designator
       (rank-based, not date-based — TLE designators carry only year +
       launch_number, no day-of-year).
    4. Predict passes for those candidates over the user's window.
    5. Run group_into_trains to verify co-orbital geometry.
    6. Return only the resulting TrainPass items (size-1 clusters dropped).
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Final

from skyfield.api import Timescale
from skyfield.jpllib import SpiceKernel

from core._types import HorizonMask, Observer, Pass, TLE, TrainPass
from core.catalog.fetcher import TLEFetcher
from core.catalog.tle_designator import parse_designator
from core.orbital.passes import predict_passes
from core.trains.clustering import group_into_trains

_GROUP_FOR: Final[dict[str, str]] = {
    "starlink": "starlink",
}


def discover_trains(
    query_kind: str,
    observer: Observer,
    start: datetime,
    end: datetime,
    *,
    tle_fetcher: TLEFetcher,
    timescale: Timescale,
    ephemeris: SpiceKernel,
    horizon_mask: HorizonMask | None = None,
    n_recent_launches: int = 3,
) -> list[TrainPass]:
    """Discover currently-active trains for a given `query_kind`.

    Args:
        query_kind: Catalog identifier (e.g. "starlink").
        observer, start, end: Same as predict_passes.
        tle_fetcher: Reused TLE fetcher (provides 24h Celestrak cache).
        timescale, ephemeris: Skyfield deps.
        horizon_mask: Optional terrain mask for pass detection.
        n_recent_launches: Keep sats from the N most recent launches
            (sorted by (year, launch_number) descending). Defaults to 3.

    Returns:
        list[TrainPass], possibly empty. Single-sat clusters from
        group_into_trains are dropped — only true trains are returned.
    """
    if query_kind not in _GROUP_FOR:
        raise ValueError(f"unknown train query_kind: {query_kind!r}")

    group_name = _GROUP_FOR[query_kind]
    all_tles, _age = tle_fetcher.get_group_tles(group_name)

    candidates = _filter_to_recent_launches(all_tles, n_recent_launches)

    all_passes: list[Pass] = []
    for tle in candidates:
        all_passes.extend(predict_passes(
            tle, observer, start, end,
            timescale=timescale,
            ephemeris=ephemeris,
            horizon_mask=horizon_mask,
        ))

    all_passes.sort(key=lambda p: p.rise.time)
    grouped = group_into_trains(all_passes)
    return [event for event in grouped if isinstance(event, TrainPass)]


def _filter_to_recent_launches(
    tles: list[TLE],
    n_recent_launches: int,
) -> list[TLE]:
    """Group TLEs by (year, launch_number); keep those in the top N keys."""
    by_launch: dict[tuple[int, int], list[TLE]] = defaultdict(list)
    for tle in tles:
        parsed = parse_designator(tle.line1)
        if parsed is None:
            continue
        year, launch_number, _piece = parsed
        by_launch[(year, launch_number)].append(tle)

    recent_keys = sorted(by_launch.keys(), reverse=True)[:n_recent_launches]
    return [tle for key in recent_keys for tle in by_launch[key]]
