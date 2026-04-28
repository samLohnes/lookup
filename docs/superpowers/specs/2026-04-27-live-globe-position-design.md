# Live Globe Position Design

**Status:** Drafted 2026-04-27. Addresses [follow-up §2](../../follow-ups.md) ("Live satellite position on 3D globe when no pass is selected").

**Goal:** When a satellite (or group) is searched in cinematic mode but no pass is selected, drive the existing globe satellite-marker from a polled "current position" backend feed instead of leaving it hidden. Add a faint trailing ground-track behind each marker so motion is visible at globe scale. Reuses the existing engine (`sample_track`), the existing marker mesh shape, and the existing `PanelTelemetry` UI surface — no new visual primitives.

**Architecture:** Two new stateless backend endpoints (`/now-positions` polled at 5 s, `/now-tracks` called once per satellite-change) reuse `core.orbital.tracking.sample_track`. A new zustand store + lifecycle hook on the frontend orchestrates polling, pause-on-tab-hide, pause-on-pass-selected, and seed-on-satellite-change. The render frame interpolates between polls using numerical differentiation across consecutive samples (no client-side SGP4). Group queries (e.g., `stations` with 2 sats) get N markers + N trails in parallel; selecting a pass exits live mode entirely.

**Tech Stack:** Python 3.12, skyfield, FastAPI/Pydantic. React 19 + zustand + Three.js. No new dependencies.

---

## 1. Context

[`docs/follow-ups.md`](../../follow-ups.md) §2 documents that in cinematic mode, when no pass is selected, the 3D globe shows a static earth + observer pin + nothing. The most visually expensive view in the app is doing the least most of the time the user is on the page.

The follow-up writeup proposes a `/now-position` endpoint with ~1 Hz polling and a separate trailing-track call. Refinements landed during this brainstorming session:

- **5 s polling + client-side extrapolation** instead of 1 Hz. LEO sats move ~7.5 km/s; at 5 s polling the marker would jump ~30 % of its diameter per frame (janky). With per-frame extrapolation from the latest two polled positions, the marker animates smoothly at 60 fps and snap-corrects every 5 s. Standard game-loop pattern. Sub-pixel divergence over the 5 s window at globe scale.
- **Group queries get N markers + N trails** rather than disabling live mode for groups. The catalog's groups are tiny (`stations` = 2, `earth-observation` = 4, max), and Starlink trains cluster too tightly to overwhelm the view (~20 dots in formation reads as one moving cluster). Backend cost stays trivial: N propagations per 5 s poll.
- **Selecting a pass exits live mode entirely** (rather than disabling only that satellite's live marker). Keeps the mental model "either you're watching a pass, or you're watching the live globe" — no mixed-mode globe.
- **Seed call doubles as initial paint.** `/now-tracks` returns 10 min of trailing samples; the latest sample IS the current position, so the marker appears as soon as the seed resolves. No flash-of-empty-marker, no separate first-position fetch.

---

## 2. Goals & Non-Goals

### 2.1 Goals

1. **Two new endpoints** under `/now-positions` and `/now-tracks`, both reusing `core.orbital.tracking.sample_track`. Stateless: no per-session storage, no caching beyond what `sample_track` already does internally.
2. **One small engine helper** `sample_at(tle, observer, when, *, timescale, ephemeris) -> TrackSample` to avoid the awkward `sample_track(now, now+1s, dt=1)[0]` pattern at the route level.
3. **Live polling lifecycle** driven by a new `useLivePolling` hook at the cinematic root: on whenever `(searched_satellite_or_group) AND (no pass selected) AND (tab visible)`; off otherwise.
4. **N parallel markers and trails** on the globe for group queries. Markers all uniform orange (matching the existing pass-arc marker style); trails uniform faint opacity (no progress-gradient — that's a pass-arc affordance).
5. **`PanelTelemetry` repurpose:** when no pass is selected and live mode is active for a *single* satellite, populate the existing 6-cell grid (alt/el/az/range/velocity/mag) from the latest poll. For group live-mode the panel stays at "—" cells (no aggregate makes sense across N sats).
6. **Render-frame extrapolation:** the FE computes interpolation velocity from `(latest_polled - previous_polled) / dt` and advances the displayed marker linearly between polls. Snap-corrects with a ~250 ms ease on each new poll. The seed call's last two samples (30 s apart) seed the velocity vector before the first /now-positions poll lands.
7. **Tab-visibility integration:** Page Visibility API pauses polling when the tab is backgrounded; resumes on focus with an immediate fresh poll.
8. **Race-guard:** every fetch uses `AbortController`; if the search target changes mid-poll the in-flight request is cancelled. Stale responses never overwrite fresh state.

### 2.2 Non-goals

- **Client-side SGP4.** Vetoed in the original writeup. Numerical differentiation across consecutive polls gives us interpolation without the engine-divergence risk.
- **Sky-view live mode.** Per the writeup, the alt-az frame is meaningless when the satellite is below horizon (which is most of the time). Sky view stays empty until a pass is selected.
- **Telemetry overlay floating near the globe.** Reusing `PanelTelemetry` instead — same visual language for pass-mode and live-mode.
- **Per-satellite color hash.** All markers uniform orange. Tight visual coherence; the trail behind each marker provides directional cue per-sat.
- **Sunlit/eclipsed marker shading or below-horizon dimming.** The pass-arc marker doesn't do these today; pattern can be extended later if needed.
- **Hover-to-trail / centroid-trail logic for groups.** Groups get markers + trails for everyone (option B from brainstorming). If real usage shows the clutter is a problem, refine in a follow-up.
- **Mixed live + pass mode.** Selecting a pass disables *all* live markers, including non-selected group members.
- **Custom TLEs.** Separate follow-up ([`docs/follow-ups.md`](../../follow-ups.md) §3).
- **Velocity vector in the API response.** FE derives velocity from polled position deltas. Endpoint response stays close to the existing `TrackSample` shape; no schema bloat.
- **Server-Sent Events / WebSocket.** Polling is fine at 5 s cadence; the long-lived-connection complexity isn't justified.

---

## 3. Backend changes

### 3.1 `core/orbital/tracking.py` — `sample_at` helper

Add a single-sample wrapper around `sample_track`:

```python
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

    Equivalent to `sample_track(when, when + 1s, dt=1)[0]` but avoids
    the calling pattern. Used by /now-positions for instantaneous polls.
    """
    samples = sample_track(
        tle, observer, when, when + timedelta(seconds=1),
        timescale=timescale, ephemeris=ephemeris,
        dt_seconds=1, intrinsic_magnitude=intrinsic_magnitude,
    )
    return samples[0]
```

Unit test in `tests/unit/test_sample_at.py` verifies it matches `sample_track(when, when+1s)[0]` for a known TLE + observer.

### 3.2 `api/schemas/requests.py` — request models

```python
class _ObserverFieldsWithNorads(_ObserverFields):
    norad_ids: list[int] = Field(..., min_length=1)


class NowPositionsRequest(_ObserverFieldsWithNorads):
    """Single-instant position for one or more satellites."""
    pass  # observer + norads is the full contract


class NowTracksRequest(_ObserverFieldsWithNorads):
    """Trailing track for one or more satellites."""
    tail_minutes: int = Field(10, ge=1, le=60)
    dt_seconds: int = Field(30, ge=1, le=300)
```

Both validate `len(norad_ids) >= 1`. No upper bound enforced at the schema layer (the catalog is small enough that runaway calls aren't a realistic risk; if that changes a cap can be added).

### 3.3 `api/schemas/responses.py` — response models

```python
class NowPositionEntry(BaseModel):
    norad_id: int
    sample: TrackSampleResponse  # reuses existing shape


class NowPositionsResponse(BaseModel):
    entries: list[NowPositionEntry]


class NowTrackEntry(BaseModel):
    norad_id: int
    samples: list[TrackSampleResponse]


class NowTracksResponse(BaseModel):
    entries: list[NowTrackEntry]
```

`TrackSampleResponse` already carries `t_utc`, `lat`, `lng`, `alt_km`, `az`, `el`, `range_km`, `velocity_km_s`, `magnitude`, `sunlit`, `observer_dark`. No new sample fields.

### 3.4 `api/routes/now.py` — new route module

```python
"""POST /now-positions and /now-tracks — live-mode endpoints."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

router = APIRouter()


@router.post("/now-positions", response_model=NowPositionsResponse)
def post_now_positions(req, tle_fetcher, timescale, ephemeris):
    """One TrackSample per requested satellite, at 'now'."""
    now = datetime.now(timezone.utc)
    observer = Observer(lat=req.lat, lng=req.lng, elevation_m=req.elevation_m)
    entries = []
    for nid in req.norad_ids:
        tle, _ = tle_fetcher.get_tle(nid)
        sample = sample_at(tle, observer, now, timescale=timescale, ephemeris=ephemeris)
        entries.append(NowPositionEntry(norad_id=nid, sample=track_sample_to_response(sample)))
    return NowPositionsResponse(entries=entries)


@router.post("/now-tracks", response_model=NowTracksResponse)
def post_now_tracks(req, tle_fetcher, timescale, ephemeris):
    """Trailing track per requested satellite, last `tail_minutes`."""
    now = datetime.now(timezone.utc)
    start = now - timedelta(minutes=req.tail_minutes)
    observer = Observer(lat=req.lat, lng=req.lng, elevation_m=req.elevation_m)
    entries = []
    for nid in req.norad_ids:
        tle, _ = tle_fetcher.get_tle(nid)
        samples = sample_track(tle, observer, start, now,
                               timescale=timescale, ephemeris=ephemeris,
                               dt_seconds=req.dt_seconds)
        entries.append(NowTrackEntry(norad_id=nid, samples=[track_sample_to_response(s) for s in samples]))
    return NowTracksResponse(entries=entries)
```

Both raise `HTTPException(404)` if `tle_fetcher.get_tle(nid)` raises `LookupError`.

### 3.5 `api/routes/__init__.py` — register

Add `from api.routes import now` and include `now.router` in the FastAPI app.

### 3.6 Integration tests

`tests/integration/test_now_routes.py`:

- `test_now_positions_returns_one_entry_per_norad`: post with `norad_ids=[25544]`, assert one entry, sample fields populated, `t_utc` within 1 s of "now."
- `test_now_positions_multi_norad`: post with `norad_ids=[25544, 48274]`, assert two entries in the response order matches the request.
- `test_now_positions_unknown_norad_returns_404`: post with `norad_ids=[999999]`, assert 404 with the unresolved id in the detail.
- `test_now_tracks_returns_samples_over_window`: post with default tail_minutes=10, dt_seconds=30, assert ~20 samples per entry, all timestamps strictly increasing, last sample within 1 s of "now."
- `test_now_tracks_respects_tail_minutes`: tail_minutes=5, dt_seconds=60 → exactly 5 samples.

Reuse the `_fake_terrain` conftest fixture pattern from `tests/integration/conftest.py` (extracted in commit `40e6b70`).

---

## 4. Frontend changes

### 4.1 New file: `web/src/store/live-position.ts`

```typescript
import { create } from "zustand";
import type { TrackSampleResponse } from "@/types/api";

interface LivePositionState {
  // Latest polled positions, keyed by NORAD ID
  positions: Map<number, TrackSampleResponse>;
  // Previous poll's positions (for velocity derivation)
  previousPositions: Map<number, TrackSampleResponse>;
  // Trailing samples per sat, rolling window
  trails: Map<number, TrackSampleResponse[]>;
  // Performance.now() at last successful poll, for extrapolation timing
  lastPolledAt: number | null;
  // Currently-active NORAD list (for stale-response detection)
  activeNorads: number[];

  seedTrails: (entries: { norad_id: number; samples: TrackSampleResponse[] }[]) => void;
  applyPoll: (entries: { norad_id: number; sample: TrackSampleResponse }[], now: number) => void;
  setActive: (norads: number[]) => void;
  clear: () => void;
}

export const useLivePositionStore = create<LivePositionState>((set) => ({
  // ... implementation
}));
```

`applyPoll` rotates `positions` → `previousPositions`, sets the new `positions`, appends the new sample to each trail (trimming samples older than 10 min by `t_utc`).

### 4.2 New file: `web/src/hooks/use-page-visibility.ts`

Tiny hook wrapping the Page Visibility API:

```typescript
export function usePageVisibility(): boolean {
  const [visible, setVisible] = useState(() =>
    typeof document === "undefined" ? true : !document.hidden,
  );
  useEffect(() => {
    const handler = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);
  return visible;
}
```

Test in `use-page-visibility.test.ts`: simulates `visibilitychange` event, asserts the hook's return value flips.

### 4.3 New file: `web/src/hooks/use-live-polling.ts`

Mounts at the cinematic root. Drives the live-position store as a side-effect. Returns nothing.

The resolved NORAD list is **derived from the current passes results**, not from the satellite store (which only carries the query string; `resolvedName` is vestigial — set only in tests). This means:
- A satellite with passes in the time window → live-marked.
- A group with passes from only some members → only those members live-marked.
- Empty passes (e.g., satellite never visible in the window) → no live mode.

Document the "group members with no passes won't show live markers" limitation in the user-facing follow-up; it's an acceptable v1 trade-off and avoids a new resolve-call or store-state machinery just to find NORAD IDs.

Lifecycle:

```typescript
export function useLivePolling() {
  const { passes } = useCurrentPasses();
  const selectedPassId = useSelectionStore((s) => s.selectedPassId);
  const observer = useObserverStore((s) => s.current);
  const tabVisible = usePageVisibility();
  const { setActive, seedTrails, applyPoll, clear } = useLivePositionStore();

  const norads = useMemo(() => {
    if (!passes) return [];
    const ids = new Set<number>();
    for (const p of passes) {
      if (p.kind === "train") p.member_norad_ids.forEach((n) => ids.add(n));
      else ids.add(p.norad_id);
    }
    return [...ids].sort();  // sorted for stable JSON.stringify dep
  }, [passes]);

  const liveModeOn = norads.length > 0 && selectedPassId === null && tabVisible;

  useEffect(() => {
    if (!liveModeOn) {
      clear();
      return;
    }

    const abort = new AbortController();
    setActive(norads);

    fetchNowTracks({ norad_ids: norads, ...observer }, abort.signal)
      .then((res) => seedTrails(res.entries))
      .catch((e) => { if (e.name !== "AbortError") console.error(e); });

    const tick = async () => {
      try {
        const res = await fetchNowPositions({ norad_ids: norads, ...observer }, abort.signal);
        applyPoll(res.entries, performance.now());
      } catch (e) {
        if (e.name !== "AbortError") console.error(e);
      }
    };
    const id = setInterval(tick, 5000);
    tick();  // also fire immediately

    return () => {
      abort.abort();
      clearInterval(id);
    };
  }, [liveModeOn, JSON.stringify(norads), observer.lat, observer.lng, observer.elevation_m]);
}
```

Stale-response guard: each `applyPoll` checks that `entries[].norad_id` is a subset of the current `activeNorads`; if not, it's a stale response from before a search change and gets dropped silently.

### 4.4 New file: `web/src/lib/live-extrapolation.ts`

Pure helpers:

```typescript
export function extrapolatePosition(
  latest: TrackSampleResponse,
  previous: TrackSampleResponse | undefined,
  nowMs: number,
  lastPolledMs: number,
): { lat: number; lng: number; alt_km: number } {
  if (!previous) return latest;  // no velocity yet, just use latest
  const elapsedSec = (nowMs - lastPolledMs) / 1000;
  const dtPolls = (new Date(latest.t_utc).getTime() - new Date(previous.t_utc).getTime()) / 1000;
  if (dtPolls === 0) return latest;
  const t = elapsedSec / dtPolls;
  // Linear interpolation in lat/lng/alt. Sub-pixel error at globe scale over 5s.
  return {
    lat: latest.lat + (latest.lat - previous.lat) * t,
    lng: latest.lng + (latest.lng - previous.lng) * t,
    alt_km: latest.alt_km + (latest.alt_km - previous.alt_km) * t,
  };
}
```

**Edge case — longitude wraparound at ±180°:** if `|latest.lng - previous.lng| > 180`, unwrap by adding/subtracting 360 before interpolation. Re-wrap the result into `[-180, 180]`. Otherwise the marker would teleport across the globe when crossing the antimeridian.

Tests in `live-extrapolation.test.ts` cover: same position (zero velocity), normal forward motion, antimeridian crossing both directions, no-previous (returns latest), zero dt (returns latest).

### 4.5 New file: `web/src/components/earth-view/live-markers-mesh.ts`

Manages an internal pool of small orange spheres (the existing material from `scene-factory.ts:90-94`). API:

```typescript
export interface LiveMarkers {
  group: THREE.Group;
  setPositions: (positions: Array<{ lat: number; lng: number; alt_km: number }>) => void;
  setVisible: (v: boolean) => void;
  dispose: () => void;
}

export function createLiveMarkers(earthRadiusUnits: number): LiveMarkers;
```

Implementation: maintains a list of meshes, grows/shrinks the pool to match `positions.length`. Each call updates transforms in-place. Reuses `latLngAltToVec3` from `@/lib/geo3d` (the same helper the existing satellite-marker uses).

Test mirrors `ground-track-mesh.test.ts` pattern: instantiate, verify mesh count grows/shrinks, dispose releases geometries.

### 4.6 New file: `web/src/components/earth-view/live-trails-mesh.ts`

Manages N parallel polylines, faint opacity (e.g., `0.35`), uniform color matching the marker, no progress-gradient. API:

```typescript
export interface LiveTrails {
  group: THREE.Group;
  setTrails: (trails: Array<Array<{ lat: number; lng: number; alt_km: number }>>) => void;
  setVisible: (v: boolean) => void;
  dispose: () => void;
}

export function createLiveTrails(earthRadiusUnits: number, viewport: { width: number; height: number }): LiveTrails;
```

Implementation pattern mirrors `ground-track-mesh.ts` (which has the polyline + viewport handling), but simpler — no progress-cursor, no two-color split, just one faint line per sat. Test mirrors `ground-track-mesh.test.ts`.

### 4.7 Modified: `web/src/components/earth-view/scene-factory.ts`

Add to `SceneHandles`:

```typescript
liveMarkers: LiveMarkers;
liveTrails: LiveTrails;
```

Instantiate alongside existing handles. Both default `visible = false`. Existing `satelliteMarker` and `groundTrack` (pass-mode) stay unchanged. `dispose()` calls the new dispose methods.

### 4.8 Modified: `web/src/components/earth-view/earth-view.tsx`

Render-frame loop additions:

```typescript
// In the existing rAF loop:
const live = useLivePositionStore.getState();
const liveModeActive = live.activeNorads.length > 0 && live.lastPolledAt !== null;

if (liveModeActive) {
  scene.satelliteMarker.visible = false;
  scene.groundTrack.visible = false;

  const interpolatedPositions = live.activeNorads.map((nid) => {
    const latest = live.positions.get(nid);
    if (!latest) return null;
    const previous = live.previousPositions.get(nid);
    return extrapolatePosition(latest, previous, performance.now(), live.lastPolledAt!);
  }).filter(Boolean);

  scene.liveMarkers.setPositions(interpolatedPositions);
  scene.liveMarkers.setVisible(true);
  scene.liveTrails.setTrails(live.activeNorads.map((nid) => live.trails.get(nid) ?? []));
  scene.liveTrails.setVisible(true);
} else {
  scene.liveMarkers.setVisible(false);
  scene.liveTrails.setVisible(false);
  // existing pass-mode wiring continues
}
```

`useLivePolling()` is called at the top of `EarthView` (or one level up if cleaner — the cinematic root).

### 4.9 Modified: `web/src/components/cinematic/passes-panel/panel-telemetry.tsx`

Fallback logic:

```typescript
export function PanelTelemetry() {
  const { sample: passSample } = useTrackAtCursor();
  const livePositions = useLivePositionStore((s) => s.positions);
  const activeNorads = useLivePositionStore((s) => s.activeNorads);

  // Pass mode wins when active.
  // Live single-sat mode populates the grid from the latest poll.
  // Live group mode (or idle) shows "—" cells.
  let sample: TrackSampleResponse | null = passSample;
  if (!sample && activeNorads.length === 1) {
    sample = livePositions.get(activeNorads[0]) ?? null;
  }

  // ... existing render of CELLS using `sample`
}
```

No new cells, no new visual. Existing test gets two new cases:
- "no pass selected, single live sat → cells populate from live store"
- "no pass selected, group live mode → cells stay '—'"

### 4.10 Modified: `web/src/lib/api.ts`

Add `fetchNowPositions(req, signal)` and `fetchNowTracks(req, signal)` matching the existing `request<T>` helper pattern (POST, JSON body, `ApiError` on non-2xx, AbortSignal threading). Same shape as the existing `fetchPasses`, `fetchSkyTrack` helpers.

### 4.11 Modified: `web/src/types/api.ts`

Add TypeScript interfaces matching the new response shapes (`NowPositionEntry`, `NowPositionsResponse`, `NowTrackEntry`, `NowTracksResponse`).

---

## 5. Test plan

### 5.1 Backend

- `tests/unit/test_sample_at.py` — `sample_at` matches `sample_track`'s first sample for an ISS TLE.
- `tests/integration/test_now_routes.py` — five cases listed in §3.6.

### 5.2 Frontend

- `web/src/store/live-position.test.ts` — store actions: `seedTrails`, `applyPoll` rotates positions correctly, trail trimming by age, `clear` resets all state.
- `web/src/hooks/use-page-visibility.test.ts` — Page Visibility API hook flips on `visibilitychange`.
- `web/src/hooks/use-live-polling.test.ts` — hook lifecycle: starts polling on mount when liveModeOn, stops when selectedPassId becomes non-null, cancels in-flight on satellite change, pauses on tab hide.
- `web/src/lib/live-extrapolation.test.ts` — extrapolation math + antimeridian wraparound.
- `web/src/components/earth-view/live-markers-mesh.test.ts` and `live-trails-mesh.test.ts` — mesh count grow/shrink, dispose hygiene.
- `web/src/components/cinematic/passes-panel/panel-telemetry.test.tsx` — extend with the two new cases above.

### 5.3 Manual verification

- Search "ISS" in cinematic mode without selecting a pass → marker appears (within 1 s of seed-call response), drifts smoothly across the globe, trail extends behind it.
- Search "stations" without selecting → 2 markers (ISS + Tiangong), 2 trails, both moving on different orbital planes.
- With a marker live, select a pass → live markers + trails disappear, pass-arc + cursor marker take over.
- Background the tab for 30 s, refocus → poll resumes immediately; marker may snap-jump to catch up but doesn't break.
- Search "starlink (trains)" without selecting → cluster of train markers moving in tight formation; trails fuse into a fat ribbon (acceptable per option B).

---

## 6. Risk register

| Risk | Mitigation |
|---|---|
| Marker stutters on slow networks (poll round-trip > 5 s) | Extrapolation continues past the polling interval; visible drift only after ~30 s of no response. Snap-correct on next response. |
| Antimeridian crossing teleports the marker | Explicit longitude unwrap in `extrapolatePosition` (§4.4), tested both directions. |
| Live mode missing for group members with no passes in the window | Documented limitation. Acceptable v1 trade-off — alternative is a separate `/resolve` call or a new resolve-state store, both heavier than the value. Fixable in a later spec if real users hit it. |
| Stale poll response overwrites a fresh one after satellite change | `AbortController` in the hook + `activeNorads` subset check in `applyPoll`. |
| Backend recomputes `sample_track` on every poll for trains (~20 sats) | At 5 s cadence: 4 propagations/sec. Skyfield handles thousands/sec. Non-issue. |
| `useLivePolling` runs in two places by mistake | Mount once at the cinematic root, never inside child components. Lint rule could enforce; not adding one. |
| Trail buffer grows unbounded if poll returns out-of-order timestamps | Trim by age (`t_utc < now - 10min`) on every `applyPoll`, not by count. Out-of-order samples get trimmed naturally. |

---

## 7. Out of scope for this branch

- Custom TLEs ([`docs/follow-ups.md`](../../follow-ups.md) §3 — separate feature branch).
- Train affordances in `pass-row.tsx` ([`docs/follow-ups.md`](../../follow-ups.md) §1 — separate small follow-up).
- Sky-view live mode (deferred per the original writeup).
- Per-satellite color hash, sunlit shading, below-horizon dimming.
- Hover-to-trail / centroid-trail logic for groups.
- Mixed live + pass mode on the same globe.
