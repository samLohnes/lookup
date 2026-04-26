"""Fuzzy satellite lookup — names, groups, and NORAD IDs.

Backed by an in-memory `CatalogIndex`. M1 ships a hardcoded
`DEFAULT_CATALOG` of ~20 well-known satellites and group labels;
M2 will replace this with a periodically-refreshed Celestrak-derived index.
"""
from __future__ import annotations

from dataclasses import dataclass

from rapidfuzz import fuzz, process
from rapidfuzz.utils import default_process

from core._types import CatalogHit, Resolution


@dataclass(frozen=True, slots=True)
class CatalogIndex:
    """An index of satellite names, group labels, and train queries.

    Args:
        satellites: Tuple of (display_name, norad_id) pairs.
        groups: Tuple of (group_name, tuple_of_norad_ids) pairs.
            Static curated sets (e.g. "stations") whose membership rarely
            changes.
        train_queries: Tuple of (display_name, query_kind) pairs. Each
            represents a dynamic phenomenon (e.g. currently-active
            Starlink trains) resolved at query time by core.trains.discovery.
    """

    satellites: tuple[tuple[str, int], ...]
    groups: tuple[tuple[str, tuple[int, ...]], ...]
    train_queries: tuple[tuple[str, str], ...] = ()


# Small, hand-curated catalog for M1. Covers the most common queries
# (ISS, Hubble) and a couple of groups (starlink, stations).
# M2 replaces this with a live Celestrak-backed index.
DEFAULT_CATALOG = CatalogIndex(
    satellites=(
        ("ISS (ZARYA)", 25544),
        ("HUBBLE SPACE TELESCOPE", 20580),
        ("TIANGONG", 48274),
        ("NOAA 19", 33591),
        ("LANDSAT 8", 39084),
        ("ENVISAT", 27386),
        ("TERRA", 25994),
        ("AQUA", 27424),
        ("ASTERIA", 43020),
    ),
    groups=(
        ("stations", (25544, 48274)),
        ("weather", (33591,)),
        ("earth-observation", (39084, 25994, 27424, 27386)),
    ),
    train_queries=(
        ("starlink (trains)", "starlink"),
    ),
)


def _try_parse_norad(query: str) -> int | None:
    """Return an integer NORAD ID if `query` is all digits, else None.

    Args:
        query: Stripped user input string.
    """
    q = query.strip()
    if q.isdigit():
        try:
            return int(q)
        except ValueError:
            return None
    return None


def fuzzy_search(query: str, *, catalog: CatalogIndex, limit: int = 10) -> list[CatalogHit]:
    """Return up to `limit` catalog hits, best-first, for the query.

    Exact NORAD-ID matches (digits only) are returned immediately with score 100.

    Within equal-score hits, train_query > group > satellite for sort priority.
    """
    q = query.strip()
    if not q:
        return []

    # Exact-NORAD shortcut
    norad = _try_parse_norad(q)
    if norad is not None:
        for name, nid in catalog.satellites:
            if nid == norad:
                return [
                    CatalogHit(
                        display_name=name,
                        match_type="satellite",
                        norad_ids=(nid,),
                        score=100.0,
                    )
                ]
        return [
            CatalogHit(
                display_name=f"NORAD {norad}",
                match_type="satellite",
                norad_ids=(norad,),
                score=100.0,
            )
        ]

    candidates: list[CatalogHit] = []

    # Fuzzy over satellite names
    sat_names = [s[0] for s in catalog.satellites]
    sat_ranked = process.extract(
        q, sat_names, scorer=fuzz.WRatio, processor=default_process,
        limit=limit, score_cutoff=60,
    )
    for display_name, score, idx in sat_ranked:
        _, nid = catalog.satellites[idx]
        candidates.append(
            CatalogHit(
                display_name=display_name,
                match_type="satellite",
                norad_ids=(nid,),
                score=float(score),
            )
        )

    # Fuzzy over group names
    group_names = [g[0] for g in catalog.groups]
    grp_ranked = process.extract(
        q, group_names, scorer=fuzz.WRatio, processor=default_process,
        limit=limit, score_cutoff=60,
    )
    for display_name, score, idx in grp_ranked:
        _, norad_ids = catalog.groups[idx]
        candidates.append(
            CatalogHit(
                display_name=display_name,
                match_type="group",
                norad_ids=norad_ids,
                score=float(score),
            )
        )

    # Fuzzy over train_query names
    train_names = [t[0] for t in catalog.train_queries]
    train_ranked = process.extract(
        q, train_names, scorer=fuzz.WRatio, processor=default_process,
        limit=limit, score_cutoff=60,
    )
    for display_name, score, idx in train_ranked:
        _, query_kind = catalog.train_queries[idx]
        candidates.append(
            CatalogHit(
                display_name=display_name,
                match_type="train_query",
                norad_ids=(),
                score=float(score),
                query_kind=query_kind,
            )
        )

    # Sort: descending score; train_query > group > satellite at equal score.
    _PRIORITY = {"train_query": 0, "group": 1, "satellite": 2}
    candidates.sort(key=lambda h: (-h.score, _PRIORITY[h.match_type]))
    return candidates[:limit]


def resolve(query: str, *, catalog: CatalogIndex) -> Resolution:
    """Resolve a query to a single/group/train_query interpretation.

    Picks the best hit from `fuzzy_search`. Raises `LookupError` if no hits.
    """
    hits = fuzzy_search(query, catalog=catalog)
    if not hits:
        raise LookupError(f"no match for query: {query!r}")
    best = hits[0]
    type_map = {"satellite": "single", "group": "group", "train_query": "train_query"}
    return Resolution(
        type=type_map[best.match_type],
        norad_ids=best.norad_ids,
        display_name=best.display_name,
        query_kind=best.query_kind,
    )
