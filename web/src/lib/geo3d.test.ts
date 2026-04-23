import { describe, expect, it } from "vitest";
import { latLngAltToVec3, EARTH_RADIUS_KM, EARTH_RADIUS_UNITS } from "@/lib/geo3d";

describe("latLngAltToVec3", () => {
  it("places (0°N, 0°E, 0 km) on the +x axis at exactly the earth radius", () => {
    const v = latLngAltToVec3(0, 0, 0);
    expect(v.x).toBeCloseTo(EARTH_RADIUS_UNITS, 4);
    expect(v.y).toBeCloseTo(0, 4);
    expect(v.z).toBeCloseTo(0, 4);
  });

  it("places the north pole on the +y axis", () => {
    const v = latLngAltToVec3(90, 0, 0);
    expect(v.x).toBeCloseTo(0, 4);
    expect(v.y).toBeCloseTo(EARTH_RADIUS_UNITS, 4);
    expect(Math.abs(v.z)).toBeLessThan(1e-3);
  });

  it("places (0°N, 90°E, 0 km) on the -z axis (right-handed, z toward viewer)", () => {
    const v = latLngAltToVec3(0, 90, 0);
    expect(v.x).toBeCloseTo(0, 4);
    expect(v.y).toBeCloseTo(0, 4);
    expect(v.z).toBeCloseTo(-EARTH_RADIUS_UNITS, 4);
  });

  it("scales radius proportionally with altitude", () => {
    const v = latLngAltToVec3(0, 0, EARTH_RADIUS_KM); // 1 earth radius up
    const r = Math.hypot(v.x, v.y, v.z);
    expect(r).toBeCloseTo(2 * EARTH_RADIUS_UNITS, 3);
  });
});
