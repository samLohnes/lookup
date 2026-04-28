import { beforeEach, describe, expect, it } from "vitest";
import { useLivePositionStore } from "./live-position";
import type { TrackSampleResponse } from "@/types/api";

function sample(time: string, lat: number, lng: number, alt_km = 412): TrackSampleResponse {
  return {
    time, lat, lng, alt_km,
    az: 0, el: 0, range_km: 478,
    velocity_km_s: 7.68, magnitude: -2.1,
    sunlit: true, observer_dark: true,
  };
}

describe("useLivePositionStore", () => {
  beforeEach(() => {
    useLivePositionStore.getState().clear();
  });

  it("initial state is empty", () => {
    const s = useLivePositionStore.getState();
    expect(s.positions.size).toBe(0);
    expect(s.previousPositions.size).toBe(0);
    expect(s.trails.size).toBe(0);
    expect(s.lastPolledAt).toBeNull();
    expect(s.activeNorads).toEqual([]);
  });

  it("setActive replaces the active NORAD list", () => {
    useLivePositionStore.getState().setActive([25544, 48274]);
    expect(useLivePositionStore.getState().activeNorads).toEqual([25544, 48274]);
  });

  it("seedTrails populates trails for each entry", () => {
    useLivePositionStore.getState().seedTrails([
      { norad_id: 25544, samples: [sample("2026-04-27T00:00:00Z", 40, -74), sample("2026-04-27T00:00:30Z", 41, -73)] },
    ]);
    const trails = useLivePositionStore.getState().trails;
    expect(trails.get(25544)?.length).toBe(2);
  });

  it("applyPoll rotates positions to previousPositions", () => {
    const t1 = sample("2026-04-27T00:00:00Z", 40, -74);
    const t2 = sample("2026-04-27T00:00:05Z", 40.5, -73.5);
    useLivePositionStore.getState().setActive([25544]);
    useLivePositionStore.getState().applyPoll([{ norad_id: 25544, sample: t1 }], 1000);
    useLivePositionStore.getState().applyPoll([{ norad_id: 25544, sample: t2 }], 1005);
    const s = useLivePositionStore.getState();
    expect(s.positions.get(25544)).toEqual(t2);
    expect(s.previousPositions.get(25544)).toEqual(t1);
    expect(s.lastPolledAt).toBe(1005);
  });

  it("applyPoll appends polled samples to the trail", () => {
    const t1 = sample("2026-04-27T00:00:00Z", 40, -74);
    useLivePositionStore.getState().setActive([25544]);
    useLivePositionStore.getState().seedTrails([
      { norad_id: 25544, samples: [sample("2026-04-26T23:55:00Z", 39, -75)] },
    ]);
    useLivePositionStore.getState().applyPoll([{ norad_id: 25544, sample: t1 }], 1000);
    const trail = useLivePositionStore.getState().trails.get(25544)!;
    expect(trail.length).toBe(2);
    expect(trail[trail.length - 1]).toEqual(t1);
  });

  it("applyPoll trims trail samples older than 10 minutes", () => {
    const old = sample("2026-04-26T23:00:00Z", 39, -75);  // ~25 min before
    const recent = sample("2026-04-27T00:00:00Z", 40, -74);
    useLivePositionStore.getState().setActive([25544]);
    useLivePositionStore.getState().seedTrails([
      { norad_id: 25544, samples: [old, recent] },
    ]);
    const now = sample("2026-04-27T00:00:30Z", 40.1, -74.1);
    useLivePositionStore.getState().applyPoll([{ norad_id: 25544, sample: now }], 2000);
    const trail = useLivePositionStore.getState().trails.get(25544)!;
    expect(trail.find((s) => s.time === old.time)).toBeUndefined();
    expect(trail.find((s) => s.time === recent.time)).toBeDefined();
    expect(trail.find((s) => s.time === now.time)).toBeDefined();
  });

  it("applyPoll silently drops entries whose norad_id is not in activeNorads", () => {
    useLivePositionStore.getState().setActive([25544]);
    const stale = sample("2026-04-27T00:00:00Z", 40, -74);
    useLivePositionStore.getState().applyPoll([{ norad_id: 999, sample: stale }], 1000);
    expect(useLivePositionStore.getState().positions.has(999)).toBe(false);
  });

  it("clear resets all state", () => {
    useLivePositionStore.getState().setActive([25544]);
    useLivePositionStore.getState().applyPoll(
      [{ norad_id: 25544, sample: sample("2026-04-27T00:00:00Z", 40, -74) }],
      1000,
    );
    useLivePositionStore.getState().clear();
    const s = useLivePositionStore.getState();
    expect(s.positions.size).toBe(0);
    expect(s.previousPositions.size).toBe(0);
    expect(s.trails.size).toBe(0);
    expect(s.activeNorads).toEqual([]);
    expect(s.lastPolledAt).toBeNull();
  });
});
