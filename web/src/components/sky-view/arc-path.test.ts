import { describe, expect, it } from "vitest";
import { buildArcPath } from "@/components/sky-view/arc-path";
import type { TrackSampleResponse } from "@/types/api";

function sample(time: string, az: number, el: number): TrackSampleResponse {
  return {
    time,
    lat: 0,
    lng: 0,
    alt_km: 400,
    az,
    el,
    range_km: 500,
    velocity_km_s: 7.66,
    magnitude: null,
    sunlit: true,
    observer_dark: true,
  };
}

describe("buildArcPath", () => {
  it("returns nulls for empty input", () => {
    expect(buildArcPath([])).toEqual({ d: null, peak: null });
  });

  it("returns nulls when fewer than 2 samples are above horizon", () => {
    const out = buildArcPath([sample("t", 0, -1), sample("t", 0, 30)]);
    expect(out).toEqual({ d: null, peak: null });
  });

  it("starts the path with M and uses L for subsequent points", () => {
    const out = buildArcPath([
      sample("t1", 90, 10),
      sample("t2", 180, 60),
      sample("t3", 270, 10),
    ]);
    expect(out.d).toMatch(/^M[\d.]+,[\d.]+ L[\d.]+,[\d.]+ L[\d.]+,[\d.]+$/);
  });

  it("identifies the peak sample by max elevation", () => {
    const a = sample("t1", 90, 10);
    const b = sample("t2", 180, 60);
    const c = sample("t3", 270, 30);
    const out = buildArcPath([a, b, c]);
    expect(out.peak).toBe(b);
  });

  it("excludes below-horizon samples from the path", () => {
    const above1 = sample("t1", 0, 10);
    const above2 = sample("t2", 0, 20);
    const out = buildArcPath([above1, sample("t-bad", 0, -5), above2]);
    // Path has exactly 2 commands (M + L)
    const commands = (out.d ?? "").split(" ");
    expect(commands).toHaveLength(2);
  });
});
