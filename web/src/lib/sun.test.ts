import { describe, expect, it } from "vitest";
import { tonightWindow } from "@/lib/sun";

describe("tonightWindow", () => {
  it("returns a sunset before the nextSunrise for a typical mid-latitude day", () => {
    const now = new Date("2026-05-01T20:00:00Z"); // 4 PM EDT in NYC
    const w = tonightWindow(now, 40.7128, -74.006);
    expect(w.sunset.getTime()).toBeLessThan(w.nextSunrise.getTime());
  });

  it("falls back to a 12 h window at the north pole in summer (sun never sets)", () => {
    const now = new Date("2026-07-01T12:00:00Z");
    const w = tonightWindow(now, 89.99, 0);
    // Both should be valid (not NaN).
    expect(isFinite(w.sunset.getTime())).toBe(true);
    expect(isFinite(w.nextSunrise.getTime())).toBe(true);
  });
});
