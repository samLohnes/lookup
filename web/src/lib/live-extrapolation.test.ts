import { describe, expect, it } from "vitest";
import { extrapolatePosition } from "./live-extrapolation";
import type { TrackSampleResponse } from "@/types/api";

function sample(time: string, lat: number, lng: number, alt_km = 412): TrackSampleResponse {
  return {
    time, lat, lng, alt_km,
    az: 0, el: 0, range_km: 478,
    velocity_km_s: 7.68, magnitude: null,
    sunlit: true, observer_dark: true,
  };
}

describe("extrapolatePosition", () => {
  it("returns latest unchanged when previous is undefined", () => {
    const latest = sample("2026-04-27T00:00:00Z", 40, -74);
    const out = extrapolatePosition(latest, undefined, 1000, 1000);
    expect(out).toEqual({ lat: 40, lng: -74, alt_km: 412 });
  });

  it("returns latest unchanged when dt between polls is zero", () => {
    const latest = sample("2026-04-27T00:00:00Z", 40, -74);
    const previous = sample("2026-04-27T00:00:00Z", 39, -73);
    const out = extrapolatePosition(latest, previous, 2000, 1000);
    expect(out).toEqual({ lat: 40, lng: -74, alt_km: 412 });
  });

  it("linearly extrapolates forward when polls are 5 s apart", () => {
    const previous = sample("2026-04-27T00:00:00Z", 40.0, -74.0, 410);
    const latest = sample("2026-04-27T00:00:05Z", 40.5, -73.5, 412);
    // 1 s after the latest poll (lastPolledMs=1000, nowMs=2000) →
    // dt between polls = 5s, t = 0.2 → +0.1 lat, +0.1 lng, +0.4 alt
    const out = extrapolatePosition(latest, previous, 2000, 1000);
    expect(out.lat).toBeCloseTo(40.6, 5);
    expect(out.lng).toBeCloseTo(-73.4, 5);
    expect(out.alt_km).toBeCloseTo(412.4, 5);
  });

  it("unwraps eastward antimeridian crossing (lng goes 179 → -179)", () => {
    const previous = sample("2026-04-27T00:00:00Z", 0, 179);
    const latest = sample("2026-04-27T00:00:05Z", 0, -179);  // crossed antimeridian eastward
    // True delta is +2°, not -358°. At t=0.2 → +0.4° from latest.
    // Result longitude is -179 + 0.4 = -178.6 (already in [-180, 180]).
    const out = extrapolatePosition(latest, previous, 2000, 1000);
    expect(out.lng).toBeCloseTo(-178.6, 5);
  });

  it("unwraps westward antimeridian crossing (lng goes -179 → 179)", () => {
    const previous = sample("2026-04-27T00:00:00Z", 0, -179);
    const latest = sample("2026-04-27T00:00:05Z", 0, 179);   // crossed antimeridian westward
    // True delta is -2°, not +358°. At t=0.2 → -0.4° from latest.
    // Result longitude should be 178.6.
    const out = extrapolatePosition(latest, previous, 2000, 1000);
    expect(out.lng).toBeCloseTo(178.6, 5);
  });

  it("normal interpolation does not unwrap when |delta| ≤ 180", () => {
    const previous = sample("2026-04-27T00:00:00Z", 0, 10);
    const latest = sample("2026-04-27T00:00:05Z", 0, 12);
    const out = extrapolatePosition(latest, previous, 2000, 1000);
    // delta = +2, t = 0.2 → +0.4 from latest = 12.4
    expect(out.lng).toBeCloseTo(12.4, 5);
  });
});
