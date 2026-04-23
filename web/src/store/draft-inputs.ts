import { create } from "zustand";
import { useObserverStore } from "./observer";
import { useSatelliteStore } from "./satellite";
import { useTimeRangeStore } from "./time-range";

/** Mirrors the committed observer store's `current` shape. */
export type DraftObserver = {
  lat: number;
  lng: number;
  elevation_m: number;
  name: string;
};

/**
 * Only tracks the user-editable query. `resolvedName` on the committed
 * satellite store is derived by a lookup hook after `query` changes, so it is
 * not a draftable input.
 */
export type DraftSatellite = {
  query: string;
};

/** Draft shape for the time range editor. */
export type DraftWindow = {
  fromUtc: string;
  toUtc: string;
};

type DraftInputs = {
  observer: DraftObserver;
  satellite: DraftSatellite;
  window: DraftWindow;
};

type DraftInputsState = {
  draft: DraftInputs;
  setDraftObserver: (o: DraftObserver) => void;
  setDraftSatellite: (s: DraftSatellite) => void;
  setDraftWindow: (w: DraftWindow) => void;
  commit: () => void;
  revert: () => void;
  isDirty: () => boolean;
  changeCount: () => number;
  /** Seeds / resyncs draft from the current committed stores. */
  initFromCommitted: () => void;
};

/** Build a fresh draft snapshot from the current committed store state. */
function snapshotCommitted(): DraftInputs {
  const o = useObserverStore.getState().current;
  const s = useSatelliteStore.getState();
  const t = useTimeRangeStore.getState();
  return {
    observer: {
      lat: o.lat,
      lng: o.lng,
      elevation_m: o.elevation_m,
      name: o.name,
    },
    satellite: { query: s.query },
    window: { fromUtc: t.fromUtc, toUtc: t.toUtc },
  };
}

function deepEqObserver(a: DraftObserver, b: DraftObserver): boolean {
  return (
    a.lat === b.lat &&
    a.lng === b.lng &&
    a.elevation_m === b.elevation_m &&
    a.name === b.name
  );
}

function deepEqSatellite(a: DraftSatellite, b: DraftSatellite): boolean {
  return a.query === b.query;
}

function deepEqWindow(a: DraftWindow, b: DraftWindow): boolean {
  return a.fromUtc === b.fromUtc && a.toUtc === b.toUtc;
}

export const useDraftInputsStore = create<DraftInputsState>()((set, get) => ({
  draft: snapshotCommitted(),
  setDraftObserver: (observer) =>
    set((st) => ({ draft: { ...st.draft, observer } })),
  setDraftSatellite: (satellite) =>
    set((st) => ({ draft: { ...st.draft, satellite } })),
  setDraftWindow: (window) =>
    set((st) => ({ draft: { ...st.draft, window } })),
  commit: () => {
    const d = get().draft;
    useObserverStore.getState().setCurrent({
      lat: d.observer.lat,
      lng: d.observer.lng,
      elevation_m: d.observer.elevation_m,
      name: d.observer.name,
    });
    // setQuery naturally clears resolvedName; the lookup hook re-resolves.
    useSatelliteStore.getState().setQuery(d.satellite.query);
    // time-range exposes positional setRange(fromUtc, toUtc).
    useTimeRangeStore
      .getState()
      .setRange(d.window.fromUtc, d.window.toUtc);
  },
  revert: () => set({ draft: snapshotCommitted() }),
  isDirty: () => {
    const d = get().draft;
    const c = snapshotCommitted();
    return (
      !deepEqObserver(d.observer, c.observer) ||
      !deepEqSatellite(d.satellite, c.satellite) ||
      !deepEqWindow(d.window, c.window)
    );
  },
  changeCount: () => {
    const d = get().draft;
    const c = snapshotCommitted();
    let n = 0;
    if (!deepEqObserver(d.observer, c.observer)) n++;
    if (!deepEqSatellite(d.satellite, c.satellite)) n++;
    if (!deepEqWindow(d.window, c.window)) n++;
    return n;
  },
  initFromCommitted: () => set({ draft: snapshotCommitted() }),
}));
