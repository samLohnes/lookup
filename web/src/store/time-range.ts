import { create } from "zustand";

interface TimeRangeState {
  fromUtc: string;
  toUtc: string;
  mode: "line-of-sight" | "naked-eye";
  setRange: (fromUtc: string, toUtc: string) => void;
  setMode: (m: TimeRangeState["mode"]) => void;
  applyPreset: (hours: number) => void;
}

/** Return the current time as an ISO 8601 string. */
function nowIso(): string {
  return new Date().toISOString();
}

/** Return the time `hours` from now as an ISO 8601 string. */
function plusHoursIso(hours: number): string {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

export const useTimeRangeStore = create<TimeRangeState>((set) => ({
  fromUtc: nowIso(),
  toUtc: plusHoursIso(24),
  mode: "line-of-sight",
  setRange: (fromUtc, toUtc) => set({ fromUtc, toUtc }),
  setMode: (m) => set({ mode: m }),
  applyPreset: (hours) =>
    set({ fromUtc: nowIso(), toUtc: plusHoursIso(hours) }),
}));
