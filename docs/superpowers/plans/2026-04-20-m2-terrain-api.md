# M2 — Terrain + API: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the M1 engine with live Celestrak TLE fetching (with disk cache + polite refresh), Copernicus DEM-based horizon masks (with disk cache), Starlink train clustering, and a local FastAPI layer exposing `/passes`, `/sky-track`, `/horizon`, and `/tle-freshness` — all reachable via `curl` on `localhost` after one launcher command.

**Architecture:** New code lives in three places: `core/catalog/` (gains a Celestrak client + TLE cache + orchestrator), a new `core/terrain/` subpackage (DEM fetch + horizon math + two caches), and a new `core/trains/` subpackage (pure clustering heuristic). A new `api/` top-level package wraps the engine behind FastAPI, with Pydantic schemas handling (de)serialisation. All network I/O is isolated in thin client modules so the math remains pure-function. Tests mock network at the httpx transport layer — no real calls in the suite.

**Tech Stack:** `httpx` (HTTP client), `rasterio` + `numpy` (DEM processing), `fastapi` + `uvicorn` + `pydantic-settings` (API). All other M2 deps are already installed from M1.

---

## File Structure

```
core/
├── _types.py                     # modify: add TrainPass, DEM
├── visibility/
│   └── __init__.py               # modify: drop filter_passes re-export (breaks M1 lazy-import workaround)
├── catalog/
│   ├── celestrak.py              # NEW: thin httpx client, no cache, no rate limiting
│   ├── tle_cache.py              # NEW: disk cache at ~/.satvis/tle-cache/
│   └── fetcher.py                # NEW: get_tle + get_group_tles with 24h refresh + ≤2 req/s guard
├── terrain/
│   ├── __init__.py               # NEW
│   ├── opentopo.py               # NEW: OpenTopography DEM fetch (GeoTIFF)
│   ├── dem_cache.py              # NEW: disk cache at ~/.satvis/dem-cache/
│   ├── horizon.py                # NEW: compute_horizon_mask from DEM (pure numpy)
│   ├── mask_cache.py             # NEW: disk cache at ~/.satvis/horizon-cache/
│   └── fetcher.py                # NEW: get_horizon_mask orchestrator
└── trains/
    ├── __init__.py               # NEW
    └── clustering.py             # NEW: group_into_trains heuristic

api/
├── __init__.py                   # NEW
├── app.py                        # NEW: FastAPI app factory + DI wiring
├── settings.py                   # NEW: pydantic-settings
├── deps.py                       # NEW: dependency providers for get_tle / get_horizon_mask
├── schemas/
│   ├── __init__.py               # NEW
│   ├── requests.py               # NEW: PassesRequest, SkyTrackRequest
│   └── responses.py              # NEW: PassResponse, TrainPassResponse, TrackSampleResponse, etc.
└── routes/
    ├── __init__.py               # NEW
    ├── passes.py                 # NEW: POST /passes
    ├── sky_track.py              # NEW: POST /sky-track
    ├── horizon.py                # NEW: GET /horizon
    └── tle_freshness.py          # NEW: GET /tle-freshness

tests/
├── conftest.py                   # modify: add http mock helpers, dem synthesiser
├── unit/
│   ├── test_celestrak.py         # NEW
│   ├── test_tle_cache.py         # NEW
│   ├── test_tle_fetcher.py       # NEW
│   ├── test_opentopo.py          # NEW
│   ├── test_dem_cache.py         # NEW
│   ├── test_horizon.py           # NEW
│   ├── test_mask_cache.py        # NEW
│   ├── test_terrain_fetcher.py   # NEW
│   └── test_trains.py            # NEW
├── integration/
│   ├── __init__.py               # NEW
│   └── test_api_end_to_end.py    # NEW: FastAPI TestClient with faked upstreams
├── api_unit/
│   ├── __init__.py               # NEW
│   ├── test_schemas.py           # NEW
│   ├── test_passes_route.py      # NEW
│   ├── test_sky_track_route.py   # NEW
│   ├── test_horizon_route.py     # NEW
│   └── test_tle_freshness_route.py  # NEW
└── fixtures/
    ├── celestrak/
    │   ├── iss_single.json       # NEW: Celestrak GP JSON for NORAD 25544
    │   └── stations_group.json   # NEW: Celestrak group response for stations
    └── dem/
        └── synth_manhattan.tif   # generated in conftest, not committed

scripts/
└── serve.sh                      # NEW: one-command launcher (uvicorn)

docs/accuracy-log.md              # modify: add M2 verification placeholder
```

---

## Conventions for this plan

- **Each code step shows the full contents** of the file being written (not a diff). Tasks are safe to execute out of order this way.
- **All exact commands assume** the engineer has already run `source .venv/bin/activate` in the project root.
- **Network is never hit in tests.** Every test that touches `httpx` uses `httpx.MockTransport` with a fixture or inline response.
- **One commit per task** minimum; the final step of each task commits.
- **Commit messages:** brief, single-line conventional commits. No body, no co-author trailer. (User preference, matches M1.)

---

## Task 0: Unblock M1's lazy-import workaround

M1 Task 11 installed a `__getattr__` lazy-loader in `core/visibility/__init__.py` to dodge a real circular import (`tracking → darkness` collides with `visibility/__init__ → filter → tracking`). The simplest clean break: stop re-exporting `filter_passes` from `core.visibility`. Callers can still `from core.visibility.filter import filter_passes` directly.

**Files:**
- Modify: `core/visibility/__init__.py`

- [ ] **Step 1: Overwrite `core/visibility/__init__.py`**

Full contents:

```python
"""Visibility — darkness, sunlit, magnitude.

Note: `filter_passes` is intentionally NOT re-exported here. It depends on
`core.orbital.tracking`, which in turn depends on this package; re-exporting
`filter_passes` from the package root creates a circular import during module
load. Import it directly from `core.visibility.filter` instead.
"""
from core.visibility.darkness import (
    ASTRONOMICAL_TWILIGHT_DEG,
    CIVIL_TWILIGHT_DEG,
    NAUTICAL_TWILIGHT_DEG,
    is_observer_in_darkness,
)
from core.visibility.magnitude import (
    DEFAULT_INTRINSIC_MAGNITUDE,
    ISS_INTRINSIC_MAGNITUDE,
    compute_magnitude,
)
from core.visibility.sunlit import is_satellite_sunlit

__all__ = [
    "ASTRONOMICAL_TWILIGHT_DEG",
    "CIVIL_TWILIGHT_DEG",
    "DEFAULT_INTRINSIC_MAGNITUDE",
    "ISS_INTRINSIC_MAGNITUDE",
    "NAUTICAL_TWILIGHT_DEG",
    "compute_magnitude",
    "is_observer_in_darkness",
    "is_satellite_sunlit",
]
```

- [ ] **Step 2: Verify imports still work via the submodule path**

```bash
python -c "from core.visibility.filter import filter_passes; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Full test suite — no regressions**

```bash
pytest -q
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add core/visibility/__init__.py
git commit -m "refactor(visibility): drop filter_passes from package root to break M1 cycle"
```

---

## Task 1: Shared dataclass additions (`TrainPass`, `DEM`)

**Files:**
- Modify: `core/_types.py`
- Test: `tests/unit/test_types.py` (add cases)

- [ ] **Step 1: Extend the type test suite**

Append to `tests/unit/test_types.py`:

```python
# --- M2 additions below ---

import numpy as np

from core._types import DEM, TrainPass


def test_train_pass_construction():
    t0 = datetime(2026, 5, 1, 2, 0, 0, tzinfo=timezone.utc)
    t1 = datetime(2026, 5, 1, 2, 2, 30, tzinfo=timezone.utc)
    t2 = datetime(2026, 5, 1, 2, 5, 0, tzinfo=timezone.utc)

    members = (
        Pass(
            id="44713-20260501020000",
            norad_id=44713,
            name="STARLINK-1",
            rise=PassEndpoint(time=t0, position=AngularPosition(10.0, 10.0)),
            peak=PassEndpoint(time=t1, position=AngularPosition(180.0, 60.0)),
            set=PassEndpoint(time=t2, position=AngularPosition(350.0, 10.0)),
            duration_s=300,
            max_magnitude=4.0,
            sunlit_fraction=1.0,
            tle_epoch=t0,
            terrain_blocked_ranges=(),
        ),
    )

    tp = TrainPass(
        id="starlink-train-20260501020000",
        name="Starlink-L175 train",
        member_norad_ids=(44713, 44714, 44715),
        rise=PassEndpoint(time=t0, position=AngularPosition(10.0, 10.0)),
        peak=PassEndpoint(time=t1, position=AngularPosition(180.0, 60.0)),
        set=PassEndpoint(time=t2, position=AngularPosition(350.0, 10.0)),
        duration_s=300,
        max_magnitude=4.0,
        member_passes=members,
    )

    assert tp.name == "Starlink-L175 train"
    assert tp.member_norad_ids == (44713, 44714, 44715)
    assert tp.peak.position.elevation_deg == 60.0
    assert tp.member_passes == members


def test_dem_construction_and_sampling():
    # 3×3 synthetic grid at (0°, 0°) with 1 m spacing per sample.
    elevations = np.array(
        [[100.0, 110.0, 120.0],
         [105.0, 115.0, 125.0],
         [108.0, 118.0, 128.0]],
        dtype=np.float32,
    )
    dem = DEM(
        south_lat=0.0,
        north_lat=1e-5,
        west_lng=0.0,
        east_lng=1e-5,
        elevations=elevations,
    )
    assert dem.shape == (3, 3)
    assert dem.elevations[1, 1] == 115.0
```

- [ ] **Step 2: Run — should fail (missing imports)**

```bash
pytest tests/unit/test_types.py -v
```

Expected: `ImportError` on `TrainPass` or `DEM`.

- [ ] **Step 3: Append to `core/_types.py`**

Add at the bottom of `core/_types.py`:

```python
# ---------------------------------------------------------------------------
# M2 additions
# ---------------------------------------------------------------------------
try:
    import numpy as _np  # imported lazily so core/_types.py stays light
    _HAS_NUMPY = True
except ImportError:  # pragma: no cover
    _HAS_NUMPY = False


@dataclass(frozen=True, slots=True)
class TrainPass:
    """An aggregated pass event representing a co-flying batch of satellites.

    Produced by `core.trains.clustering.group_into_trains` when multiple
    individual passes have near-simultaneous rises and parallel ground
    tracks (e.g. a freshly-launched Starlink train).

    The rise/peak/set endpoints are the envelope of the member passes:
    earliest rise, latest set, median-ish peak.
    """

    id: str
    name: str
    member_norad_ids: tuple[int, ...]
    rise: "PassEndpoint"
    peak: "PassEndpoint"
    set: "PassEndpoint"
    duration_s: int
    max_magnitude: Optional[float]
    member_passes: tuple["Pass", ...]


@dataclass(frozen=True, slots=True)
class DEM:
    """A raster elevation tile covering a geographic bounding box.

    Attributes:
        south_lat, north_lat: WGS84 latitude bounds in degrees.
        west_lng, east_lng: WGS84 longitude bounds in degrees.
        elevations: 2-D float32 numpy array, shape (rows, cols). `elevations[0,0]`
            is the north-west corner; rows increase southward, cols eastward.
    """

    south_lat: float
    north_lat: float
    west_lng: float
    east_lng: float
    elevations: "object"  # Typed loosely to avoid forcing numpy imports at type-check time.

    @property
    def shape(self) -> tuple[int, int]:
        """(rows, cols) of the underlying array."""
        return tuple(self.elevations.shape)  # type: ignore[attr-defined]
```

- [ ] **Step 4: Run — should pass**

```bash
pytest tests/unit/test_types.py -v
```

Expected: all tests pass including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add core/_types.py tests/unit/test_types.py
git commit -m "feat(core): add TrainPass and DEM dataclasses"
```

---

## Task 2: Celestrak HTTP client

A thin wrapper over the Celestrak GP API. No cache, no rate-limiting, no retry — just "give me a URL or (group|norad), get back parsed TLEs." Caching + rate-limiting live in the orchestrator (Task 4).

**Files:**
- Create: `core/catalog/celestrak.py`
- Create: `tests/fixtures/celestrak/iss_single.json`
- Create: `tests/fixtures/celestrak/stations_group.json`
- Test: `tests/unit/test_celestrak.py`

- [ ] **Step 1: Create Celestrak fixture files**

`tests/fixtures/celestrak/iss_single.json`:

```json
[
  {
    "OBJECT_NAME": "ISS (ZARYA)",
    "OBJECT_ID": "1998-067A",
    "EPOCH": "2026-04-20T18:43:46.346592",
    "MEAN_MOTION": 15.5,
    "ECCENTRICITY": 0.0006726,
    "INCLINATION": 51.6406,
    "RA_OF_ASC_NODE": 224.2064,
    "ARG_OF_PERICENTER": 330.9385,
    "MEAN_ANOMALY": 29.0851,
    "EPHEMERIS_TYPE": 0,
    "CLASSIFICATION_TYPE": "U",
    "NORAD_CAT_ID": 25544,
    "ELEMENT_SET_NO": 999,
    "REV_AT_EPOCH": 50000,
    "BSTAR": 0.00018,
    "MEAN_MOTION_DOT": 0.0001,
    "MEAN_MOTION_DDOT": 0,
    "TLE_LINE0": "ISS (ZARYA)",
    "TLE_LINE1": "1 25544U 98067A   26110.78039753  .00010000  00000-0  18000-3 0  9990",
    "TLE_LINE2": "2 25544  51.6406 224.2064 0006726 330.9385  29.0851 15.50000000 99990"
  }
]
```

`tests/fixtures/celestrak/stations_group.json`:

```json
[
  {
    "OBJECT_NAME": "ISS (ZARYA)",
    "NORAD_CAT_ID": 25544,
    "TLE_LINE0": "ISS (ZARYA)",
    "TLE_LINE1": "1 25544U 98067A   26110.78039753  .00010000  00000-0  18000-3 0  9990",
    "TLE_LINE2": "2 25544  51.6406 224.2064 0006726 330.9385  29.0851 15.50000000 99990"
  },
  {
    "OBJECT_NAME": "TIANGONG",
    "NORAD_CAT_ID": 48274,
    "TLE_LINE0": "TIANGONG",
    "TLE_LINE1": "1 48274U 21035A   26110.50000000  .00020000  00000-0  30000-3 0  9991",
    "TLE_LINE2": "2 48274  41.4700 100.0000 0002000  90.0000 270.0000 15.60000000 12345"
  }
]
```

- [ ] **Step 2: Write the failing tests**

Create `tests/unit/test_celestrak.py`:

```python
"""Tests for core.catalog.celestrak."""
from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from core.catalog.celestrak import (
    CelestrakClient,
    CelestrakError,
    celestrak_url,
)

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "celestrak"


def _mock_transport_from_file(path: Path, status: int = 200):
    body = path.read_text()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, text=body, headers={"content-type": "application/json"})

    return httpx.MockTransport(handler)


def test_url_for_single_norad():
    url = celestrak_url(norad_id=25544)
    assert "CATNR=25544" in url
    assert "FORMAT=json" in url


def test_url_for_group():
    url = celestrak_url(group="stations")
    assert "GROUP=stations" in url
    assert "FORMAT=json" in url


def test_url_raises_if_neither_given():
    with pytest.raises(ValueError, match="must specify"):
        celestrak_url()


def test_fetch_single_returns_one_tle():
    transport = _mock_transport_from_file(FIXTURES / "iss_single.json")
    client = CelestrakClient(transport=transport)

    tles = client.fetch_single(norad_id=25544)

    assert len(tles) == 1
    tle = tles[0]
    assert tle.norad_id == 25544
    assert tle.name == "ISS (ZARYA)"
    # Epoch parsed from TLE line 1
    assert tle.epoch.year == 2026


def test_fetch_group_returns_multiple_tles():
    transport = _mock_transport_from_file(FIXTURES / "stations_group.json")
    client = CelestrakClient(transport=transport)

    tles = client.fetch_group("stations")

    assert len(tles) == 2
    norad_ids = {t.norad_id for t in tles}
    assert norad_ids == {25544, 48274}


def test_fetch_raises_on_http_error():
    transport = _mock_transport_from_file(FIXTURES / "iss_single.json", status=500)
    client = CelestrakClient(transport=transport)

    with pytest.raises(CelestrakError, match="HTTP 500"):
        client.fetch_single(norad_id=25544)


def test_fetch_raises_on_empty_response():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="[]", headers={"content-type": "application/json"})

    client = CelestrakClient(transport=httpx.MockTransport(handler))

    with pytest.raises(CelestrakError, match="no results"):
        client.fetch_single(norad_id=99999)
```

- [ ] **Step 3: Run — expect ImportError**

```bash
pytest tests/unit/test_celestrak.py -v
```

Expected: `ModuleNotFoundError: No module named 'core.catalog.celestrak'`

- [ ] **Step 4: Implement `core/catalog/celestrak.py`**

```python
"""Thin Celestrak GP-API client.

Returns `TLE` objects parsed from Celestrak's JSON responses. No caching,
no retry, no rate-limiting — those belong to the orchestrator in
`core.catalog.fetcher`.
"""
from __future__ import annotations

from typing import Optional

import httpx

from core._types import TLE
from core.catalog.tle_parser import parse_tle

CELESTRAK_BASE_URL = "https://celestrak.org/NORAD/elements/gp.php"
DEFAULT_TIMEOUT_S = 15.0


class CelestrakError(RuntimeError):
    """Raised when a Celestrak fetch fails or returns no usable data."""


def celestrak_url(
    *,
    norad_id: Optional[int] = None,
    group: Optional[str] = None,
    base_url: str = CELESTRAK_BASE_URL,
) -> str:
    """Build a Celestrak GP URL for either a single NORAD ID or a group.

    Raises:
        ValueError: if both or neither of `norad_id`/`group` are given.
    """
    if (norad_id is None) == (group is None):
        raise ValueError("must specify exactly one of norad_id or group")
    if norad_id is not None:
        return f"{base_url}?CATNR={int(norad_id)}&FORMAT=json"
    return f"{base_url}?GROUP={group}&FORMAT=json"


class CelestrakClient:
    """Thin HTTP client returning parsed TLEs."""

    def __init__(
        self,
        *,
        base_url: str = CELESTRAK_BASE_URL,
        timeout_s: float = DEFAULT_TIMEOUT_S,
        transport: Optional[httpx.BaseTransport] = None,
    ) -> None:
        self._base_url = base_url
        self._client = httpx.Client(timeout=timeout_s, transport=transport)

    def _get_json(self, url: str) -> list[dict]:
        try:
            response = self._client.get(url)
        except httpx.HTTPError as exc:
            raise CelestrakError(f"network error: {exc}") from exc
        if response.status_code != 200:
            raise CelestrakError(
                f"HTTP {response.status_code} from Celestrak: {response.text[:200]}"
            )
        data = response.json()
        if not isinstance(data, list):
            raise CelestrakError(f"unexpected payload shape: {type(data).__name__}")
        return data

    def _parse_rows(self, rows: list[dict]) -> list[TLE]:
        out: list[TLE] = []
        for row in rows:
            line1 = row["TLE_LINE1"]
            line2 = row["TLE_LINE2"]
            name = row.get("TLE_LINE0") or row["OBJECT_NAME"]
            out.append(parse_tle(line1=line1, line2=line2, name=name))
        return out

    def fetch_single(self, *, norad_id: int) -> list[TLE]:
        """Fetch the TLE for one NORAD ID (wrapped in a single-element list)."""
        url = celestrak_url(norad_id=norad_id, base_url=self._base_url)
        rows = self._get_json(url)
        if not rows:
            raise CelestrakError(f"Celestrak returned no results for NORAD {norad_id}")
        return self._parse_rows(rows)

    def fetch_group(self, group: str) -> list[TLE]:
        """Fetch all TLEs in a named Celestrak group (e.g. 'stations')."""
        url = celestrak_url(group=group, base_url=self._base_url)
        rows = self._get_json(url)
        if not rows:
            raise CelestrakError(f"Celestrak returned no results for group {group!r}")
        return self._parse_rows(rows)

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "CelestrakClient":
        return self

    def __exit__(self, *exc_info) -> None:
        self.close()
```

- [ ] **Step 5: Run — should pass**

```bash
pytest tests/unit/test_celestrak.py -v
```

Expected: 7 passed.

- [ ] **Step 6: Commit**

```bash
git add core/catalog/celestrak.py tests/unit/test_celestrak.py tests/fixtures/celestrak/
git commit -m "feat(catalog): Celestrak GP API client"
```

---

## Task 3: TLE disk cache

Tiny module: read/write JSON records keyed by group-name or NORAD-id, with a `fetched_at` timestamp for age-based invalidation.

**Files:**
- Create: `core/catalog/tle_cache.py`
- Test: `tests/unit/test_tle_cache.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/test_tle_cache.py`:

```python
"""Tests for core.catalog.tle_cache."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from core._types import TLE
from core.catalog.tle_cache import TLECache


def _make_tle(norad_id: int = 25544) -> TLE:
    return TLE(
        norad_id=norad_id,
        name="ISS (ZARYA)",
        line1="1 25544U 98067A   26110.78039753  .00010000  00000-0  18000-3 0  9990",
        line2="2 25544  51.6406 224.2064 0006726 330.9385  29.0851 15.50000000 99990",
        epoch=datetime(2026, 4, 20, 18, 43, 46, tzinfo=timezone.utc),
    )


def test_cache_miss_returns_none(tmp_path: Path):
    cache = TLECache(root=tmp_path)
    assert cache.load_single(25544) is None


def test_cache_roundtrip_single(tmp_path: Path):
    cache = TLECache(root=tmp_path)
    tle = _make_tle()
    fetched_at = datetime(2026, 4, 20, 19, 0, 0, tzinfo=timezone.utc)

    cache.save_single(tle, fetched_at=fetched_at)

    loaded, loaded_at = cache.load_single(25544)  # type: ignore[misc]
    assert loaded.norad_id == tle.norad_id
    assert loaded.line1 == tle.line1
    assert loaded.line2 == tle.line2
    assert loaded.epoch == tle.epoch
    assert loaded_at == fetched_at


def test_cache_roundtrip_group(tmp_path: Path):
    cache = TLECache(root=tmp_path)
    tles = [_make_tle(25544), _make_tle(48274)]
    fetched_at = datetime(2026, 4, 20, 19, 0, 0, tzinfo=timezone.utc)

    cache.save_group("stations", tles, fetched_at=fetched_at)

    loaded, loaded_at = cache.load_group("stations")  # type: ignore[misc]
    assert len(loaded) == 2
    assert loaded_at == fetched_at


def test_cache_age_seconds(tmp_path: Path):
    cache = TLECache(root=tmp_path)
    tle = _make_tle()
    fetched_at = datetime(2026, 4, 20, 10, 0, 0, tzinfo=timezone.utc)
    cache.save_single(tle, fetched_at=fetched_at)

    now = fetched_at + timedelta(hours=3)
    loaded, loaded_at = cache.load_single(25544)  # type: ignore[misc]
    age = (now - loaded_at).total_seconds()
    assert age == pytest.approx(10800.0)
```

- [ ] **Step 2: Run — expect ImportError**

```bash
pytest tests/unit/test_tle_cache.py -v
```

Expected: `ModuleNotFoundError: No module named 'core.catalog.tle_cache'`

- [ ] **Step 3: Implement `core/catalog/tle_cache.py`**

```python
"""Disk cache for TLE fetches.

Layout under `root`:
    <root>/tle-cache/
        single/<norad_id>.json         # { fetched_at, tle: {...} }
        group/<group_name>.json        # { fetched_at, tles: [{...}, ...] }

Records are self-describing JSON so they survive schema changes as long as
the fields we read remain compatible.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from core._types import TLE


def _tle_to_dict(tle: TLE) -> dict:
    return {
        "norad_id": tle.norad_id,
        "name": tle.name,
        "line1": tle.line1,
        "line2": tle.line2,
        "epoch": tle.epoch.isoformat(),
    }


def _tle_from_dict(d: dict) -> TLE:
    return TLE(
        norad_id=int(d["norad_id"]),
        name=d["name"],
        line1=d["line1"],
        line2=d["line2"],
        epoch=datetime.fromisoformat(d["epoch"]),
    )


class TLECache:
    """Append/replace-only cache of TLEs keyed by NORAD ID or group name."""

    def __init__(self, *, root: Path | str) -> None:
        self._root = Path(root) / "tle-cache"
        (self._root / "single").mkdir(parents=True, exist_ok=True)
        (self._root / "group").mkdir(parents=True, exist_ok=True)

    def _single_path(self, norad_id: int) -> Path:
        return self._root / "single" / f"{norad_id}.json"

    def _group_path(self, group: str) -> Path:
        safe = group.replace("/", "_")
        return self._root / "group" / f"{safe}.json"

    def save_single(self, tle: TLE, *, fetched_at: datetime) -> None:
        record = {"fetched_at": fetched_at.isoformat(), "tle": _tle_to_dict(tle)}
        self._single_path(tle.norad_id).write_text(json.dumps(record, indent=2))

    def save_group(self, group: str, tles: list[TLE], *, fetched_at: datetime) -> None:
        record = {
            "fetched_at": fetched_at.isoformat(),
            "tles": [_tle_to_dict(t) for t in tles],
        }
        self._group_path(group).write_text(json.dumps(record, indent=2))

    def load_single(self, norad_id: int) -> Optional[tuple[TLE, datetime]]:
        path = self._single_path(norad_id)
        if not path.exists():
            return None
        record = json.loads(path.read_text())
        return _tle_from_dict(record["tle"]), datetime.fromisoformat(record["fetched_at"])

    def load_group(self, group: str) -> Optional[tuple[list[TLE], datetime]]:
        path = self._group_path(group)
        if not path.exists():
            return None
        record = json.loads(path.read_text())
        tles = [_tle_from_dict(d) for d in record["tles"]]
        return tles, datetime.fromisoformat(record["fetched_at"])
```

- [ ] **Step 4: Run — should pass**

```bash
pytest tests/unit/test_tle_cache.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add core/catalog/tle_cache.py tests/unit/test_tle_cache.py
git commit -m "feat(catalog): disk cache for TLE records"
```

---

## Task 4: TLE fetcher (client + cache + 24h refresh + polite rate-limit)

Orchestrator over Tasks 2 and 3. Exposes the signatures the spec promised for `core.catalog` in §7.5: `get_tle(norad_id)` and `get_group_tles(group_name)`.

Rate-limit design: a process-local monotonic-time token bucket cap at 2 req/s. Overkill for one human user, but Celestrak's ToS is explicit; enforcing it is two lines.

**Files:**
- Create: `core/catalog/fetcher.py`
- Test: `tests/unit/test_tle_fetcher.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/test_tle_fetcher.py`:

```python
"""Tests for core.catalog.fetcher."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import pytest

from core._types import TLE
from core.catalog.celestrak import CelestrakClient
from core.catalog.fetcher import TLEFetcher

FIX_ISS = Path(__file__).resolve().parents[1] / "fixtures" / "celestrak" / "iss_single.json"
FIX_STATIONS = Path(__file__).resolve().parents[1] / "fixtures" / "celestrak" / "stations_group.json"


def _client_from_file(path: Path) -> CelestrakClient:
    body = path.read_text()
    transport = httpx.MockTransport(lambda req: httpx.Response(200, text=body))
    return CelestrakClient(transport=transport)


def test_get_tle_fetches_on_cold_cache(tmp_path: Path):
    client = _client_from_file(FIX_ISS)
    now = datetime(2026, 4, 20, 19, 0, 0, tzinfo=timezone.utc)
    fetcher = TLEFetcher(client=client, cache_root=tmp_path, now=lambda: now)

    tle, age_s = fetcher.get_tle(25544)

    assert tle.norad_id == 25544
    assert age_s == 0.0


def test_get_tle_uses_cache_when_fresh(tmp_path: Path):
    client = _client_from_file(FIX_ISS)
    now = [datetime(2026, 4, 20, 19, 0, 0, tzinfo=timezone.utc)]
    fetcher = TLEFetcher(client=client, cache_root=tmp_path, now=lambda: now[0])

    # First call: populates cache.
    fetcher.get_tle(25544)

    # Advance clock 1h (well under 24h threshold); expect no re-fetch.
    now[0] += timedelta(hours=1)

    # Swap client out to a transport that would fail if contacted.
    fail_transport = httpx.MockTransport(lambda req: httpx.Response(500, text="should not hit"))
    fetcher._client = CelestrakClient(transport=fail_transport)  # type: ignore[attr-defined]

    tle, age_s = fetcher.get_tle(25544)
    assert tle.norad_id == 25544
    assert age_s == pytest.approx(3600.0)


def test_get_tle_refreshes_when_stale(tmp_path: Path):
    client = _client_from_file(FIX_ISS)
    now = [datetime(2026, 4, 20, 19, 0, 0, tzinfo=timezone.utc)]
    fetcher = TLEFetcher(client=client, cache_root=tmp_path, now=lambda: now[0])

    fetcher.get_tle(25544)

    # Fast-forward 25h → stale.
    now[0] += timedelta(hours=25)

    # New client that returns the same fixture — verifies the re-fetch path runs.
    fetcher._client = _client_from_file(FIX_ISS)  # type: ignore[attr-defined]

    tle, age_s = fetcher.get_tle(25544)
    assert tle.norad_id == 25544
    assert age_s == 0.0  # just refreshed


def test_get_group_tles_returns_list(tmp_path: Path):
    client = _client_from_file(FIX_STATIONS)
    now = datetime(2026, 4, 20, 19, 0, 0, tzinfo=timezone.utc)
    fetcher = TLEFetcher(client=client, cache_root=tmp_path, now=lambda: now)

    tles, age_s = fetcher.get_group_tles("stations")

    assert len(tles) == 2
    assert {t.norad_id for t in tles} == {25544, 48274}
    assert age_s == 0.0


def test_rate_limiter_enforces_minimum_spacing():
    from core.catalog.fetcher import RateLimiter

    ticks = [0.0]

    def now_s() -> float:
        return ticks[0]

    def sleeper(duration_s: float) -> None:
        ticks[0] += duration_s

    limiter = RateLimiter(max_per_second=2.0, now_s=now_s, sleep=sleeper)

    # First call: no wait.
    limiter.wait_if_needed()
    assert ticks[0] == 0.0

    # Second call immediately after: must sleep ~0.5s.
    limiter.wait_if_needed()
    assert ticks[0] == pytest.approx(0.5, abs=1e-6)
```

- [ ] **Step 2: Run — expect ImportError**

```bash
pytest tests/unit/test_tle_fetcher.py -v
```

Expected: `ModuleNotFoundError: No module named 'core.catalog.fetcher'`

- [ ] **Step 3: Implement `core/catalog/fetcher.py`**

```python
"""TLE fetcher — orchestrates Celestrak client + disk cache with a 24h freshness window.

Exposes the public engine API:
    - get_tle(norad_id) -> (TLE, age_seconds)
    - get_group_tles(group_name) -> (list[TLE], age_seconds)

The `age_seconds` value lets callers surface TLE freshness per result
(e.g. in an API response) without re-reading the cache metadata.
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

from core._types import TLE
from core.catalog.celestrak import CelestrakClient
from core.catalog.tle_cache import TLECache


class RateLimiter:
    """Minimal rolling-window rate limiter.

    Enforces a ceiling of `max_per_second` by sleeping if the previous call
    was too recent. Monotonic clock by default; both clock and sleep are
    injectable for tests.
    """

    def __init__(
        self,
        *,
        max_per_second: float = 2.0,
        now_s: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        if max_per_second <= 0:
            raise ValueError("max_per_second must be positive")
        self._min_gap_s = 1.0 / max_per_second
        self._now_s = now_s
        self._sleep = sleep
        self._last_call_s: float | None = None

    def wait_if_needed(self) -> None:
        now = self._now_s()
        if self._last_call_s is not None:
            elapsed = now - self._last_call_s
            if elapsed < self._min_gap_s:
                self._sleep(self._min_gap_s - elapsed)
                now = self._now_s()
        self._last_call_s = now


DEFAULT_TLE_MAX_AGE = timedelta(hours=24)


class TLEFetcher:
    """Read-through cache for Celestrak TLEs.

    Age policy: return the cached record if it's younger than `max_age`;
    otherwise re-fetch, overwrite the cache, and return the fresh record.
    On fetch errors with a populated cache, the fetcher falls back to the
    stale cached entry rather than raising — the caller can decide via
    `age_seconds` whether that's acceptable.
    """

    def __init__(
        self,
        *,
        client: CelestrakClient,
        cache_root: Path,
        max_age: timedelta = DEFAULT_TLE_MAX_AGE,
        rate_limiter: RateLimiter | None = None,
        now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    ) -> None:
        self._client = client
        self._cache = TLECache(root=cache_root)
        self._max_age = max_age
        self._rate_limiter = rate_limiter or RateLimiter()
        self._now = now

    # ------------------------- internals -----------------------------------

    def _age_seconds(self, fetched_at: datetime) -> float:
        return (self._now() - fetched_at).total_seconds()

    def _is_fresh(self, fetched_at: datetime) -> bool:
        return self._age_seconds(fetched_at) < self._max_age.total_seconds()

    # ------------------------- public API ----------------------------------

    def get_tle(self, norad_id: int) -> tuple[TLE, float]:
        """Return `(tle, age_in_seconds)` for a single NORAD ID."""
        cached = self._cache.load_single(norad_id)
        if cached is not None and self._is_fresh(cached[1]):
            return cached[0], self._age_seconds(cached[1])

        self._rate_limiter.wait_if_needed()
        try:
            fresh_list = self._client.fetch_single(norad_id=norad_id)
        except Exception:
            if cached is not None:
                return cached[0], self._age_seconds(cached[1])
            raise
        fresh = fresh_list[0]
        fetched_at = self._now()
        self._cache.save_single(fresh, fetched_at=fetched_at)
        return fresh, 0.0

    def get_group_tles(self, group: str) -> tuple[list[TLE], float]:
        """Return `(tles, age_in_seconds)` for a Celestrak group."""
        cached = self._cache.load_group(group)
        if cached is not None and self._is_fresh(cached[1]):
            return cached[0], self._age_seconds(cached[1])

        self._rate_limiter.wait_if_needed()
        try:
            fresh = self._client.fetch_group(group)
        except Exception:
            if cached is not None:
                return cached[0], self._age_seconds(cached[1])
            raise
        fetched_at = self._now()
        self._cache.save_group(group, fresh, fetched_at=fetched_at)
        return fresh, 0.0
```

- [ ] **Step 4: Run — should pass**

```bash
pytest tests/unit/test_tle_fetcher.py -v
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add core/catalog/fetcher.py tests/unit/test_tle_fetcher.py
git commit -m "feat(catalog): TLE fetcher with cache and rate limit"
```

---

## Task 5: OpenTopography DEM client

Fetches Copernicus DEM GLO-30 tiles from OpenTopography. Returns raw GeoTIFF bytes — parsing into a `DEM` dataclass happens in Task 6 where we have the parsed cache.

OpenTopography requires an API key for the globaldem REST endpoint (as of 2025). Read from `OPENTOPOGRAPHY_API_KEY` env var; raise a clear error if missing.

**Files:**
- Create: `core/terrain/__init__.py`
- Create: `core/terrain/opentopo.py`
- Test: `tests/unit/test_opentopo.py`

- [ ] **Step 1: Create empty `core/terrain/__init__.py`**

```python
"""Terrain — DEM fetch, horizon computation, caches."""
```

- [ ] **Step 2: Write the failing tests**

Create `tests/unit/test_opentopo.py`:

```python
"""Tests for core.terrain.opentopo."""
from __future__ import annotations

import os
from unittest.mock import patch

import httpx
import pytest

from core.terrain.opentopo import (
    OpenTopoClient,
    OpenTopoError,
    bbox_for_radius_km,
    opentopo_url,
)

# A tiny "fake GeoTIFF" — we test that the client returns the raw bytes
# unchanged. Real parsing happens in test_dem_cache / test_horizon.
FAKE_TIFF = b"II*\x00fake geotiff bytes"


def test_bbox_for_radius_km_is_centered():
    south, north, west, east = bbox_for_radius_km(lat=40.7128, lng=-74.0060, radius_km=50)
    # Latitude half-width ≈ 50/111 ≈ 0.45°; longitude half-width compensated by cos(lat).
    assert north - south == pytest.approx(2 * 50 / 111.0, abs=0.02)
    # Symmetry
    mid_lat = (south + north) / 2
    mid_lng = (west + east) / 2
    assert mid_lat == pytest.approx(40.7128, abs=1e-6)
    assert mid_lng == pytest.approx(-74.0060, abs=1e-6)


def test_url_contains_required_params():
    url = opentopo_url(south=40.0, north=41.0, west=-75.0, east=-74.0, api_key="TESTKEY")
    assert "demtype=COP30" in url
    assert "south=40.0" in url
    assert "north=41.0" in url
    assert "west=-75.0" in url
    assert "east=-74.0" in url
    assert "outputFormat=GTiff" in url
    assert "API_Key=TESTKEY" in url


def test_fetch_returns_raw_bytes():
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=FAKE_TIFF, headers={"content-type": "image/tiff"})

    client = OpenTopoClient(api_key="TESTKEY", transport=httpx.MockTransport(handler))
    data = client.fetch(lat=40.7128, lng=-74.0060, radius_km=5)
    assert data == FAKE_TIFF


def test_fetch_raises_on_missing_key():
    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(OpenTopoError, match="API key"):
            OpenTopoClient().fetch(lat=0.0, lng=0.0, radius_km=5)


def test_fetch_raises_on_http_error():
    transport = httpx.MockTransport(lambda req: httpx.Response(403, text="Forbidden"))
    client = OpenTopoClient(api_key="TESTKEY", transport=transport)
    with pytest.raises(OpenTopoError, match="HTTP 403"):
        client.fetch(lat=0.0, lng=0.0, radius_km=5)
```

- [ ] **Step 3: Run — expect ImportError**

```bash
pytest tests/unit/test_opentopo.py -v
```

Expected: `ModuleNotFoundError: No module named 'core.terrain.opentopo'`

- [ ] **Step 4: Implement `core/terrain/opentopo.py`**

```python
"""OpenTopography DEM fetch client.

Returns raw GeoTIFF bytes for a bounding box around an observer. Parsing
into a `DEM` dataclass happens in `core.terrain.dem_cache`.

Requires an OpenTopography API key. Register free at:
    https://portal.opentopography.org/requestService?service=api

Set via env var `OPENTOPOGRAPHY_API_KEY` or pass explicitly to the client.
"""
from __future__ import annotations

import math
import os
import urllib.parse
from typing import Optional

import httpx

OPENTOPO_BASE_URL = "https://portal.opentopography.org/API/globaldem"
DEFAULT_DEM_TYPE = "COP30"  # Copernicus DEM GLO-30, 30m global
DEFAULT_TIMEOUT_S = 60.0
METERS_PER_DEG_LAT = 111_000.0


class OpenTopoError(RuntimeError):
    """Raised when an OpenTopography request fails or is misconfigured."""


def bbox_for_radius_km(*, lat: float, lng: float, radius_km: float) -> tuple[float, float, float, float]:
    """Return `(south, north, west, east)` bounds of a square around (lat, lng).

    Longitude width is compensated by `cos(lat)` so the box remains roughly
    square on the ground at all latitudes except the poles.
    """
    half_lat = radius_km * 1000 / METERS_PER_DEG_LAT
    cos_lat = max(math.cos(math.radians(lat)), 1e-6)
    half_lng = half_lat / cos_lat
    return (lat - half_lat, lat + half_lat, lng - half_lng, lng + half_lng)


def opentopo_url(
    *,
    south: float,
    north: float,
    west: float,
    east: float,
    api_key: str,
    dem_type: str = DEFAULT_DEM_TYPE,
    base_url: str = OPENTOPO_BASE_URL,
) -> str:
    """Build an OpenTopography globaldem URL."""
    params = {
        "demtype": dem_type,
        "south": south,
        "north": north,
        "west": west,
        "east": east,
        "outputFormat": "GTiff",
        "API_Key": api_key,
    }
    return f"{base_url}?{urllib.parse.urlencode(params)}"


class OpenTopoClient:
    """Fetches Copernicus DEM GLO-30 GeoTIFFs from OpenTopography."""

    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        base_url: str = OPENTOPO_BASE_URL,
        dem_type: str = DEFAULT_DEM_TYPE,
        timeout_s: float = DEFAULT_TIMEOUT_S,
        transport: Optional[httpx.BaseTransport] = None,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url
        self._dem_type = dem_type
        self._client = httpx.Client(timeout=timeout_s, transport=transport)

    def _resolve_api_key(self) -> str:
        key = self._api_key or os.environ.get("OPENTOPOGRAPHY_API_KEY")
        if not key:
            raise OpenTopoError(
                "OpenTopography API key not set. Register a free key at "
                "https://portal.opentopography.org/ and set OPENTOPOGRAPHY_API_KEY."
            )
        return key

    def fetch(self, *, lat: float, lng: float, radius_km: float = 50) -> bytes:
        """Return raw GeoTIFF bytes for a bbox of half-width `radius_km` around (lat, lng)."""
        south, north, west, east = bbox_for_radius_km(lat=lat, lng=lng, radius_km=radius_km)
        url = opentopo_url(
            south=south,
            north=north,
            west=west,
            east=east,
            api_key=self._resolve_api_key(),
            dem_type=self._dem_type,
            base_url=self._base_url,
        )
        try:
            response = self._client.get(url)
        except httpx.HTTPError as exc:
            raise OpenTopoError(f"network error: {exc}") from exc
        if response.status_code != 200:
            raise OpenTopoError(
                f"HTTP {response.status_code} from OpenTopography: {response.text[:200]}"
            )
        return response.content

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "OpenTopoClient":
        return self

    def __exit__(self, *exc_info) -> None:
        self.close()
```

- [ ] **Step 5: Run — should pass**

```bash
pytest tests/unit/test_opentopo.py -v
```

Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add core/terrain/__init__.py core/terrain/opentopo.py tests/unit/test_opentopo.py
git commit -m "feat(terrain): OpenTopography DEM client"
```

---

## Task 6: DEM cache (GeoTIFF on disk → parsed `DEM` objects)

The GeoTIFF bytes from Task 5 are saved under `~/.satvis/dem-cache/<hash>.tif`. A loader parses them (via `rasterio`) into `DEM` dataclasses. Location hashing uses rounded lat/lng + radius so the same query hits the same file.

**Files:**
- Create: `core/terrain/dem_cache.py`
- Test: `tests/unit/test_dem_cache.py`
- Modify: `tests/conftest.py` (add synthetic DEM factory)

- [ ] **Step 1: Add a synthetic DEM helper to `tests/conftest.py`**

Append to `tests/conftest.py`:

```python
import numpy as np


@pytest.fixture(scope="session")
def synth_dem_tile_bytes(tmp_path_factory: pytest.TempPathFactory):
    """Generate a tiny synthetic GeoTIFF for DEM tests.

    3x3 grid centered at (0°, 0°), cell size 1e-5°, elevations form a cone
    peaking at the center (100 m → 120 m going outward).
    """
    rasterio = pytest.importorskip("rasterio")
    from rasterio.transform import from_bounds

    tmp = tmp_path_factory.mktemp("synth-dem")
    path = tmp / "synth.tif"

    data = np.array(
        [[100.0, 110.0, 100.0],
         [110.0, 120.0, 110.0],
         [100.0, 110.0, 100.0]],
        dtype=np.float32,
    )
    transform = from_bounds(west=-1e-5, south=-1e-5, east=1e-5, north=1e-5,
                            width=3, height=3)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=3,
        width=3,
        count=1,
        dtype="float32",
        crs="EPSG:4326",
        transform=transform,
    ) as dst:
        dst.write(data, 1)
    return path.read_bytes()
```

- [ ] **Step 2: Write the failing tests**

Create `tests/unit/test_dem_cache.py`:

```python
"""Tests for core.terrain.dem_cache."""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from core._types import DEM
from core.terrain.dem_cache import DEMCache, dem_cache_key


def test_cache_key_is_stable():
    a = dem_cache_key(lat=40.7128, lng=-74.0060, radius_km=50)
    b = dem_cache_key(lat=40.7128, lng=-74.0060, radius_km=50)
    assert a == b


def test_cache_key_differs_for_different_locations():
    a = dem_cache_key(lat=40.7128, lng=-74.0060, radius_km=50)
    b = dem_cache_key(lat=51.5, lng=-0.12, radius_km=50)
    assert a != b


def test_save_and_load_roundtrip(tmp_path: Path, synth_dem_tile_bytes: bytes):
    cache = DEMCache(root=tmp_path)

    key = dem_cache_key(lat=0.0, lng=0.0, radius_km=1)
    cache.save_bytes(key, synth_dem_tile_bytes)

    loaded = cache.load(key)
    assert loaded is not None
    assert isinstance(loaded, DEM)
    assert loaded.shape == (3, 3)
    assert loaded.elevations[1, 1] == pytest.approx(120.0)


def test_cache_miss_returns_none(tmp_path: Path):
    cache = DEMCache(root=tmp_path)
    assert cache.load(dem_cache_key(lat=0.0, lng=0.0, radius_km=5)) is None
```

- [ ] **Step 3: Run — expect ImportError**

```bash
pytest tests/unit/test_dem_cache.py -v
```

Expected: `ModuleNotFoundError: No module named 'core.terrain.dem_cache'`

- [ ] **Step 4: Implement `core/terrain/dem_cache.py`**

```python
"""Disk cache for DEM tiles.

Layout under `root`:
    <root>/dem-cache/<cache_key>.tif

`cache_key` is a stable hash of (lat_rounded, lng_rounded, radius_km) so
nearby queries reuse the same tile. Load parses the GeoTIFF into a `DEM`
dataclass using rasterio.
"""
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Optional

import numpy as np
import rasterio

from core._types import DEM

# Round to 4 decimals ≈ 11m precision at equator — plenty for DEM tile reuse.
_LL_ROUND_DIGITS = 4


def dem_cache_key(*, lat: float, lng: float, radius_km: float) -> str:
    """Stable 16-char hash over rounded lat/lng + radius."""
    tag = f"{round(lat, _LL_ROUND_DIGITS)}_{round(lng, _LL_ROUND_DIGITS)}_{int(radius_km)}"
    return hashlib.sha256(tag.encode("utf-8")).hexdigest()[:16]


class DEMCache:
    """Saves raw GeoTIFF bytes; loads them parsed into `DEM`."""

    def __init__(self, *, root: Path | str) -> None:
        self._root = Path(root) / "dem-cache"
        self._root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        return self._root / f"{key}.tif"

    def save_bytes(self, key: str, tiff_bytes: bytes) -> None:
        self._path(key).write_bytes(tiff_bytes)

    def load(self, key: str) -> Optional[DEM]:
        path = self._path(key)
        if not path.exists():
            return None
        with rasterio.open(path) as src:
            elevations = src.read(1).astype(np.float32, copy=False)
            bounds = src.bounds
        return DEM(
            south_lat=float(bounds.bottom),
            north_lat=float(bounds.top),
            west_lng=float(bounds.left),
            east_lng=float(bounds.right),
            elevations=elevations,
        )
```

- [ ] **Step 5: Run — should pass**

```bash
pytest tests/unit/test_dem_cache.py -v
```

Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add core/terrain/dem_cache.py tests/unit/test_dem_cache.py tests/conftest.py
git commit -m "feat(terrain): DEM disk cache with GeoTIFF loader"
```

---

## Task 7: Horizon mask computation

Pure numpy math: given a `DEM` and an `Observer`, cast 360 rays outward at 1° increments, sample the DEM along each ray, track the maximum elevation angle seen. Returns a `HorizonMask` (360 samples).

**Files:**
- Create: `core/terrain/horizon.py`
- Test: `tests/unit/test_horizon.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/test_horizon.py`:

```python
"""Tests for core.terrain.horizon."""
from __future__ import annotations

import numpy as np
import pytest

from core._types import DEM, HorizonMask, Observer
from core.terrain.horizon import compute_horizon_mask


def _flat_dem(height_m: float = 100.0, size: int = 21) -> DEM:
    """A flat plain at constant elevation, 1km square, centered at (0,0)."""
    elevations = np.full((size, size), height_m, dtype=np.float32)
    half = 0.005  # ~500m in degrees
    return DEM(south_lat=-half, north_lat=half, west_lng=-half, east_lng=half,
               elevations=elevations)


def _cone_dem(peak_m: float = 500.0, base_m: float = 100.0, size: int = 41) -> DEM:
    """A cone with peak at grid center, falling linearly to `base_m` at the corners."""
    cx, cy = size // 2, size // 2
    ys, xs = np.mgrid[0:size, 0:size]
    dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    max_dist = dist.max()
    slope = (peak_m - base_m) / max_dist
    elevations = (peak_m - slope * dist).astype(np.float32)
    half = 0.005
    return DEM(south_lat=-half, north_lat=half, west_lng=-half, east_lng=half,
               elevations=elevations)


def test_flat_terrain_gives_zero_horizon():
    dem = _flat_dem(height_m=100.0)
    observer = Observer(lat=0.0, lng=0.0, elevation_m=100.0)  # same height as terrain

    mask = compute_horizon_mask(dem=dem, observer=observer)

    assert isinstance(mask, HorizonMask)
    assert len(mask.samples_deg) == 360
    # Flat at observer height -> horizon elevation ~0° everywhere.
    samples = np.asarray(mask.samples_deg)
    assert np.all(samples < 0.1)


def test_cone_terrain_puts_high_horizon_near_the_peak():
    dem = _cone_dem(peak_m=500.0)
    # Observer sits at the SW edge of the tile, at base elevation.
    observer = Observer(lat=-0.004, lng=-0.004, elevation_m=100.0)

    mask = compute_horizon_mask(dem=dem, observer=observer)

    # Peak is to the NE of observer — azimuth ~45° — should be the maximum.
    samples = np.asarray(mask.samples_deg)
    peak_az = int(np.argmax(samples))
    assert 20 <= peak_az <= 70
    # And the peak horizon elevation should be substantial (cone rises 400m over ~600m).
    assert samples[peak_az] > 10.0


def test_observer_above_terrain_gives_negative_horizon():
    dem = _flat_dem(height_m=100.0)
    # Observer 500m above the plain — should see a negative horizon elevation
    # in the azimuth directions where the DEM surface drops below them.
    observer = Observer(lat=0.0, lng=0.0, elevation_m=600.0)

    mask = compute_horizon_mask(dem=dem, observer=observer)

    samples = np.asarray(mask.samples_deg)
    # At least some samples should be < 0.
    assert np.any(samples < 0.0)


def test_mask_has_exactly_360_samples():
    dem = _flat_dem()
    observer = Observer(lat=0.0, lng=0.0, elevation_m=100.0)
    mask = compute_horizon_mask(dem=dem, observer=observer)
    assert len(mask.samples_deg) == 360
```

- [ ] **Step 2: Run — expect ImportError**

```bash
pytest tests/unit/test_horizon.py -v
```

Expected: `ModuleNotFoundError: No module named 'core.terrain.horizon'`

- [ ] **Step 3: Implement `core/terrain/horizon.py`**

```python
"""Horizon mask computation from a DEM.

Casts 360 rays at 1° azimuth increments outward from the observer, samples
the DEM along each ray, and records the maximum elevation angle seen. The
result is a 360-element `HorizonMask`, usable by `predict_passes` to filter
terrain-blocked passes.
"""
from __future__ import annotations

import math

import numpy as np

from core._types import DEM, HorizonMask, Observer

_METERS_PER_DEG_LAT = 111_000.0
_RAY_STEP_M = 100.0
_MAX_RAY_DISTANCE_M = 50_000.0


def _sample_dem_at(dem: DEM, lat: float, lng: float) -> float:
    """Bilinear-ish sample of the DEM at (lat, lng). Returns NaN if outside bounds."""
    elevations: np.ndarray = dem.elevations  # type: ignore[assignment]
    rows, cols = elevations.shape
    if not (dem.south_lat <= lat <= dem.north_lat):
        return float("nan")
    if not (dem.west_lng <= lng <= dem.east_lng):
        return float("nan")

    # Normalise to fractional row/col; row 0 = north.
    lat_frac = (dem.north_lat - lat) / max(dem.north_lat - dem.south_lat, 1e-9)
    lng_frac = (lng - dem.west_lng) / max(dem.east_lng - dem.west_lng, 1e-9)

    r = lat_frac * (rows - 1)
    c = lng_frac * (cols - 1)

    r0 = int(math.floor(r))
    c0 = int(math.floor(c))
    r1 = min(r0 + 1, rows - 1)
    c1 = min(c0 + 1, cols - 1)
    dr = r - r0
    dc = c - c0

    v = (
        elevations[r0, c0] * (1 - dr) * (1 - dc)
        + elevations[r1, c0] * dr * (1 - dc)
        + elevations[r0, c1] * (1 - dr) * dc
        + elevations[r1, c1] * dr * dc
    )
    return float(v)


def compute_horizon_mask(
    *,
    dem: DEM,
    observer: Observer,
    samples: int = 360,
    ray_step_m: float = _RAY_STEP_M,
    max_distance_m: float = _MAX_RAY_DISTANCE_M,
) -> HorizonMask:
    """Compute a 360-element horizon mask from a DEM and observer location.

    Args:
        dem: Elevation tile covering the area around `observer`.
        observer: Observation location. `observer.elevation_m` is used as
            the observer's physical eye height; terrain at the observer
            is NOT auto-added.
        samples: Number of azimuths. Must be 360 for `HorizonMask`.
        ray_step_m: Distance between samples along each ray.
        max_distance_m: How far to cast each ray.

    Returns:
        `HorizonMask` with one min-elevation-degree value per azimuth (0..359).
    """
    if samples != 360:
        raise ValueError("HorizonMask currently requires exactly 360 samples")

    lat0 = observer.lat
    lng0 = observer.lng
    h0 = observer.elevation_m
    cos_lat = max(math.cos(math.radians(lat0)), 1e-6)

    horizon = np.full(samples, -90.0, dtype=np.float64)

    distances = np.arange(ray_step_m, max_distance_m + ray_step_m, ray_step_m, dtype=np.float64)

    for az_deg in range(samples):
        az_rad = math.radians(az_deg)
        # Ray direction in degrees-per-meter.
        d_lat_per_m = math.cos(az_rad) / _METERS_PER_DEG_LAT
        d_lng_per_m = math.sin(az_rad) / (_METERS_PER_DEG_LAT * cos_lat)

        max_angle = -90.0
        for d in distances:
            lat_s = lat0 + d_lat_per_m * d
            lng_s = lng0 + d_lng_per_m * d
            h_s = _sample_dem_at(dem, lat_s, lng_s)
            if math.isnan(h_s):
                break
            # Elevation angle from observer to this surface point.
            angle = math.degrees(math.atan2(h_s - h0, d))
            if angle > max_angle:
                max_angle = angle
        horizon[az_deg] = max_angle

    return HorizonMask(samples_deg=tuple(float(v) for v in horizon))
```

- [ ] **Step 4: Run — should pass**

```bash
pytest tests/unit/test_horizon.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add core/terrain/horizon.py tests/unit/test_horizon.py
git commit -m "feat(terrain): horizon mask from DEM rays"
```

---

## Task 8: Horizon mask cache + orchestrator

Persisted under `~/.satvis/horizon-cache/<key>.json`; the orchestrator wires together DEM fetch, DEM cache, horizon compute, and mask cache into a single `get_horizon_mask(observer)`.

**Files:**
- Create: `core/terrain/mask_cache.py`
- Create: `core/terrain/fetcher.py`
- Test: `tests/unit/test_mask_cache.py`
- Test: `tests/unit/test_terrain_fetcher.py`

- [ ] **Step 1: Write the failing tests for the mask cache**

Create `tests/unit/test_mask_cache.py`:

```python
"""Tests for core.terrain.mask_cache."""
from __future__ import annotations

from pathlib import Path

from core._types import HorizonMask
from core.terrain.mask_cache import HorizonMaskCache, mask_cache_key


def test_mask_key_stable():
    assert (
        mask_cache_key(lat=40.7128, lng=-74.0060, radius_km=50)
        == mask_cache_key(lat=40.7128, lng=-74.0060, radius_km=50)
    )


def test_mask_cache_roundtrip(tmp_path: Path):
    cache = HorizonMaskCache(root=tmp_path)
    samples = tuple(float(i % 10) for i in range(360))
    mask = HorizonMask(samples_deg=samples)

    key = mask_cache_key(lat=0.0, lng=0.0, radius_km=50)
    cache.save(key, mask)

    loaded = cache.load(key)
    assert loaded is not None
    assert loaded.samples_deg == samples


def test_mask_cache_miss(tmp_path: Path):
    cache = HorizonMaskCache(root=tmp_path)
    assert cache.load(mask_cache_key(lat=1.0, lng=1.0, radius_km=50)) is None
```

- [ ] **Step 2: Implement `core/terrain/mask_cache.py`**

```python
"""Disk cache for computed horizon masks.

Keyed identically to the DEM cache so a given observer maps consistently
from DEM fetch → horizon compute → mask cache.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Optional

from core._types import HorizonMask

_LL_ROUND_DIGITS = 4


def mask_cache_key(*, lat: float, lng: float, radius_km: float) -> str:
    """Stable 16-char hash over rounded lat/lng + radius."""
    tag = f"{round(lat, _LL_ROUND_DIGITS)}_{round(lng, _LL_ROUND_DIGITS)}_{int(radius_km)}"
    return hashlib.sha256(tag.encode("utf-8")).hexdigest()[:16]


class HorizonMaskCache:
    """Stores computed HorizonMask objects as JSON."""

    def __init__(self, *, root: Path | str) -> None:
        self._root = Path(root) / "horizon-cache"
        self._root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        return self._root / f"{key}.json"

    def save(self, key: str, mask: HorizonMask) -> None:
        payload = {"samples_deg": list(mask.samples_deg)}
        self._path(key).write_text(json.dumps(payload))

    def load(self, key: str) -> Optional[HorizonMask]:
        path = self._path(key)
        if not path.exists():
            return None
        payload = json.loads(path.read_text())
        return HorizonMask(samples_deg=tuple(float(v) for v in payload["samples_deg"]))
```

- [ ] **Step 3: Run — expect tests to pass**

```bash
pytest tests/unit/test_mask_cache.py -v
```

Expected: 3 passed.

- [ ] **Step 4: Write the failing tests for the orchestrator**

Create `tests/unit/test_terrain_fetcher.py`:

```python
"""Tests for core.terrain.fetcher."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import pytest

from core._types import Observer
from core.terrain.fetcher import TerrainFetcher
from core.terrain.opentopo import OpenTopoClient


def _client_returning(bytes_: bytes) -> OpenTopoClient:
    import httpx

    transport = httpx.MockTransport(lambda req: httpx.Response(200, content=bytes_))
    return OpenTopoClient(api_key="TESTKEY", transport=transport)


def test_first_call_fetches_and_computes(tmp_path: Path, synth_dem_tile_bytes: bytes):
    fetcher = TerrainFetcher(client=_client_returning(synth_dem_tile_bytes), cache_root=tmp_path)
    observer = Observer(lat=0.0, lng=0.0, elevation_m=100.0)

    mask = fetcher.get_horizon_mask(observer)

    assert len(mask.samples_deg) == 360


def test_second_call_uses_mask_cache_without_hitting_client(tmp_path: Path, synth_dem_tile_bytes: bytes):
    observer = Observer(lat=0.0, lng=0.0, elevation_m=100.0)

    # Warm both caches with a real client.
    fetcher = TerrainFetcher(client=_client_returning(synth_dem_tile_bytes), cache_root=tmp_path)
    first = fetcher.get_horizon_mask(observer)

    # Now swap in a client that would fail — second call must not call it.
    fail_client = MagicMock(spec=OpenTopoClient)
    fail_client.fetch.side_effect = AssertionError("should not be called")
    fetcher2 = TerrainFetcher(client=fail_client, cache_root=tmp_path)

    second = fetcher2.get_horizon_mask(observer)

    assert first.samples_deg == second.samples_deg
    fail_client.fetch.assert_not_called()
```

- [ ] **Step 5: Implement `core/terrain/fetcher.py`**

```python
"""Terrain orchestrator — DEM fetch + DEM cache + horizon compute + mask cache.

Exposes `get_horizon_mask(observer) -> HorizonMask`, the public engine API.
Order of operations:
    1. Check mask cache → return immediately if present.
    2. Check DEM cache → load if present, else fetch + save.
    3. Compute horizon mask from DEM.
    4. Save mask to cache.
    5. Return.
"""
from __future__ import annotations

from pathlib import Path

from core._types import HorizonMask, Observer
from core.terrain.dem_cache import DEMCache, dem_cache_key
from core.terrain.horizon import compute_horizon_mask
from core.terrain.mask_cache import HorizonMaskCache, mask_cache_key
from core.terrain.opentopo import OpenTopoClient

DEFAULT_RADIUS_KM = 50


class TerrainFetcher:
    """Read-through cache stack for per-location horizon masks."""

    def __init__(
        self,
        *,
        client: OpenTopoClient,
        cache_root: Path | str,
        radius_km: int = DEFAULT_RADIUS_KM,
    ) -> None:
        self._client = client
        self._dem_cache = DEMCache(root=cache_root)
        self._mask_cache = HorizonMaskCache(root=cache_root)
        self._radius_km = radius_km

    def get_horizon_mask(self, observer: Observer) -> HorizonMask:
        """Return a 360° horizon mask for `observer`, using caches when available."""
        key = mask_cache_key(lat=observer.lat, lng=observer.lng, radius_km=self._radius_km)

        cached_mask = self._mask_cache.load(key)
        if cached_mask is not None:
            return cached_mask

        dem_key = dem_cache_key(lat=observer.lat, lng=observer.lng, radius_km=self._radius_km)
        dem = self._dem_cache.load(dem_key)
        if dem is None:
            tiff_bytes = self._client.fetch(
                lat=observer.lat, lng=observer.lng, radius_km=self._radius_km
            )
            self._dem_cache.save_bytes(dem_key, tiff_bytes)
            dem = self._dem_cache.load(dem_key)
            assert dem is not None, "DEM cache load must succeed after save"

        mask = compute_horizon_mask(dem=dem, observer=observer)
        self._mask_cache.save(key, mask)
        return mask
```

- [ ] **Step 6: Run — should pass**

```bash
pytest tests/unit/test_terrain_fetcher.py -v
```

Expected: 2 passed.

- [ ] **Step 7: Commit**

```bash
git add core/terrain/mask_cache.py core/terrain/fetcher.py tests/unit/test_mask_cache.py tests/unit/test_terrain_fetcher.py
git commit -m "feat(terrain): get_horizon_mask orchestrator with caches"
```

---

## Task 9: Starlink train clustering

Pure heuristic: cluster passes whose rise times are within `time_window_s` AND whose peak azimuths are within `angle_window_deg`. Each cluster becomes a `TrainPass` aggregating its members.

**Files:**
- Create: `core/trains/__init__.py`
- Create: `core/trains/clustering.py`
- Test: `tests/unit/test_trains.py`

- [ ] **Step 1: Create `core/trains/__init__.py`**

```python
"""Trains — heuristic clustering of co-flying satellite passes into train events."""
from core.trains.clustering import group_into_trains

__all__ = ["group_into_trains"]
```

- [ ] **Step 2: Write the failing tests**

Create `tests/unit/test_trains.py`:

```python
"""Tests for core.trains.clustering."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from core._types import AngularPosition, Pass, PassEndpoint, TrainPass
from core.trains.clustering import group_into_trains


def _pass(norad_id: int, rise_time: datetime, peak_az: float) -> Pass:
    return Pass(
        id=f"{norad_id}-{rise_time.strftime('%Y%m%d%H%M%S')}",
        norad_id=norad_id,
        name=f"STARLINK-{norad_id}",
        rise=PassEndpoint(time=rise_time, position=AngularPosition(peak_az - 90.0, 5.0)),
        peak=PassEndpoint(time=rise_time + timedelta(minutes=3), position=AngularPosition(peak_az, 60.0)),
        set=PassEndpoint(time=rise_time + timedelta(minutes=6), position=AngularPosition(peak_az + 90.0, 5.0)),
        duration_s=360,
        max_magnitude=4.0,
        sunlit_fraction=1.0,
        tle_epoch=rise_time,
        terrain_blocked_ranges=(),
    )


def test_no_passes_returns_empty():
    assert group_into_trains([]) == []


def test_single_pass_is_not_clustered():
    base = datetime(2026, 5, 1, 2, 0, 0, tzinfo=timezone.utc)
    result = group_into_trains([_pass(44713, base, 180.0)])
    assert len(result) == 1
    assert isinstance(result[0], Pass)


def test_co_flying_passes_become_one_trainpass():
    base = datetime(2026, 5, 1, 2, 0, 0, tzinfo=timezone.utc)
    passes = [
        _pass(44713, base, 180.0),
        _pass(44714, base + timedelta(seconds=5), 180.5),
        _pass(44715, base + timedelta(seconds=10), 181.0),
    ]

    result = group_into_trains(passes, time_window_s=60, angle_window_deg=2)

    assert len(result) == 1
    tp = result[0]
    assert isinstance(tp, TrainPass)
    assert tp.member_norad_ids == (44713, 44714, 44715)
    assert len(tp.member_passes) == 3
    # Envelope: earliest rise + latest set
    assert tp.rise.time == passes[0].rise.time
    assert tp.set.time == passes[-1].set.time


def test_passes_outside_time_window_are_not_clustered():
    base = datetime(2026, 5, 1, 2, 0, 0, tzinfo=timezone.utc)
    passes = [
        _pass(44713, base, 180.0),
        _pass(44714, base + timedelta(minutes=10), 180.5),  # 10 minutes later
    ]

    result = group_into_trains(passes, time_window_s=60)

    assert len(result) == 2
    assert all(isinstance(p, Pass) for p in result)


def test_passes_outside_azimuth_window_are_not_clustered():
    base = datetime(2026, 5, 1, 2, 0, 0, tzinfo=timezone.utc)
    passes = [
        _pass(44713, base, 180.0),
        _pass(44714, base + timedelta(seconds=5), 210.0),  # 30° different azimuth
    ]

    result = group_into_trains(passes, angle_window_deg=2)

    assert len(result) == 2
    assert all(isinstance(p, Pass) for p in result)


def test_mixed_clusters_and_singletons():
    base = datetime(2026, 5, 1, 2, 0, 0, tzinfo=timezone.utc)
    passes = [
        # Cluster 1 (three members)
        _pass(44713, base, 180.0),
        _pass(44714, base + timedelta(seconds=5), 180.5),
        _pass(44715, base + timedelta(seconds=10), 181.0),
        # Singleton, different time
        _pass(25544, base + timedelta(hours=1), 90.0),
        # Cluster 2 (two members)
        _pass(44800, base + timedelta(hours=2), 0.0),
        _pass(44801, base + timedelta(hours=2, seconds=15), 1.0),
    ]

    result = group_into_trains(passes)

    # Preserves time order of clusters
    assert [type(x).__name__ for x in result] == ["TrainPass", "Pass", "TrainPass"]
    assert result[0].member_norad_ids == (44713, 44714, 44715)  # type: ignore[union-attr]
    assert result[2].member_norad_ids == (44800, 44801)  # type: ignore[union-attr]
```

- [ ] **Step 3: Implement `core/trains/clustering.py`**

```python
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
```

- [ ] **Step 4: Run — should pass**

```bash
pytest tests/unit/test_trains.py -v
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add core/trains/__init__.py core/trains/clustering.py tests/unit/test_trains.py
git commit -m "feat(trains): Starlink train clustering heuristic"
```

---

## Task 10: FastAPI scaffold + settings + DI

The app factory pattern, with dependency-injection hooks for `TLEFetcher`, `TerrainFetcher`, and the skyfield `Timescale`/`ephemeris` singletons. No routes yet — they land one per task.

**Files:**
- Create: `api/__init__.py`
- Create: `api/settings.py`
- Create: `api/deps.py`
- Create: `api/app.py`
- Test: `tests/api_unit/__init__.py`
- Test: `tests/api_unit/test_app.py`
- Modify: `pyproject.toml` (add fastapi + uvicorn + pydantic-settings)

- [ ] **Step 1: Add deps to `pyproject.toml`**

Edit the `[project]` → `dependencies` list to also include:

```toml
  "fastapi>=0.115",
  "uvicorn>=0.30",
  "pydantic-settings>=2.3",
  "httpx>=0.27",
  "rasterio>=1.3",
```

Then reinstall:

```bash
uv pip install -e ".[dev]"
```

- [ ] **Step 2: Create `tests/api_unit/__init__.py`** (empty file)

- [ ] **Step 3: Write the failing test**

Create `tests/api_unit/test_app.py`:

```python
"""Smoke tests for the FastAPI app factory + settings."""
from __future__ import annotations

from fastapi.testclient import TestClient

from api.app import create_app
from api.settings import Settings


def test_app_starts_and_health_endpoint_returns_ok():
    app = create_app(Settings(cache_root="/tmp/satvis-test"))
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_settings_has_expected_defaults():
    s = Settings()
    assert s.cache_root.endswith(".satvis")
    assert s.tle_max_age_hours == 24
    assert s.horizon_radius_km == 50
```

- [ ] **Step 4: Implement `api/settings.py`**

```python
"""Pydantic settings for the API — read from env vars or defaults."""
from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration."""

    cache_root: str = str(Path.home() / ".satvis")
    tle_max_age_hours: int = 24
    horizon_radius_km: int = 50
    opentopography_api_key: str | None = None

    model_config = SettingsConfigDict(env_prefix="SATVIS_", env_file=".env", extra="ignore")
```

- [ ] **Step 5: Implement `api/deps.py`**

```python
"""FastAPI dependency providers — the hooks tests override for mocking."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends
from skyfield.api import Loader, Timescale
from skyfield.jpllib import SpiceKernel

from api.settings import Settings
from core.catalog.celestrak import CelestrakClient
from core.catalog.fetcher import TLEFetcher
from core.terrain.fetcher import TerrainFetcher
from core.terrain.opentopo import OpenTopoClient


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


@lru_cache(maxsize=1)
def _skyfield_loader(cache_root: str) -> Loader:
    cache = Path(cache_root) / "skyfield-cache"
    cache.mkdir(parents=True, exist_ok=True)
    return Loader(str(cache))


def get_timescale(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Timescale:
    return _skyfield_loader(settings.cache_root).timescale()


def get_ephemeris(
    settings: Annotated[Settings, Depends(get_settings)],
) -> SpiceKernel:
    return _skyfield_loader(settings.cache_root)("de421.bsp")


def get_tle_fetcher(
    settings: Annotated[Settings, Depends(get_settings)],
) -> TLEFetcher:
    return TLEFetcher(
        client=CelestrakClient(),
        cache_root=Path(settings.cache_root),
    )


def get_terrain_fetcher(
    settings: Annotated[Settings, Depends(get_settings)],
) -> TerrainFetcher:
    return TerrainFetcher(
        client=OpenTopoClient(api_key=settings.opentopography_api_key),
        cache_root=Path(settings.cache_root),
        radius_km=settings.horizon_radius_km,
    )
```

- [ ] **Step 6: Implement `api/app.py`**

```python
"""FastAPI app factory."""
from __future__ import annotations

from fastapi import FastAPI

from api.settings import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    """Return a FastAPI app configured from `settings`.

    Routes are registered here. Tests create a fresh app with
    overridden dependencies via `app.dependency_overrides`.
    """
    _settings = settings or Settings()
    app = FastAPI(title="Satellite Visibility", version="0.2.0")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    # Route modules register themselves here (later tasks).
    # from api.routes import passes, sky_track, horizon, tle_freshness
    # app.include_router(passes.router)
    # ...

    app.state.settings = _settings
    return app
```

- [ ] **Step 7: Create `api/__init__.py`**

```python
"""Satellite Visibility — FastAPI layer."""
from api.app import create_app

__all__ = ["create_app"]
```

- [ ] **Step 8: Run — should pass**

```bash
pytest tests/api_unit/test_app.py -v
```

Expected: 2 passed.

- [ ] **Step 9: Commit**

```bash
git add pyproject.toml api/ tests/api_unit/
git commit -m "feat(api): FastAPI scaffold with settings and DI"
```

---

## Task 11: Request/response schemas

Pydantic models mirror the dataclasses but are serialisable via FastAPI. Keep them in `api/schemas/` to isolate the serialization layer from the engine.

**Files:**
- Create: `api/schemas/__init__.py`
- Create: `api/schemas/requests.py`
- Create: `api/schemas/responses.py`
- Test: `tests/api_unit/test_schemas.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/api_unit/test_schemas.py`:

```python
"""Tests for api.schemas — round-tripping engine types through Pydantic."""
from __future__ import annotations

from datetime import datetime, timezone

from core._types import AngularPosition, Pass, PassEndpoint
from api.schemas.requests import PassesRequest, SkyTrackRequest
from api.schemas.responses import PassResponse, pass_to_response


def test_passes_request_parses_strings():
    body = {
        "lat": 40.7128,
        "lng": -74.0060,
        "elevation_m": 10,
        "query": "ISS",
        "from_utc": "2026-05-01T00:00:00Z",
        "to_utc": "2026-05-08T00:00:00Z",
        "mode": "naked-eye",
    }
    req = PassesRequest.model_validate(body)
    assert req.lat == 40.7128
    assert req.mode == "naked-eye"


def test_passes_request_rejects_bad_mode():
    import pydantic

    bad = {
        "lat": 0.0, "lng": 0.0, "elevation_m": 0, "query": "iss",
        "from_utc": "2026-05-01T00:00:00Z", "to_utc": "2026-05-08T00:00:00Z",
        "mode": "invalid",
    }
    try:
        PassesRequest.model_validate(bad)
        raise AssertionError("expected validation error")
    except pydantic.ValidationError:
        pass


def test_pass_to_response_roundtrip():
    t0 = datetime(2026, 5, 1, 2, 0, 0, tzinfo=timezone.utc)
    p = Pass(
        id="25544-20260501020000",
        norad_id=25544,
        name="ISS (ZARYA)",
        rise=PassEndpoint(time=t0, position=AngularPosition(30.0, 10.0)),
        peak=PassEndpoint(time=t0, position=AngularPosition(180.0, 60.0)),
        set=PassEndpoint(time=t0, position=AngularPosition(300.0, 10.0)),
        duration_s=300,
        max_magnitude=-2.5,
        sunlit_fraction=0.9,
        tle_epoch=t0,
        terrain_blocked_ranges=(),
    )
    resp = pass_to_response(p)
    assert isinstance(resp, PassResponse)
    assert resp.id == p.id
    assert resp.peak.elevation_deg == 60.0
    data = resp.model_dump()
    assert data["max_magnitude"] == -2.5


def test_sky_track_request_validates():
    body = {
        "lat": 40.7128, "lng": -74.0060, "elevation_m": 10,
        "query": "ISS",
        "from_utc": "2026-05-01T00:00:00Z",
        "to_utc": "2026-05-01T00:05:00Z",
        "dt_seconds": 5,
    }
    req = SkyTrackRequest.model_validate(body)
    assert req.dt_seconds == 5
```

- [ ] **Step 2: Create `api/schemas/__init__.py`** (empty file)

- [ ] **Step 3: Implement `api/schemas/requests.py`**

```python
"""Request-body Pydantic models for the API."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class _ObserverFields(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)
    elevation_m: float = 0.0


class PassesRequest(_ObserverFields):
    query: str = Field(..., min_length=1)
    from_utc: datetime
    to_utc: datetime
    mode: Literal["line-of-sight", "naked-eye"] = "line-of-sight"
    min_magnitude: float | None = None


class SkyTrackRequest(_ObserverFields):
    query: str = Field(..., min_length=1)
    from_utc: datetime
    to_utc: datetime
    dt_seconds: int = Field(1, ge=1, le=3600)
```

- [ ] **Step 4: Implement `api/schemas/responses.py`**

```python
"""Response Pydantic models — mirror engine types for JSON serialization."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional, Union

from pydantic import BaseModel

from core._types import Pass, TrackSample, TrainPass


class AngularPositionResponse(BaseModel):
    azimuth_deg: float
    elevation_deg: float


class PassEndpointResponse(BaseModel):
    time: datetime
    azimuth_deg: float
    elevation_deg: float


class PassResponse(BaseModel):
    kind: Literal["single"] = "single"
    id: str
    norad_id: int
    name: str
    rise: PassEndpointResponse
    peak: PassEndpointResponse
    set: PassEndpointResponse
    duration_s: int
    max_magnitude: Optional[float]
    sunlit_fraction: float
    tle_epoch: datetime


class TrainPassResponse(BaseModel):
    kind: Literal["train"] = "train"
    id: str
    name: str
    member_norad_ids: list[int]
    rise: PassEndpointResponse
    peak: PassEndpointResponse
    set: PassEndpointResponse
    duration_s: int
    max_magnitude: Optional[float]
    member_count: int


class TrackSampleResponse(BaseModel):
    time: datetime
    lat: float
    lng: float
    alt_km: float
    az: float
    el: float
    range_km: float
    velocity_km_s: float
    magnitude: Optional[float]
    sunlit: bool
    observer_dark: bool


class TLEFreshnessResponse(BaseModel):
    norad_id: int
    name: str
    tle_epoch: datetime
    fetched_age_seconds: float


class HorizonResponse(BaseModel):
    lat: float
    lng: float
    radius_km: int
    samples_deg: list[float]


class PassesResponse(BaseModel):
    query: str
    resolved_name: str
    passes: list[Union[PassResponse, TrainPassResponse]]
    tle_age_seconds: Optional[float]


def _endpoint_to_response(ep) -> PassEndpointResponse:
    return PassEndpointResponse(
        time=ep.time,
        azimuth_deg=ep.position.azimuth_deg,
        elevation_deg=ep.position.elevation_deg,
    )


def pass_to_response(p: Pass) -> PassResponse:
    return PassResponse(
        id=p.id,
        norad_id=p.norad_id,
        name=p.name,
        rise=_endpoint_to_response(p.rise),
        peak=_endpoint_to_response(p.peak),
        set=_endpoint_to_response(p.set),
        duration_s=p.duration_s,
        max_magnitude=p.max_magnitude,
        sunlit_fraction=p.sunlit_fraction,
        tle_epoch=p.tle_epoch,
    )


def trainpass_to_response(tp: TrainPass) -> TrainPassResponse:
    return TrainPassResponse(
        id=tp.id,
        name=tp.name,
        member_norad_ids=list(tp.member_norad_ids),
        rise=_endpoint_to_response(tp.rise),
        peak=_endpoint_to_response(tp.peak),
        set=_endpoint_to_response(tp.set),
        duration_s=tp.duration_s,
        max_magnitude=tp.max_magnitude,
        member_count=len(tp.member_passes),
    )


def track_sample_to_response(s: TrackSample) -> TrackSampleResponse:
    return TrackSampleResponse(
        time=s.time,
        lat=s.lat,
        lng=s.lng,
        alt_km=s.alt_km,
        az=s.az,
        el=s.el,
        range_km=s.range_km,
        velocity_km_s=s.velocity_km_s,
        magnitude=s.magnitude,
        sunlit=s.sunlit,
        observer_dark=s.observer_dark,
    )
```

- [ ] **Step 5: Run — should pass**

```bash
pytest tests/api_unit/test_schemas.py -v
```

Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add api/schemas/ tests/api_unit/test_schemas.py
git commit -m "feat(api): request and response schemas"
```

---

## Task 12: POST /passes

The flagship endpoint. Resolves query → per-NORAD TLEs → predict → filter → (if group) group into trains → return.

**Files:**
- Create: `api/routes/__init__.py`
- Create: `api/routes/passes.py`
- Modify: `api/app.py` (register router)
- Test: `tests/api_unit/test_passes_route.py`

- [ ] **Step 1: Write the failing test**

Create `tests/api_unit/test_passes_route.py`:

```python
"""Tests for POST /passes route (with mocked upstream fetchers)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from skyfield.api import load

from api.app import create_app
from api.deps import get_ephemeris, get_terrain_fetcher, get_timescale, get_tle_fetcher
from api.settings import Settings
from core._types import HorizonMask
from core.catalog.tle_parser import parse_tle_file

TLE_PATH = "tests/fixtures/tle/iss_25544.txt"


def _fake_tle_fetcher():
    tle = parse_tle_file(TLE_PATH)
    fake = MagicMock()
    fake.get_tle.return_value = (tle, 120.0)
    fake.get_group_tles.return_value = ([tle], 120.0)
    return fake


def _fake_terrain_fetcher():
    # No blockage — zero-elevation mask.
    fake = MagicMock()
    fake.get_horizon_mask.return_value = HorizonMask(samples_deg=tuple(0.0 for _ in range(360)))
    return fake


def _build_client() -> TestClient:
    app = create_app(Settings(cache_root="/tmp/satvis-test"))
    app.dependency_overrides[get_tle_fetcher] = _fake_tle_fetcher
    app.dependency_overrides[get_terrain_fetcher] = _fake_terrain_fetcher
    app.dependency_overrides[get_timescale] = lambda: load.timescale()
    app.dependency_overrides[get_ephemeris] = lambda: load("de421.bsp")
    return TestClient(app)


def test_passes_returns_passes_for_iss():
    client = _build_client()
    tle = parse_tle_file(TLE_PATH)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=24)

    response = client.post("/passes", json={
        "lat": 40.7128,
        "lng": -74.0060,
        "elevation_m": 10,
        "query": "ISS",
        "from_utc": start.isoformat(),
        "to_utc": end.isoformat(),
        "mode": "line-of-sight",
    })

    assert response.status_code == 200
    body = response.json()
    assert body["resolved_name"] == "ISS (ZARYA)"
    assert len(body["passes"]) >= 2
    assert body["passes"][0]["kind"] == "single"
    assert body["tle_age_seconds"] == 120.0


def test_passes_returns_404_when_query_unresolvable():
    client = _build_client()
    tle = parse_tle_file(TLE_PATH)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=1)

    response = client.post("/passes", json={
        "lat": 0.0, "lng": 0.0, "elevation_m": 0,
        "query": "NOTAREALSATELLITE",
        "from_utc": start.isoformat(),
        "to_utc": end.isoformat(),
        "mode": "line-of-sight",
    })

    assert response.status_code == 404
```

- [ ] **Step 2: Create `api/routes/__init__.py`** (empty)

- [ ] **Step 3: Implement `api/routes/passes.py`**

```python
"""POST /passes — predict visibility windows for a query + observer + window."""
from __future__ import annotations

from datetime import datetime
from typing import Annotated, Union

from fastapi import APIRouter, Depends, HTTPException
from skyfield.api import Timescale
from skyfield.jpllib import SpiceKernel

from api.deps import get_ephemeris, get_terrain_fetcher, get_timescale, get_tle_fetcher
from api.schemas.requests import PassesRequest
from api.schemas.responses import (
    PassesResponse,
    PassResponse,
    TrainPassResponse,
    pass_to_response,
    trainpass_to_response,
)
from core._types import Observer, Pass, TLE
from core.catalog.fetcher import TLEFetcher
from core.catalog.search import DEFAULT_CATALOG, resolve
from core.orbital.passes import predict_passes
from core.terrain.fetcher import TerrainFetcher
from core.trains.clustering import group_into_trains
from core.visibility.filter import filter_passes

router = APIRouter()


def _observer_from_request(req: PassesRequest) -> Observer:
    return Observer(lat=req.lat, lng=req.lng, elevation_m=req.elevation_m)


@router.post("/passes", response_model=PassesResponse)
def post_passes(
    req: PassesRequest,
    tle_fetcher: Annotated[TLEFetcher, Depends(get_tle_fetcher)],
    terrain: Annotated[TerrainFetcher, Depends(get_terrain_fetcher)],
    timescale: Annotated[Timescale, Depends(get_timescale)],
    ephemeris: Annotated[SpiceKernel, Depends(get_ephemeris)],
) -> PassesResponse:
    try:
        resolution = resolve(req.query, catalog=DEFAULT_CATALOG)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    observer = _observer_from_request(req)
    horizon = terrain.get_horizon_mask(observer)

    tles: list[TLE] = []
    ages: list[float] = []
    if resolution.type == "single":
        tle, age = tle_fetcher.get_tle(resolution.norad_ids[0])
        tles.append(tle)
        ages.append(age)
    else:
        # Use group endpoint for efficiency. `resolution.display_name` is the group name.
        group_tles, age = tle_fetcher.get_group_tles(resolution.display_name)
        # Filter to the ids we resolved (some group endpoints return extras).
        wanted = set(resolution.norad_ids)
        tles.extend(t for t in group_tles if t.norad_id in wanted)
        ages.append(age)

    all_passes: list[Pass] = []
    for tle in tles:
        tle_passes = predict_passes(
            tle, observer, req.from_utc, req.to_utc,
            timescale=timescale,
            horizon_mask=horizon,
        )
        filtered = filter_passes(
            tle_passes, tle, observer,
            mode=req.mode,
            timescale=timescale,
            ephemeris=ephemeris,
            min_magnitude=req.min_magnitude,
        )
        all_passes.extend(filtered)
    all_passes.sort(key=lambda p: p.rise.time)

    grouped = group_into_trains(all_passes) if resolution.type == "group" else all_passes

    items: list[Union[PassResponse, TrainPassResponse]] = []
    for event in grouped:
        if isinstance(event, Pass):
            items.append(pass_to_response(event))
        else:
            items.append(trainpass_to_response(event))

    return PassesResponse(
        query=req.query,
        resolved_name=resolution.display_name,
        passes=items,
        tle_age_seconds=ages[0] if ages else None,
    )
```

- [ ] **Step 4: Register the router in `api/app.py`**

Replace `api/app.py` full contents:

```python
"""FastAPI app factory."""
from __future__ import annotations

from fastapi import FastAPI

from api.routes.passes import router as passes_router
from api.settings import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    """Return a FastAPI app configured from `settings`."""
    _settings = settings or Settings()
    app = FastAPI(title="Satellite Visibility", version="0.2.0")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(passes_router)

    app.state.settings = _settings
    return app
```

- [ ] **Step 5: Run — should pass**

```bash
pytest tests/api_unit/test_passes_route.py -v
```

Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add api/routes/__init__.py api/routes/passes.py api/app.py tests/api_unit/test_passes_route.py
git commit -m "feat(api): POST /passes endpoint"
```

---

## Task 13: POST /sky-track

Dense sampling endpoint — for a given TLE + observer + window, returns a list of `TrackSample`. Drives the timeline/animation in M3+.

**Files:**
- Create: `api/routes/sky_track.py`
- Modify: `api/app.py`
- Test: `tests/api_unit/test_sky_track_route.py`

- [ ] **Step 1: Write the failing test**

Create `tests/api_unit/test_sky_track_route.py`:

```python
"""Tests for POST /sky-track."""
from __future__ import annotations

from datetime import timedelta, timezone
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from skyfield.api import load

from api.app import create_app
from api.deps import get_ephemeris, get_terrain_fetcher, get_timescale, get_tle_fetcher
from api.settings import Settings
from core.catalog.tle_parser import parse_tle_file

TLE_PATH = "tests/fixtures/tle/iss_25544.txt"


def _fake_tle_fetcher():
    tle = parse_tle_file(TLE_PATH)
    fake = MagicMock()
    fake.get_tle.return_value = (tle, 100.0)
    return fake


def _build_client() -> TestClient:
    app = create_app(Settings(cache_root="/tmp/satvis-test"))
    app.dependency_overrides[get_tle_fetcher] = _fake_tle_fetcher
    app.dependency_overrides[get_terrain_fetcher] = lambda: MagicMock()
    app.dependency_overrides[get_timescale] = lambda: load.timescale()
    app.dependency_overrides[get_ephemeris] = lambda: load("de421.bsp")
    return TestClient(app)


def test_sky_track_returns_samples_for_short_window():
    client = _build_client()
    tle = parse_tle_file(TLE_PATH)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(seconds=30)

    response = client.post("/sky-track", json={
        "lat": 40.7128, "lng": -74.0060, "elevation_m": 10,
        "query": "ISS",
        "from_utc": start.isoformat(),
        "to_utc": end.isoformat(),
        "dt_seconds": 10,
    })

    assert response.status_code == 200
    body = response.json()
    assert len(body["samples"]) == 3  # 0, 10, 20 seconds
    first = body["samples"][0]
    assert "az" in first and "el" in first and "range_km" in first
```

- [ ] **Step 2: Implement `api/routes/sky_track.py`**

```python
"""POST /sky-track — dense TrackSample entries over a short window."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from skyfield.api import Timescale
from skyfield.jpllib import SpiceKernel

from api.deps import get_ephemeris, get_timescale, get_tle_fetcher
from api.schemas.requests import SkyTrackRequest
from api.schemas.responses import TrackSampleResponse, track_sample_to_response
from core._types import Observer
from core.catalog.fetcher import TLEFetcher
from core.catalog.search import DEFAULT_CATALOG, resolve
from core.orbital.tracking import sample_track

router = APIRouter()


class SkyTrackResponse(BaseModel):
    resolved_name: str
    samples: list[TrackSampleResponse]


@router.post("/sky-track", response_model=SkyTrackResponse)
def post_sky_track(
    req: SkyTrackRequest,
    tle_fetcher: Annotated[TLEFetcher, Depends(get_tle_fetcher)],
    timescale: Annotated[Timescale, Depends(get_timescale)],
    ephemeris: Annotated[SpiceKernel, Depends(get_ephemeris)],
) -> SkyTrackResponse:
    try:
        resolution = resolve(req.query, catalog=DEFAULT_CATALOG)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if resolution.type != "single":
        raise HTTPException(
            status_code=400,
            detail="sky-track expects a single satellite, not a group",
        )

    tle, _ = tle_fetcher.get_tle(resolution.norad_ids[0])
    observer = Observer(lat=req.lat, lng=req.lng, elevation_m=req.elevation_m)

    samples = sample_track(
        tle, observer, req.from_utc, req.to_utc,
        timescale=timescale,
        ephemeris=ephemeris,
        dt_seconds=req.dt_seconds,
    )

    return SkyTrackResponse(
        resolved_name=resolution.display_name,
        samples=[track_sample_to_response(s) for s in samples],
    )
```

- [ ] **Step 3: Register the router in `api/app.py`**

Replace the imports + `include_router` lines:

```python
from api.routes.passes import router as passes_router
from api.routes.sky_track import router as sky_track_router
```

And in `create_app`:

```python
    app.include_router(passes_router)
    app.include_router(sky_track_router)
```

- [ ] **Step 4: Run — should pass**

```bash
pytest tests/api_unit/test_sky_track_route.py -v
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add api/routes/sky_track.py api/app.py tests/api_unit/test_sky_track_route.py
git commit -m "feat(api): POST /sky-track endpoint"
```

---

## Task 14: GET /horizon

Returns the computed horizon mask for a given observer location — useful for M3's sky view to render the terrain silhouette.

**Files:**
- Create: `api/routes/horizon.py`
- Modify: `api/app.py`
- Test: `tests/api_unit/test_horizon_route.py`

- [ ] **Step 1: Write the failing test**

Create `tests/api_unit/test_horizon_route.py`:

```python
"""Tests for GET /horizon."""
from __future__ import annotations

from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from api.app import create_app
from api.deps import get_terrain_fetcher
from api.settings import Settings
from core._types import HorizonMask


def test_horizon_returns_360_samples():
    app = create_app(Settings(cache_root="/tmp/satvis-test"))

    fake = MagicMock()
    fake.get_horizon_mask.return_value = HorizonMask(
        samples_deg=tuple(float(i) * 0.1 for i in range(360)),
    )
    app.dependency_overrides[get_terrain_fetcher] = lambda: fake

    with TestClient(app) as client:
        response = client.get("/horizon", params={
            "lat": 40.7128, "lng": -74.0060, "elevation_m": 10,
        })

    assert response.status_code == 200
    body = response.json()
    assert len(body["samples_deg"]) == 360
    assert body["lat"] == 40.7128
    assert body["samples_deg"][0] == 0.0
```

- [ ] **Step 2: Implement `api/routes/horizon.py`**

```python
"""GET /horizon — the 360° terrain horizon mask for an observer."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from api.deps import get_settings, get_terrain_fetcher
from api.schemas.responses import HorizonResponse
from api.settings import Settings
from core._types import Observer
from core.terrain.fetcher import TerrainFetcher

router = APIRouter()


@router.get("/horizon", response_model=HorizonResponse)
def get_horizon(
    terrain: Annotated[TerrainFetcher, Depends(get_terrain_fetcher)],
    settings: Annotated[Settings, Depends(get_settings)],
    lat: float = Query(..., ge=-90.0, le=90.0),
    lng: float = Query(..., ge=-180.0, le=180.0),
    elevation_m: float = 0.0,
) -> HorizonResponse:
    observer = Observer(lat=lat, lng=lng, elevation_m=elevation_m)
    mask = terrain.get_horizon_mask(observer)
    return HorizonResponse(
        lat=lat,
        lng=lng,
        radius_km=settings.horizon_radius_km,
        samples_deg=list(mask.samples_deg),
    )
```

- [ ] **Step 3: Register router in `api/app.py`**

Add import + include line alongside the others.

- [ ] **Step 4: Run — should pass**

```bash
pytest tests/api_unit/test_horizon_route.py -v
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add api/routes/horizon.py api/app.py tests/api_unit/test_horizon_route.py
git commit -m "feat(api): GET /horizon endpoint"
```

---

## Task 15: GET /tle-freshness

Inspection endpoint — given a query, return the resolved NORAD(s) and the age of their cached TLEs. Supports the frontend's "TLE epoch: X hours ago" UI.

**Files:**
- Create: `api/routes/tle_freshness.py`
- Modify: `api/app.py`
- Test: `tests/api_unit/test_tle_freshness_route.py`

- [ ] **Step 1: Write the failing test**

Create `tests/api_unit/test_tle_freshness_route.py`:

```python
"""Tests for GET /tle-freshness."""
from __future__ import annotations

from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from api.app import create_app
from api.deps import get_tle_fetcher
from api.settings import Settings
from core.catalog.tle_parser import parse_tle_file

TLE_PATH = "tests/fixtures/tle/iss_25544.txt"


def test_tle_freshness_returns_age_for_single_query():
    app = create_app(Settings(cache_root="/tmp/satvis-test"))
    tle = parse_tle_file(TLE_PATH)

    fake = MagicMock()
    fake.get_tle.return_value = (tle, 3600.0)
    app.dependency_overrides[get_tle_fetcher] = lambda: fake

    with TestClient(app) as client:
        response = client.get("/tle-freshness", params={"query": "ISS"})

    assert response.status_code == 200
    body = response.json()
    assert body[0]["norad_id"] == 25544
    assert body[0]["fetched_age_seconds"] == 3600.0


def test_tle_freshness_returns_404_for_unknown_query():
    app = create_app(Settings(cache_root="/tmp/satvis-test"))
    app.dependency_overrides[get_tle_fetcher] = lambda: MagicMock()

    with TestClient(app) as client:
        response = client.get("/tle-freshness", params={"query": "NOPE"})

    assert response.status_code == 404
```

- [ ] **Step 2: Implement `api/routes/tle_freshness.py`**

```python
"""GET /tle-freshness — surface the cached TLE age for a query."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import get_tle_fetcher
from api.schemas.responses import TLEFreshnessResponse
from core.catalog.fetcher import TLEFetcher
from core.catalog.search import DEFAULT_CATALOG, resolve

router = APIRouter()


@router.get("/tle-freshness", response_model=list[TLEFreshnessResponse])
def get_tle_freshness(
    query: Annotated[str, Query(min_length=1)],
    tle_fetcher: Annotated[TLEFetcher, Depends(get_tle_fetcher)],
) -> list[TLEFreshnessResponse]:
    try:
        resolution = resolve(query, catalog=DEFAULT_CATALOG)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    out: list[TLEFreshnessResponse] = []
    if resolution.type == "single":
        tle, age = tle_fetcher.get_tle(resolution.norad_ids[0])
        out.append(TLEFreshnessResponse(
            norad_id=tle.norad_id,
            name=tle.name,
            tle_epoch=tle.epoch,
            fetched_age_seconds=age,
        ))
    else:
        tles, age = tle_fetcher.get_group_tles(resolution.display_name)
        wanted = set(resolution.norad_ids)
        for t in tles:
            if t.norad_id not in wanted:
                continue
            out.append(TLEFreshnessResponse(
                norad_id=t.norad_id,
                name=t.name,
                tle_epoch=t.epoch,
                fetched_age_seconds=age,
            ))
    return out
```

- [ ] **Step 3: Register router in `api/app.py`**

Add import + include line.

- [ ] **Step 4: Run — should pass**

```bash
pytest tests/api_unit/test_tle_freshness_route.py -v
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add api/routes/tle_freshness.py api/app.py tests/api_unit/test_tle_freshness_route.py
git commit -m "feat(api): GET /tle-freshness endpoint"
```

---

## Task 16: End-to-end integration test

One integration test that wires real engine + real schemas + faked network, and POSTs to `/passes` exactly the way a frontend would. Verifies the full path including pagination into `passes[]` with `kind="single"` entries.

**Files:**
- Create: `tests/integration/__init__.py` (empty)
- Create: `tests/integration/test_api_end_to_end.py`

- [ ] **Step 1: Create `tests/integration/__init__.py`** (empty)

- [ ] **Step 2: Write the integration test**

Create `tests/integration/test_api_end_to_end.py`:

```python
"""End-to-end: POST /passes with mocked upstream HTTP, real engine stack."""
from __future__ import annotations

from datetime import timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock

import httpx
import pytest
from fastapi.testclient import TestClient
from skyfield.api import load

from api.app import create_app
from api.deps import get_ephemeris, get_terrain_fetcher, get_timescale, get_tle_fetcher
from api.settings import Settings
from core._types import HorizonMask
from core.catalog.celestrak import CelestrakClient
from core.catalog.fetcher import TLEFetcher
from core.catalog.tle_parser import parse_tle_file

CELESTRAK_FIX = Path(__file__).resolve().parents[1] / "fixtures" / "celestrak" / "iss_single.json"
TLE_PATH = Path(__file__).resolve().parents[1] / "fixtures" / "tle" / "iss_25544.txt"


def _fake_transport_from(path: Path) -> httpx.MockTransport:
    body = path.read_text()
    return httpx.MockTransport(lambda req: httpx.Response(200, text=body))


def _fake_terrain():
    fake = MagicMock()
    fake.get_horizon_mask.return_value = HorizonMask(
        samples_deg=tuple(0.0 for _ in range(360)),
    )
    return fake


@pytest.fixture
def client(tmp_path):
    app = create_app(Settings(cache_root=str(tmp_path)))

    tle_client = CelestrakClient(transport=_fake_transport_from(CELESTRAK_FIX))
    app.dependency_overrides[get_tle_fetcher] = lambda: TLEFetcher(
        client=tle_client, cache_root=tmp_path,
    )
    app.dependency_overrides[get_terrain_fetcher] = _fake_terrain
    app.dependency_overrides[get_timescale] = lambda: load.timescale()
    app.dependency_overrides[get_ephemeris] = lambda: load("de421.bsp")
    return TestClient(app)


def test_post_passes_end_to_end_iss_24h(client: TestClient):
    tle = parse_tle_file(TLE_PATH)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=24)

    response = client.post("/passes", json={
        "lat": 40.7128,
        "lng": -74.0060,
        "elevation_m": 10,
        "query": "ISS",
        "from_utc": start.isoformat(),
        "to_utc": end.isoformat(),
        "mode": "line-of-sight",
    })

    assert response.status_code == 200
    body = response.json()
    assert body["resolved_name"] == "ISS (ZARYA)"
    assert len(body["passes"]) >= 2
    for p in body["passes"]:
        assert p["kind"] == "single"
        assert p["norad_id"] == 25544
        assert 0.0 <= p["peak"]["elevation_deg"] <= 90.0
```

- [ ] **Step 3: Run — should pass**

```bash
pytest tests/integration -v
```

Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/
git commit -m "test(integration): end-to-end /passes over real engine"
```

---

## Task 17: Launcher script

One command to start the local API.

**Files:**
- Create: `scripts/serve.sh`

- [ ] **Step 1: Write `scripts/serve.sh`**

```bash
#!/usr/bin/env bash
# Start the local satellite-visibility API.
# Binds to 127.0.0.1 only — never exposes to the network.

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -d .venv ]]; then
  echo "error: .venv not found. Run 'uv venv && uv pip install -e \".[dev]\"' first." >&2
  exit 1
fi

# shellcheck disable=SC1091
source .venv/bin/activate

HOST="${SATVIS_HOST:-127.0.0.1}"
PORT="${SATVIS_PORT:-8765}"

echo "Starting Satellite Visibility API on http://${HOST}:${PORT}"
echo "OpenAPI docs: http://${HOST}:${PORT}/docs"
echo

exec uvicorn "api.app:create_app" --factory --host "${HOST}" --port "${PORT}" --reload
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/serve.sh
```

- [ ] **Step 3: Smoke test (optional — do NOT commit the background process)**

In one terminal:

```bash
./scripts/serve.sh &
SERVER_PID=$!
sleep 2
curl -s http://127.0.0.1:8765/health
echo
kill $SERVER_PID 2>/dev/null || true
```

Expected: `{"status":"ok"}`

- [ ] **Step 4: Commit**

```bash
git add scripts/serve.sh
git commit -m "feat(scripts): local API launcher"
```

---

## Task 18: Update README + accuracy log for M2

**Files:**
- Modify: `README.md`
- Modify: `docs/accuracy-log.md`

- [ ] **Step 1: Update `README.md` — add an "API" section**

Append after the "Quick demo" section:

```markdown
## Run the local API

```bash
./scripts/serve.sh
```

This binds on `127.0.0.1:8765` and exposes:

- `POST /passes` — predicted passes (single satellite or group, with train clustering)
- `POST /sky-track` — dense per-second samples for animating a pass
- `GET /horizon?lat=…&lng=…` — 360° terrain horizon mask
- `GET /tle-freshness?query=…` — how old the cached TLEs are
- `GET /docs` — interactive OpenAPI UI

Quick test:

```bash
curl -s -X POST http://127.0.0.1:8765/passes \
  -H 'content-type: application/json' \
  -d '{
    "lat": 40.7128, "lng": -74.0060, "elevation_m": 10,
    "query": "ISS",
    "from_utc": "2026-05-01T00:00:00Z",
    "to_utc": "2026-05-08T00:00:00Z",
    "mode": "line-of-sight"
  }' | python -m json.tool | head -40
```

### OpenTopography API key

Terrain-based horizon masks require a free OpenTopography API key. Register at
https://portal.opentopography.org/ and export:

```bash
export SATVIS_OPENTOPOGRAPHY_API_KEY=your-key-here
```

Without a key, `/passes` and `/horizon` will return HTTP 500 with a clear
error message. The fallback is to pass `horizon_mask=null` (not a flag
the API currently exposes — a future enhancement).
```

- [ ] **Step 2: Update `docs/accuracy-log.md` — add an M2 row**

Append a new row to the table:

```markdown
| 2026-04-20 | /passes endpoint sanity: ISS over NYC, 24 h, line-of-sight | Engine-derived via `tests/integration/test_api_end_to_end.py` | Integration test asserts ≥ 2 passes with valid geometry; must be re-verified against Heavens-Above before claim | M2 seed. Integration-level regression guard only. |
```

- [ ] **Step 3: Commit**

```bash
git add README.md docs/accuracy-log.md
git commit -m "docs: README and accuracy log updates for M2"
```

---

## Task 19: Final suite + coverage + tag

- [ ] **Step 1: Full test run with coverage**

```bash
pytest --cov=core --cov=api --cov-report=term-missing
```

Expected: all tests pass. Coverage ≥ 90% for both `core/` and `api/`. If a specific file is below, report it; do NOT pad with trivial tests.

- [ ] **Step 2: Lint**

```bash
ruff check core api tests scripts
```

Expected: no errors. Fix any that appear.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "chore: M2 lint and coverage cleanup" || echo "nothing to commit"
```

- [ ] **Step 4: Tag**

```bash
git tag -a m2-terrain-api -m "M2: terrain + API"
git tag -l
```

Expected: `m2-terrain-api` appears in the list.

---

## M2 Completion Criteria

- [ ] All unit tests pass (`pytest tests/unit tests/api_unit`)
- [ ] Integration test passes (`pytest tests/integration`)
- [ ] `curl` against a running `scripts/serve.sh` returns a pass list (smoke-tested manually)
- [ ] `core/` + `api/` combined coverage ≥ 90%
- [ ] `ruff check` clean
- [ ] OpenTopography API key documented in README
- [ ] `m2-terrain-api` git tag created
