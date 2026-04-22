import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ObserverLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  elevation_m: number;
}

interface ObserverState {
  current: { lat: number; lng: number; elevation_m: number; name: string };
  saved: ObserverLocation[];
  setCurrent: (loc: Partial<ObserverState["current"]>) => void;
  addSaved: (loc: Omit<ObserverLocation, "id">) => void;
  removeSaved: (id: string) => void;
  applySaved: (id: string) => void;
}

const DEFAULT_CURRENT = {
  lat: 40.7128,
  lng: -74.006,
  elevation_m: 10,
  name: "Brooklyn, NY",
};

export const useObserverStore = create<ObserverState>()(
  persist(
    (set, get) => ({
      current: DEFAULT_CURRENT,
      saved: [],
      setCurrent: (loc) =>
        set((s) => ({ current: { ...s.current, ...loc } })),
      addSaved: (loc) =>
        set((s) => ({
          saved: [
            ...s.saved,
            { ...loc, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
          ],
        })),
      removeSaved: (id) =>
        set((s) => ({ saved: s.saved.filter((l) => l.id !== id) })),
      applySaved: (id) => {
        const target = get().saved.find((l) => l.id === id);
        if (target) {
          set({
            current: {
              lat: target.lat,
              lng: target.lng,
              elevation_m: target.elevation_m,
              name: target.name,
            },
          });
        }
      },
    }),
    { name: "satvis.observer" },
  ),
);
