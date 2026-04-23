import { describe, expect, it } from "vitest";
import { samplesToSurfacePositions } from "./ground-track-mesh";

describe("samplesToSurfacePositions", () => {
  it("returns N × 3 flat array for N samples", () => {
    const samples = [
      { lat: 0, lng: 0, altitudeM: 400000 },
      { lat: 10, lng: 20, altitudeM: 400000 },
      { lat: 20, lng: 40, altitudeM: 400000 },
    ];
    const out = samplesToSurfacePositions(samples, 1.0);
    expect(out.length).toBe(9);
  });

  it("places (lat=0, lng=0) at approximately (1, 0, 0) on unit sphere", () => {
    const out = samplesToSurfacePositions(
      [{ lat: 0, lng: 0, altitudeM: 0 }],
      1.0,
    );
    expect(out[0]).toBeGreaterThan(0.99);
    expect(out[0]).toBeLessThan(1.02);
    expect(Math.abs(out[1])).toBeLessThan(0.01);
    expect(Math.abs(out[2])).toBeLessThan(0.01);
  });

  it("places (lat=90, lng=*) near the north pole (0, 0, 1)", () => {
    const out = samplesToSurfacePositions(
      [{ lat: 90, lng: 42, altitudeM: 0 }],
      1.0,
    );
    expect(Math.abs(out[0])).toBeLessThan(0.01);
    expect(Math.abs(out[1])).toBeLessThan(0.01);
    expect(out[2]).toBeGreaterThan(0.99);
  });
});
