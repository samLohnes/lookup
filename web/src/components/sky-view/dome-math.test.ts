import { describe, expect, it } from "vitest";
import { altAzToXy, DOME_CENTER, DOME_RADIUS } from "./dome-math";

describe("altAzToXy", () => {
  it("zenith (el=90) maps to exactly the dome center regardless of az", () => {
    for (const az of [0, 45, 90, 180, 270]) {
      const { x, y } = altAzToXy(az, 90);
      expect(x).toBeCloseTo(DOME_CENTER, 1);
      expect(y).toBeCloseTo(DOME_CENTER, 1);
    }
  });

  it("horizon north (az=0, el=0) is directly above center on the circle", () => {
    const { x, y } = altAzToXy(0, 0);
    expect(x).toBeCloseTo(DOME_CENTER, 1);
    expect(y).toBeCloseTo(DOME_CENTER - DOME_RADIUS, 1);
  });

  it("horizon east (az=90, el=0) is to the right of center on the circle", () => {
    const { x, y } = altAzToXy(90, 0);
    expect(x).toBeCloseTo(DOME_CENTER + DOME_RADIUS, 1);
    expect(y).toBeCloseTo(DOME_CENTER, 1);
  });

  it("horizon south (az=180, el=0) is directly below center on the circle", () => {
    const { x, y } = altAzToXy(180, 0);
    expect(x).toBeCloseTo(DOME_CENTER, 1);
    expect(y).toBeCloseTo(DOME_CENTER + DOME_RADIUS, 1);
  });

  it("horizon west (az=270, el=0) is to the left of center on the circle", () => {
    const { x, y } = altAzToXy(270, 0);
    expect(x).toBeCloseTo(DOME_CENTER - DOME_RADIUS, 1);
    expect(y).toBeCloseTo(DOME_CENTER, 1);
  });

  it("mid-elevation (az=0, el=45) is halfway between zenith and horizon", () => {
    const { x, y } = altAzToXy(0, 45);
    expect(x).toBeCloseTo(DOME_CENTER, 1);
    expect(y).toBeCloseTo(DOME_CENTER - DOME_RADIUS / 2, 1);
  });

  it("below horizon (az=0, el=-10) falls outside the dome circle", () => {
    const { x, y } = altAzToXy(0, -10);
    const dist = Math.sqrt((x - DOME_CENTER) ** 2 + (y - DOME_CENTER) ** 2);
    expect(dist).toBeGreaterThan(DOME_RADIUS);
  });
});
