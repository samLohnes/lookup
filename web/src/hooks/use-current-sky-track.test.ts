import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCurrentSkyTrack } from "./use-current-sky-track";
import { useObserverStore } from "@/store/observer";
import { useSatelliteStore } from "@/store/satellite";
import { useSelectionStore } from "@/store/selection";
import type { PassItem, TrainPassResponse } from "@/types/api";

vi.mock("@/hooks/use-sky-track", () => ({
  useSkyTrack: vi.fn(() => ({ data: undefined, isFetching: false })),
}));
import { useSkyTrack } from "@/hooks/use-sky-track";

vi.mock("@/hooks/use-current-passes", () => ({
  useCurrentPasses: vi.fn(),
}));
import { useCurrentPasses } from "@/hooks/use-current-passes";

const stubSinglePass = (norad_id: number, id: string): PassItem => ({
  kind: "single",
  id,
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

const stubTrainPass = (id: string, member_norad_ids: number[]): TrainPassResponse => ({
  kind: "train",
  id,
  name: "Starlink train",
  member_norad_ids,
  rise: { time: "2026-04-27T03:00:00Z", azimuth_deg: 100, elevation_deg: 0, range_km: 1500 },
  peak: { time: "2026-04-27T03:05:00Z", azimuth_deg: 180, elevation_deg: 60, range_km: 480 },
  set: { time: "2026-04-27T03:10:00Z", azimuth_deg: 260, elevation_deg: 0, range_km: 1500 },
  duration_s: 600,
  max_magnitude: -1.5,
  member_count: member_norad_ids.length,
});

describe("useCurrentSkyTrack", () => {
  beforeEach(() => {
    useObserverStore.setState({
      current: { lat: 40.7128, lng: -74.006, elevation_m: 10, name: "NYC" },
    });
    useSatelliteStore.setState({ query: "starlink trains", resolvedName: null });
    useSelectionStore.setState({ selectedPassId: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes the user's typed query through unchanged for a single-sat pass", () => {
    (useCurrentPasses as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { query: "ISS", resolved_name: "ISS", passes: [stubSinglePass(25544, "iss-25544")] },
      isLoading: false,
    });
    useSatelliteStore.setState({ query: "ISS", resolvedName: null });
    useSelectionStore.setState({ selectedPassId: "iss-25544" });

    renderHook(() => useCurrentSkyTrack());

    const req = (useSkyTrack as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(req).not.toBeNull();
    expect(req.query).toBe("ISS");
  });

  it("pins the query to the first member's NORAD when a train pass is selected", () => {
    // The /sky-track endpoint expects a single satellite; the user's typed
    // query (e.g. "starlink trains") would resolve to a group/train_query
    // and 400. Pinning to a member NORAD makes the globe render one
    // representative ground track for the train.
    const train = stubTrainPass("train-a", [55001, 55002, 55003]);
    (useCurrentPasses as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { query: "starlink trains", resolved_name: "starlink trains", passes: [train] },
      isLoading: false,
    });
    useSelectionStore.setState({ selectedPassId: "train-a" });

    renderHook(() => useCurrentSkyTrack());

    const req = (useSkyTrack as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(req).not.toBeNull();
    expect(req.query).toBe("55001");
    expect(req.from_utc).toBe(train.rise.time);
    expect(req.to_utc).toBe(train.set.time);
  });

  it("returns idle (null req) when no pass is selected", () => {
    (useCurrentPasses as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { query: "ISS", resolved_name: "ISS", passes: [stubSinglePass(25544, "iss-25544")] },
      isLoading: false,
    });

    renderHook(() => useCurrentSkyTrack());

    const req = (useSkyTrack as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(req).toBeNull();
  });
});
