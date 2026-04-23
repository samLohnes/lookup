import { describe, expect, it } from "vitest";
import { buildHorizonPoints } from "@/components/sky-view/horizon-points";

function flatMask(elevation: number): number[] {
  return new Array(360).fill(elevation);
}

describe("buildHorizonPoints", () => {
  it("rejects masks with the wrong length", () => {
    expect(() => buildHorizonPoints([1, 2, 3])).toThrow(/360/);
  });

  it("emits 720 coordinate pairs (forward + reverse)", () => {
    const out = buildHorizonPoints(flatMask(0));
    const pairs = out.split(" ");
    expect(pairs).toHaveLength(720);
  });

  it("each pair is two numbers separated by a comma", () => {
    const out = buildHorizonPoints(flatMask(0));
    for (const pair of out.split(" ")) {
      expect(pair).toMatch(/^-?\d+\.\d{2},-?\d+\.\d{2}$/);
    }
  });

  it("clamps below-horizon samples to 0 (no points outside the dome)", () => {
    // A negative-elevation mask should still trace the horizon line, never
    // outside the dome. We verify all forward-pass points have the same
    // distance from center as the reverse-pass points (since both lie on the
    // horizon when terrain is below the horizon).
    const out = buildHorizonPoints(flatMask(-10));
    const pairs = out.split(" ").map((p) => {
      const [x, y] = p.split(",").map(Number);
      return { x, y };
    });
    const forward = pairs.slice(0, 360);
    const reverse = pairs.slice(360);
    // forward[i] should equal reverse[359 - i] (both at horizon for same azimuth)
    for (let i = 0; i < 360; i++) {
      expect(forward[i].x).toBeCloseTo(reverse[359 - i].x, 1);
      expect(forward[i].y).toBeCloseTo(reverse[359 - i].y, 1);
    }
  });

  it("places a single high-elevation peak inside the dome", () => {
    const mask = flatMask(0);
    mask[45] = 60; // peak to the NE
    const out = buildHorizonPoints(mask);
    // The 46th forward point (index 45) should be much closer to center
    // than the 0-elevation reverse points.
    const pairs = out.split(" ").map((p) => {
      const [x, y] = p.split(",").map(Number);
      return { x, y };
    });
    const peak = pairs[45];
    const dist = (p: { x: number; y: number }) =>
      Math.hypot(p.x - 160, p.y - 160); // DOME_CENTER = 160
    expect(dist(peak)).toBeLessThan(dist(pairs[0]));
  });
});
