import { describe, expect, it } from "vitest";
import { interpolateAtCursor } from "@/lib/interpolate";
import { ARC_SAMPLES, trackSample } from "@/test/fixtures/track-samples";

describe("interpolateAtCursor", () => {
  it("returns null for empty samples", () => {
    expect(interpolateAtCursor([], "2026-05-01T02:00:00Z")).toBeNull();
  });

  it("returns null when cursor is before the first sample", () => {
    expect(interpolateAtCursor(ARC_SAMPLES, "2026-05-01T01:00:00Z")).toBeNull();
  });

  it("returns null when cursor is after the last sample", () => {
    expect(interpolateAtCursor(ARC_SAMPLES, "2026-05-01T03:00:00Z")).toBeNull();
  });

  it("returns the exact sample when cursor matches a sample timestamp", () => {
    const out = interpolateAtCursor(ARC_SAMPLES, "2026-05-01T02:03:00Z");
    expect(out?.az).toBeCloseTo(180, 5);
    expect(out?.el).toBeCloseTo(60, 5);
  });

  it("linearly interpolates az/el/range halfway between two samples", () => {
    // Halfway between sample[0] (02:00, az=90, el=5) and sample[1] (02:01:30, az=135, el=30).
    // 02:00:45 is exactly halfway.
    const out = interpolateAtCursor(ARC_SAMPLES, "2026-05-01T02:00:45Z");
    expect(out?.az).toBeCloseTo(112.5, 1);
    expect(out?.el).toBeCloseTo(17.5, 1);
    expect(out?.range_km).toBeCloseTo(550, 1);
  });

  it("snaps boolean fields to the earlier sample", () => {
    const samples = [
      trackSample({ time: "2026-05-01T02:00:00Z", sunlit: false, observer_dark: false }),
      trackSample({ time: "2026-05-01T02:01:00Z", sunlit: true, observer_dark: true }),
    ];
    const out = interpolateAtCursor(samples, "2026-05-01T02:00:30Z");
    expect(out?.sunlit).toBe(false);
    expect(out?.observer_dark).toBe(false);
  });

  it("interpolates magnitude when both endpoints have it", () => {
    const samples = [
      trackSample({ time: "2026-05-01T02:00:00Z", magnitude: -1 }),
      trackSample({ time: "2026-05-01T02:01:00Z", magnitude: -3 }),
    ];
    const out = interpolateAtCursor(samples, "2026-05-01T02:00:30Z");
    expect(out?.magnitude).toBeCloseTo(-2, 1);
  });

  it("returns null magnitude if either endpoint is null (mode is line-of-sight)", () => {
    const samples = [
      trackSample({ time: "2026-05-01T02:00:00Z", magnitude: null }),
      trackSample({ time: "2026-05-01T02:01:00Z", magnitude: -2 }),
    ];
    const out = interpolateAtCursor(samples, "2026-05-01T02:00:30Z");
    expect(out?.magnitude).toBeNull();
  });

  it("sets the time field on the result to the cursor", () => {
    const out = interpolateAtCursor(ARC_SAMPLES, "2026-05-01T02:00:45Z");
    expect(out?.time).toBe("2026-05-01T02:00:45Z");
  });
});

describe("interpolateAtCursor — azimuth wrap at north", () => {
  it("interpolates 358° → 2° through 0°, not through 180°", () => {
    // Two samples 60 seconds apart. Cursor at the midpoint.
    const samples = [
      {
        time: "2026-04-25T00:00:00Z",
        lat: 40, lng: -74, alt_km: 400, az: 358, el: 10,
        range_km: 500, velocity_km_s: 7.68, magnitude: null,
        sunlit: true, observer_dark: true,
      },
      {
        time: "2026-04-25T00:01:00Z",
        lat: 40, lng: -74, alt_km: 400, az: 2, el: 10,
        range_km: 500, velocity_km_s: 7.68, magnitude: null,
        sunlit: true, observer_dark: true,
      },
    ];
    const out = interpolateAtCursor(samples, "2026-04-25T00:00:30Z");
    expect(out).not.toBeNull();
    // Midpoint of 358° → 2° going through north is 0° (or 360°, same point).
    // Must NOT be 180° (lerp-through-south bug).
    expect(out!.az).toBeCloseTo(0, 5);
  });

  it("interpolates 10° → 350° through 0° backward", () => {
    // Satellite moving westward across north: az decreases from 10 → 350.
    const samples = [
      {
        time: "2026-04-25T00:00:00Z",
        lat: 40, lng: -74, alt_km: 400, az: 10, el: 10,
        range_km: 500, velocity_km_s: 7.68, magnitude: null,
        sunlit: true, observer_dark: true,
      },
      {
        time: "2026-04-25T00:01:00Z",
        lat: 40, lng: -74, alt_km: 400, az: 350, el: 10,
        range_km: 500, velocity_km_s: 7.68, magnitude: null,
        sunlit: true, observer_dark: true,
      },
    ];
    const out = interpolateAtCursor(samples, "2026-04-25T00:00:30Z");
    expect(out).not.toBeNull();
    // Midpoint should be 0° (via the short path), NOT 180° (via south).
    expect(out!.az).toBeCloseTo(0, 5);
  });

  it("interpolates normal range 100° → 110° linearly (no wrap)", () => {
    // Sanity check: midpoint of 100 → 110 is 105, no wrap logic should trigger.
    const samples = [
      {
        time: "2026-04-25T00:00:00Z",
        lat: 40, lng: -74, alt_km: 400, az: 100, el: 45,
        range_km: 500, velocity_km_s: 7.68, magnitude: null,
        sunlit: true, observer_dark: true,
      },
      {
        time: "2026-04-25T00:01:00Z",
        lat: 40, lng: -74, alt_km: 400, az: 110, el: 45,
        range_km: 500, velocity_km_s: 7.68, magnitude: null,
        sunlit: true, observer_dark: true,
      },
    ];
    const out = interpolateAtCursor(samples, "2026-04-25T00:00:30Z");
    expect(out).not.toBeNull();
    expect(out!.az).toBeCloseTo(105, 5);
  });

  it("normalizes result to [0, 360) after wrap", () => {
    // a=350, b=10, diff+=360 → 20, result at t=0.75 = 350 + 20*0.75 = 365.
    // Normalize: 365 % 360 = 5.
    const samples = [
      {
        time: "2026-04-25T00:00:00Z",
        lat: 40, lng: -74, alt_km: 400, az: 350, el: 10,
        range_km: 500, velocity_km_s: 7.68, magnitude: null,
        sunlit: true, observer_dark: true,
      },
      {
        time: "2026-04-25T00:01:00Z",
        lat: 40, lng: -74, alt_km: 400, az: 10, el: 10,
        range_km: 500, velocity_km_s: 7.68, magnitude: null,
        sunlit: true, observer_dark: true,
      },
    ];
    // Cursor at 45s of a 60s span = t = 0.75.
    const out = interpolateAtCursor(samples, "2026-04-25T00:00:45Z");
    expect(out).not.toBeNull();
    expect(out!.az).toBeCloseTo(5, 5);
    expect(out!.az).toBeGreaterThanOrEqual(0);
    expect(out!.az).toBeLessThan(360);
  });
});
