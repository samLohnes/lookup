# M4 — 3D Hero + Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scrubbable timeline cursor that drives a per-second telemetry rail, a "ghost" satellite marker on the existing sky view, and a brand-new Three.js 3D earth view (swappable with the sky view as the right-column hero). Plus per-pass ICS calendar export and a "Tonight's passes" summary card above the pass list.

**Architecture:** A new Zustand `playback` store holds `cursor_utc`, `is_playing`, and `speed_multiplier`. A `usePlaybackLoop` hook (mounted once) advances the cursor via `requestAnimationFrame` whenever `is_playing` is true, stopping at the selected pass's set time. Visual layers (telemetry rail, ghost marker on sky view, satellite marker on 3D earth) all subscribe to `cursor_utc` and read interpolated `/sky-track` samples through a shared `useTrackAtCursor` hook. The 3D earth uses Three.js directly (no react-three-fiber) — a tiny scene factory mounts a sphere + Blue Marble texture + observer pin + satellite marker + camera controller into a canvas. ICS export is a pure-function `formatPassAsIcs` that downloads via blob URL.

**Tech Stack:** Three.js 0.170+ for the 3D earth, suncalc for "tonight" sunrise/sunset math (5 KB, well-tested). Everything else extends M1–M3 (React, TanStack Query, Zustand, Tailwind, shadcn). No new backend changes.

---

## File Structure

```
web/
├── public/
│   └── earth-blue-marble.jpg            # NEW: NASA Blue Marble texture (~1.5 MB)
├── src/
│   ├── store/
│   │   └── playback.ts                  # NEW: cursor_utc, is_playing, speed_multiplier
│   ├── hooks/
│   │   ├── use-playback-loop.ts         # NEW: rAF-driven cursor advance
│   │   ├── use-track-at-cursor.ts       # NEW: interpolated sample at cursor
│   │   └── use-tonight-summary.ts       # NEW: filters passes to "tonight"
│   ├── lib/
│   │   ├── interpolate.ts               # NEW: lerp helpers for TrackSample
│   │   ├── ics.ts                       # NEW: format Pass → .ics text
│   │   ├── sun.ts                       # NEW: thin wrapper over suncalc
│   │   └── geo3d.ts                     # NEW: lat/lng/alt → Cartesian (XYZ on a unit sphere * radius)
│   ├── components/
│   │   ├── playback/
│   │   │   ├── scrub-bar.tsx            # NEW: range-input slider tied to cursor
│   │   │   ├── play-button.tsx          # NEW: play/pause toggle
│   │   │   ├── speed-selector.tsx       # NEW: 1× / 10× / 60×
│   │   │   └── playback-bar.tsx         # NEW: composes the three above
│   │   ├── telemetry/
│   │   │   └── telemetry-rail.tsx       # NEW: subscribes to cursor + samples
│   │   ├── sky-view/
│   │   │   └── satellite-cursor.tsx     # NEW: ghost marker at cursor on sky-view
│   │   ├── earth-view/
│   │   │   ├── earth-view.tsx           # NEW: canvas + Three.js scene root
│   │   │   ├── scene-factory.ts         # NEW: pure scene + mesh setup
│   │   │   ├── observer-pin-3d.ts       # NEW: pin sphere mesh factory
│   │   │   ├── satellite-marker-3d.ts   # NEW: satellite marker mesh factory
│   │   │   └── camera-controller.ts     # NEW: auto-orbit logic, user override
│   │   ├── hero/
│   │   │   ├── hero-panel.tsx           # NEW: renders sky OR earth hero
│   │   │   └── hero-toggle.tsx          # NEW: switch button
│   │   └── passes/
│   │       ├── tonight-card.tsx         # NEW: summary card
│   │       └── pass-export-button.tsx   # NEW: ICS download
│   └── test/
│       └── fixtures/
│           └── track-samples.ts         # NEW: shared TrackSample arrays for tests
```

**Modified files (limited):**

- `App.tsx` — wire `<HeroPanel />` (replaces `<SkyView />` direct mount), `<TelemetryRail />`, `<PlaybackBar />`, `<TonightCard />`
- `pass-card.tsx` — add `<PassExportButton />`
- `sky-view.tsx` — add `<SatelliteCursor />` layer

---

## Conventions for this plan

- **Each code step shows complete file contents** of new files. For modifications to existing files, show the full updated file (not a diff).
- **Tests use `just`:** `just web-test` for the suite, `just web-cov` for coverage, `just web-build` for TS check, `just web-lint` for ESLint. The Python suite is unaffected by this milestone.
- **Commit messages:** brief, single-line conventional commits. No body, no co-author trailer.
- **One commit per task** minimum; the final step of each task commits.
- **Test imports:** use `import { renderWithProviders, screen, userEvent } from "@/test/render"` — the M3 helper that wraps in `QueryClientProvider`. For pure-function tests use plain `vitest`.
- **Three.js + jsdom:** Three.js renders to a `<canvas>` with WebGL. jsdom doesn't have WebGL. Component tests for the 3D view assert "the canvas mounts" and "the scene factory was called with the right params"; pure scene math is tested separately via `geo3d` and `scene-factory`.

---

## Task 1: Playback Zustand store

**Files:**
- Create: `web/src/store/playback.ts`
- Create: `web/src/store/playback.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/store/playback.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { usePlaybackStore } from "@/store/playback";

describe("usePlaybackStore", () => {
  beforeEach(() => {
    usePlaybackStore.setState({
      cursorUtc: null,
      isPlaying: false,
      speedMultiplier: 1,
    });
  });

  it("setCursor stores an ISO timestamp", () => {
    usePlaybackStore.getState().setCursor("2026-05-01T02:03:00Z");
    expect(usePlaybackStore.getState().cursorUtc).toBe("2026-05-01T02:03:00Z");
  });

  it("play sets isPlaying true; pause sets it false", () => {
    usePlaybackStore.getState().play();
    expect(usePlaybackStore.getState().isPlaying).toBe(true);
    usePlaybackStore.getState().pause();
    expect(usePlaybackStore.getState().isPlaying).toBe(false);
  });

  it("toggle flips isPlaying", () => {
    usePlaybackStore.getState().toggle();
    expect(usePlaybackStore.getState().isPlaying).toBe(true);
    usePlaybackStore.getState().toggle();
    expect(usePlaybackStore.getState().isPlaying).toBe(false);
  });

  it("setSpeed accepts the three valid multipliers", () => {
    for (const s of [1, 10, 60] as const) {
      usePlaybackStore.getState().setSpeed(s);
      expect(usePlaybackStore.getState().speedMultiplier).toBe(s);
    }
  });

  it("seekTo sets cursor and pauses (so the user sees the new frame, not playback)", () => {
    usePlaybackStore.setState({ isPlaying: true });
    usePlaybackStore.getState().seekTo("2026-05-01T02:00:00Z");
    expect(usePlaybackStore.getState().cursorUtc).toBe("2026-05-01T02:00:00Z");
    expect(usePlaybackStore.getState().isPlaying).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd web && npx vitest run src/store/playback.test.ts
```

Expected: `Cannot find module '@/store/playback'`.

- [ ] **Step 3: Implement `web/src/store/playback.ts`**

```ts
import { create } from "zustand";

export type SpeedMultiplier = 1 | 10 | 60;

interface PlaybackState {
  cursorUtc: string | null;
  isPlaying: boolean;
  speedMultiplier: SpeedMultiplier;
  setCursor: (iso: string | null) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (s: SpeedMultiplier) => void;
  /** Seek to a specific cursor and pause so the user sees the frame at rest. */
  seekTo: (iso: string) => void;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  cursorUtc: null,
  isPlaying: false,
  speedMultiplier: 1,
  setCursor: (iso) => set({ cursorUtc: iso }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setSpeed: (s) => set({ speedMultiplier: s }),
  seekTo: (iso) => set({ cursorUtc: iso, isPlaying: false }),
}));
```

- [ ] **Step 4: Run — should pass**

```bash
cd web && npx vitest run src/store/playback.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat(web): playback Zustand store"
```

---

## Task 2: Linear interpolation between TrackSamples

The `/sky-track` endpoint emits samples at fixed intervals (we use `dt_seconds=2`). Between two adjacent samples we linearly interpolate az / el / range / velocity / magnitude / sub-point. Booleans (`sunlit`, `observer_dark`) snap to the earlier sample.

**Files:**
- Create: `web/src/lib/interpolate.ts`
- Create: `web/src/lib/interpolate.test.ts`
- Create: `web/src/test/fixtures/track-samples.ts`

- [ ] **Step 1: Create the shared fixture file**

`web/src/test/fixtures/track-samples.ts`:

```ts
import type { TrackSampleResponse } from "@/types/api";

/** Build a TrackSample with sensible defaults — overrides only the fields you care about. */
export function trackSample(
  overrides: Partial<TrackSampleResponse> & { time: string },
): TrackSampleResponse {
  return {
    lat: 0,
    lng: 0,
    alt_km: 400,
    az: 0,
    el: 0,
    range_km: 500,
    velocity_km_s: 7.66,
    magnitude: null,
    sunlit: true,
    observer_dark: true,
    ...overrides,
  };
}

/** A canned 5-sample arc rising in the SE, peaking south, setting SW. */
export const ARC_SAMPLES: TrackSampleResponse[] = [
  trackSample({ time: "2026-05-01T02:00:00Z", az: 90, el: 5,  range_km: 600 }),
  trackSample({ time: "2026-05-01T02:01:30Z", az: 135, el: 30, range_km: 500 }),
  trackSample({ time: "2026-05-01T02:03:00Z", az: 180, el: 60, range_km: 450 }),
  trackSample({ time: "2026-05-01T02:04:30Z", az: 225, el: 30, range_km: 500 }),
  trackSample({ time: "2026-05-01T02:06:00Z", az: 270, el: 5,  range_km: 600 }),
];
```

- [ ] **Step 2: Write the failing test**

`web/src/lib/interpolate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { interpolateAtCursor } from "@/lib/interpolate";
import { ARC_SAMPLES, trackSample } from "@/test/fixtures/track-samples";

describe("interpolateAtCursor", () => {
  it("returns null for empty samples", () => {
    expect(interpolateAtCursor([], "2026-05-01T02:00:00Z")).toBeNull();
  });

  it("returns null when cursor is before the first sample", () => {
    expect(interpolateAtCursor(ARC_SAMPLES, "2026-05-01T01:00:00Z")).toBeNull();
  });

  it("returns null when cursor is after the last sample", () => {
    expect(interpolateAtCursor(ARC_SAMPLES, "2026-05-01T03:00:00Z")).toBeNull();
  });

  it("returns the exact sample when cursor matches a sample timestamp", () => {
    const out = interpolateAtCursor(ARC_SAMPLES, "2026-05-01T02:03:00Z");
    expect(out?.az).toBeCloseTo(180, 5);
    expect(out?.el).toBeCloseTo(60, 5);
  });

  it("linearly interpolates az/el/range halfway between two samples", () => {
    // Halfway between sample[0] (02:00, az=90, el=5) and sample[1] (02:01:30, az=135, el=30).
    // 02:00:45 is exactly halfway.
    const out = interpolateAtCursor(ARC_SAMPLES, "2026-05-01T02:00:45Z");
    expect(out?.az).toBeCloseTo(112.5, 1);
    expect(out?.el).toBeCloseTo(17.5, 1);
    expect(out?.range_km).toBeCloseTo(550, 1);
  });

  it("snaps boolean fields to the earlier sample", () => {
    const samples = [
      trackSample({ time: "2026-05-01T02:00:00Z", sunlit: false, observer_dark: false }),
      trackSample({ time: "2026-05-01T02:01:00Z", sunlit: true,  observer_dark: true }),
    ];
    const out = interpolateAtCursor(samples, "2026-05-01T02:00:30Z");
    expect(out?.sunlit).toBe(false);
    expect(out?.observer_dark).toBe(false);
  });

  it("interpolates magnitude when both endpoints have it", () => {
    const samples = [
      trackSample({ time: "2026-05-01T02:00:00Z", magnitude: -1 }),
      trackSample({ time: "2026-05-01T02:01:00Z", magnitude: -3 }),
    ];
    const out = interpolateAtCursor(samples, "2026-05-01T02:00:30Z");
    expect(out?.magnitude).toBeCloseTo(-2, 1);
  });

  it("returns null magnitude if either endpoint is null (mode is line-of-sight)", () => {
    const samples = [
      trackSample({ time: "2026-05-01T02:00:00Z", magnitude: null }),
      trackSample({ time: "2026-05-01T02:01:00Z", magnitude: -2 }),
    ];
    const out = interpolateAtCursor(samples, "2026-05-01T02:00:30Z");
    expect(out?.magnitude).toBeNull();
  });

  it("sets the time field on the result to the cursor", () => {
    const out = interpolateAtCursor(ARC_SAMPLES, "2026-05-01T02:00:45Z");
    expect(out?.time).toBe("2026-05-01T02:00:45Z");
  });
});
```

- [ ] **Step 3: Run — expect failure**

```bash
cd web && npx vitest run src/lib/interpolate.test.ts
```

Expected: `Cannot find module '@/lib/interpolate'`.

- [ ] **Step 4: Implement `web/src/lib/interpolate.ts`**

```ts
import type { TrackSampleResponse } from "@/types/api";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolate a TrackSample at a precise cursor time within a sample series.
 *
 * Returns null if `samples` is empty or the cursor is outside the series.
 *
 * Numeric fields (az, el, range, velocity, alt, lat, lng, magnitude when both
 * endpoints have it) are linearly interpolated. Boolean fields (sunlit,
 * observer_dark) snap to the earlier sample to avoid impossible mid-step
 * transitions like "half-eclipsed".
 */
export function interpolateAtCursor(
  samples: TrackSampleResponse[],
  cursorIso: string,
): TrackSampleResponse | null {
  if (samples.length === 0) return null;
  const cursor = Date.parse(cursorIso);
  if (Number.isNaN(cursor)) return null;
  const first = Date.parse(samples[0].time);
  const last = Date.parse(samples[samples.length - 1].time);
  if (cursor < first || cursor > last) return null;

  // Find the segment containing the cursor.
  let lo = 0;
  let hi = samples.length - 1;
  // Linear scan is fine — pass tracks have <= ~200 samples.
  for (let i = 0; i < samples.length - 1; i += 1) {
    const a = Date.parse(samples[i].time);
    const b = Date.parse(samples[i + 1].time);
    if (cursor >= a && cursor <= b) {
      lo = i;
      hi = i + 1;
      break;
    }
  }

  const a = samples[lo];
  const b = samples[hi];
  const tA = Date.parse(a.time);
  const tB = Date.parse(b.time);
  const span = tB - tA;
  const t = span === 0 ? 0 : (cursor - tA) / span;

  const magBoth = a.magnitude != null && b.magnitude != null;

  return {
    time: cursorIso,
    lat: lerp(a.lat, b.lat, t),
    lng: lerp(a.lng, b.lng, t),
    alt_km: lerp(a.alt_km, b.alt_km, t),
    az: lerp(a.az, b.az, t),
    el: lerp(a.el, b.el, t),
    range_km: lerp(a.range_km, b.range_km, t),
    velocity_km_s: lerp(a.velocity_km_s, b.velocity_km_s, t),
    magnitude: magBoth ? lerp(a.magnitude!, b.magnitude!, t) : null,
    sunlit: a.sunlit, // snap to earlier
    observer_dark: a.observer_dark, // snap to earlier
  };
}
```

- [ ] **Step 5: Run — should pass**

```bash
cd web && npx vitest run src/lib/interpolate.test.ts
```

Expected: 9 passed.

- [ ] **Step 6: Commit**

```bash
git add web
git commit -m "feat(web): interpolateAtCursor for TrackSample series"
```

---

## Task 3: useTrackAtCursor hook

Wraps the existing `useCurrentSkyTrack` and applies `interpolateAtCursor` against the playback store's `cursorUtc`. Returns `{ sample, isLoading }`.

**Files:**
- Create: `web/src/hooks/use-track-at-cursor.ts`

- [ ] **Step 1: Implement**

```ts
import { useMemo } from "react";
import { useCurrentSkyTrack } from "@/hooks/use-current-sky-track";
import { usePlaybackStore } from "@/store/playback";
import { interpolateAtCursor } from "@/lib/interpolate";
import type { TrackSampleResponse } from "@/types/api";

export interface TrackAtCursor {
  sample: TrackSampleResponse | null;
  isLoading: boolean;
}

export function useTrackAtCursor(): TrackAtCursor {
  const cursor = usePlaybackStore((s) => s.cursorUtc);
  const { data, isFetching } = useCurrentSkyTrack();

  const sample = useMemo(() => {
    if (!cursor || !data) return null;
    return interpolateAtCursor(data.samples, cursor);
  }, [cursor, data]);

  return { sample, isLoading: isFetching && !data };
}
```

- [ ] **Step 2: Verify build**

```bash
just web-build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add web
git commit -m "feat(web): useTrackAtCursor hook"
```

---

## Task 4: Cursor reset effect

When the user selects a new pass, the cursor should reset to that pass's rise time and playback should pause (let the user start fresh). When the cursor reaches the pass's set time, playback should auto-pause.

**Files:**
- Create: `web/src/hooks/use-cursor-reset.ts`
- Create: `web/src/hooks/use-cursor-reset.test.ts`

- [ ] **Step 1: Write the failing test**

`web/src/hooks/use-cursor-reset.test.ts`:

```ts
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { useCursorReset } from "@/hooks/use-cursor-reset";
import { usePlaybackStore } from "@/store/playback";
import { useObserverStore } from "@/store/observer";
import { useSatelliteStore } from "@/store/satellite";
import { useSelectionStore } from "@/store/selection";
import { useTimeRangeStore } from "@/store/time-range";
import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  useObserverStore.setState({
    current: { lat: 40.7128, lng: -74.006, elevation_m: 10, name: "NYC" },
    saved: [],
  });
  useSatelliteStore.setState({ query: "ISS", resolvedName: null });
  useTimeRangeStore.setState({
    fromUtc: "2026-05-01T00:00:00Z",
    toUtc: "2026-05-08T00:00:00Z",
    mode: "line-of-sight",
  });
  useSelectionStore.setState({ selectedPassId: null });
  usePlaybackStore.setState({
    cursorUtc: null,
    isPlaying: false,
    speedMultiplier: 1,
  });
});

describe("useCursorReset", () => {
  it("sets cursor to selected pass's rise time and pauses playback", async () => {
    server.use(
      http.post("/api/passes", () =>
        HttpResponse.json({
          query: "ISS",
          resolved_name: "ISS (ZARYA)",
          passes: [
            {
              kind: "single",
              id: "p1",
              norad_id: 25544,
              name: "ISS (ZARYA)",
              rise: { time: "2026-05-01T02:00:00Z", azimuth_deg: 90, elevation_deg: 0 },
              peak: { time: "2026-05-01T02:03:00Z", azimuth_deg: 180, elevation_deg: 60 },
              set: { time: "2026-05-01T02:06:00Z", azimuth_deg: 270, elevation_deg: 0 },
              duration_s: 360,
              max_magnitude: null,
              sunlit_fraction: 0,
              tle_epoch: "2026-04-30T00:00:00Z",
            },
          ],
          tle_age_seconds: 0,
        }),
      ),
    );

    usePlaybackStore.setState({
      cursorUtc: null,
      isPlaying: true,
      speedMultiplier: 1,
    });

    const { rerender } = renderHook(() => useCursorReset(), { wrapper });

    // Wait for /passes query, then trigger selection.
    await new Promise((r) => setTimeout(r, 30));
    useSelectionStore.setState({ selectedPassId: "p1" });
    rerender();
    await new Promise((r) => setTimeout(r, 30));

    expect(usePlaybackStore.getState().cursorUtc).toBe("2026-05-01T02:00:00Z");
    expect(usePlaybackStore.getState().isPlaying).toBe(false);
  });

  it("clears cursor when selection becomes null", async () => {
    usePlaybackStore.setState({
      cursorUtc: "2026-05-01T02:03:00Z",
      isPlaying: false,
      speedMultiplier: 1,
    });
    useSelectionStore.setState({ selectedPassId: null });
    renderHook(() => useCursorReset(), { wrapper });
    await new Promise((r) => setTimeout(r, 30));
    expect(usePlaybackStore.getState().cursorUtc).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd web && npx vitest run src/hooks/use-cursor-reset.test.ts
```

Expected: `Cannot find module '@/hooks/use-cursor-reset'`.

- [ ] **Step 3: Implement `web/src/hooks/use-cursor-reset.ts`**

```ts
import { useEffect } from "react";
import { useCurrentPasses } from "@/hooks/use-current-passes";
import { useSelectionStore } from "@/store/selection";
import { usePlaybackStore } from "@/store/playback";

/** Whenever the selected pass changes, reset the playback cursor to that
 *  pass's rise time (and pause). When selection clears, clear the cursor.
 *
 *  Mount once at app level (e.g. inside <App />). */
export function useCursorReset(): void {
  const { data } = useCurrentPasses();
  const selectedId = useSelectionStore((s) => s.selectedPassId);

  useEffect(() => {
    if (!selectedId) {
      usePlaybackStore.setState({ cursorUtc: null, isPlaying: false });
      return;
    }
    if (!data) return;
    const pass = data.passes.find((p) => p.id === selectedId);
    if (!pass) return;
    usePlaybackStore.setState({
      cursorUtc: pass.rise.time,
      isPlaying: false,
    });
  }, [selectedId, data]);
}
```

- [ ] **Step 4: Run — should pass**

```bash
cd web && npx vitest run src/hooks/use-cursor-reset.test.ts
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat(web): useCursorReset effect"
```

---

## Task 5: Playback loop (`requestAnimationFrame` driver)

Single mount at app level. While `isPlaying` is true, advances `cursorUtc` by `Δms × speedMultiplier` per frame (where Δms is the rAF delta). Pauses when cursor reaches the end of the cached `/sky-track` window.

**Files:**
- Create: `web/src/hooks/use-playback-loop.ts`
- Create: `web/src/hooks/use-playback-loop.test.ts`

- [ ] **Step 1: Write the failing test**

`web/src/hooks/use-playback-loop.test.ts`:

```ts
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { usePlaybackLoop } from "@/hooks/use-playback-loop";
import { usePlaybackStore } from "@/store/playback";
import { useObserverStore } from "@/store/observer";
import { useSatelliteStore } from "@/store/satellite";
import { useSelectionStore } from "@/store/selection";
import { useTimeRangeStore } from "@/store/time-range";
import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const SAMPLES = [
  { time: "2026-05-01T02:00:00Z", lat: 0, lng: 0, alt_km: 400, az: 90, el: 5,  range_km: 600, velocity_km_s: 7.66, magnitude: null, sunlit: true, observer_dark: true },
  { time: "2026-05-01T02:00:02Z", lat: 0, lng: 0, alt_km: 400, az: 95, el: 6,  range_km: 595, velocity_km_s: 7.66, magnitude: null, sunlit: true, observer_dark: true },
  { time: "2026-05-01T02:00:04Z", lat: 0, lng: 0, alt_km: 400, az: 100, el: 7, range_km: 590, velocity_km_s: 7.66, magnitude: null, sunlit: true, observer_dark: true },
];

beforeEach(() => {
  useObserverStore.setState({
    current: { lat: 40.7128, lng: -74.006, elevation_m: 10, name: "NYC" },
    saved: [],
  });
  useSatelliteStore.setState({ query: "ISS", resolvedName: null });
  useTimeRangeStore.setState({
    fromUtc: "2026-05-01T00:00:00Z",
    toUtc: "2026-05-08T00:00:00Z",
    mode: "line-of-sight",
  });
  useSelectionStore.setState({ selectedPassId: "p1" });
  usePlaybackStore.setState({
    cursorUtc: "2026-05-01T02:00:00Z",
    isPlaying: false,
    speedMultiplier: 1,
  });

  // Always serve a single pass so the cursor's window is well-defined.
  server.use(
    http.post("/api/passes", () =>
      HttpResponse.json({
        query: "ISS",
        resolved_name: "ISS (ZARYA)",
        passes: [
          {
            kind: "single",
            id: "p1",
            norad_id: 25544,
            name: "ISS (ZARYA)",
            rise: { time: "2026-05-01T02:00:00Z", azimuth_deg: 90, elevation_deg: 0 },
            peak: { time: "2026-05-01T02:00:02Z", azimuth_deg: 95, elevation_deg: 6 },
            set: { time: "2026-05-01T02:00:04Z", azimuth_deg: 100, elevation_deg: 0 },
            duration_s: 4,
            max_magnitude: null,
            sunlit_fraction: 0,
            tle_epoch: "2026-04-30T00:00:00Z",
          },
        ],
        tle_age_seconds: 0,
      }),
    ),
    http.post("/api/sky-track", () =>
      HttpResponse.json({ resolved_name: "ISS (ZARYA)", samples: SAMPLES }),
    ),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("usePlaybackLoop", () => {
  it("advances cursor while playing at 1×", async () => {
    renderHook(() => usePlaybackLoop(), { wrapper });
    // Wait for sky-track query.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    usePlaybackStore.setState({ isPlaying: true });

    // Manually advance time by simulating 1000 ms of rAF ticks.
    // The hook drives off requestAnimationFrame which jsdom polyfills loosely;
    // we just wait wall-clock and assert the cursor moved forward.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });

    const cursor = usePlaybackStore.getState().cursorUtc;
    expect(cursor).not.toBe("2026-05-01T02:00:00Z");
    expect(Date.parse(cursor!)).toBeGreaterThan(Date.parse("2026-05-01T02:00:00Z"));
  });

  it("does not advance when paused", async () => {
    renderHook(() => usePlaybackLoop(), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    usePlaybackStore.setState({ isPlaying: false });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });

    expect(usePlaybackStore.getState().cursorUtc).toBe("2026-05-01T02:00:00Z");
  });

  it("auto-pauses when cursor reaches the end of the pass", async () => {
    renderHook(() => usePlaybackLoop(), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Start near the end of the pass; play at 60× to blow past in one frame.
    usePlaybackStore.setState({
      cursorUtc: "2026-05-01T02:00:03Z",
      isPlaying: true,
      speedMultiplier: 60,
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });

    expect(usePlaybackStore.getState().isPlaying).toBe(false);
    // Cursor clamped to the pass's set time.
    expect(usePlaybackStore.getState().cursorUtc).toBe("2026-05-01T02:00:04Z");
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd web && npx vitest run src/hooks/use-playback-loop.test.ts
```

Expected: `Cannot find module '@/hooks/use-playback-loop'`.

- [ ] **Step 3: Implement `web/src/hooks/use-playback-loop.ts`**

```ts
import { useEffect, useRef } from "react";
import { usePlaybackStore } from "@/store/playback";
import { useCurrentSkyTrack } from "@/hooks/use-current-sky-track";

/** Drives the playback cursor via requestAnimationFrame.
 *
 *  Mount once at app level. Self-pauses when the cursor reaches the end
 *  of the cached /sky-track samples (i.e. the selected pass's set time).
 *
 *  The loop is decoupled from React render frequency by reading
 *  store state inside the rAF callback — Zustand's getState() is
 *  synchronous and free of subscriptions, which is what we want here.
 */
export function usePlaybackLoop(): void {
  const { data } = useCurrentSkyTrack();
  const lastTickRef = useRef<number | null>(null);

  // Subscribe to isPlaying so we can start/stop the loop on changes.
  const isPlaying = usePlaybackStore((s) => s.isPlaying);

  useEffect(() => {
    if (!isPlaying || !data || data.samples.length === 0) {
      lastTickRef.current = null;
      return;
    }

    const lastSampleMs = Date.parse(data.samples[data.samples.length - 1].time);
    let raf = 0;

    const tick = (now: number) => {
      const last = lastTickRef.current;
      lastTickRef.current = now;
      if (last !== null) {
        const deltaMs = now - last;
        const { cursorUtc, speedMultiplier } = usePlaybackStore.getState();
        if (cursorUtc) {
          const advanced = Date.parse(cursorUtc) + deltaMs * speedMultiplier;
          if (advanced >= lastSampleMs) {
            usePlaybackStore.setState({
              cursorUtc: new Date(lastSampleMs).toISOString(),
              isPlaying: false,
            });
            return; // stop the loop
          }
          usePlaybackStore.setState({
            cursorUtc: new Date(advanced).toISOString(),
          });
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      lastTickRef.current = null;
    };
  }, [isPlaying, data]);
}
```

- [ ] **Step 4: Run — should pass**

```bash
cd web && npx vitest run src/hooks/use-playback-loop.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat(web): playback loop driving cursor via rAF"
```

---

## Task 6: Play/pause button, speed selector, scrub bar

Three small components composed into one playback bar.

**Files:**
- Create: `web/src/components/playback/play-button.tsx`
- Create: `web/src/components/playback/play-button.test.tsx`
- Create: `web/src/components/playback/speed-selector.tsx`
- Create: `web/src/components/playback/speed-selector.test.tsx`
- Create: `web/src/components/playback/scrub-bar.tsx`
- Create: `web/src/components/playback/scrub-bar.test.tsx`
- Create: `web/src/components/playback/playback-bar.tsx`

- [ ] **Step 1: Implement `play-button.tsx`**

```tsx
import { Button } from "@/components/ui/button";
import { usePlaybackStore } from "@/store/playback";
import { useSelectionStore } from "@/store/selection";

export function PlayButton() {
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const toggle = usePlaybackStore((s) => s.toggle);
  const selected = useSelectionStore((s) => s.selectedPassId);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!selected}
      onClick={toggle}
      aria-label={isPlaying ? "Pause" : "Play"}
    >
      {isPlaying ? "❚❚ Pause" : "▶ Play"}
    </Button>
  );
}
```

- [ ] **Step 2: Test for `play-button.tsx`**

`web/src/components/playback/play-button.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { PlayButton } from "@/components/playback/play-button";
import { usePlaybackStore } from "@/store/playback";
import { useSelectionStore } from "@/store/selection";

beforeEach(() => {
  usePlaybackStore.setState({
    cursorUtc: null,
    isPlaying: false,
    speedMultiplier: 1,
  });
  useSelectionStore.setState({ selectedPassId: "p1" });
});

describe("PlayButton", () => {
  it("renders Play when paused, Pause when playing", () => {
    const { rerender } = renderWithProviders(<PlayButton />);
    expect(screen.getByRole("button")).toHaveTextContent(/Play/);
    usePlaybackStore.setState({ isPlaying: true });
    rerender(<PlayButton />);
    expect(screen.getByRole("button")).toHaveTextContent(/Pause/);
  });

  it("toggles isPlaying on click", async () => {
    renderWithProviders(<PlayButton />);
    await userEvent.click(screen.getByRole("button"));
    expect(usePlaybackStore.getState().isPlaying).toBe(true);
  });

  it("is disabled when no pass is selected", () => {
    useSelectionStore.setState({ selectedPassId: null });
    renderWithProviders(<PlayButton />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

- [ ] **Step 3: Implement `speed-selector.tsx`**

```tsx
import { Button } from "@/components/ui/button";
import { usePlaybackStore, type SpeedMultiplier } from "@/store/playback";

const SPEEDS: SpeedMultiplier[] = [1, 10, 60];

export function SpeedSelector() {
  const speed = usePlaybackStore((s) => s.speedMultiplier);
  const setSpeed = usePlaybackStore((s) => s.setSpeed);
  return (
    <div className="flex gap-1" role="group" aria-label="Playback speed">
      {SPEEDS.map((s) => (
        <Button
          key={s}
          variant={s === speed ? "default" : "outline"}
          size="sm"
          onClick={() => setSpeed(s)}
        >
          {s}×
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Test for `speed-selector.tsx`**

`web/src/components/playback/speed-selector.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { SpeedSelector } from "@/components/playback/speed-selector";
import { usePlaybackStore } from "@/store/playback";

beforeEach(() => {
  usePlaybackStore.setState({
    cursorUtc: null,
    isPlaying: false,
    speedMultiplier: 1,
  });
});

describe("SpeedSelector", () => {
  it("renders three buttons for 1×, 10×, 60×", () => {
    renderWithProviders(<SpeedSelector />);
    expect(screen.getByRole("button", { name: "1×" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10×" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "60×" })).toBeInTheDocument();
  });

  it("clicking 60× sets speedMultiplier to 60", async () => {
    renderWithProviders(<SpeedSelector />);
    await userEvent.click(screen.getByRole("button", { name: "60×" }));
    expect(usePlaybackStore.getState().speedMultiplier).toBe(60);
  });
});
```

- [ ] **Step 5: Implement `scrub-bar.tsx`**

```tsx
import { useCurrentPasses } from "@/hooks/use-current-passes";
import { usePlaybackStore } from "@/store/playback";
import { useSelectionStore } from "@/store/selection";

/** A native range input bound to the cursor. The user can drag to seek. */
export function ScrubBar() {
  const { data } = useCurrentPasses();
  const cursor = usePlaybackStore((s) => s.cursorUtc);
  const seekTo = usePlaybackStore((s) => s.seekTo);
  const selectedId = useSelectionStore((s) => s.selectedPassId);

  if (!data || !selectedId) {
    return (
      <div className="text-xs text-fg-subtle py-2">
        Select a pass to scrub.
      </div>
    );
  }

  const pass = data.passes.find((p) => p.id === selectedId);
  if (!pass) return null;
  const startMs = Date.parse(pass.rise.time);
  const endMs = Date.parse(pass.set.time);
  const cursorMs = cursor ? Date.parse(cursor) : startMs;
  const value = Math.max(0, Math.min(cursorMs - startMs, endMs - startMs));

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="label-upper">cursor</span>
      <input
        aria-label="Scrub"
        type="range"
        min={0}
        max={endMs - startMs}
        step={1000}
        value={value}
        onChange={(e) => {
          const ms = Number(e.target.value);
          seekTo(new Date(startMs + ms).toISOString());
        }}
        className="flex-1 accent-satellite"
      />
      <span className="text-xs tabular-nums text-fg-muted">
        {formatSecondsWithinPass(value)}
      </span>
    </div>
  );
}

function formatSecondsWithinPass(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `+${m}:${s.toString().padStart(2, "0")}`;
}
```

- [ ] **Step 6: Test for `scrub-bar.tsx`**

`web/src/components/playback/scrub-bar.test.tsx`:

```tsx
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { ScrubBar } from "@/components/playback/scrub-bar";
import { server } from "@/test/msw/server";
import { useObserverStore } from "@/store/observer";
import { usePlaybackStore } from "@/store/playback";
import { useSatelliteStore } from "@/store/satellite";
import { useSelectionStore } from "@/store/selection";
import { useTimeRangeStore } from "@/store/time-range";

beforeEach(() => {
  useObserverStore.setState({
    current: { lat: 40.7128, lng: -74.006, elevation_m: 10, name: "NYC" },
    saved: [],
  });
  useSatelliteStore.setState({ query: "ISS", resolvedName: null });
  useTimeRangeStore.setState({
    fromUtc: "2026-05-01T00:00:00Z",
    toUtc: "2026-05-08T00:00:00Z",
    mode: "line-of-sight",
  });
  useSelectionStore.setState({ selectedPassId: "p1" });
  usePlaybackStore.setState({
    cursorUtc: "2026-05-01T02:00:00Z",
    isPlaying: false,
    speedMultiplier: 1,
  });

  server.use(
    http.post("/api/passes", () =>
      HttpResponse.json({
        query: "ISS",
        resolved_name: "ISS (ZARYA)",
        passes: [
          {
            kind: "single",
            id: "p1",
            norad_id: 25544,
            name: "ISS (ZARYA)",
            rise: { time: "2026-05-01T02:00:00Z", azimuth_deg: 90, elevation_deg: 0 },
            peak: { time: "2026-05-01T02:03:00Z", azimuth_deg: 180, elevation_deg: 60 },
            set: { time: "2026-05-01T02:06:00Z", azimuth_deg: 270, elevation_deg: 0 },
            duration_s: 360,
            max_magnitude: null,
            sunlit_fraction: 0,
            tle_epoch: "2026-04-30T00:00:00Z",
          },
        ],
        tle_age_seconds: 0,
      }),
    ),
  );
});

describe("ScrubBar", () => {
  it("shows a hint when no pass is selected", () => {
    useSelectionStore.setState({ selectedPassId: null });
    renderWithProviders(<ScrubBar />);
    expect(screen.getByText(/Select a pass to scrub/)).toBeInTheDocument();
  });

  it("renders the slider when a pass is selected", async () => {
    renderWithProviders(<ScrubBar />);
    expect(await screen.findByRole("slider")).toBeInTheDocument();
  });

  it("dragging the slider seeks the cursor and pauses", async () => {
    renderWithProviders(<ScrubBar />);
    const slider = (await screen.findByRole("slider")) as HTMLInputElement;
    // Manually fire a change — userEvent.type doesn't drag range inputs in jsdom.
    slider.value = "60000"; // +1 minute
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    slider.dispatchEvent(new Event("change", { bubbles: true }));

    expect(usePlaybackStore.getState().cursorUtc).toBe("2026-05-01T02:01:00.000Z");
    expect(usePlaybackStore.getState().isPlaying).toBe(false);
  });
});
```

- [ ] **Step 7: Implement `playback-bar.tsx`**

```tsx
import { PlayButton } from "@/components/playback/play-button";
import { SpeedSelector } from "@/components/playback/speed-selector";
import { ScrubBar } from "@/components/playback/scrub-bar";

export function PlaybackBar() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <PlayButton />
        <SpeedSelector />
      </div>
      <ScrubBar />
    </div>
  );
}
```

- [ ] **Step 8: Run all playback tests**

```bash
cd web && npx vitest run src/components/playback
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add web
git commit -m "feat(web): play/pause + speed + scrub bar"
```

---

## Task 7: Telemetry rail

A small component that subscribes to `useTrackAtCursor` and renders a 6-row telemetry table.

**Files:**
- Create: `web/src/components/telemetry/telemetry-rail.tsx`
- Create: `web/src/components/telemetry/telemetry-rail.test.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useTrackAtCursor } from "@/hooks/use-track-at-cursor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RowProps {
  label: string;
  value: string;
}

function Row({ label, value }: RowProps) {
  return (
    <div className="flex justify-between text-xs py-0.5">
      <span className="text-fg-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function TelemetryRail() {
  const { sample, isLoading } = useTrackAtCursor();

  if (!sample) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Telemetry</CardTitle>
        </CardHeader>
        <CardContent className="text-fg-muted text-xs">
          {isLoading ? "Loading…" : "Select a pass and press play to see telemetry."}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Telemetry</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <Row
          label="Time (local)"
          value={new Date(sample.time).toLocaleTimeString()}
        />
        <Row label="Altitude" value={`${sample.alt_km.toFixed(1)} km`} />
        <Row label="Range" value={`${sample.range_km.toFixed(0)} km`} />
        <Row label="Velocity" value={`${sample.velocity_km_s.toFixed(2)} km/s`} />
        <Row label="Az / El" value={`${sample.az.toFixed(0)}° / ${sample.el.toFixed(1)}°`} />
        <Row
          label="Magnitude"
          value={sample.magnitude != null ? sample.magnitude.toFixed(1) : "—"}
        />
        <Row label="Sunlit" value={sample.sunlit ? "yes" : "no (eclipsed)"} />
        <Row
          label="Observer dark"
          value={sample.observer_dark ? "yes" : "no"}
        />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Test**

`web/src/components/telemetry/telemetry-rail.test.tsx`:

```tsx
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { TelemetryRail } from "@/components/telemetry/telemetry-rail";
import { server } from "@/test/msw/server";
import { useObserverStore } from "@/store/observer";
import { usePlaybackStore } from "@/store/playback";
import { useSatelliteStore } from "@/store/satellite";
import { useSelectionStore } from "@/store/selection";
import { useTimeRangeStore } from "@/store/time-range";
import { ARC_SAMPLES } from "@/test/fixtures/track-samples";

beforeEach(() => {
  useObserverStore.setState({
    current: { lat: 40.7128, lng: -74.006, elevation_m: 10, name: "NYC" },
    saved: [],
  });
  useSatelliteStore.setState({ query: "ISS", resolvedName: null });
  useTimeRangeStore.setState({
    fromUtc: "2026-05-01T00:00:00Z",
    toUtc: "2026-05-08T00:00:00Z",
    mode: "line-of-sight",
  });
  useSelectionStore.setState({ selectedPassId: "p1" });
  usePlaybackStore.setState({
    cursorUtc: null,
    isPlaying: false,
    speedMultiplier: 1,
  });

  server.use(
    http.post("/api/passes", () =>
      HttpResponse.json({
        query: "ISS",
        resolved_name: "ISS (ZARYA)",
        passes: [
          {
            kind: "single",
            id: "p1",
            norad_id: 25544,
            name: "ISS (ZARYA)",
            rise: { time: "2026-05-01T02:00:00Z", azimuth_deg: 90, elevation_deg: 0 },
            peak: { time: "2026-05-01T02:03:00Z", azimuth_deg: 180, elevation_deg: 60 },
            set: { time: "2026-05-01T02:06:00Z", azimuth_deg: 270, elevation_deg: 0 },
            duration_s: 360,
            max_magnitude: null,
            sunlit_fraction: 0,
            tle_epoch: "2026-04-30T00:00:00Z",
          },
        ],
        tle_age_seconds: 0,
      }),
    ),
    http.post("/api/sky-track", () =>
      HttpResponse.json({ resolved_name: "ISS (ZARYA)", samples: ARC_SAMPLES }),
    ),
  );
});

describe("TelemetryRail", () => {
  it("shows hint when cursor is null", () => {
    renderWithProviders(<TelemetryRail />);
    expect(screen.getByText(/Select a pass and press play/)).toBeInTheDocument();
  });

  it("renders telemetry rows when cursor is set within the pass window", async () => {
    usePlaybackStore.setState({ cursorUtc: "2026-05-01T02:03:00Z" });
    renderWithProviders(<TelemetryRail />);

    expect(await screen.findByText("Altitude")).toBeInTheDocument();
    expect(screen.getByText("Range")).toBeInTheDocument();
    expect(screen.getByText("Velocity")).toBeInTheDocument();
    expect(screen.getByText("Az / El")).toBeInTheDocument();
    // Sample at 02:03:00 has az=180, el=60.
    expect(screen.getByText("180° / 60.0°")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run**

```bash
cd web && npx vitest run src/components/telemetry
```

Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add web
git commit -m "feat(web): telemetry rail bound to playback cursor"
```

---

## Task 8: Sky-view cursor marker

A small SVG circle on the sky view that follows the playback cursor (when one is set), in addition to the existing pass arc.

**Files:**
- Create: `web/src/components/sky-view/satellite-cursor.tsx`
- Create: `web/src/components/sky-view/satellite-cursor.test.tsx`
- Modify: `web/src/components/sky-view/sky-view.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useTrackAtCursor } from "@/hooks/use-track-at-cursor";
import { altAzToXy } from "@/components/sky-view/dome-math";

export function SatelliteCursor() {
  const { sample } = useTrackAtCursor();
  if (!sample || sample.el < 0) return null;
  const p = altAzToXy(sample.az, sample.el);
  return (
    <circle
      cx={p.x}
      cy={p.y}
      r={5}
      className="fill-satellite stroke-bg"
      strokeWidth={1.5}
    />
  );
}
```

- [ ] **Step 2: Test**

`web/src/components/sky-view/satellite-cursor.test.tsx`:

```tsx
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { renderWithProviders } from "@/test/render";
import { SatelliteCursor } from "@/components/sky-view/satellite-cursor";
import { server } from "@/test/msw/server";
import { useObserverStore } from "@/store/observer";
import { usePlaybackStore } from "@/store/playback";
import { useSatelliteStore } from "@/store/satellite";
import { useSelectionStore } from "@/store/selection";
import { useTimeRangeStore } from "@/store/time-range";
import { ARC_SAMPLES } from "@/test/fixtures/track-samples";

function svgWrap(children: ReactNode) {
  return (
    <svg viewBox="0 0 320 320" data-testid="wrap">
      {children}
    </svg>
  );
}

beforeEach(() => {
  useObserverStore.setState({
    current: { lat: 40.7128, lng: -74.006, elevation_m: 10, name: "NYC" },
    saved: [],
  });
  useSatelliteStore.setState({ query: "ISS", resolvedName: null });
  useTimeRangeStore.setState({
    fromUtc: "2026-05-01T00:00:00Z",
    toUtc: "2026-05-08T00:00:00Z",
    mode: "line-of-sight",
  });
  useSelectionStore.setState({ selectedPassId: "p1" });
  usePlaybackStore.setState({
    cursorUtc: null,
    isPlaying: false,
    speedMultiplier: 1,
  });

  server.use(
    http.post("/api/passes", () =>
      HttpResponse.json({
        query: "ISS",
        resolved_name: "ISS (ZARYA)",
        passes: [
          {
            kind: "single",
            id: "p1",
            norad_id: 25544,
            name: "ISS (ZARYA)",
            rise: { time: "2026-05-01T02:00:00Z", azimuth_deg: 90, elevation_deg: 0 },
            peak: { time: "2026-05-01T02:03:00Z", azimuth_deg: 180, elevation_deg: 60 },
            set: { time: "2026-05-01T02:06:00Z", azimuth_deg: 270, elevation_deg: 0 },
            duration_s: 360,
            max_magnitude: null,
            sunlit_fraction: 0,
            tle_epoch: "2026-04-30T00:00:00Z",
          },
        ],
        tle_age_seconds: 0,
      }),
    ),
    http.post("/api/sky-track", () =>
      HttpResponse.json({ resolved_name: "ISS (ZARYA)", samples: ARC_SAMPLES }),
    ),
  );
});

describe("SatelliteCursor", () => {
  it("renders nothing when cursor is null", () => {
    const { container } = renderWithProviders(svgWrap(<SatelliteCursor />));
    expect(container.querySelector("circle")).toBeNull();
  });

  it("renders a circle inside the dome when cursor is within the pass", async () => {
    usePlaybackStore.setState({ cursorUtc: "2026-05-01T02:03:00Z" });
    const { container } = renderWithProviders(svgWrap(<SatelliteCursor />));
    await new Promise((r) => setTimeout(r, 60));
    const circle = container.querySelector("circle");
    expect(circle).not.toBeNull();
  });
});
```

- [ ] **Step 3: Add the layer to `sky-view.tsx`**

Read the current `sky-view.tsx`, then overwrite:

```tsx
import { Dome, DOME_SIZE } from "./dome";
import { Compass } from "./compass";
import { HorizonSilhouette } from "./horizon-silhouette";
import { SatelliteArc } from "./satellite-arc";
import { SatelliteCursor } from "./satellite-cursor";

export function SkyView() {
  return (
    <svg
      viewBox={`0 0 ${DOME_SIZE} ${DOME_SIZE}`}
      className="w-full max-w-[320px] mx-auto"
      role="img"
      aria-label="Sky view — looking up from the observer"
    >
      <Dome />
      <HorizonSilhouette />
      <SatelliteArc />
      <SatelliteCursor />
      <Compass />
    </svg>
  );
}
```

- [ ] **Step 4: Run**

```bash
cd web && npx vitest run src/components/sky-view
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat(web): satellite cursor marker on sky view"
```

---

## Task 9: lat/lng/alt → 3D Cartesian helper

Pure math used by the 3D earth scene to position the observer pin and the satellite marker. Earth radius is fixed (6378 km in real units; we'll use 1 unit = 1 earth radius and scale altitude proportionally).

**Files:**
- Create: `web/src/lib/geo3d.ts`
- Create: `web/src/lib/geo3d.test.ts`

- [ ] **Step 1: Write the failing test**

`web/src/lib/geo3d.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { latLngAltToVec3, EARTH_RADIUS_KM, EARTH_RADIUS_UNITS } from "@/lib/geo3d";

describe("latLngAltToVec3", () => {
  it("places (0°N, 0°E, 0 km) on the +x axis at exactly the earth radius", () => {
    const v = latLngAltToVec3(0, 0, 0);
    expect(v.x).toBeCloseTo(EARTH_RADIUS_UNITS, 4);
    expect(v.y).toBeCloseTo(0, 4);
    expect(v.z).toBeCloseTo(0, 4);
  });

  it("places the north pole on the +y axis", () => {
    const v = latLngAltToVec3(90, 0, 0);
    expect(v.x).toBeCloseTo(0, 4);
    expect(v.y).toBeCloseTo(EARTH_RADIUS_UNITS, 4);
    expect(Math.abs(v.z)).toBeLessThan(1e-3);
  });

  it("places (0°N, 90°E, 0 km) on the -z axis (right-handed, z toward viewer)", () => {
    const v = latLngAltToVec3(0, 90, 0);
    expect(v.x).toBeCloseTo(0, 4);
    expect(v.y).toBeCloseTo(0, 4);
    expect(v.z).toBeCloseTo(-EARTH_RADIUS_UNITS, 4);
  });

  it("scales radius proportionally with altitude", () => {
    const v = latLngAltToVec3(0, 0, EARTH_RADIUS_KM); // 1 earth radius up
    const r = Math.hypot(v.x, v.y, v.z);
    expect(r).toBeCloseTo(2 * EARTH_RADIUS_UNITS, 3);
  });
});
```

- [ ] **Step 2: Implement `web/src/lib/geo3d.ts`**

```ts
/** Real Earth equatorial radius in km. */
export const EARTH_RADIUS_KM = 6378;

/** Three.js scene units per Earth radius. We use 1 for tidy math. */
export const EARTH_RADIUS_UNITS = 1;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Convert (lat°, lng°, altitude_km) to a Cartesian vector in scene units.
 *
 *  Convention:
 *  - +y up (north pole)
 *  - +x toward (lat=0, lng=0)
 *  - -z toward (lat=0, lng=90°E)  (right-handed coord system, default Three.js)
 *
 *  Altitude scales radius linearly: 1 EARTH_RADIUS_KM of altitude doubles
 *  the distance from origin.
 */
export function latLngAltToVec3(
  lat: number,
  lng: number,
  altitudeKm: number,
): Vec3 {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lng * Math.PI) / 180;
  const r = EARTH_RADIUS_UNITS * (1 + altitudeKm / EARTH_RADIUS_KM);

  return {
    x: r * Math.cos(phi) * Math.cos(lambda),
    y: r * Math.sin(phi),
    z: -r * Math.cos(phi) * Math.sin(lambda),
  };
}
```

- [ ] **Step 3: Run**

```bash
cd web && npx vitest run src/lib/geo3d.test.ts
```

Expected: 4 passed.

- [ ] **Step 4: Commit**

```bash
git add web
git commit -m "feat(web): geo3d lat/lng/alt → Vec3 helper"
```

---

## Task 10: Three.js install + scene factory + earth view canvas

**Files:**
- Modify: `web/package.json` (add three + @types/three)
- Create: `web/src/components/earth-view/scene-factory.ts`
- Create: `web/src/components/earth-view/scene-factory.test.ts`
- Create: `web/src/components/earth-view/earth-view.tsx`
- Create: `web/public/earth-blue-marble.jpg`  (download manually — see step 1)

- [ ] **Step 1: Download the Blue Marble texture**

NASA Visible Earth provides Blue Marble images in the public domain. Use one of the smaller resolutions to keep the bundle reasonable.

```bash
curl -L -o web/public/earth-blue-marble.jpg \
  "https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57735/land_ocean_ice_2048.jpg"
ls -la web/public/earth-blue-marble.jpg
```

Expected: file is ~1.5 MB. If the URL has changed, alternative: `https://upload.wikimedia.org/wikipedia/commons/c/cf/WorldMap-A_non-Frame.png` (Wikipedia's equirectangular world map, public domain) — pick whichever is reachable.

- [ ] **Step 2: Install Three.js**

```bash
cd web && npm install three && npm install -D @types/three
```

- [ ] **Step 3: Implement `scene-factory.ts`**

```ts
import * as THREE from "three";
import { EARTH_RADIUS_UNITS } from "@/lib/geo3d";

export interface SceneHandles {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  earthMesh: THREE.Mesh;
  observerPin: THREE.Mesh;
  satelliteMarker: THREE.Mesh;
  groundTrack: THREE.Line;
  /** Releases all GPU resources. Call on unmount. */
  dispose: () => void;
}

interface CreateSceneArgs {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  textureUrl: string;
}

/** Create a Three.js scene + camera + renderer wired to a canvas. Pure
 *  factory — does not start a render loop and does not append to the DOM
 *  beyond the canvas the caller provides.
 *
 *  All meshes are initially at the origin; the calling code (earth-view.tsx)
 *  is responsible for moving the observer pin and satellite marker to the
 *  current observer's lat/lng and the cursor sample's lat/lng/alt.
 */
export function createScene(args: CreateSceneArgs): SceneHandles {
  const { canvas, width, height, textureUrl } = args;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a); // bg color

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
  camera.position.set(0, 0, 3);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(typeof window !== "undefined" ? window.devicePixelRatio : 1);

  // Earth sphere
  const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS_UNITS, 64, 32);
  const loader = new THREE.TextureLoader();
  const earthMaterial = new THREE.MeshBasicMaterial({
    map: loader.load(textureUrl),
  });
  const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
  scene.add(earthMesh);

  // Observer pin — small amber sphere
  const pinGeo = new THREE.SphereGeometry(0.015, 16, 16);
  const pinMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
  const observerPin = new THREE.Mesh(pinGeo, pinMat);
  scene.add(observerPin);

  // Satellite marker — small blue sphere
  const satGeo = new THREE.SphereGeometry(0.018, 16, 16);
  const satMat = new THREE.MeshBasicMaterial({ color: 0x9ec5ff });
  const satelliteMarker = new THREE.Mesh(satGeo, satMat);
  scene.add(satelliteMarker);

  // Ground track placeholder line — points are set by the caller.
  const trackGeo = new THREE.BufferGeometry().setFromPoints([]);
  const trackMat = new THREE.LineBasicMaterial({ color: 0x9ec5ff });
  const groundTrack = new THREE.Line(trackGeo, trackMat);
  scene.add(groundTrack);

  function dispose() {
    earthGeometry.dispose();
    earthMaterial.dispose();
    earthMaterial.map?.dispose();
    pinGeo.dispose();
    pinMat.dispose();
    satGeo.dispose();
    satMat.dispose();
    trackGeo.dispose();
    trackMat.dispose();
    renderer.dispose();
  }

  return {
    scene,
    camera,
    renderer,
    earthMesh,
    observerPin,
    satelliteMarker,
    groundTrack,
    dispose,
  };
}
```

- [ ] **Step 4: Test the scene factory's structure (mock WebGL)**

`web/src/components/earth-view/scene-factory.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScene } from "@/components/earth-view/scene-factory";

// Three.js' WebGLRenderer requires a real WebGL context. In jsdom we mock
// `getContext('webgl2')` to return a minimal object. Three's renderer will
// throw if it can't initialize — so we mock at a higher level by stubbing
// WebGLRenderer itself. We can't test rendered output here; we test that
// the factory wires the right mesh shapes.

vi.mock("three", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      dispose: vi.fn(),
      render: vi.fn(),
      domElement: { width: 0, height: 0 } as unknown as HTMLCanvasElement,
    })),
  };
});

describe("createScene", () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement("canvas");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates earth, observer pin, satellite marker, and ground track meshes", () => {
    const handles = createScene({
      canvas,
      width: 320,
      height: 320,
      textureUrl: "/earth-blue-marble.jpg",
    });

    expect(handles.scene.children.length).toBeGreaterThanOrEqual(4);
    expect(handles.earthMesh.geometry.type).toBe("SphereGeometry");
    expect(handles.observerPin.geometry.type).toBe("SphereGeometry");
    expect(handles.satelliteMarker.geometry.type).toBe("SphereGeometry");
    expect(handles.groundTrack.type).toBe("Line");

    handles.dispose();
  });
});
```

- [ ] **Step 5: Implement `earth-view.tsx`**

```tsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createScene, type SceneHandles } from "./scene-factory";
import { latLngAltToVec3 } from "@/lib/geo3d";
import { useObserverStore } from "@/store/observer";
import { useTrackAtCursor } from "@/hooks/use-track-at-cursor";

const TEXTURE_URL = "/earth-blue-marble.jpg";

export function EarthView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const handlesRef = useRef<SceneHandles | null>(null);
  const observer = useObserverStore((s) => s.current);
  const { sample } = useTrackAtCursor();

  // Mount once.
  useEffect(() => {
    if (!containerRef.current) return;

    const canvas = document.createElement("canvas");
    const rect = containerRef.current.getBoundingClientRect();
    const width = Math.floor(rect.width || 320);
    const height = Math.floor(rect.height || 320);
    containerRef.current.appendChild(canvas);

    const handles = createScene({
      canvas,
      width,
      height,
      textureUrl: TEXTURE_URL,
    });
    handlesRef.current = handles;

    let raf = 0;
    const renderLoop = () => {
      handles.renderer.render(handles.scene, handles.camera);
      raf = requestAnimationFrame(renderLoop);
    };
    raf = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(raf);
      handles.dispose();
      canvas.remove();
      handlesRef.current = null;
    };
  }, []);

  // Move the observer pin whenever the observer changes.
  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;
    const v = latLngAltToVec3(observer.lat, observer.lng, 0);
    handles.observerPin.position.set(v.x, v.y, v.z);
  }, [observer.lat, observer.lng]);

  // Move the satellite marker whenever the cursor sample changes.
  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;
    if (!sample) {
      handles.satelliteMarker.visible = false;
      return;
    }
    handles.satelliteMarker.visible = true;
    const v = latLngAltToVec3(sample.lat, sample.lng, sample.alt_km);
    handles.satelliteMarker.position.set(v.x, v.y, v.z);
  }, [sample]);

  // Auto-orbit camera so observer pin is roughly centered.
  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;
    const v = latLngAltToVec3(observer.lat, observer.lng, 0);
    const len = Math.hypot(v.x, v.y, v.z);
    const cameraDistance = 3;
    handles.camera.position.set(
      (v.x / len) * cameraDistance,
      (v.y / len) * cameraDistance,
      (v.z / len) * cameraDistance,
    );
    handles.camera.lookAt(0, 0, 0);
  }, [observer.lat, observer.lng]);

  return <div ref={containerRef} className="w-full h-[320px] rounded-card overflow-hidden border border-edge bg-bg" role="region" aria-label="3D earth view" />;
}
```

- [ ] **Step 6: Run scene-factory test**

```bash
cd web && npx vitest run src/components/earth-view
```

Expected: 1 passed.

- [ ] **Step 7: Smoke test — verify the dev server still runs**

```bash
just web &
SERVER=$!
sleep 5
curl -sf http://localhost:5173/ | grep -q 'id="root"' && echo OK
kill $SERVER 2>/dev/null || true
wait $SERVER 2>/dev/null || true
```

Expected: prints `OK`.

- [ ] **Step 8: Commit**

```bash
git add web
git commit -m "feat(web): Three.js earth view with scene factory"
```

---

## Task 11: Hero panel + toggle

A small toggle in the right column header swaps between the SkyView and the EarthView. State lives in a tiny store (no need for Zustand here — a single `useState` in HeroPanel is fine).

**Files:**
- Create: `web/src/components/hero/hero-panel.tsx`
- Create: `web/src/components/hero/hero-toggle.tsx`
- Create: `web/src/components/hero/hero-panel.test.tsx`
- Modify: `web/src/App.tsx` (replace `<SkyView />` with `<HeroPanel />`)

- [ ] **Step 1: Implement `hero-toggle.tsx`**

```tsx
import { Button } from "@/components/ui/button";

interface Props {
  hero: "sky" | "earth";
  onChange: (hero: "sky" | "earth") => void;
}

export function HeroToggle({ hero, onChange }: Props) {
  return (
    <div className="flex gap-1" role="group" aria-label="Hero view">
      <Button
        variant={hero === "sky" ? "default" : "outline"}
        size="sm"
        onClick={() => onChange("sky")}
      >
        Sky
      </Button>
      <Button
        variant={hero === "earth" ? "default" : "outline"}
        size="sm"
        onClick={() => onChange("earth")}
      >
        Earth
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Implement `hero-panel.tsx`**

```tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkyView } from "@/components/sky-view/sky-view";
import { EarthView } from "@/components/earth-view/earth-view";
import { HeroToggle } from "@/components/hero/hero-toggle";

export function HeroPanel() {
  const [hero, setHero] = useState<"sky" | "earth">("sky");
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{hero === "sky" ? "Sky view" : "Earth view"}</CardTitle>
        <HeroToggle hero={hero} onChange={setHero} />
      </CardHeader>
      <CardContent>
        {hero === "sky" ? <SkyView /> : <EarthView />}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Test the toggle**

`web/src/components/hero/hero-panel.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { HeroPanel } from "@/components/hero/hero-panel";

// Stub EarthView so the test doesn't try to spin up Three.js in jsdom.
vi.mock("@/components/earth-view/earth-view", () => ({
  EarthView: () => <div data-testid="earth-stub">EarthView</div>,
}));

describe("HeroPanel", () => {
  it("starts on the sky view", () => {
    renderWithProviders(<HeroPanel />);
    expect(screen.getByText("Sky view")).toBeInTheDocument();
    expect(screen.queryByTestId("earth-stub")).toBeNull();
  });

  it("clicking the Earth toggle swaps the hero", async () => {
    renderWithProviders(<HeroPanel />);
    await userEvent.click(screen.getByRole("button", { name: "Earth" }));
    expect(screen.getByText("Earth view")).toBeInTheDocument();
    expect(screen.getByTestId("earth-stub")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Update `App.tsx`** to mount HeroPanel + the playback loop driver + cursor reset hook

Read the current `App.tsx`, then overwrite:

```tsx
import { Header } from "@/components/layout/header";
import { AppShell } from "@/components/layout/app-shell";
import { ObserverPanel } from "@/components/observer/observer-panel";
import { InputsBar } from "@/components/layout/inputs-bar";
import { PassList } from "@/components/passes/pass-list";
import { TimelineStrip } from "@/components/passes/timeline-strip";
import { HeroPanel } from "@/components/hero/hero-panel";
import { TelemetryRail } from "@/components/telemetry/telemetry-rail";
import { PlaybackBar } from "@/components/playback/playback-bar";
import { useCursorReset } from "@/hooks/use-cursor-reset";
import { usePlaybackLoop } from "@/hooks/use-playback-loop";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function App() {
  // Wire global side-effects once.
  useCursorReset();
  usePlaybackLoop();

  return (
    <>
      <Header />
      <AppShell
        left={
          <>
            <ObserverPanel />
            <InputsBar />
          </>
        }
        main={
          <Card>
            <CardHeader>
              <CardTitle>Passes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TimelineStrip />
              <PassList />
            </CardContent>
          </Card>
        }
        side={
          <>
            <HeroPanel />
            <PlaybackBar />
            <TelemetryRail />
          </>
        }
      />
    </>
  );
}
```

- [ ] **Step 5: Run tests + verify build**

```bash
cd web && npx vitest run src/components/hero
just web-build
```

Expected: 2 passed; build clean.

- [ ] **Step 6: Commit**

```bash
git add web
git commit -m "feat(web): hero panel with sky/earth toggle"
```

---

## Task 12: ICS export + per-pass button

Pure helper formats a `Pass` as an iCalendar `.ics` string. Component renders a small download button on each pass card.

**Files:**
- Create: `web/src/lib/ics.ts`
- Create: `web/src/lib/ics.test.ts`
- Create: `web/src/components/passes/pass-export-button.tsx`
- Modify: `web/src/components/passes/pass-card.tsx` (add the button)

- [ ] **Step 1: Write the failing test for `ics.ts`**

`web/src/lib/ics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatPassAsIcs } from "@/lib/ics";
import type { PassResponse } from "@/types/api";

const PASS: PassResponse = {
  kind: "single",
  id: "25544-20260501020000",
  norad_id: 25544,
  name: "ISS (ZARYA)",
  rise: { time: "2026-05-01T02:00:00Z", azimuth_deg: 90, elevation_deg: 0 },
  peak: { time: "2026-05-01T02:03:00Z", azimuth_deg: 180, elevation_deg: 60 },
  set: { time: "2026-05-01T02:06:00Z", azimuth_deg: 270, elevation_deg: 0 },
  duration_s: 360,
  max_magnitude: -2.5,
  sunlit_fraction: 1,
  tle_epoch: "2026-04-30T00:00:00Z",
};

describe("formatPassAsIcs", () => {
  it("includes BEGIN/END VCALENDAR + VEVENT envelope", () => {
    const ics = formatPassAsIcs(PASS, { observerName: "Brooklyn" });
    expect(ics).toMatch(/^BEGIN:VCALENDAR/);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toMatch(/END:VCALENDAR\s*$/);
  });

  it("encodes DTSTART/DTEND in basic UTC format (YYYYMMDDTHHMMSSZ)", () => {
    const ics = formatPassAsIcs(PASS, { observerName: "Brooklyn" });
    expect(ics).toContain("DTSTART:20260501T020000Z");
    expect(ics).toContain("DTEND:20260501T020600Z");
  });

  it("uses the satellite name in SUMMARY", () => {
    const ics = formatPassAsIcs(PASS, { observerName: "Brooklyn" });
    expect(ics).toMatch(/SUMMARY:ISS \(ZARYA\) pass/);
  });

  it("uses observer name in LOCATION", () => {
    const ics = formatPassAsIcs(PASS, { observerName: "Brooklyn" });
    expect(ics).toContain("LOCATION:Brooklyn");
  });

  it("includes peak az/el and magnitude in DESCRIPTION", () => {
    const ics = formatPassAsIcs(PASS, { observerName: "Brooklyn" });
    expect(ics).toMatch(/peak 60° at azimuth 180°/);
    expect(ics).toMatch(/magnitude -2\.5/);
  });

  it("UID is stable for the same pass", () => {
    const a = formatPassAsIcs(PASS, { observerName: "Brooklyn" });
    const b = formatPassAsIcs(PASS, { observerName: "Brooklyn" });
    const uidA = a.match(/UID:(.+)/)?.[1];
    const uidB = b.match(/UID:(.+)/)?.[1];
    expect(uidA).toBe(uidB);
  });
});
```

- [ ] **Step 2: Implement `web/src/lib/ics.ts`**

```ts
import type { PassItem, PassResponse, TrainPassResponse } from "@/types/api";

interface FormatOpts {
  observerName: string;
}

function toIcsUtc(iso: string): string {
  // 2026-05-01T02:00:00Z → 20260501T020000Z
  return iso.replace(/[-:]/g, "").replace(/\.\d+Z?$/, "Z").replace("Z", "Z");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function describePass(pass: PassItem): string {
  const peakEl = pass.peak.elevation_deg.toFixed(0);
  const peakAz = pass.peak.azimuth_deg.toFixed(0);
  const lines = [
    `Duration: ${Math.floor(pass.duration_s / 60)}m ${(pass.duration_s % 60)
      .toString()
      .padStart(2, "0")}s`,
    `Rise: az ${pass.rise.azimuth_deg.toFixed(0)}°`,
    `Peak: ${peakEl}° at azimuth ${peakAz}°`,
    `Set: az ${pass.set.azimuth_deg.toFixed(0)}°`,
  ];
  if (pass.max_magnitude != null) {
    lines.push(`Brightness: magnitude ${pass.max_magnitude.toFixed(1)}`);
  }
  return lines.join("\\n");
}

function passName(pass: PassItem): string {
  if (pass.kind === "train") {
    return `${pass.name}`;
  }
  const single = pass as PassResponse;
  return `${single.name} pass`;
}

function passId(pass: PassItem): string {
  if (pass.kind === "train") {
    const t = pass as TrainPassResponse;
    return t.id;
  }
  const s = pass as PassResponse;
  return s.id;
}

export function formatPassAsIcs(pass: PassItem, opts: FormatOpts): string {
  const dtstart = toIcsUtc(pass.rise.time);
  const dtend = toIcsUtc(pass.set.time);
  const uid = `${passId(pass)}@satellite-visibility`;
  const dtstamp = toIcsUtc(new Date().toISOString());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//satellite-visibility//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeText(passName(pass))}`,
    `LOCATION:${escapeText(opts.observerName)}`,
    `DESCRIPTION:${escapeText(describePass(pass))}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];
  return lines.join("\r\n");
}

/** Trigger a download of the ICS in the browser. */
export function downloadIcs(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Run**

```bash
cd web && npx vitest run src/lib/ics.test.ts
```

Expected: 6 passed.

- [ ] **Step 4: Implement `pass-export-button.tsx`**

```tsx
import { Button } from "@/components/ui/button";
import { downloadIcs, formatPassAsIcs } from "@/lib/ics";
import { useObserverStore } from "@/store/observer";
import type { PassItem } from "@/types/api";

interface Props {
  pass: PassItem;
}

export function PassExportButton({ pass }: Props) {
  const observerName = useObserverStore((s) => s.current.name);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={(e) => {
        e.stopPropagation(); // don't trigger card-level select
        const ics = formatPassAsIcs(pass, { observerName });
        downloadIcs(`pass-${pass.id}.ics`, ics);
      }}
      aria-label="Add to calendar"
    >
      📅 .ics
    </Button>
  );
}
```

- [ ] **Step 5: Add the button to `pass-card.tsx`**

Read the current `pass-card.tsx`, then overwrite it to put the export button in the bottom-right of the card. Full updated file:

```tsx
import { useSelectionStore } from "@/store/selection";
import type { PassItem } from "@/types/api";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import { PassExportButton } from "@/components/passes/pass-export-button";

interface Props {
  pass: PassItem;
}

export function PassCard({ pass }: Props) {
  const selectedId = useSelectionStore((s) => s.selectedPassId);
  const select = useSelectionStore((s) => s.select);
  const isSelected = selectedId === pass.id;

  const riseLocal = new Date(pass.rise.time).toLocaleString();
  const mag =
    pass.max_magnitude != null ? `mag ${pass.max_magnitude.toFixed(1)}` : null;

  return (
    <div
      onClick={() => select(pass.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          select(pass.id);
        }
      }}
      className={cn(
        "block w-full text-left p-3 rounded-card border transition-colors cursor-pointer",
        isSelected
          ? "border-satellite bg-satellite/5"
          : "border-edge hover:bg-edge",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-medium truncate">{pass.name}</div>
        <div className="text-xs text-fg-muted tabular-nums">
          {formatDuration(pass.duration_s)}
        </div>
      </div>
      <div className="text-xs text-fg-muted mt-1">{riseLocal}</div>
      <div className="text-xs text-fg-muted mt-0.5 tabular-nums">
        peak {pass.peak.elevation_deg.toFixed(0)}° ·{" "}
        {pass.peak.azimuth_deg.toFixed(0)}°
        {mag && ` · ${mag}`}
      </div>
      {pass.kind === "train" && (
        <div className="text-xs text-satellite mt-1">
          {pass.member_count} objects
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <PassExportButton pass={pass} />
      </div>
    </div>
  );
}
```

Note: PassCard's outer element is now a `<div>` with role="button" because nesting a `<button>` (the export button) inside another `<button>` is invalid HTML. The keyboard handler keeps space/enter accessible.

- [ ] **Step 6: Update `pass-card.test.tsx`** — the existing test queries `getByRole("button")` which now matches the outer div PLUS the export button. Update queries.

Read the current `pass-card.test.tsx` and update assertions that reference `getByRole("button")` to match the new structure. Specifically:

The existing tests use `screen.getByRole("button")` for both rendering and click. There are now multiple buttons (the card itself + the export ghost button). Use `getAllByRole("button")[0]` (the card) or use a more specific selector. Read the test file and update each `getByRole("button")` call to `screen.getByRole("button", { name: "ISS (ZARYA)" })` for the card-level button (when ARIA label can be added) — OR refactor the assertion to query by the card's content using `closest("[role='button']")`:

The simpler fix: update the card-render JSX to include `aria-label={pass.name}` on the wrapper div. Then tests can do `getByRole("button", { name: "ISS (ZARYA)" })`.

Update `pass-card.tsx` once more — add the `aria-label`:

```tsx
    <div
      onClick={() => select(pass.id)}
      role="button"
      tabIndex={0}
      aria-label={pass.name}
      onKeyDown={(e) => {
        // ...
```

Then in `pass-card.test.tsx`:

```tsx
// Click test:
await userEvent.click(screen.getByRole("button", { name: "ISS (ZARYA)" }));

// Highlight test:
const card = screen.getByRole("button", { name: "ISS (ZARYA)" });
expect(card.className).toContain("border-satellite");
```

Read the existing test file, identify the two assertions using `getByRole("button")`, and update them to the named-lookup form.

- [ ] **Step 7: Run pass tests**

```bash
cd web && npx vitest run src/components/passes
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add web
git commit -m "feat(web): ICS calendar export per pass"
```

---

## Task 13: Sun helper + tonight summary

**Files:**
- Modify: `web/package.json` (add suncalc + types)
- Create: `web/src/lib/sun.ts`
- Create: `web/src/lib/sun.test.ts`
- Create: `web/src/hooks/use-tonight-summary.ts`
- Create: `web/src/components/passes/tonight-card.tsx`
- Create: `web/src/components/passes/tonight-card.test.tsx`
- Modify: `web/src/App.tsx` (mount TonightCard above PassList)

- [ ] **Step 1: Install suncalc**

```bash
cd web && npm install suncalc && npm install -D @types/suncalc
```

- [ ] **Step 2: Implement `sun.ts`**

```ts
import SunCalc from "suncalc";

export interface TonightWindow {
  sunset: Date;
  nextSunrise: Date;
}

/** Compute the local "tonight" window: today's sunset → tomorrow's sunrise.
 *  If sunset has already passed for the current `now`, uses today's sunset.
 *  If sunset is still in the future today, that becomes the start anyway.
 */
export function tonightWindow(
  now: Date,
  lat: number,
  lng: number,
): TonightWindow {
  const today = SunCalc.getTimes(now, lat, lng);
  let sunset = today.sunset;
  // SunCalc returns NaN-Date for polar regions where the sun never sets.
  // Fall back to "tonight = next 12 hours" in that case so the UI doesn't break.
  if (isNaN(sunset.getTime())) {
    sunset = now;
  }

  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  let nextSunrise = SunCalc.getTimes(tomorrow, lat, lng).sunrise;
  if (isNaN(nextSunrise.getTime())) {
    nextSunrise = new Date(now.getTime() + 12 * 3600 * 1000);
  }

  return { sunset, nextSunrise };
}
```

- [ ] **Step 3: Test `sun.ts`**

`web/src/lib/sun.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { tonightWindow } from "@/lib/sun";

describe("tonightWindow", () => {
  it("returns a sunset before the nextSunrise for a typical mid-latitude day", () => {
    const now = new Date("2026-05-01T20:00:00Z"); // 4 PM EDT in NYC
    const w = tonightWindow(now, 40.7128, -74.006);
    expect(w.sunset.getTime()).toBeLessThan(w.nextSunrise.getTime());
  });

  it("falls back to a 12 h window at the north pole in summer (sun never sets)", () => {
    const now = new Date("2026-07-01T12:00:00Z");
    const w = tonightWindow(now, 89.99, 0);
    // Both should be valid (not NaN).
    expect(isFinite(w.sunset.getTime())).toBe(true);
    expect(isFinite(w.nextSunrise.getTime())).toBe(true);
  });
});
```

- [ ] **Step 4: Implement `use-tonight-summary.ts`**

```ts
import { useMemo } from "react";
import { useCurrentPasses } from "@/hooks/use-current-passes";
import { useObserverStore } from "@/store/observer";
import { tonightWindow } from "@/lib/sun";
import type { PassItem } from "@/types/api";

export interface TonightSummary {
  count: number;
  brightest: PassItem | null;
  highest: PassItem | null;
  passes: PassItem[];
  /** Window labels in local-time strings for display. */
  windowLabel: string;
}

export function useTonightSummary(now: Date = new Date()): TonightSummary | null {
  const observer = useObserverStore((s) => s.current);
  const { data } = useCurrentPasses();

  return useMemo(() => {
    if (!data) return null;
    const { sunset, nextSunrise } = tonightWindow(now, observer.lat, observer.lng);

    const passes = data.passes.filter((p) => {
      const t = Date.parse(p.rise.time);
      return t >= sunset.getTime() && t <= nextSunrise.getTime();
    });

    if (passes.length === 0) return null;

    const brightest = passes.reduce<PassItem | null>((best, p) => {
      if (p.max_magnitude == null) return best;
      if (best == null || best.max_magnitude == null) return p;
      return p.max_magnitude < best.max_magnitude ? p : best;
    }, null);

    const highest = passes.reduce<PassItem>(
      (best, p) =>
        p.peak.elevation_deg > best.peak.elevation_deg ? p : best,
      passes[0],
    );

    const fmt = (d: Date) =>
      d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const windowLabel = `${fmt(sunset)} – ${fmt(nextSunrise)}`;

    return { count: passes.length, brightest, highest, passes, windowLabel };
  }, [data, observer.lat, observer.lng, now]);
}
```

- [ ] **Step 5: Implement `tonight-card.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTonightSummary } from "@/hooks/use-tonight-summary";
import { useSelectionStore } from "@/store/selection";

export function TonightCard() {
  const summary = useTonightSummary();
  const select = useSelectionStore((s) => s.select);

  if (!summary) return null;

  return (
    <Card className="border-satellite/40 bg-satellite/5">
      <CardHeader>
        <CardTitle className="serif-accent">Tonight</CardTitle>
        <p className="text-xs text-fg-muted">{summary.windowLabel}</p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div>
          <span className="label-upper">Visible passes:</span>{" "}
          <span className="tabular-nums">{summary.count}</span>
        </div>
        {summary.brightest && (
          <button
            className="block text-left hover:underline"
            onClick={() => select(summary.brightest!.id)}
          >
            <span className="label-upper">Brightest:</span>{" "}
            {summary.brightest.name} ·{" "}
            {summary.brightest.max_magnitude != null
              ? `mag ${summary.brightest.max_magnitude.toFixed(1)}`
              : ""}
          </button>
        )}
        {summary.highest && (
          <button
            className="block text-left hover:underline"
            onClick={() => select(summary.highest!.id)}
          >
            <span className="label-upper">Highest:</span>{" "}
            {summary.highest.name} ·{" "}
            {summary.highest.peak.elevation_deg.toFixed(0)}°
          </button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Test `tonight-card.tsx`**

`web/src/components/passes/tonight-card.test.tsx`:

```tsx
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { TonightCard } from "@/components/passes/tonight-card";
import { server } from "@/test/msw/server";
import { useObserverStore } from "@/store/observer";
import { useSatelliteStore } from "@/store/satellite";
import { useTimeRangeStore } from "@/store/time-range";

beforeEach(() => {
  useObserverStore.setState({
    current: { lat: 40.7128, lng: -74.006, elevation_m: 10, name: "NYC" },
    saved: [],
  });
  useSatelliteStore.setState({ query: "ISS", resolvedName: null });
  // Long enough window that "tonight" passes fit inside it.
  useTimeRangeStore.setState({
    fromUtc: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    toUtc: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    mode: "naked-eye",
  });
});

describe("TonightCard", () => {
  it("renders nothing when no passes are returned", async () => {
    server.use(
      http.post("/api/passes", () =>
        HttpResponse.json({
          query: "ISS",
          resolved_name: "ISS (ZARYA)",
          passes: [],
          tle_age_seconds: 0,
        }),
      ),
    );
    const { container } = renderWithProviders(<TonightCard />);
    await new Promise((r) => setTimeout(r, 50));
    expect(container.firstChild).toBeNull();
  });

  it("renders the tonight summary when at least one pass is in the tonight window", async () => {
    // Place a synthetic pass in the next few hours from "now" — guaranteed
    // to fall within "tonight" for any mid-latitude observer at this season.
    const inOneHour = new Date(Date.now() + 1 * 3600 * 1000).toISOString();
    const inOneHourPlus5 = new Date(Date.now() + 1 * 3600 * 1000 + 300_000).toISOString();
    server.use(
      http.post("/api/passes", () =>
        HttpResponse.json({
          query: "ISS",
          resolved_name: "ISS (ZARYA)",
          passes: [
            {
              kind: "single",
              id: "p1",
              norad_id: 25544,
              name: "ISS (ZARYA)",
              rise: { time: inOneHour, azimuth_deg: 90, elevation_deg: 0 },
              peak: { time: inOneHour, azimuth_deg: 180, elevation_deg: 65 },
              set: { time: inOneHourPlus5, azimuth_deg: 270, elevation_deg: 0 },
              duration_s: 300,
              max_magnitude: -3,
              sunlit_fraction: 1,
              tle_epoch: "2026-04-30T00:00:00Z",
            },
          ],
          tle_age_seconds: 0,
        }),
      ),
    );
    renderWithProviders(<TonightCard />);
    expect(await screen.findByText("Tonight")).toBeInTheDocument();
    expect(screen.getByText(/Visible passes/)).toBeInTheDocument();
    expect(screen.getByText(/ISS \(ZARYA\)/)).toBeInTheDocument();
  });
});
```

Note: the second test depends on the system clock + observer location; at extremely high latitudes during midnight sun this might not produce a valid window. Run at NYC coords (which we set) and "now" being any ordinary date — the test should be stable.

- [ ] **Step 7: Update `App.tsx`** — mount `<TonightCard />` above `<TimelineStrip />` in the main slot

Read App.tsx then overwrite. Insert just one new import and one new line in the main slot:

```tsx
import { TonightCard } from "@/components/passes/tonight-card";
// ...
        main={
          <Card>
            <CardHeader>
              <CardTitle>Passes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TonightCard />
              <TimelineStrip />
              <PassList />
            </CardContent>
          </Card>
        }
```

- [ ] **Step 8: Run**

```bash
cd web && npx vitest run src/lib/sun.test.ts src/components/passes/tonight-card.test.tsx
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add web
git commit -m "feat(web): tonight summary card with sunrise/sunset window"
```

---

## Task 14: README + Justfile updates

**Files:**
- Modify: `README.md`
- (Justfile recipes already cover the frontend; no new ones needed.)

- [ ] **Step 1: Update the "Run the frontend" section**

Read `README.md`. Append a new sub-section after the existing "Frontend tests" sub-section (or replace the existing description if updates fit there):

```markdown
### What's new in M4

- **Scrubbable timeline** — select any pass, hit Play, watch the satellite trace its arc in real time (1×, 10×, or 60× speed)
- **Telemetry rail** — live altitude / range / az/el / velocity / magnitude / sunlit / dark, all bound to the cursor
- **3D earth view** — toggle the right-column hero between the alt-az sky dome and a Three.js earth with observer pin + satellite marker
- **ICS calendar export** — every pass card has a `📅 .ics` button that downloads a calendar event for the rise/set window
- **Tonight summary** — when there are passes in the local sunset → next sunrise window, a card highlights the brightest and the highest

### Earth-view notes

- Texture: NASA Blue Marble (`web/public/earth-blue-marble.jpg`, ~1.5 MB, public domain). If you swap textures, keep the equirectangular projection.
- Three.js bundle adds ~600 KB to the production build. M5 will likely lazy-load this so the sky-only path stays small.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: M4 frontend features in README"
```

---

## Task 15: Final gates + tag

- [ ] **Step 1: Frontend tests**

```bash
just web-test
```

Expected: all tests pass (count: ~84 from M3 debt cleanup + ~27 new in this milestone = ~111).

- [ ] **Step 2: Frontend lint**

```bash
just web-lint
```

Expected: clean. If errors, fix real issues — no rule disables.

- [ ] **Step 3: Frontend production build**

```bash
just web-build
```

Expected: clean. Bundle size warning for Three.js is acceptable; M5 will address.

- [ ] **Step 4: Frontend coverage**

```bash
just web-cov
```

Expected: per-file coverage reasonable; total around 70-80%. Newly-added pure functions (interpolate, geo3d, ics, sun) all 100%. Components with side-effecty Three.js (`earth-view.tsx`) will have low coverage; that's accepted because Three.js doesn't run in jsdom.

- [ ] **Step 5: Python suite (sanity — backend untouched)**

```bash
just test
```

Expected: still 133 passing.

- [ ] **Step 6: Commit any cleanup**

```bash
git add -A
git commit -m "chore: M4 lint and coverage cleanup" || echo "nothing to commit"
```

- [ ] **Step 7: Tag**

```bash
git tag -a m4-3d-hero -m "M4: 3D hero + scrub + telemetry + ICS + tonight"
git tag -l
```

Expected: `m4-3d-hero` appears alongside the earlier tags.

---

## M4 Completion Criteria

- [ ] Selecting a pass resets the cursor to the rise time and pauses
- [ ] Pressing Play advances the cursor in real time at chosen speed
- [ ] Reaching the set time auto-pauses
- [ ] Telemetry rail updates per-second with altitude / range / az / el / velocity / magnitude / sunlit / dark
- [ ] Sky view shows a ghost satellite marker at the cursor position
- [ ] Hero toggle swaps between Sky and Earth panels
- [ ] Earth view renders a Blue Marble globe with observer pin + satellite marker that moves with the cursor
- [ ] Pass cards have a `📅 .ics` button that downloads a calendar event opening cleanly in macOS Calendar / Google Calendar
- [ ] When tonight has passes, the Tonight card appears above the pass list with brightest + highest highlighted
- [ ] All frontend tests + lint + Python tests + lint pass
- [ ] `m4-3d-hero` git tag exists
