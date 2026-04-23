import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDraftInputsStore } from "./draft-inputs";
import { useObserverStore } from "./observer";
import { useSatelliteStore } from "./satellite";
import { useTimeRangeStore } from "./time-range";

describe("draft-inputs store", () => {
  beforeEach(() => {
    useObserverStore.setState({
      current: { lat: 40.7128, lng: -74.006, elevation_m: 10, name: "Brooklyn" },
    });
    useSatelliteStore.setState({ query: "ISS", resolvedName: "ISS (ZARYA)" } as never);
    useTimeRangeStore.setState({
      fromUtc: "2026-05-01T00:00:00Z",
      toUtc: "2026-05-02T00:00:00Z",
      mode: "line-of-sight",
    } as never);
    useDraftInputsStore.getState().initFromCommitted();
  });

  it("draft initially equals committed", () => {
    const { result } = renderHook(() => useDraftInputsStore());
    expect(result.current.isDirty()).toBe(false);
    expect(result.current.changeCount()).toBe(0);
  });

  it("setDraftObserver marks dirty", () => {
    const { result } = renderHook(() => useDraftInputsStore());
    act(() =>
      result.current.setDraftObserver({
        lat: 51.5,
        lng: -0.12,
        elevation_m: 10,
        name: "London",
      }),
    );
    expect(result.current.isDirty()).toBe(true);
    expect(result.current.changeCount()).toBe(1);
  });

  it("commit writes draft observer to committed store", () => {
    const { result } = renderHook(() => useDraftInputsStore());
    act(() =>
      result.current.setDraftObserver({
        lat: 51.5,
        lng: -0.12,
        elevation_m: 10,
        name: "London",
      }),
    );
    act(() => result.current.commit());
    expect(useObserverStore.getState().current.name).toBe("London");
    expect(result.current.isDirty()).toBe(false);
  });

  it("commit writes draft satellite query via setQuery", () => {
    const { result } = renderHook(() => useDraftInputsStore());
    act(() => result.current.setDraftSatellite({ query: "hubble" }));
    act(() => result.current.commit());
    expect(useSatelliteStore.getState().query).toBe("hubble");
  });

  it("revert restores draft from committed", () => {
    const { result } = renderHook(() => useDraftInputsStore());
    act(() => result.current.setDraftSatellite({ query: "hubble" }));
    expect(result.current.isDirty()).toBe(true);
    act(() => result.current.revert());
    expect(result.current.isDirty()).toBe(false);
    expect(result.current.draft.satellite.query).toBe("ISS");
  });

  it("changeCount counts multiple dirty fields", () => {
    const { result } = renderHook(() => useDraftInputsStore());
    act(() =>
      result.current.setDraftObserver({
        lat: 51.5,
        lng: -0.12,
        elevation_m: 10,
        name: "London",
      }),
    );
    act(() => result.current.setDraftSatellite({ query: "hubble" }));
    expect(result.current.changeCount()).toBe(2);
  });
});
