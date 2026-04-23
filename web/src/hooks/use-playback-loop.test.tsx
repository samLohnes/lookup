import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
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

    // Manually advance time by simulating 200 ms of rAF ticks.
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
    expect(usePlaybackStore.getState().cursorUtc).toBe("2026-05-01T02:00:04.000Z");
  });
});
