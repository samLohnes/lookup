# Satellite Visibility — Design

**Date:** 2026-04-20
**Status:** Approved for implementation planning
**Author:** Sam Lohnes (with Claude, via superpowers brainstorming)

---

## 1. Summary

A local desktop tool that predicts when named satellites (or satellite groups) will be visible from a user-specified location on Earth over a user-specified time window, and renders the results as a polished, cinematic 3D visualization of the observer's location with the satellite's path, alongside an alt-azimuth sky view usable for actual observation planning.

The tool is simultaneously **research-grade** (accurate enough to plan real observations) and **visually exceptional** (modern, cinematic UI). Runs entirely on the user's machine; network usage is limited to fetching orbital elements, terrain data, map tiles, and geocoding.

---

## 2. Goals & Non-Goals

**Goals**
- Predict satellite passes with research-grade accuracy (rise/peak/set within ±1 s; azimuth/elevation within ±0.1°)
- Support both geometric line-of-sight and naked-eye optical visibility modes, selectable per query
- Account for local terrain via DEM-derived horizon masks
- Provide cinematic 3D earth visualization *and* functional alt-az sky view, with a shared timeline scrubber
- Expose a clean, pure Python engine (`core/`) that is already a library on day one, with future CLI extraction being trivial
- Keep the tool fully local — no shared deployment, no accounts, no telemetry

**Non-Goals (for MVP)**
- No shared web app / hosted deployment
- No desktop OS notifications (v2+)
- No packaged desktop binary (Tauri/Electron) (v2+)
- No CLI at MVP (engine is already library-shaped, CLI is a small follow-on)
- No user-drawn horizon obstruction overlay (v2+)
- No magnitude filter UI (engine supports it; UI is v2+)

---

## 3. Users & Use Cases

Primary user: an individual who wants to observe satellite passes from their own location and is willing to trade deployment simplicity for accuracy and polish.

**Canonical use cases:**
1. "When is the next ISS pass visible from my backyard this week?"
2. "There was a Starlink launch yesterday — when does the train go over tonight?"
3. "I'm planning astrophotography Friday night — what bright passes happen between 21:00 and 00:00?"
4. "I'll be at the cabin next weekend — what's visible from there?"

---

## 4. Architecture

Three-tier, one directory:

```
Frontend (React + Vite + TypeScript)
    │  HTTP (localhost only)
    ▼
API layer (FastAPI) — thin routing wrapper, no business logic
    │  Python imports
    ▼
core/ (pure Python package, zero web dependencies)
├── orbital/      # skyfield-based SGP4 + observer geometry
├── visibility/   # sunlit/observer-darkness/magnitude logic
├── terrain/      # DEM fetch + 360° horizon mask
├── catalog/      # TLE cache + Celestrak fetch + fuzzy search
└── trains/       # Starlink train clustering heuristic
```

### 4.1 Repo layout

```
satellite-visibility/
├── core/           # pure Python package (pip-installable)
├── api/            # FastAPI app, thin wrapper around core
├── web/            # React/Vite frontend
├── scripts/        # launcher, cache-warming utilities
├── tests/          # pytest (unit, golden, integration)
└── docs/
```

### 4.2 Key architectural properties

- `core/` has zero dependencies on FastAPI or any web framework. It is a library today, not tomorrow.
- All orbital math goes through `skyfield`. No hand-rolled SGP4.
- Local app runs as two processes: `uvicorn` on one port, Vite dev server on another. A single launcher script starts both.
- No database at MVP — disk caches are JSON/GeoTIFF files under `~/.satvis/`.
- FastAPI binds to localhost only. Nothing listens on a public interface.

---

## 5. Data Sources

All free, all used within terms of service. No authentication required for any MVP call.

| Source | Purpose | Auth | Frequency |
|---|---|---|---|
| Celestrak | TLEs (satellite orbital elements) | None | Auto-refresh 24h per satellite/group |
| OpenTopography (Copernicus DEM 30m) | Terrain elevation for horizon mask | None for public datasets | Once per new observer location, cached permanently |
| OSM Nominatim | Address → lat/lng geocoding | None; 1 req/sec politeness | Per address search |
| OSM tiles (or Mapbox free tier) | 2D map tiles for location picker | None / free tier | While picker is open |

### 5.1 What leaves the machine

Only the calls in the table above. No telemetry, no analytics, no LLM calls, no authentication, no user accounts, no data leaves the local machine otherwise.

### 5.2 Cache layout

```
~/.satvis/
├── tle-cache/<group_or_norad>.json    # TLE + fetched_at timestamp
├── dem-cache/<lat_lng_hash>.tif       # raw DEM tile
├── horizon-cache/<lat_lng_hash>.json  # computed 360° horizon mask
├── locations.json                     # saved named locations
└── settings.json                      # visibility mode, magnitude threshold, etc.
```

---

## 6. Data Flow

### 6.1 Flow A — "What's visible from Brooklyn this week for ISS?"

```
1. Frontend: user picks location ("Brooklyn") + satellite ("iss") + date range (7 days)
   POST /passes { lat, lng, query: "iss", from, to, mode: "naked-eye" }

2. API layer:
   → catalog.resolve("iss")            # fuzzy match → NORAD 25544
   → catalog.get_tle(25544)            # cache lookup; refresh if >24h old
   → terrain.get_horizon_mask(lat,lng) # cache lookup; fetch+compute if miss
   → orbital.predict_passes(tle, observer, from, to, horizon_mask)
   → visibility.filter_passes(passes, mode="naked-eye")
   → returns list of Pass with full telemetry

3. Frontend renders:
   • timeline strip (one tick per pass)
   • pass list + "tonight" summary card
   • auto-selects next upcoming pass → triggers Flow B
```

### 6.2 Flow B — "Show me pass #03 in detail"

Fires on pass selection or timeline scrub.

```
1. Frontend → GET /sky-track for selected pass window
2. API → orbital.sample_track(tle, observer, t_start, t_end, dt=1s)
       → returns list of TrackSample
3. Frontend:
   • 3D earth animates sat marker along ground track; observer pin fixed
   • Sky view draws alt-az arc + current sat position
   • Telemetry rail binds to scrubbed time
```

### 6.3 TLE freshness

- On every `/passes` call, check cache timestamp per resolved satellite.
- If >24h, fetch Celestrak in a background task and return the current result immediately.
- Each `Pass` carries its `tle_epoch` so the frontend can surface freshness per-pass.

### 6.4 DEM first-fetch UX

First query for a brand-new location blocks for ~5–15 s (DEM fetch + mask compute). Subsequent queries for the same location are instant. Frontend shows a "computing local horizon…" state during that wait.

---

## 7. Component Interfaces (`core/`)

All types are Python dataclasses; all functions are pure unless explicitly noted.

### 7.1 Core types

```python
Observer      = { lat, lng, elevation_m, name? }
HorizonMask   = { azimuth_deg → min_elevation_deg }   # 360 samples @ 1° resolution
TLE           = { norad_id, name, line1, line2, epoch }

Pass          = {
  id, norad_id, name,
  rise:  { time, azimuth, elevation },
  peak:  { time, azimuth, elevation },
  set:   { time, azimuth, elevation },
  duration_s,
  max_magnitude?,
  sunlit_fraction,
  tle_epoch,
  terrain_blocked_ranges
}

TrackSample   = {
  time, lat, lng, alt_km,
  az, el, range_km, velocity_km_s,
  magnitude?, sunlit, observer_dark
}

VisibilityMode = "line-of-sight" | "naked-eye"
```

### 7.2 `core/orbital/`

Pure SGP4 + observer geometry. Deterministic given inputs. No I/O.

```python
predict_passes(tle, observer, start, end, horizon_mask, min_elevation=0) -> list[Pass]
sample_track(tle, observer, start, end, dt_seconds=1) -> list[TrackSample]
```

Depends on: `skyfield`.

### 7.3 `core/visibility/`

Pure. No I/O.

```python
filter_passes(passes, mode, min_magnitude=None) -> list[Pass]
compute_magnitude(track_sample, satellite_type) -> float | None
is_observer_in_darkness(time, observer) -> bool    # civil/nautical/astronomical twilight
is_satellite_sunlit(time, sat_position) -> bool    # Earth-shadow test
```

Depends on: `skyfield` (for solar position).

### 7.4 `core/terrain/`

Side-effecting (network + disk). Isolated here so the rest of `core/` stays pure.

```python
fetch_dem(lat, lng, radius_km=50) -> DEM           # hits OpenTopography; writes to dem-cache/
compute_horizon_mask(dem, observer, samples=360) -> HorizonMask
get_horizon_mask(observer) -> HorizonMask          # cache lookup or fetch+compute+cache
```

Depends on: `rasterio`, `numpy`, `httpx`.

### 7.5 `core/catalog/`

Side-effecting (network + disk). Also isolated.

```python
fuzzy_search(query) -> list[CatalogHit]
resolve(query) -> Resolution   # { type: "single" | "group", norad_ids: [...] }
get_tle(norad_id) -> TLE
get_group_tles(group_name) -> list[TLE]    # e.g. "starlink", "stations"
```

Depends on: `httpx`, `rapidfuzz` (or similar).

### 7.6 `core/trains/`

Pure. No I/O. Clusters passes whose ground tracks + timing indicate they are co-flying launch batches.

```python
group_into_trains(passes, time_window_s=60, angle_window_deg=2) -> list[TrainPass | Pass]
```

---

## 8. Frontend

### 8.1 Layout

Matches the "B aesthetic with A's data density" direction — Cosmic Editorial aesthetic, photographic 3D earth, full telemetry rail, coupled sky view, persistent timeline strip.

Two hero modes, swapped by a single control:
- **Earth-hero:** 3D earth dominant, sky view as a secondary panel. Mode for overview / wow-factor.
- **Sky-hero:** sky view dominant, 3D earth secondary. Mode for actual observation.

### 8.2 Inputs

- Location: address search (OSM Nominatim) + 2D map picker with pin drop. Saved locations with user-chosen names ("Backyard", "Cabin"). Explicit lat/lng entry as fallback.
- Satellite: fuzzy search field. Matches names (ISS, HUBBLE), groups (starlink, stations), and NORAD IDs. Disambiguation UI when ambiguous.
- Time range: 7-day default, stretchable to 14 with an accuracy warning banner.
- Visibility mode toggle: line-of-sight / naked-eye.

### 8.3 Outputs

- Pass list + timeline (one tick per pass, selected pass highlighted, scrub cursor shows current time).
- "Tonight's passes" summary card visible on app open.
- Per-pass detail: rise/peak/set times + bearings, sun elevation, magnitude, terrain-blocked ranges, TLE epoch.
- 3D earth animation driven by timeline.
- Sky view alt-az plot with compass cardinals, terrain mask, satellite arc.
- "Export to calendar" per pass → generates `.ics` file.

### 8.4 Multi-satellite handling

When a group query returns more than N results (initial threshold: 50):
- Auto-detect Starlink trains (clustered co-flying batches) and render each train as a single event.
- Apply default filters: magnitude brighter than +4, peak elevation above 30°.
- Provide "show all passes / notable only" toggle.
- Individual satellite queries are never filtered this way.

---

## 9. Accuracy Targets

| Quantity | Target tolerance | Reference for verification |
|---|---|---|
| Rise/set/peak time (ISS pass) | ±1 s | Heavens-Above, Celestrak SatTrack |
| Azimuth at peak | ±0.1° | Same |
| Elevation at peak | ±0.1° | Same |
| Predicted visual magnitude | ±0.5 mag | Magnitude models diverge meaningfully across implementations; this tolerance is deliberately wider than the geometric quantities |
| Horizon elevation per azimuth (DEM) | ±0.5° | `gdal`-computed reference mask |
| TLE epoch displayed per pass | Exact | Celestrak metadata |

---

## 10. Testing Strategy

```
tests/
├── unit/
│   ├── test_orbital.py
│   ├── test_visibility.py
│   ├── test_terrain.py
│   ├── test_catalog.py
│   └── test_trains.py
├── golden/
│   ├── test_iss_passes_nyc.py     # frozen TLE + location + date → hand-verified expected
│   └── test_starlink_train.py     # known launch; assert cluster size/timing
├── integration/
│   └── test_passes_endpoint.py    # API with fake TLE + DEM caches
└── fixtures/
    ├── tle/                       # frozen TLE snapshots
    ├── dem/                       # small real DEM tile (Manhattan)
    └── expected/                  # hand-verified pass lists
```

**Coverage targets**
- `core/` (engine): 90%+
- `api/`: 70%+
- Frontend: E2E smoke tests only at MVP; visual polish is verified by eye

**Accuracy verification cadence**
- On every engine change: golden tests must still pass
- Quarterly: manually cross-check 3 ISS passes + 1 Starlink train vs. Heavens-Above; record results in `docs/accuracy-log.md`
- Any divergence exceeding stated tolerances is a regression; investigate before merging

**What is not automated**
- Live Celestrak fetches (mocked in tests; manually verified)
- Live OpenTopography fetches (same)
- 3D rendering (no visual regression at MVP)

---

## 11. MVP Scope

### 11.1 In scope for v1

Input & location
- Address search (Nominatim) + 2D map picker
- Saved named locations
- Explicit lat/lng entry fallback

Satellite query
- Fuzzy search across names, groups, NORAD IDs
- Disambiguation when ambiguous
- Single-satellite and group queries

Prediction engine
- SGP4 via skyfield
- TLE cache with 24h auto-refresh
- Per-pass TLE epoch surfaced
- 7-day default, stretchable to 14 with warning

Visibility
- Two modes (line-of-sight, naked-eye), user-toggled
- Sunlit + observer-darkness logic
- Magnitude computed and displayed (no filter UI)

Terrain
- Copernicus DEM via OpenTopography
- 360° horizon mask computed + cached
- Blocked azimuth ranges per pass

Multi-satellite
- Starlink train auto-detection
- Default brightness/elevation filters for groups
- "All passes / notable only" toggle

Visualization
- Cosmic Editorial aesthetic
- 3D earth (Three.js or CesiumJS — decision deferred to implementation plan)
- Alt-az sky view
- Swappable hero
- Shared timeline with scrubber + play/pause
- Telemetry rail + hover tooltips
- "Tonight's passes" card
- ICS calendar export

Architecture
- Pure Python `core/` (zero web deps)
- Thin FastAPI `api/`
- React/Vite/TS `web/`
- pytest suite with unit + golden + integration

### 11.2 Deferred to v2+

- User-drawn horizon obstructions (paint a tree line on the sky dome)
- Magnitude filter UI (engine already supports it)
- Desktop OS notifications (would add background daemon)
- Tauri / Electron packaging
- CLI wrapping the engine
- "Work offline" toggle
- Visual regression tests for 3D rendering
- Multi-observer comparison (two locations at once)
- Space-Track.org as alternate TLE source

---

## 12. Build Milestones

Each milestone is independently usable and testable.

**M1 — Engine works** (pure Python, no UI)
- `core/orbital/`, `core/visibility/`, `core/catalog/` implemented
- Golden tests passing; ISS-NYC pass matches Heavens-Above within tolerance
- Runnable from a Python REPL or script

**M2 — Terrain + API**
- `core/terrain/` (DEM fetch + horizon mask cache) implemented
- `core/trains/` implemented
- FastAPI `/passes`, `/sky-track`, `/tle-freshness`, `/horizon` endpoints
- End-to-end: one curl call returns a full pass list

**M3 — Minimal frontend**
- React app scaffolded with Cosmic Editorial theme applied
- Location + satellite inputs, map picker, saved locations
- Pass list + timeline + 2D sky view
- No 3D yet

**M4 — 3D hero + polish**
- 3D earth view, switchable with sky view
- Playback/scrub, animated satellite marker
- Telemetry rail bound to timeline cursor
- ICS export + "tonight" summary card

**M5 — v1 release**
- Full test suite green
- One-command launcher script
- README with setup + usage
- `docs/accuracy-log.md` seeded with 3 verified ISS passes + 1 Starlink train

---

## 13. Success Criteria for v1

1. Predict ISS passes for a saved NYC location within ±1 s of Heavens-Above
2. Starlink train query shows clustered results with correct batch grouping
3. Local horizon from DEM visibly excludes passes blocked by real terrain
4. ICS export opens correctly in macOS Calendar
5. Cold-start (empty caches) to first pass result: < 20 s
6. Warm-start (caches populated) to first pass result: < 2 s
7. `pytest` green with `core/` at 90%+ coverage

---

## 14. Open Items for Implementation Plan

These are decisions deferred from design to the implementation plan:

- **3D library choice**: Three.js (full creative control, more scaffolding) vs CesiumJS (built-in terrain/imagery, less custom). To be decided in the implementation plan based on prototype effort; the design does not depend on which is chosen.
- **Fuzzy-search library**: `rapidfuzz` vs a simple custom trigram matcher. `rapidfuzz` is likely.
- **Launcher**: a shell script starting uvicorn + vite vs a Python script doing the same. Shell script preferred for MVP.
- **Repo init**: project directory is not yet a git repository; `git init` is part of M1 setup.
