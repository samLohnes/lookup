import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DisplayTzMode = "client" | "observer" | "utc";

interface DisplayTzState {
  mode: DisplayTzMode;
  setMode: (m: DisplayTzMode) => void;
}

export const useDisplayTzStore = create<DisplayTzState>()(
  persist(
    (set) => ({
      mode: "client",
      setMode: (mode) => set({ mode }),
    }),
    { name: "satvis.display-tz" },
  ),
);
