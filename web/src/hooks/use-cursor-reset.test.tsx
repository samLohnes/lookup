import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
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
