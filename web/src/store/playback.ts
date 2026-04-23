import { create } from "zustand";

export type SpeedMultiplier = 1 | 10 | 60;

interface PlaybackState {
  cursorUtc: string | null;
  isPlaying: boolean;
  speedMultiplier: SpeedMultiplier;
  setCursor: (iso: string | null) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (s: SpeedMultiplier) => void;
  /** Seek to a specific cursor and pause so the user sees the frame at rest. */
  seekTo: (iso: string) => void;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  cursorUtc: null,
  isPlaying: false,
  speedMultiplier: 1,
  setCursor: (iso) => set({ cursorUtc: iso }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setSpeed: (s) => set({ speedMultiplier: s }),
  seekTo: (iso) => set({ cursorUtc: iso, isPlaying: false }),
}));
