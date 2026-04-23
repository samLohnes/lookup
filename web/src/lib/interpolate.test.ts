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
