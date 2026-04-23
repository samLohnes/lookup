import { beforeEach, describe, expect, it } from "vitest";
import { useSatelliteStore } from "@/store/satellite";

describe("useSatelliteStore", () => {
  beforeEach(() => {
    useSatelliteStore.setState({ query: "ISS", resolvedName: null });
  });

  it("setQuery updates query and clears resolvedName", () => {
    useSatelliteStore.setState({ query: "old", resolvedName: "OLD" });
    useSatelliteStore.getState().setQuery("hubble");
    expect(useSatelliteStore.getState().query).toBe("hubble");
    expect(useSatelliteStore.getState().resolvedName).toBeNull();
  });

  it("setResolved sets the resolved name without changing query", () => {
    useSatelliteStore.setState({ query: "iss", resolvedName: null });
    useSatelliteStore.getState().setResolved("ISS (ZARYA)");
    expect(useSatelliteStore.getState().query).toBe("iss");
    expect(useSatelliteStore.getState().resolvedName).toBe("ISS (ZARYA)");
  });

  it("clear empties query and resolvedName", () => {
    useSatelliteStore.setState({ query: "x", resolvedName: "X" });
    useSatelliteStore.getState().clear();
    expect(useSatelliteStore.getState().query).toBe("");
    expect(useSatelliteStore.getState().resolvedName).toBeNull();
  });
});
