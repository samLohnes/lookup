# M6 — Cinematic Mode Design

**Status:** Drafted 2026-04-23. Targets shipping after v0.5.0 (m5-release).

**Goal:** Transform the app from a dashboard-with-a-3D-panel into a dual-mode product — a cinematic earth-hero experience for enthusiasts and the existing information-dense research layout for observation planners — toggleable from within the app and sharing all application state.

**Architecture:** Single React SPA, one bundle, two layouts. Mode state lives in a Zustand store persisted to `localStorage`. The existing `React.lazy` boundary on `EarthView` (from M5) means research users never download the Three.js chunk. A new `draft-inputs` store mediates a commit-then-query pattern for observer/satellite/window edits in both modes. The Three.js scene gains Direction A aesthetics (Blue Marble + Black Marble night lights, sharp terminator, sparse starfield, subtle atmosphere glow), a great-circle ground-track line with progress rendering, drag-to-rotate camera controls, and camera reframe on pass selection.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind, shadcn/ui, Zustand (+ persist middleware), TanStack Query, Three.js. No new dependencies.

---

## 1. Context & Motivation

### 1.1 What v0.5.0 ships

The v0.5.0 baseline (after M1–M5) is a functionally complete satellite pass predictor with a three-column dashboard: observer and satellite inputs on the left, pass list + timeline in the middle, and a sky-or-earth hero toggle on the right alongside telemetry and playback. The 3D earth is a ~320px card inside a larger layout; it renders a Blue Marble sphere with an observer pin and a satellite marker. The scene is "technically correct" but visually flat — no atmosphere, no ground-track line, no night-side city lights, no starfield backdrop.

### 1.2 What users want

Two user archetypes emerged during M5 verification:

- **Enthusiasts / hobbyists** — want a cinematic "from space" feel. The 3D earth is the star; data panels are supporting cast. This audience is poorly served by v0.5.0's small-earth-in-a-dashboard layout.
- **Observation planners / researchers** — want information density. Pass list + timeline + telemetry should be visible simultaneously. This audience is well-served today.

The competing needs resolve cleanly: rather than compromising one experience for the other, ship two layouts that share all state and let the user pick.

### 1.3 What the 3D earth should feel like

The reference is Apple Maps' 3D globe view — a hero-scale photorealistic earth on a starfield, with minimal floating chrome and data access via collapsible drawers. Zoom-level exploration is explicitly out of scope ("antithetical to what the product should be used for"); the earth is a fixed vantage point, not a map.

The aesthetic target is **scientific accuracy with a subtle cinematic polish** — NASA Blue Marble daytime, Black Marble night lights, sharp terminator, faint blue atmospheric halo at the limb, sparse stars. Not moody-dark; not over-stylized.

---

## 2. Goals & Non-Goals

### 2.1 Goals

1. **Add a cinematic mode** that renders the 3D earth full-viewport as the hero, with UI controls behind a left drawer, a right-side pass rail, a resizable PiP sky view, a bottom playback dock, and a small top-right chrome cluster.
2. **Preserve research mode** as today's 3-column dashboard, with the sky view as the permanent hero (earth-view toggle removed).
3. **Add a mode toggle** that switches between the two layouts at runtime. Persist the user's preference to `localStorage`.
4. **Apply a commit-then-query input pattern** to observer + satellite + window inputs in both modes. Explicit "Run" button commits the draft; `/passes` re-runs only on commit.
5. **Upgrade the earth scene** to Direction A aesthetics — higher-res textures, day/night shader, sharp terminator, atmosphere glow, starfield, ground-track line with progress rendering, drag-to-rotate camera, reframe-on-pass-selection.
6. **Never download Three.js for research-only users.** The existing `React.lazy` boundary from M5 handles this — if the user's persisted mode is `research`, the `earth-view` chunk is never requested.
7. **No regressions** in observer/satellite/pass-list/timeline/sky-view/telemetry/playback functionality. Existing tests continue to pass.

### 2.2 Non-goals

- **Cloud layer** on the earth (deferred — fast-follow polish)
- **Auto-rotation modes** (real-time / accelerated earth spin) — M6 ships static-only; toggleable modes are a later polish
- **Mobile cinematic variant** — desktop-only for M6 (viewport < 900px forces research mode)
- **Click-the-globe to set observer location** — M6 ships with the existing Leaflet modal only
- **City labels, ocean names, graticules** — would belong in a separate "Labels & Landmarks" milestone
- **Motion design layer** — no `framer-motion` introduction; drawer/PiP transitions use pure CSS defaults
- **Custom scrubber with hover preview** — separate polish milestone
- **Typography system overhaul** — separate polish
- **Visual regression tests for 3D rendering** — not in M6's test surface
- **New data sources** — no new backend endpoints, no new TLE sources, no new DEM providers

---

## 3. Architecture Overview

### 3.1 One SPA, two layouts, shared state

The app remains a single React SPA served from the existing Vite build. There is no routing change — mode is a piece of state, not a URL. Reasoning:
- Shared state (observer, satellite, window, selection, playback) should not depend on route; users expect "change my satellite then toggle the view" to preserve their selection.
- Route-based mode would require bundle duplication or a shared-chunk strategy; the `React.lazy` approach already in place from M5 gives us the same bundle-isolation benefit more simply.
- A single URL is easier to share (screenshots, bookmarks) and doesn't leak implementation detail to the user.

### 3.2 Store topology

All existing stores (`observer`, `satellite`, `time-range`, `selection`, `playback`, `display-tz`) remain unchanged. Two new stores:

- **`app-mode`** (Zustand + persist middleware, key `satvis.app-mode`) — holds the current mode.
- **`draft-inputs`** (Zustand, session-scoped, not persisted) — holds pending edits to observer/satellite/window before commit.
- **`pip-sky`** (Zustand, session-scoped, not persisted) — holds the PiP sky view's position, size, and open state.

TanStack Query keys remain off the existing `observer` / `satellite` / `time-range` stores (the "committed" values). `/passes` re-runs on commit, not on draft edit.

### 3.3 Bundle strategy

The `React.lazy` boundary on `EarthView` shipped in M5 continues to handle bundle isolation:
- Research-mode boot: `index.js` loads, Three.js chunk never requested.
- Cinematic-mode boot: `index.js` + `earth-view-*.js` chunk on first render of the earth.
- Runtime research → cinematic toggle: triggers the earth-view chunk fetch if not yet cached. User sees `<EarthViewLoader />` (from M5) until it arrives.

Expected bundle sizes after M6 (approximate):
- Main chunk: ~540 KB (up from ~521 KB — adds drawer, pip-sky, draft-inputs, new layouts)
- Earth-view chunk: ~650 KB (up from ~511 KB — adds day/night shader, atmosphere, ground-track mesh, camera controls)
- New static assets in `web/public/`:
  - `earth-blue-marble-4k.jpg` (~3-4 MB) — replaces the existing ~1.5 MB 2K version
  - `earth-black-marble-4k.jpg` (~1-2 MB)
  - `star-field-4k.jpg` (~1-2 MB) — e.g., NASA Tycho star map
  - Total new/replaced asset weight: ~5-8 MB, loaded only when the cinematic earth first renders

### 3.4 Mobile handling

Mode toggle is disabled when viewport < 900px. Tooltip: "Cinematic mode is desktop-only." Research mode works on mobile via today's column-collapse responsive behavior (no change in M6).

---

## 4. Mode Toggle & Persistence

### 4.1 Store interface

```ts
// web/src/store/app-mode.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppMode = "cinematic" | "research";

type AppModeState = {
  mode: AppMode;
  setMode: (m: AppMode) => void;
};

export const useAppModeStore = create<AppModeState>()(
  persist(
    (set) => ({
      mode: "cinematic", // default on first visit
      setMode: (mode) => set({ mode }),
    }),
    { name: "satvis.app-mode" },
  ),
);
```

### 4.2 Boot sequence

1. Zustand's persist middleware rehydrates `mode` from `localStorage` on app init. If no prior value, default is `cinematic`.
2. Top-level layout component reads `mode` and renders `<CinematicLayout />` or `<ResearchLayout />`.
3. A viewport-size effect forces `mode === "research"` when width < 900px. The user's persisted preference is preserved in storage; the forced value is a render-time override.

### 4.3 Toggle UX

- Pill in the top-right chrome cluster, visible in both modes.
- Label + icon: "🎬 Cinematic" / "📊 Research" with a chevron.
- Click opens a small popover with both options; click one to switch.
- On mobile (< 900px), the pill is rendered but disabled. Title attribute / tooltip: "Cinematic is desktop-only."

### 4.4 Transition behavior

- **Cinematic → Research:** `<EarthView />` unmounts inside the Suspense boundary. Scene disposer runs (Three.js renderer, meshes, textures released). Research layout renders. Sky view takes the hero slot.
- **Research → Cinematic:** `<EarthView />` re-mounts. If the `earth-view-*.js` chunk was never fetched (first-time cinematic user), the `<Suspense fallback={<EarthViewLoader />}>` shows the loader; chunk loads, scene mounts.
- No page reload, no lost state. Observer / satellite / selection / playback all preserved.

---

## 5. Commit-then-Query Pattern

### 5.1 Rationale

Today's inputs re-run `/passes` on every keystroke via TanStack Query's key-based invalidation. This causes loading-state flicker while a user is typing an address and also generates unnecessary backend calls. Moving to commit-then-query:
- **Reduces visual noise** — no flashing loading states during edits.
- **Matches user mental model** — users "configure a query, then run it" the same way they configure H-A or a database search.
- **Eliminates wasted work** — `/passes` with a DEM fetch (new observer bbox) uses the OpenTopography API key; fewer runs = fewer potential cache misses.

### 5.2 Store interface

```ts
// web/src/store/draft-inputs.ts
type DraftInputs = {
  observer: ObserverConfig;
  satellite: SatelliteQuery;
  window: TimeWindow;
};

type DraftInputsState = {
  draft: DraftInputs;
  committed: DraftInputs;
  setDraftObserver: (o: ObserverConfig) => void;
  setDraftSatellite: (s: SatelliteQuery) => void;
  setDraftWindow: (w: TimeWindow) => void;
  commit: () => void;   // draft → committed; also writes committed values into the existing observer/satellite/time-range stores
  revert: () => void;   // committed → draft
  isDirty: () => boolean;
  changeCount: () => number;
};
```

On boot, both `draft` and `committed` are initialized from the existing observer/satellite/time-range store defaults (Brooklyn + ISS + Next 24h), so `isDirty` is false initially and the Run button is disabled.

### 5.3 Interaction rules

- Drawer inputs (observer, satellite, window) write to `draft` via the setter actions.
- `Run passes` button in the drawer footer calls `commit()`. Button is:
  - Disabled when `!isDirty()`
  - Enabled, primary-colored, labeled `Run (N changes)` where N = `changeCount()` when dirty
- Keyboard shortcuts:
  - `Enter` inside any drawer input = `commit()`
  - `Esc` inside any drawer input = `revert()`
- Closing the drawer without clicking Run does **not** commit (user can intentionally discard by pressing Esc or closing).

### 5.4 What stays live-reactive (no commit required)

- Pass selection (click a bar in the rail)
- Playback controls (play/pause/scrub/speed)
- Visibility mode toggle in chrome (LOS / Naked-eye) — `/passes` does re-run on this, but it's a single-control change, not a multi-field form
- Display timezone toggle in chrome
- Mode toggle (cinematic ⇄ research)
- Drawer open/close, rail expand/collapse, PiP drag/resize/close

---

## 6. Cinematic Mode Layout

### 6.1 Viewport layout

```
┌──────────────────────────────────────────────────────────────────┐
│  earth hero (full viewport background)          [🎬][👁][🕐]    │  ← top-right chrome
│                                                                  │
│ ╔═╗                                                        ┌───┐ │  ← left tab
│ ║O║                                                        │Pas│ │  ← right rail
│ ║b║                                                        │ses│ │    (collapsed)
│ ║s║                                                        │ 7 │ │
│ ║ ║              [ earth + ground track ]                  │08*│ │  ← active
│ ║·║                                                        │10 │ │
│ ║S║                                                        │12 │ │
│ ║a║                                                        │13 │ │
│ ║t║                                                        │15 │ │
│ ║·║                                          ╭─────╮       │   │ │  ← PiP sky
│ ║W║                                          │ PiP │       │⇤  │ │    (user-placed)
│ ║i║                                          │ sky │       │   │ │
│ ║n║                                          ╰─────╯       └───┘ │
│ ╚═╝      ┌─────────────────────────────────────────┐             │  ← bottom dock
│          │⏸ ──────●───────────  1× │ telemetry    │             │
│          └─────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 Earth hero

- `<EarthView />` renders as the full-viewport background. No card chrome, no border.
- Z-index: 0 (bottom of the stack).
- The earth sphere must remain fully visible (not clipped) when the bottom dock, PiP, and expanded pass rail are all present. The camera's reframe target on pass selection accounts for these offsets — the observer lat/lng is placed in the center of the non-obstructed region (roughly upper-middle of viewport), not dead-center.

### 6.3 Top-right chrome cluster

Three pills, always visible, fixed position, z-index above the earth (~10). Rendered by `<ChromeCluster />`. 10-11px text, rounded-6, backdrop-blur-8 over a semi-transparent blue-gray background, 1px border.

No app title is rendered in cinematic mode — the earth is the hero and the title would compete. The chrome cluster is the only top-bar element.

1. **Mode toggle** — `<ModeToggle />` — "🎬 Cinematic ▾" — opens a popover with both options.
2. **Visibility mode** — `<VisibilityModeToggle />` — "👁 Line-of-sight ▾" or "🌙 Naked-eye ▾" — opens a popover. Live-reactive: changing this value re-runs `/passes` via the existing query key.
3. **Display timezone** — existing `<DisplayTzToggle />`, repositioned. "🕐 Client" / "📍 Observer" / "UTC" — UI-only, no query.

### 6.4 Left drawer

Single collapsible panel docked to the left edge. Implemented as `<LeftDrawer />`.

**Collapsed state (default):**
- 40px wide vertical tab on the left edge.
- Label (vertical text): "Observer · Satellite · Window"
- Click the tab opens the drawer.

**Expanded state:**
- ~360px wide, full height (below top chrome, above bottom dock).
- Semi-transparent blue-gray background with backdrop-blur-12.
- Three stacked sections in order, each a `<section>` with a small label header:
  1. **Observer** — address search (existing `<AddressSearch />`), "Set on map…" button (opens Leaflet modal), saved locations list (existing), `<TzWarning />` (from M5). All fields write to `draft-inputs.observer` via setter.
  2. **Satellite** — search input (existing `<SatelliteSearch />`), current-selection summary. Writes to `draft-inputs.satellite`.
  3. **Window** — preset buttons (`Next 24h`, `Next 3d`, `Next 7d`), custom date range picker (existing). Writes to `draft-inputs.window`.
- **Sticky footer** — `Run passes` button (primary color when dirty, disabled when not). Label: `Run (3 changes)` when dirty.

**Close behavior:**
- Click the tab again, or click anywhere on the earth hero (outside the drawer) → drawer closes.
- Clicking Run also closes the drawer by default (convenient: edit → Run → see the results).

**Keyboard:**
- `⌘K` — opens the drawer if closed and focuses the satellite search input.
- `Enter` inside any drawer input — commits.
- `Esc` inside the drawer — reverts and closes.

### 6.5 Right pass rail

Always visible, docked to the right edge. Implemented as `<PassRail />`. Two states:

**Collapsed (~70px wide, default):**
- Label header: "PASSES" (vertical or compressed horizontal).
- One compact bar per pass in the `passes` query result:
  - Peak time (UTC or whatever tz the display toggle is set to)
  - Peak elevation
- Active pass (from `selection` store) highlighted in orange.
- Vertical scroll if more than ~12 passes.
- "⇤ expand" handle at the bottom — clicking it widens to expanded state.
- Clicking a bar selects that pass (sets `selection.passId`). Rail state does not change.

**Expanded (~300px wide):**
- Full detail row per pass:
  - Rise / peak / set time
  - Direction (NE → S, etc.)
  - Peak elevation
  - Magnitude
  - Duration
- Active pass highlighted.
- Header shows pass count and "⇥ collapse" handle.
- Clicking a row selects that pass. Rail state does not change.

Rail expanded/collapsed state is session-scoped — stored in a local `useState` inside `<PassRail />`, not persisted.

### 6.6 Bottom dock

Implemented as `<PlaybackDock />`. 44px tall, positioned between the left drawer tab and the pass rail. Hidden when `selection.passId === null`.

Contents (left to right):
- Play/pause button (existing `<PlayButton />`)
- Scrub bar (existing `<ScrubBar />`)
- Elapsed / total time (e.g., "03:12 / 07:11")
- Speed toggle (existing `<SpeedSelect />`)
- Separator
- Live telemetry strip — altitude / elevation / magnitude, tabular-nums, bound to the playback cursor sample (existing `<TelemetryRail />` repurposed as a horizontal strip)

### 6.7 PiP sky view

Implemented as `<PipSkyView />`. Wraps the existing `<SkyView />` component in a floating, positioned, resizable container.

- Default position: bottom-right, ~26% viewport width (square aspect).
- Rendered z-index above everything except top chrome pills.
- Chrome:
  - **Drag handle** — the entire header strip (top 20px). `pointerdown` on header → drag.
  - **Close `×`** — top-right corner of the PiP. Calls `pipSky.close()`. Does not clear position/size.
  - **Resize handle** — bottom-right corner, visible diagonal mark. `pointerdown` → resize. Aspect ratio locked 1:1.
- Constraints:
  - Min size: 200px
  - Max size: 60% of shorter viewport dimension
  - Position bounds: at least 40px of the PiP must remain inside the viewport
- Auto-open: whenever `selection.passId` changes to a non-null value (first selection AND every subsequent selection change), `pipSky.open()` is called. Already-open PiP is unaffected by this call. User closing the PiP persists until the next selection change — at which point it reopens.
- Inner `<SkyView />` is unchanged; its SVG scales to whatever container it's rendered in.

---

## 7. Research Mode Layout

### 7.1 Overview

Research mode is today's v0.5.0 layout with three targeted changes. Everything else remains exactly as shipped.

### 7.2 Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Satellite Visibility          [📊][👁][🕐]                  │  ← top-right chrome
├──────────┬─────────────────────────┬─────────────────────────┤
│ Observer │  Pass list              │  Sky view               │
│ Satellite│  Timeline strip         │  Telemetry rail         │
│ Window   │  Tonight card           │  Playback controls      │
│          │                         │                         │
│ [Run]    │                         │                         │
└──────────┴─────────────────────────┴─────────────────────────┘
```

### 7.3 Changes from v0.5.0

1. **Hero toggle removed.** The `<HeroPanel />` that swapped between `<SkyView />` and `<EarthView />` (via `<HeroToggle />`) is replaced with a plain `<SkyView />`. `<EarthView />` is not rendered in research mode. The Three.js chunk never loads.
2. **Left column footer.** Observer + Satellite + Window inputs become draft state. A `Run (N changes)` button at the bottom of the left column commits. Same `draft-inputs` store as cinematic mode.
3. **Top-right chrome cluster.** Same three pills as cinematic (mode toggle, visibility mode, timezone) replace the existing header chrome. The app title ("Satellite Visibility") remains on the left of the header bar.

### 7.4 Unchanged

- `<ObserverPanel />`, `<SatelliteSearch />`, `<TimeRangePicker />` — same components, now wired to `draft-inputs` setters.
- `<PassList />`, `<TimelineStrip />`, `<TonightCard />` — no changes.
- `<SkyView />` + its children (horizon silhouette, satellite arc, satellite cursor) — no changes.
- `<TelemetryRail />`, `<PlayButton />`, `<ScrubBar />`, `<SpeedSelect />` — no changes, same right-column layout as today.

### 7.5 Visibility mode toggle

In v0.5.0, the LOS / Naked-eye toggle lives inside the satellite/mode panel in the middle column. In M6, it is **promoted to the top-right chrome** in both modes for consistency. The old panel-level toggle is removed.

---

## 8. Earth Scene

The 3D scene upgrade, implemented entirely within `web/src/components/earth-view/`.

### 8.1 Module structure

```
web/src/components/earth-view/
├── constants.ts              # existing — EARTH_VIEW_HEIGHT_PX etc.
├── earth-view.tsx            # existing — React component, mount point
├── scene.ts                  # existing — createScene factory, gets updates
├── earth-mesh.ts             # NEW — earth sphere + day/night shader material
├── atmosphere-mesh.ts        # NEW — rim-glow sphere
├── starfield-mesh.ts         # NEW — static star sphere
├── ground-track-mesh.ts      # NEW — great-circle polyline meshes
├── observer-pin-mesh.ts      # NEW (or moved from scene.ts)
├── satellite-marker-mesh.ts  # NEW (or moved from scene.ts)
├── camera-controls.ts        # NEW — drag-to-rotate + pass-reframe tween
└── shaders/
    ├── earth-day-night.vert
    ├── earth-day-night.frag
    ├── atmosphere.vert
    └── atmosphere.frag
```

Each mesh file exports a factory function that returns a `{ mesh, update(…), dispose() }` handle. `scene.ts` composes them. Shaders are imported as strings via Vite's `?raw` suffix.

### 8.2 Earth mesh — day/night blend

- Geometry: `SphereGeometry(R, 128, 64)` — radius ~1 unit (scene-space), 128 × 64 segments.
- Material: `ShaderMaterial` with two texture uniforms (`dayTex`, `nightTex`) and a `sunDir` uniform.
- Fragment shader computes `dot(normal, sunDir)`:
  - `d > 0.08`: day side — sample `dayTex`, output at full brightness.
  - `d < -0.02`: night side — sample `nightTex`, output at reduced exposure (~0.6× — city lights are bright but shouldn't overpower day geography).
  - `-0.02 ≤ d ≤ 0.08`: terminator — linear mix between day and night. The ~10°-wide ramp is deliberately thin to preserve the "sharp edge" target in the aesthetic.
- `sunDir` is computed per-frame in JS: during playback, from the current sim time; when no pass is selected or playback is paused, from the current wall-clock time (`new Date()`). The conversion uses a standard sub-solar-point approximation — declination from day-of-year, right ascension from hour-of-day — already in scope for a few hundred lines of pure math. Lives in `web/src/lib/sun-direction.ts` (NEW helper).

### 8.3 Atmosphere mesh

- Geometry: `SphereGeometry(R * 1.03, 64, 32)` — slightly larger than earth, back-face rendered only.
- Material: `ShaderMaterial`, additive blending.
- Fragment shader: Fresnel term `pow(1.0 - dot(normal, viewDir), 3.0)` × color × intensity. Color: `vec3(0.48, 0.69, 0.88)` (soft blue). Intensity: 0.6 (subtle).
- Back-face rendering means we only see the rim glow when looking past the earth's silhouette.

### 8.4 Starfield mesh

- Geometry: `SphereGeometry(R * 10, 32, 16)` — large sphere, back-face rendered.
- Material: `MeshBasicMaterial({ map: starfieldTexture, side: BackSide })`.
- Texture: equirectangular star map (e.g., NASA Tycho or the Wikipedia-hosted open star maps, ~4K).
- Static — never updates.

### 8.5 Observer pin

- Geometry: `SphereGeometry(0.008, 16, 16)` — small sphere.
- Position: `latLngToVec3(observer.lat, observer.lng, R * 1.002)` — slightly above earth surface.
- Material: `MeshBasicMaterial({ color: 0x4a9eff })` with a child `PointLight` or emissive flag for glow.
- Visible whenever `selection.passId !== null` AND an observer is set.
- Updated when observer changes (on commit).

### 8.6 Satellite marker

- Geometry: `SphereGeometry(0.012, 16, 16)`.
- Position: derived from the playback cursor's `(lat, lng, altitude)` via `latLngToVec3(lat, lng, R * (1 + altitude_scaled))`. Altitude is exaggerated by a factor of **4** — real ISS altitude ~420 km vs earth radius 6371 km would place the marker ~0.066R above the surface; 4× exaggeration lifts it to ~0.26R, which reads clearly as "in space" without being absurd.
- Material: `MeshBasicMaterial({ color: 0xffae60 })` with emissive glow or a halo sprite.
- Visible whenever `selection.passId !== null` AND playback has a current sample.
- Updated every frame during playback.

### 8.7 Ground-track mesh

See section 9.

### 8.8 Shared utilities

- `latLngToVec3(lat, lng, radius)` — standard spherical-to-Cartesian conversion. Lives in `web/src/lib/geo3d.ts` (already exists from M4).
- `greatCircleArc(pointA, pointB, segments)` — helper in `ground-track-mesh.ts` — not needed since we have dense per-second samples from `/sky-track` already.

---

## 9. Ground Track Rendering

### 9.1 Visual target — Option D

Two overlapping lines rendered on the earth's surface:
- **Background line** — faint gray, full pass arc from rise to set, always visible.
- **Progress line** — bright orange, from pass start to the current playback cursor. Bright emissive glow.

Idle state (no selection): no ground track rendered at all.

### 9.2 Geometry

Input: dense `(lat, lng, alt, az, el, t)` samples from the existing `/sky-track` endpoint (via `useSkyTrack`). Typically ~300-400 samples per pass at ~1-2 sec intervals.

For each sample, compute the ground-projected surface point: `latLngToVec3(sample.lat, sample.lng, R * 1.001)` (slightly above surface to avoid z-fighting with the earth mesh). Produces a polyline of N vertices along the great-circle path.

### 9.3 Rendering with Line2 (thick lines)

Three.js's `LineBasicMaterial` renders 1-pixel lines regardless of distance — too thin for a cinematic look. Use `Line2` from `three/examples/jsm/lines/` instead, which renders screen-space-constant width.

**Background line:**
- `LineGeometry().setPositions(flatVertexArray)` — all N × 3 floats.
- `LineMaterial({ color: 0xc8d2e6, linewidth: 1.5, transparent: true, opacity: 0.3 })` — faint gray.
- Mesh: `Line2(geometry, material)`.

**Progress line:**
- Same `LineGeometry`.
- `LineMaterial({ color: 0xff9650, linewidth: 2.5, transparent: true, opacity: 0.95 })` — bright orange.
- Geometry's `drawRange` is set to `[0, cursorSampleIndex × 3]` each frame, truncating the rendered polyline to only the portion covered so far.
- Glow: either a second, thicker, low-opacity `Line2` duplicated underneath, or a bloom post-process. Start with the duplicate-line approach (simpler, no post-pipeline needed).

### 9.4 Updates

- On `selection` change → recompute vertex positions from new sky-track data (both lines share the same `LineGeometry`). Destroy old geometry.
- On playback cursor tick → update progress line's `drawRange`. No geometry changes, cheap.

---

## 10. Camera Behavior

### 10.1 Default state

- Position: fixed distance from earth center — roughly `(0, 0, 3.5 × R)` in scene space, pointing at the origin.
- Target: earth center `(0, 0, 0)`.
- No auto-rotation.

### 10.2 Drag-to-rotate

- `OrbitControls` from `three/examples/jsm/controls/OrbitControls.js`.
- `enableZoom = false` (hard constraint: no zoom).
- `enablePan = false` (no panning — always look at earth center).
- `enableDamping = true`, `dampingFactor = 0.08` — brief inertia after mouse-up.
- Polar angle clamped: `minPolarAngle = 0.3`, `maxPolarAngle = π - 0.3` — prevents flipping over the poles.

### 10.3 Pass-selection reframe

When `selection.passId` changes, tween the camera to a new position.

Reframe target:
- Compute the pass midpoint's observer-relative geometry — the point on earth's surface at the observer's lat/lng.
- Position: a point distance `3.5 × R` from earth center, on the line from earth center through the observer location, with a small latitude offset so the observer appears roughly in the upper third of the viewport (accounting for the bottom dock taking the lower ~50px and the PiP potentially occupying the lower-right).
- Tween duration: 0.8s, ease-out.
- Implementation: a simple `requestAnimationFrame` tween using `gsap`-style `slerp` between two quaternions, or a tiny hand-rolled tween. No new dependency — hand-rolled is fine.

### 10.4 User override during tween or playback

- A user `pointerdown` on the earth immediately cancels any in-progress reframe tween and hands control to `OrbitControls`.
- Re-selecting the same pass or selecting a new pass re-initiates a reframe.
- Playback never triggers camera motion — the satellite marker and the progress line update, but the camera stays where it is (or where the user has rotated it).

### 10.5 Dock / PiP non-clipping constraint

The earth sphere must remain fully visible (not clipped at the edges by the bottom dock, the PiP, or an expanded pass rail) in the default view and after any reframe.

- The camera's default position places the earth centered with ~15% margin on all sides at a standard 16:9 viewport.
- The reframe target's vertical offset is tuned so the observer lat/lng sits ~35-40% from the top of the viewport (rather than dead center), accounting for the bottom ~50px dock + potential PiP in the lower-right.
- If the pass rail is expanded (widening to ~300px), the camera reframe shifts the earth leftward to compensate, so the visible sphere remains un-clipped.

---

## 11. PiP Sky View

### 11.1 Store interface

```ts
// web/src/store/pip-sky.ts
type PipSkyState = {
  isOpen: boolean;
  position: { x: number; y: number }; // top-left in viewport px
  size: { width: number; height: number }; // square
  open: () => void;
  close: () => void;
  setPosition: (p: { x: number; y: number }) => void;
  setSize: (s: { width: number; height: number }) => void;
};
```

Session-scoped (no persist middleware). On cinematic mode entry, initialized to:
- `isOpen: false`
- `position: { x: viewportWidth - size.width - 80, y: viewportHeight - size.height - 68 }` (bottom-right, above the dock, left of the pass rail)
- `size: { width: Math.min(0.26 * viewportWidth, 400), height: same }` (square, capped at 400px per side)

### 11.2 Component

`<PipSkyView />` — a `<div>` with `position: fixed`, bound to the store's position + size + isOpen. Wraps the existing `<SkyView />` inside.

Header strip (top 20px): drag handle + title ("sky · [observer name]") + close `×` button. Resize handle: bottom-right corner, 14×14px diagonal mark.

### 11.3 Interaction

- **Drag**: `pointerdown` on the header starts drag. `pointermove` updates `position`. Release ends drag. Bounds-checked: at least 40px of the PiP must remain inside the viewport on all edges.
- **Resize**: `pointerdown` on the bottom-right corner starts resize. `pointermove` updates `size`. Aspect locked 1:1 (drag adjusts both width and height equally based on the max of dx, dy). Min 200px, max 60% of the shorter viewport dimension.
- **Close**: `×` button calls `close()`. Does not clear `position` / `size` — reopening restores the last placement.
- **Auto-open**: a `useEffect` watching `selection.passId` — whenever it changes to a non-null value (initial selection AND every subsequent pass switch), calls `open()`. A call to `open()` when `isOpen === true` is a no-op, so already-open PiP is unaffected.

### 11.4 Rendering

- Inner `<SkyView />` is unchanged. It renders as an SVG that scales to its container's bounding box.
- The PiP container has `overflow: hidden` and a `border-radius: 50%` (circular frame) to match the dome's natural shape — though the chrome strip at top is rectangular and lives in a separate layer above the circular clip.

---

## 12. Component Map

### 12.1 New components

- `web/src/components/layout/cinematic-layout.tsx` — top-level cinematic mode layout
- `web/src/components/layout/research-layout.tsx` — top-level research mode layout (replaces the current `App.tsx` contents)
- `web/src/components/layout/chrome-cluster.tsx` — top-right floating pill cluster
- `web/src/components/layout/mode-toggle.tsx` — cinematic/research pill
- `web/src/components/layout/visibility-mode-toggle.tsx` — LOS/naked-eye pill (promoted from existing panel)
- `web/src/components/cinematic/left-drawer.tsx` — single collapsible left drawer with stacked sections
- `web/src/components/cinematic/pass-rail.tsx` — right-side pass rail with compact/expanded states
- `web/src/components/cinematic/playback-dock.tsx` — bottom playback + telemetry dock
- `web/src/components/cinematic/pip-sky-view.tsx` — resizable floating sky view
- `web/src/components/earth-view/earth-mesh.ts`, `atmosphere-mesh.ts`, `starfield-mesh.ts`, `ground-track-mesh.ts`, `observer-pin-mesh.ts`, `satellite-marker-mesh.ts`, `camera-controls.ts`, plus shader files
- `web/src/lib/sun-direction.ts` — sub-solar-point helper used by the earth-mesh shader uniform

### 12.2 Modified components

- `web/src/App.tsx` — reads `app-mode`, renders either `<CinematicLayout />` or `<ResearchLayout />`
- `web/src/components/hero/hero-panel.tsx` — retained for research mode only; no longer swaps earth — renders `<SkyView />` directly (or is replaced by a simpler wrapper)
- `web/src/components/observer/observer-panel.tsx` — wiring updated to use `draft-inputs` setters
- `web/src/components/satellite/satellite-search.tsx` — same wiring update
- `web/src/components/layout/header.tsx` — chrome cluster takes over the right side; title stays on the left
- `web/src/components/earth-view/earth-view.tsx` — scene mounting upgraded; mesh wiring changes
- `web/src/components/earth-view/scene.ts` — composes the new mesh factories

### 12.3 New stores

- `web/src/store/app-mode.ts`
- `web/src/store/draft-inputs.ts`
- `web/src/store/pip-sky.ts`

### 12.4 Removed / obsoleted

- `<HeroToggle />` component — no longer needed in either mode
- The panel-level visibility-mode toggle in satellite/mode UI — promoted to chrome, old inline removed

---

## 13. Testing Strategy

### 13.1 New unit tests

- `web/src/store/app-mode.test.ts` — default cinematic, persists via middleware, mobile-force fallback
- `web/src/store/draft-inputs.test.ts` — `isDirty`, `changeCount`, commit/revert flow, setter semantics
- `web/src/store/pip-sky.test.ts` — open/close/setPosition/setSize, bounds enforcement
- `web/src/components/layout/cinematic-layout.test.tsx` — composition, chrome presence, drawer open/close, PiP auto-open on selection
- `web/src/components/layout/research-layout.test.tsx` — today's panels present, earth view not mounted, Run button dirty state
- `web/src/components/layout/mode-toggle.test.tsx` — click switches mode, disabled < 900px, tooltip correct
- `web/src/components/layout/visibility-mode-toggle.test.tsx` — value syncs to existing store, re-query on change
- `web/src/components/cinematic/left-drawer.test.tsx` — three sections render, draft updates, Run button enable/disable, keyboard shortcuts (Enter, Esc, ⌘K)
- `web/src/components/cinematic/pass-rail.test.tsx` — collapsed renders bars, expanded renders rows, click-selects pass, expand/collapse sticks across selections
- `web/src/components/cinematic/pip-sky-view.test.tsx` — auto-open on selection, drag/resize/close affordances present, bounds enforcement
- `web/src/lib/sun-direction.test.ts` — known-date assertions against published sub-solar coordinates (e.g., vernal equinox → sub-solar lat ~0°, summer solstice → sub-solar lat ~23.4°)

### 13.2 Updated existing tests

- `web/src/components/hero/hero-panel.test.tsx` — research mode permanent sky hero (no earth toggle)
- `web/src/components/layout/header.test.tsx` — chrome cluster replaces old header chrome
- Any test that mocks `mode.setMode` or touches the visibility-mode toggle — update imports

### 13.3 Integration / scene

Three.js scene rendering itself is **not** unit-tested in M6. Same policy as today — the scene factory wires existing primitives; GL correctness is verified manually. Visual regression testing (Playwright + screenshot diff) is noted as a post-M6 polish item but not in this milestone.

### 13.4 Manual smoke checklist

Before tagging M6:
1. Fresh browser (no localStorage) → defaults to cinematic → earth renders → default Brooklyn+ISS committed → run → passes populate rail.
2. Click a pass → PiP auto-opens, camera reframes, ground track draws, progress line grows during playback.
3. Drag the PiP → stays in place across selections.
4. Close PiP → stays closed on next selection? (expected: no — auto-open fires on any selection change).
5. Toggle to research → earth unmounts, sky view becomes hero, passes preserved.
6. Toggle back to cinematic → earth re-mounts via Suspense, state preserved.
7. Change observer in drawer, don't click Run → pass list unchanged.
8. Click Run → pass list re-runs, drawer closes.
9. Reload the page → persists in last-selected mode.
10. Shrink viewport to < 900px → cinematic toggle disabled with tooltip; research layout renders.

---

## 14. Implementation Sequencing

The writing-plans skill will produce the ordered task list. Rough dependencies to guide sequencing:

1. **Stores first** — `app-mode`, `draft-inputs`, `pip-sky`. Unit tests pass before any UI consumes them.
2. **Shared chrome** — `<ModeToggle />`, `<VisibilityModeToggle />`, `<ChromeCluster />`. These work in both modes.
3. **Research mode refactor** — reshape today's layout into `<ResearchLayout />`, wire `draft-inputs` in the left column, promote visibility toggle to chrome, remove earth hero toggle. Ship this first because it gives an early "half-shipped" state where the commit-then-query pattern is live and testable without the Three.js complexity.
4. **Cinematic shell** — `<CinematicLayout />`, `<LeftDrawer />`, `<PassRail />`, `<PlaybackDock />` — all renderable over the existing (unmodified) `<EarthView />`. Verifies the layout works before the scene upgrade lands.
5. **PiP sky view** — `<PipSkyView />` with drag/resize/close. Adds to the cinematic shell.
6. **Scene upgrade** — new mesh factories (earth day/night, atmosphere, starfield, ground-track, camera controls). Done in `web/src/components/earth-view/`. Can ship atomically since `scene.ts` composes them; earlier sub-phases don't depend on this.
7. **Polish + gates** — manual smoke check, test suite, lint, build, tag.

---

## 15. Explicit Non-Goals (deferred)

These are written here so the implementation plan doesn't mistake them for scope. Each is a follow-on milestone candidate.

### 15.1 Fast-follow polish (M6.1 candidates)

- **Cloud layer** — second rotating semi-transparent texture above the earth
- **Typography system** — paired display serif + data sans, tabular figures
- **Motion design layer** — framer-motion for drawer / PiP / mode-toggle transitions
- **Custom scrubber with hover preview** — thumbnail on hover, track markers for rise/peak/set
- **Visual regression tests** — Playwright screenshot diff for the earth scene

### 15.2 Next-milestone candidates (M7 — Labels & Landmarks)

- **City labels** on the earth — ~50-100 major cities, billboard text, collision hiding, distance LOD
- **Ocean/continent names, graticules** — equator, tropics, prime meridian as faint arcs
- **Click-the-globe to set observer location** — alternative to the Leaflet modal

### 15.3 Longer-horizon candidates

- **Auto-rotation modes** (real-time / accelerated) — toggle inside cinematic
- **Mobile cinematic variant** — single pane, swipeable sheets, smaller PiP
- **Command palette** — real ⌘K with multi-action routing
- **Multi-observer comparison**, **Tauri/Electron packaging**, **background notifications** — longer-term product directions

---

## 16. Milestone Definition of Done

M6 ships when:

- [ ] `app-mode`, `draft-inputs`, `pip-sky` stores exist with passing unit tests
- [ ] Research mode renders today's layout minus the earth-view hero toggle, with a working Run button (commit-then-query)
- [ ] Cinematic mode renders: full-viewport earth hero, top-right chrome cluster (mode + visibility + tz pills), left drawer (observer + satellite + window + Run), right pass rail (collapsed + expanded), bottom playback dock, resizable PiP sky view
- [ ] Mode toggle persists to `localStorage` and respects it on reload; forced to research < 900px
- [ ] Earth scene is upgraded: Direction A aesthetics (4K Blue Marble + Black Marble night, atmosphere, starfield), drag-to-rotate camera, pass-selection reframe, ground track option D (faint full arc + bright progress)
- [ ] PiP sky view auto-opens on pass selection; drag / resize / close all work; position persists across selections within a session
- [ ] All existing tests still pass; new tests per section 13 all pass
- [ ] Frontend lint + build green; main chunk ~540 KB, earth-view chunk ~650 KB (both within expected ranges)
- [ ] No regressions in observer / satellite / pass-list / timeline / telemetry / playback behavior
- [ ] Manual smoke checklist (section 13.4) all green
- [ ] Git tag `m6-cinematic`, pushed to origin

---

## 17. Open Questions

- Satellite marker altitude exaggeration factor — spec locks at 4×; may want to tune by eye during implementation.
- Camera reframe tween duration — spec locks at 0.8s ease-out; may want to tune.
- Ground-track glow implementation — spec uses duplicate thicker line; consider post-process bloom if visual quality is insufficient.
- Asset licensing — confirm NASA Blue Marble 4K + Black Marble 4K + Tycho star map are all public-domain and can be bundled. (Expected: yes, all NASA / ESA products.)

