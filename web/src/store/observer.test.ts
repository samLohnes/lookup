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

describe("useObserverStore persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("writes saved locations to localStorage", () => {
    useObserverStore.setState({
      current: { lat: 0, lng: 0, elevation_m: 0, name: "test" },
      saved: [],
    });
    useObserverStore.getState().addSaved({
      name: "Backyard",
      lat: 40.7,
      lng: -74,
      elevation_m: 10,
    });

    const raw = localStorage.getItem("satvis.observer");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    // zustand persist wraps state under `state`
    expect(parsed.state.saved).toHaveLength(1);
    expect(parsed.state.saved[0].name).toBe("Backyard");
  });

  it("rehydrates from existing localStorage on rehydrate()", async () => {
    // Reset in-memory state first — persist middleware writes to storage on
    // setState, so we must seed storage after this call to win the race.
    useObserverStore.setState({
      current: { lat: 0, lng: 0, elevation_m: 0, name: "" },
      saved: [],
    });

    // Seed localStorage as if a previous session had saved a location.
    const seeded = {
      state: {
        current: { lat: 51.5, lng: -0.12, elevation_m: 5, name: "London" },
        saved: [
          {
            id: "fixed-id-1",
            name: "Cabin",
            lat: 45.5,
            lng: -73.5,
            elevation_m: 500,
          },
        ],
      },
      version: 0,
    };
    localStorage.setItem("satvis.observer", JSON.stringify(seeded));

    await useObserverStore.persist.rehydrate();

    expect(useObserverStore.getState().current.name).toBe("London");
    expect(useObserverStore.getState().saved).toHaveLength(1);
    expect(useObserverStore.getState().saved[0].name).toBe("Cabin");
  });
});
