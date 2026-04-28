import { create } from "zustand";

interface CameraTarget {
  lat: number;
  lng: number;
  /** Strictly-increasing token so consumers re-fire on repeat clicks
   *  even when lat/lng haven't moved. */
  nonce: number;
}

interface CameraTargetState {
  target: CameraTarget | null;
  reframeTo: (lat: number, lng: number) => void;
  clear: () => void;
}

let nonceCounter = 0;

export const useCameraTargetStore = create<CameraTargetState>((set) => ({
  target: null,
  reframeTo: (lat, lng) => {
    nonceCounter += 1;
    set({ target: { lat, lng, nonce: nonceCounter } });
  },
  clear: () => set({ target: null }),
}));
