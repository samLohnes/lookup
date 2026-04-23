import { describe, expect, it } from "vitest";
import { subSolarPoint, sunDirectionForDate } from "./sun-direction";

describe("subSolarPoint", () => {
  it("vernal equinox (March 20) → sub-solar latitude ~0°", () => {
    const d = new Date(Date.UTC(2026, 2, 20, 12, 0, 0));
    const { lat } = subSolarPoint(d);
    expect(Math.abs(lat)).toBeLessThan(1.0);
  });

  it("summer solstice (June 21) → sub-solar latitude ~+23.4°", () => {
    const d = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
    const { lat } = subSolarPoint(d);
    expect(lat).toBeGreaterThan(23.0);
    expect(lat).toBeLessThan(23.8);
  });

  it("winter solstice (December 21) → sub-solar latitude ~-23.4°", () => {
    const d = new Date(Date.UTC(2026, 11, 21, 12, 0, 0));
    const { lat } = subSolarPoint(d);
    expect(lat).toBeLessThan(-23.0);
    expect(lat).toBeGreaterThan(-23.8);
  });

  it("noon UTC → sub-solar longitude near 0°", () => {
    const d = new Date(Date.UTC(2026, 2, 20, 12, 0, 0));
    const { lng } = subSolarPoint(d);
    expect(Math.abs(lng)).toBeLessThan(1.0);
  });

  it("midnight UTC → sub-solar longitude near ±180°", () => {
    const d = new Date(Date.UTC(2026, 2, 20, 0, 0, 0));
    const { lng } = subSolarPoint(d);
    expect(Math.abs(Math.abs(lng) - 180)).toBeLessThan(1.0);
  });
});

describe("sunDirectionForDate", () => {
  it("returns a unit vector", () => {
    const v = sunDirectionForDate(new Date());
    const mag = Math.hypot(v.x, v.y, v.z);
    expect(mag).toBeCloseTo(1.0, 3);
  });
});
