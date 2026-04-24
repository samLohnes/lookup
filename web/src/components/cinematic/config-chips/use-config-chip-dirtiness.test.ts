import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useConfigChipDirtiness } from "./use-config-chip-dirtiness";
import { useDraftInputsStore } from "@/store/draft-inputs";
import { useObserverStore } from "@/store/observer";
import { useSatelliteStore } from "@/store/satellite";
import { useTimeRangeStore } from "@/store/time-range";

describe("useConfigChipDirtiness", () => {
  beforeEach(() => {
    useObserverStore.setState({
      current: { lat: 40.7, lng: -74.0, elevation_m: 10, name: "NYC" },
    });
    useSatelliteStore.setState({ query: "ISS", resolvedName: null });
    useTimeRangeStore.setState({
      fromUtc: "2026-04-24T18:00:00Z",
      toUtc: "2026-04-25T06:00:00Z",
      mode: "line-of-sight",
    });
    useDraftInputsStore.getState().initFromCommitted();
  });

  it("returns all-false when no drafts diverge", () => {
    const { result } = renderHook(() => useConfigChipDirtiness());
    expect(result.current).toEqual({
      observer: false,
      satellite: false,
      window: false,
      any: false,
    });
  });

  it("flags observer dirty when observer draft diverges", () => {
    useDraftInputsStore.getState().setDraftObserver({
      lat: 37.7, lng: -122.4, elevation_m: 20, name: "SF",
    });
    const { result } = renderHook(() => useConfigChipDirtiness());
    expect(result.current.observer).toBe(true);
    expect(result.current.any).toBe(true);
    expect(result.current.satellite).toBe(false);
    expect(result.current.window).toBe(false);
  });

  it("flags all three when all drafts diverge", () => {
    useDraftInputsStore.getState().setDraftObserver({
      lat: 37.7, lng: -122.4, elevation_m: 20, name: "SF",
    });
    useDraftInputsStore.getState().setDraftSatellite({ query: "STARLINK" });
    useDraftInputsStore.getState().setDraftWindow({
      fromUtc: "2026-05-01T00:00:00Z",
      toUtc: "2026-05-02T00:00:00Z",
    });
    const { result } = renderHook(() => useConfigChipDirtiness());
    expect(result.current).toEqual({
      observer: true,
      satellite: true,
      window: true,
      any: true,
    });
  });

  it("clears observer-dirty after commit writes draft to committed stores", () => {
    useDraftInputsStore.getState().setDraftObserver({
      lat: 37.7, lng: -122.4, elevation_m: 20, name: "SF",
    });
    const { result, rerender } = renderHook(() => useConfigChipDirtiness());
    expect(result.current.observer).toBe(true);

    // Commit — writes draft to the committed observer store. The hook must
    // re-evaluate because it subscribes to the observer store directly,
    // not only to draft-inputs.
    useDraftInputsStore.getState().commit();
    rerender();

    expect(result.current.observer).toBe(false);
    expect(result.current.any).toBe(false);
  });
});
