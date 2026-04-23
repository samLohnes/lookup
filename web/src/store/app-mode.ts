import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppMode = "cinematic" | "research";

type AppModeState = {
  mode: AppMode;
  setMode: (m: AppMode) => void;
};

export const useAppModeStore = create<AppModeState>()(
  persist(
    (set) => ({
      mode: "cinematic",
      setMode: (mode) => set({ mode }),
    }),
    { name: "satvis.app-mode" },
  ),
);
