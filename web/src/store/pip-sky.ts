import { create } from "zustand";

export const PIP_MIN_SIZE = 200;

type XY = { x: number; y: number };
type Size = { width: number; height: number };

type PipSkyState = {
  isOpen: boolean;
  position: XY;
  size: Size;
  open: () => void;
  close: () => void;
  setPosition: (p: XY) => void;
  setSize: (s: Size) => void;
};

export const usePipSkyStore = create<PipSkyState>()((set) => ({
  isOpen: false,
  // Sentinel — replaced on first open with a viewport-aware bottom-right
  // placement (see PipSkyView). Using negative coords avoids accidentally
  // rendering at a real on-screen position before initialization.
  position: { x: -1, y: -1 },
  size: { width: 300, height: 300 },
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setPosition: (position) => set({ position }),
  setSize: ({ width, height }) => {
    // Aspect ratio 1:1 — use the larger dimension the user dragged.
    const target = Math.max(width, height);
    const clamped = Math.max(target, PIP_MIN_SIZE);
    set({ size: { width: clamped, height: clamped } });
  },
}));
