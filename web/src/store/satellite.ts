import { create } from "zustand";

interface SatelliteState {
  query: string;
  resolvedName: string | null;
  setQuery: (q: string) => void;
  setResolved: (name: string | null) => void;
  clear: () => void;
}

export const useSatelliteStore = create<SatelliteState>((set) => ({
  query: "ISS",
  resolvedName: null,
  setQuery: (q) => set({ query: q, resolvedName: null }),
  setResolved: (name) => set({ resolvedName: name }),
  clear: () => set({ query: "", resolvedName: null }),
}));
