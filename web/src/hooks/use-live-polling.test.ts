import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLivePolling } from "./use-live-polling";
import { useLivePositionStore } from "@/store/live-position";
import { useObserverStore } from "@/store/observer";
import { useSelectionStore } from "@/store/selection";
import { useSatelliteStore } from "@/store/satellite";
import type { PassItem, NowPositionsResponse, NowTracksResponse } from "@/types/api";

vi.mock("@/lib/api", () => ({
  api: {
    nowPositions: vi.fn(),
    nowTracks: vi.fn(),
  },
}));
import { api } from "@/lib/api";

vi.mock("@/hooks/use-current-passes", () => ({
  useCurrentPasses: vi.fn(),
}));
import { useCurrentPasses } from "@/hooks/use-current-passes";

const stubPass = (norad_id: number): PassItem => ({
  kind: "single",
  id: `iss-${norad_id}`,
  norad_id,
  name: "ISS",
  rise: { time: "2026-04-27T03:00:00Z", azimuth_deg: 100, elevation_deg: 0, range_km: 1500 },
  peak: { time: "2026-04-27T03:05:00Z", azimuth_deg: 180, elevation_deg: 60, range_km: 480 },
  set: { time: "2026-04-27T03:10:00Z", azimuth_deg: 260, elevation_deg: 0, range_km: 1500 },
  duration_s: 600,
  max_magnitude: -2.0,
  sunlit_fraction: 0.8,
  tle_epoch: "2026-04-27T00:00:00Z",
  peak_angular_speed_deg_s: 1.2,
  naked_eye_visible: "yes",
});

const stubSample = (time: string) => ({
  time, lat: 40, lng: -74, alt_km: 412,
  az: 0, el: 0, range_km: 478,
  velocity_km_s: 7.68, magnitude: -2.1,
  sunlit: true, observer_dark: true,
});

describe("useLivePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useLivePositionStore.getState().clear();
    useSelectionStore.setState({ selectedPassId: null });
    useObserverStore.setState({
      current: { lat: 40.7128, lng: -74.0060, elevation_m: 10, name: "NYC" },
    });
    useSatelliteStore.setState({ query: "ISS", resolvedName: null });
    (useCurrentPasses as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { query: "ISS", resolved_name: "ISS", passes: [stubPass(25544)], tle_age_seconds: 0 },
      isLoading: false,
    });
    (api.nowPositions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      entries: [{ norad_id: 25544, sample: stubSample("2026-04-27T00:00:00Z") }],
    } satisfies NowPositionsResponse);
    (api.nowTracks as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      entries: [{ norad_id: 25544, samples: [stubSample("2026-04-26T23:55:00Z")] }],
    } satisfies NowTracksResponse);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("seeds trails and starts polling when mounted in liveModeOn state", async () => {
    renderHook(() => useLivePolling());
    await vi.runOnlyPendingTimersAsync();
    expect(api.nowTracks).toHaveBeenCalledTimes(1);
    expect(api.nowPositions).toHaveBeenCalled();
  });

  it("populates the live-position store with active norads from passes", async () => {
    renderHook(() => useLivePolling());
    await vi.runOnlyPendingTimersAsync();
    // setActive runs synchronously inside the effect, so after pending timers
    // flush the store should already be populated. waitFor would deadlock
    // under vi.useFakeTimers since its internal polling timer is also faked.
    expect(useLivePositionStore.getState().activeNorads).toEqual([25544]);
  });

  it("clears state and stops polling when a pass is selected", async () => {
    const { rerender } = renderHook(() => useLivePolling());
    await vi.runOnlyPendingTimersAsync();
    expect(useLivePositionStore.getState().activeNorads).toEqual([25544]);

    useSelectionStore.setState({ selectedPassId: "iss-25544" });
    rerender();
    await vi.runOnlyPendingTimersAsync();
    expect(useLivePositionStore.getState().activeNorads).toEqual([]);
  });

  it("clears state when passes is empty", async () => {
    (useCurrentPasses as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { query: "ISS", resolved_name: "ISS", passes: [], tle_age_seconds: 0 },
      isLoading: false,
    });
    renderHook(() => useLivePolling());
    await vi.runOnlyPendingTimersAsync();
    expect(useLivePositionStore.getState().activeNorads).toEqual([]);
    expect(api.nowPositions).not.toHaveBeenCalled();
  });

  it("polls every 5 seconds while live mode is on", async () => {
    renderHook(() => useLivePolling());
    await vi.runOnlyPendingTimersAsync();
    const initialCalls = (api.nowPositions as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    vi.advanceTimersByTime(5000);
    await vi.runOnlyPendingTimersAsync();
    expect((api.nowPositions as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(initialCalls);
  });

  it("aborts in-flight nowPositions when norads change", async () => {
    // Mock nowPositions to return a never-resolving promise so we can verify
    // the AbortController fires before resolution. Capture only the FIRST
    // signal so the rerender's new call doesn't overwrite our reference.
    const signalsSeen: AbortSignal[] = [];
    (api.nowPositions as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_body: unknown, signal?: AbortSignal) => {
        if (signal) signalsSeen.push(signal);
        return new Promise(() => {}); // never resolves
      },
    );

    const { rerender } = renderHook(() => useLivePolling());
    await vi.runOnlyPendingTimersAsync();
    expect(signalsSeen.length).toBeGreaterThan(0);
    const firstSignal = signalsSeen[0];
    expect(firstSignal.aborted).toBe(false);

    // Change passes to a different sat — should trigger a new effect run,
    // which aborts the prior controller.
    (useCurrentPasses as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { query: "Tiangong", resolved_name: "Tiangong", passes: [stubPass(48274)], tle_age_seconds: 0 },
      isLoading: false,
    });
    rerender();
    await vi.runOnlyPendingTimersAsync();
    expect(firstSignal.aborted).toBe(true);
  });
});
