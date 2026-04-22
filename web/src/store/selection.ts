import { create } from "zustand";

interface SelectionState {
  selectedPassId: string | null;
  select: (id: string | null) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedPassId: null,
  select: (id) => set({ selectedPassId: id }),
}));
