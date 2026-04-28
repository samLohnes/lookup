import { create } from "zustand";
import type { TrackSampleResponse } from "@/types/api";

const TRAIL_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

interface PositionEntry {
  norad_id: number;
  sample: TrackSampleResponse;
}

interface TrackEntry {
  norad_id: number;
  samples: TrackSampleResponse[];
}

interface LivePositionState {
  /** Latest polled sample, keyed by NORAD ID. */
  positions: Map<number, TrackSampleResponse>;
  /** Previous poll's sample, used to derive interpolation velocity. */
  previousPositions: Map<number, TrackSampleResponse>;
  /** Rolling tail of samples per sat, max ~10 minutes by sample t_utc. */
  trails: Map<number, TrackSampleResponse[]>;
  /** performance.now() at last successful poll (for extrapolation timing). */
  lastPolledAt: number | null;
  /** NORAD IDs currently being polled (for stale-response detection). */
  activeNorads: number[];

  setActive: (norads: number[]) => void;
  seedTrails: (entries: TrackEntry[]) => void;
  applyPoll: (entries: PositionEntry[], polledAtMs: number) => void;
  clear: () => void;
}

/** Drop trail samples whose t_utc is older than 10 minutes before the newest sample. */
function trimTrail(samples: TrackSampleResponse[]): TrackSampleResponse[] {
  if (samples.length === 0) return samples;
  const newestMs = new Date(samples[samples.length - 1].time).getTime();
  const cutoff = newestMs - TRAIL_MAX_AGE_MS;
  return samples.filter((s) => new Date(s.time).getTime() >= cutoff);
}

export const useLivePositionStore = create<LivePositionState>((set, get) => ({
  positions: new Map(),
  previousPositions: new Map(),
  trails: new Map(),
  lastPolledAt: null,
  activeNorads: [],

  setActive: (norads) => set({ activeNorads: [...norads] }),

  seedTrails: (entries) => {
    const trails = new Map<number, TrackSampleResponse[]>();
    for (const e of entries) trails.set(e.norad_id, [...e.samples]);
    set({ trails });
  },

  applyPoll: (entries, polledAtMs) => {
    const active = new Set(get().activeNorads);
    const fresh = entries.filter((e) => active.has(e.norad_id));
    if (fresh.length === 0) return;

    const prevPositions = get().positions;
    const newPositions = new Map<number, TrackSampleResponse>();
    const newPrevPositions = new Map<number, TrackSampleResponse>();
    const newTrails = new Map(get().trails);

    for (const e of fresh) {
      newPositions.set(e.norad_id, e.sample);
      const prior = prevPositions.get(e.norad_id);
      if (prior) newPrevPositions.set(e.norad_id, prior);

      const existingTrail = newTrails.get(e.norad_id) ?? [];
      newTrails.set(e.norad_id, trimTrail([...existingTrail, e.sample]));
    }

    set({
      positions: newPositions,
      previousPositions: newPrevPositions,
      trails: newTrails,
      lastPolledAt: polledAtMs,
    });
  },

  clear: () =>
    set({
      positions: new Map(),
      previousPositions: new Map(),
      trails: new Map(),
      lastPolledAt: null,
      activeNorads: [],
    }),
}));
