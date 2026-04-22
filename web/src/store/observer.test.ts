import { beforeEach, describe, expect, it } from "vitest";
import { useObserverStore } from "@/store/observer";

describe("useObserverStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useObserverStore.setState({
      current: { lat: 0, lng: 0, elevation_m: 0, name: "test" },
      saved: [],
    });
  });

  it("setCurrent merges partial updates", () => {
    useObserverStore.getState().setCurrent({ lat: 40.7128 });
    expect(useObserverStore.getState().current.lat).toBe(40.7128);
    expect(useObserverStore.getState().current.name).toBe("test");
  });

  it("addSaved produces a unique id", () => {
    useObserverStore.getState().addSaved({
      name: "Backyard",
      lat: 40,
      lng: -74,
      elevation_m: 10,
    });
    expect(useObserverStore.getState().saved).toHaveLength(1);
    expect(useObserverStore.getState().saved[0].id).toBeTruthy();
  });

  it("applySaved copies a saved location into current", () => {
    useObserverStore.getState().addSaved({
      name: "Cabin",
      lat: 45.5,
      lng: -73.5,
      elevation_m: 500,
    });
    const id = useObserverStore.getState().saved[0].id;
    useObserverStore.getState().applySaved(id);
    expect(useObserverStore.getState().current.name).toBe("Cabin");
    expect(useObserverStore.getState().current.elevation_m).toBe(500);
  });

  it("removeSaved deletes by id", () => {
    useObserverStore.getState().addSaved({
      name: "X",
      lat: 0,
      lng: 0,
      elevation_m: 0,
    });
    const id = useObserverStore.getState().saved[0].id;
    useObserverStore.getState().removeSaved(id);
    expect(useObserverStore.getState().saved).toHaveLength(0);
  });
});
