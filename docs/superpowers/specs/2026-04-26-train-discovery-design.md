# Train Discovery Design

**Status:** Drafted 2026-04-26. Follows engine-accuracy + pass-row truthfulness (merged 2026-04-26).

**Goal:** Replace the broken hardcoded "starlink" catalog group with first-class train discovery. The catalog gains a third resolution kind, `train_query`, that runs a discovery routine at query time — fetching the live Celestrak Starlink fleet, recency-filtering by international designator launch rank, and verifying co-orbital geometry via the existing `group_into_trains` clustering. Picking `starlink (trains)` from the search returns currently-active Starlink trains; an empty result renders an informational empty state.

**Architecture:** The catalog stops conflating "static named sets" (stations) with "dynamic computed phenomena" (Starlink trains). `Resolution.type` extends to `Literal["single", "group", "train_query"]`; a new `core/trains/discovery.py` module orchestrates the discovery pipeline. The `/passes` route branches on resolution type to call discovery for `train_query`. The cinematic right panel uses the existing `PassList` for non-empty train results and a new informational `EmptyTrains` component for empty results. The "all Starlinks" / firehose UI / mitigation pipeline are explicitly out of scope: a user who wants a specific Starlink uses NORAD-ID lookup or name search, both of which the existing single-sat path handles.

**Tech Stack:** Python 3.12, skyfield, FastAPI/Pydantic. React 19 + Tailwind. No new dependencies.

---

## 1. Context

[`docs/follow-ups.md`](../../docs/follow-ups.md) documents that picking "starlink" from the search dropdown never produces a `TrainPass`. Root cause analysis (this brainstorming session) traced the chain:

- [`core/catalog/search.py:47`](../../core/catalog/search.py) hardcodes `("starlink", (44713, 44714, 44715, 44716, 44717))` — five NORAD IDs from a 2019 Starlink-1 launch.
- After ~7 years, those sats have spread out enough that their rise times for any observer are minutes apart, not seconds.
- [`core/trains/clustering.group_into_trains`](../../core/trains/clustering.py) requires consecutive passes within 60 s rise time AND 2° peak azimuth (lines 96–99). The 5 sats fail the predicate.
- All clusters end up size-1 → no `TrainPass` emitted.

The follow-up writeup proposes "live-fetch the Starlink group from Celestrak" as the fix. That's a band-aid: it treats "starlink" as a static set of NORAD IDs that just happens to be refreshed live, when the user's actual intent — "show me current Starlink trains" — is *categorically* about transient orbital state, not about which sats. Any list, hardcoded or live-fetched, goes stale the moment the chosen sats spread out.

The fix is to teach the catalog that some queries don't reduce to a NORAD list — they reduce to "ask the train discovery service."

---

## 2. Goals & Non-Goals

### 2.1 Goals

1. **Add `Resolution.type = "train_query"`** as a first-class third kind alongside `single` and `group`. `Resolution` gains an optional `query_kind: str | None` (e.g., `"starlink"`) that the discovery service interprets.
2. **`CatalogIndex` gains `train_queries: tuple[tuple[str, str], ...]`** — pairs of `(display_name, query_kind)`. Fuzzy search indexes train queries alongside satellites and groups, ranked first within equal-score buckets.
3. **One new default catalog entry:** `("starlink (trains)", "starlink")` as a `train_query`. Removes the broken hardcoded `("starlink", (44713, ..., 44717))` group entry.
4. **New module `core/trains/discovery.py`** with one public function `discover_trains(query_kind, observer, start, end, *, tle_fetcher, timescale, ephemeris, horizon_mask=None, n_recent_launches=3) -> list[TrainPass]`. Uses the hybrid heuristic: rank-based recency filter on international designator (keep sats from the N most recent launches) → predict passes → `group_into_trains` verifies co-orbital geometry → return only `TrainPass` items. Rank-based rather than date-based because international designators carry only `(year, launch_number)` — no day-of-year — so a launched-within-N-days filter cannot be derived from a TLE alone.
5. **`/passes` route gains a `train_query` branch** that calls `discover_trains` and returns trains-only. `single` and `group` paths unchanged.
6. **`EmptyTrains` component** in the cinematic panel renders informational text when a `train_query` returns `[]`. No CTA, no fallback. Title: "No active Starlink trains"; subtitle explains trains form within ~30 days of a launch and suggests checking back when there's a recent launch.
7. **Integration test** (`tests/integration/test_train_query_returns_train.py`): synthetic Celestrak fixture with a co-orbital batch + `query="starlink (trains)"` POST `/passes` returns ≥ 1 `TrainPassResponse` and zero `PassResponse` items. This is the regression guard the original M1 placeholder lacked.

### 2.2 Non-goals

- **`starlink (all)` catalog entry / firehose UI / virtualized lists.** A user who wants a specific Starlink uses NORAD-ID lookup or name search (existing single-sat flow). "All Starlinks at once" is not a supported query in this spec. Can be added later as a separate spec if real users ask.
- **No new performance mitigation pipeline** (orbital-plane envelope, dimness pre-filter, result-count budget). The train_query path predicts ~30 sats — fast enough without mitigation. The mitigations were only needed for "all Starlinks."
- **No new response fields** (`truncated_at`, `window_narrowed`). `PassesResponse` schema unchanged.
- **No new frontend dependency** (`@tanstack/react-virtual` not added).
- **Research-mode integration.** New `EmptyTrains` lives in `web/src/components/cinematic/passes-panel/`. Research mode keeps its existing flow.
- **Per-launch discoverable trains** (e.g., `Starlink G10-24` as a separate searchable entry). Discovery flattens all current trains under one `starlink (trains)` umbrella.
- **Other train queries** — Iridium NEXT, OneWeb, etc. The architecture is general (`_GROUP_FOR` dict in `discovery.py`), but we ship `"starlink"` only.
- **"Last train detected: N days ago" empty-state context.** Adds non-trivial engine work for marginal UX gain.
- **Live launch-date metadata** from a non-Celestrak source. TLE international designator is sufficient.
- **Train affordance in `pass-row.tsx`** ([`docs/follow-ups.md`](../../docs/follow-ups.md) §2). Separate follow-up.

---

## 3. Catalog schema changes

### 3.1 `core/_types.py` — `Resolution`

Replace the existing `Resolution` dataclass (lines 148–154):

```python
@dataclass(frozen=True, slots=True)
class Resolution:
    """The resolved interpretation of a user query."""

    type: Literal["single", "group", "train_query"]
    norad_ids: tuple[int, ...]
    display_name: str
    query_kind: Optional[str] = None
```

`norad_ids` stays in the dataclass — populated for `single` and `group` resolutions; empty tuple for `train_query` (discovery decides which sats matter at query time, not the catalog). `query_kind` is populated only for `train_query` (e.g., `"starlink"`).

`CatalogHit` (also in `core/_types.py`) gains an optional `query_kind: Optional[str] = None` and its `match_type` literal extends to include `"train_query"`.

### 3.2 `core/catalog/search.py` — `CatalogIndex`

Replace the `CatalogIndex` dataclass (lines 17–27):

```python
@dataclass(frozen=True, slots=True)
class CatalogIndex:
    """An index of satellite names, group labels, and train queries."""

    satellites: tuple[tuple[str, int], ...]
    groups: tuple[tuple[str, tuple[int, ...]], ...]
    train_queries: tuple[tuple[str, str], ...]
```

`train_queries` is a tuple of `(display_name, query_kind)` pairs.

### 3.3 `DEFAULT_CATALOG`

Replace the existing `DEFAULT_CATALOG` (lines 33–51):

```python
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
```

The hardcoded `("starlink", (44713, 44714, 44715, 44716, 44717))` is removed. No `starlink (all)` entry — out of scope.

### 3.4 `fuzzy_search` and `resolve` updates

`fuzzy_search` (lines 69–143) gains a third pass over `train_queries` mirroring the existing satellite + group passes. New `CatalogHit.match_type` value: `"train_query"`. Sort priority within equal-score hits: `train_query` > `group` > `satellite`.

`resolve` (lines 146–164) maps the best hit's `match_type` to the corresponding `Resolution.type`:

```python
type_map = {"satellite": "single", "group": "group", "train_query": "train_query"}
return Resolution(
    type=type_map[best.match_type],
    norad_ids=best.norad_ids,
    display_name=best.display_name,
    query_kind=best.query_kind if best.match_type == "train_query" else None,
)
```

---

## 4. Discovery service

### 4.1 New module `core/trains/discovery.py`

```python
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
            (sorted by (year, launch_number) descending). Defaults to 3,
            which covers ~3 weeks of typical Starlink launch cadence.
            Rank-based rather than date-based: international designators
            carry only year + sequence, no day-of-year, so a
            launched-within-N-days filter is not derivable from a TLE.

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
    """Group TLEs by (year, launch_number); keep the N most recent groups."""
    by_launch: dict[tuple[int, int], list[TLE]] = defaultdict(list)
    for tle in tles:
        parsed = parse_designator(tle.line1)
        if parsed is None:
            continue
        year, launch_number, _piece = parsed
        by_launch[(year, launch_number)].append(tle)

    recent_keys = sorted(by_launch.keys(), reverse=True)[:n_recent_launches]
    return [tle for key in recent_keys for tle in by_launch[key]]
```

### 4.2 New module `core/catalog/tle_designator.py`

```python
"""Parse the international designator from TLE line 1 (cols 10-17).

Format: YY-NNN-PIECE  →  e.g. "25024A " for the 24th launch of 2025, piece A.

Used by `core/trains/discovery.py` to group sats by launch event for
rank-based recency filtering. Day-of-year is NOT available from the
designator — only year and launch sequence — so callers cannot derive
an absolute launch date.
"""
from __future__ import annotations


def parse_designator(line1: str) -> tuple[int, int, str] | None:
    """Parse cols 10-17 of TLE line 1.

    Format: YY-NNN-PIECE  →  e.g. line1[9:17] = "25024A  " for the 24th
    launch of 2025, piece A. The two-digit year follows skyfield's
    convention: <57 → 20xx, else 19xx.

    Returns:
        (launch_year_4digit, launch_number, piece) or None if unparseable.
    """
    if len(line1) < 17:
        return None
    raw = line1[9:17]  # 8 chars, 0-indexed slice
    yy_str = raw[:2].strip()
    nnn_str = raw[2:5].strip()
    piece = raw[5:].strip()
    if not (yy_str.isdigit() and nnn_str.isdigit()):
        return None
    yy = int(yy_str)
    year = 2000 + yy if yy < 57 else 1900 + yy
    return year, int(nnn_str), piece
```

---

## 5. Performance budget

| Path | Worst-case sats predicted | 24 h window | 7 d window |
|---|---|---|---|
| `train_query "starlink"` | ~30 (recency-filtered to top 3 launches) | 1–3 s | 5–15 s |
| `single` / `group` (existing) | unchanged | unchanged | unchanged |

Performance is comfortable without further mitigation. The 24h Celestrak group cache absorbs the dominant fetch cost; `n_recent_launches=3` bounds the predicted set tightly. If future train_queries emerge with more candidates per launch (e.g., Starship-class deployments with 100+ sats), the performance budget will be revisited then, not preemptively.

---

## 6. API route changes

`api/routes/passes.py` gets a third branch on `resolution.type`:

```python
if resolution.type == "single":
    # unchanged — fetch single TLE, predict, filter
    ...
elif resolution.type == "train_query":
    train_passes = discover_trains(
        query_kind=resolution.query_kind,
        observer=observer,
        start=req.from_utc,
        end=req.to_utc,
        tle_fetcher=tle_fetcher,
        timescale=timescale,
        ephemeris=ephemeris,
        horizon_mask=horizon,
    )
    items: list[Union[PassResponse, TrainPassResponse]] = [
        trainpass_to_response(tp) for tp in train_passes
    ]
    return PassesResponse(
        query=req.query,
        resolved_name=resolution.display_name,
        passes=items,
        tle_age_seconds=None,
    )

else:  # resolution.type == "group" — unchanged
    group_tles, age = tle_fetcher.get_group_tles(resolution.display_name)
    wanted = set(resolution.norad_ids)
    tles.extend(t for t in group_tles if t.norad_id in wanted)
    ages.append(age)
    # ... existing predict + filter loop ...
```

Two structural decisions baked in:

1. **`train_query` ignores caller-supplied `min_magnitude` / `min_peak_elevation_deg`.** The clustering predicate (60 s rise gap, 2° peak az) is the qualification — re-applying mag/el filters on top would silently drop trains containing bright sats next to dim ones. Group defaults at [`api/routes/passes.py:31-32`](../../api/routes/passes.py) only apply to `group` resolutions.
2. **`PassesResponse` schema unchanged.** No new fields. Only the branching behavior changes.

---

## 7. Frontend

### 7.1 New component — `EmptyTrains`

`web/src/components/cinematic/passes-panel/empty-trains.tsx`:

Centered card rendered when `train_query` returns `passes.length === 0`. No CTA, no interactive elements. Static informational content:

- **Title** (Fraunces serif, 16px, muted): "No active Starlink trains"
- **Subtitle** (11px, more muted, max-width 260px, centered): "Trains form within the first ~30 days of a SpaceX launch. None visible from your location in this window — check back when there's been a recent launch."

Visual treatment matches the existing cinematic empty-state aesthetic (e.g., the current `pass-list.tsx` line 30–35 "No passes tonight" pattern).

### 7.2 Mode switching in `passes-panel.tsx`

`web/src/components/cinematic/passes-panel/passes-panel.tsx` decides which list to render:

```tsx
const passes = data?.passes ?? [];
const resolvedName = data?.resolved_name ?? "";
const isTrainQuery = resolvedName === "starlink (trains)";

if (isTrainQuery && passes.length === 0) return <EmptyTrains />;
return <PassList />;  // existing component, unchanged for all other paths
```

For `train_query`-with-results, the existing `<PassList>` renders unchanged — `PassRow` already handles `kind === "train"` (with the known follow-up to add a "{N} objects" affordance, out of scope here).

### 7.3 Fuzzy search dropdown

The existing `SatelliteSearchBody` (`web/src/components/satellite/satellite-search-body.tsx`) renders fuzzy hits from `/catalog/search`. The catalog endpoint's response shape (`CatalogHitResponse`) already has `match_type: "satellite" | "group"`; extend to `"satellite" | "group" | "train_query"`. The frontend renders the new `train_query` hits with the same row component as groups — no visual differentiation needed; the parenthetical `(trains)` in the display name is sufficient.

`api/schemas/responses.py` `CatalogHitResponse.match_type` literal extends to include `"train_query"`. `api/routes/catalog.py` needs no logic change beyond passing through the new hit type — `fuzzy_search` already returns the new entries; the route just serializes whatever it gets.

### 7.4 Type updates — `web/src/types/api.ts`

`PassesResponseBody` is unchanged (no new fields). `CatalogHitResponse.match_type` literal extends to include `"train_query"`.

### 7.5 No new frontend dependency

`@tanstack/react-virtual` is **not** added. No new packages.

---

## 8. Testing strategy

### 8.1 Unit (Python)

- **`tests/unit/test_tle_designator.py`** — designator parsing edge cases: year boundaries (yy=56 vs 57), malformed inputs (non-digit fields), missing piece char, line1 too short. Asserts the same `(year, launch_number)` is returned for all sats in the same launch (used for grouping in discovery).
- **`tests/unit/test_discovery.py`** — `discover_trains` with synthetic Celestrak-shaped fixtures via `httpx.MockTransport`:
  - Fixture A: known-recent batch (designators with the highest `(year, launch_number)` in the catalog) that should cluster → returns ≥ 1 `TrainPass`.
  - Fixture B: catalog where all batches are old or scattered → rank-based filter still keeps the top N, but if those don't cluster, returns `[]`. Verifies rank filtering doesn't artificially preserve unclustered sats.
  - Fixture C: recent batch but sats already dispersed (synthetic TLEs with rise times far apart) → clustering verification drops them, returns `[]`.
  - Fixture D: empty Celestrak response → returns `[]` cleanly, no exception.
  - Fixture E: `n_recent_launches=2` correctly limits to the two highest `(year, launch_number)` keys when more exist.
- **`tests/unit/test_search_train_queries.py`** — `fuzzy_search` returns the new `starlink (trains)` entry when query is `"starlink"` or `"star"`. Sort priority places `train_query` hits ahead of `group` hits at equal scores.

### 8.2 Integration (Python)

- **`tests/integration/test_train_query_returns_train.py`** — synthetic Celestrak fixture with a co-orbital batch + `POST /passes` with `query="starlink (trains)"` returns ≥ 1 `TrainPassResponse` and zero `PassResponse` items. **Regression guard.**
- **`tests/integration/test_train_query_empty.py`** — fixture with no recent launches OR with recent batches that don't cluster; `train_query` returns empty `passes`, no error, no auto-fallback.

### 8.3 Component (TypeScript)

- **`empty-trains.test.tsx`** — renders title and subtitle text; no buttons or interactive elements present (asserts the no-CTA design).
- **`pass-list.test.tsx`** — add a test case for the small `train_query`-with-results path (existing `<PassList>` renders normally with `TrainPassResponse` items).

### 8.4 Existing tests requiring updates

- **`tests/unit/test_search.py`** — assertions about `DEFAULT_CATALOG.groups` change. Remove the test for the hardcoded `("starlink", (44713, ...))` entry. Add coverage for `train_queries` field shape.

### 8.5 Tests not affected

- **Golden fixture (`tests/golden/test_iss_nyc.py`)** — exercises `predict_passes` directly with a single TLE, no catalog/discovery flow involved. No changes.
- **Existing `tests/unit/test_clustering.py`** — `group_into_trains` is unchanged. No changes.

---

## 9. Files touched

**New (Python):**

- `core/trains/discovery.py`
- `core/catalog/tle_designator.py`
- `tests/unit/test_tle_designator.py`
- `tests/unit/test_discovery.py`
- `tests/unit/test_search_train_queries.py`
- `tests/integration/test_train_query_returns_train.py`
- `tests/integration/test_train_query_empty.py`

**Modified (Python):**

- `core/_types.py` — `Resolution` extends to `train_query`; `CatalogHit` gains `query_kind` + extended `match_type` literal
- `core/catalog/search.py` — `CatalogIndex.train_queries` field; `fuzzy_search` third pass; `resolve` maps new type; `DEFAULT_CATALOG` updated
- `api/routes/passes.py` — three-way branch on resolution type
- `api/schemas/responses.py` — `CatalogHitResponse.match_type` literal extended
- `tests/unit/test_search.py` — assertions updated for new catalog shape

**New (TypeScript):**

- `web/src/components/cinematic/passes-panel/empty-trains.tsx`
- `web/src/components/cinematic/passes-panel/empty-trains.test.tsx`

**Modified (TypeScript):**

- `web/src/components/cinematic/passes-panel/passes-panel.tsx` — mode switching for `train_query` empty state
- `web/src/types/api.ts` — `CatalogHitResponse.match_type` literal extended
- `web/src/components/satellite/satellite-search-body.tsx` — handles `train_query` `match_type` (existing render path is fine; only the type narrowing changes)

---

## 10. Open questions

None at draft time. All design decisions resolved during brainstorming (Q1–Q6 + scope-narrowing decision to drop firehose).
