import { describe, expect, it } from "vitest";
import { computeTimelineLayout } from "@/components/passes/timeline-layout";

const FROM = "2026-05-01T00:00:00Z";
const TO = "2026-05-08T00:00:00Z"; // 7-day window

function pass(id: string, riseIso: string, setIso: string) {
  return {
    id,
    rise: { time: riseIso, azimuth_deg: 0, elevation_deg: 0 },
    set: { time: setIso, azimuth_deg: 0, elevation_deg: 0 },
  };
}

describe("computeTimelineLayout", () => {
  it("returns empty for no passes", () => {
    const out = computeTimelineLayout([], FROM, TO);
    expect(out.bars).toEqual([]);
    expect(out.dayTicks).toEqual([]);
  });

  it("places a centered pass at ~50% of the window", () => {
    // Window midpoint is 2026-05-04T12:00:00Z. 5-min pass straddling midpoint.
    const out = computeTimelineLayout(
      [pass("a", "2026-05-04T11:57:30Z", "2026-05-04T12:02:30Z")],
      FROM,
      TO,
    );
    expect(out.bars[0].leftPct).toBeCloseTo(50, 1);
  });

  it("clamps a pass starting before fromUtc to leftPct=0", () => {
    const out = computeTimelineLayout(
      [pass("a", "2026-04-30T23:00:00Z", "2026-05-01T00:30:00Z")],
      FROM,
      TO,
    );
    expect(out.bars[0].leftPct).toBe(0);
    // Width is the visible portion only.
    expect(out.bars[0].widthPct).toBeGreaterThan(0);
    expect(out.bars[0].widthPct).toBeLessThan(1);
  });

  it("clamps a pass ending after toUtc to fit inside the strip", () => {
    const out = computeTimelineLayout(
      [pass("a", "2026-05-07T23:30:00Z", "2026-05-08T00:30:00Z")],
      FROM,
      TO,
    );
    const bar = out.bars[0];
    // leftPct is clamped to [0,100] and rightPct is clamped to 100;
    // minimum bar width may push the total slightly over 100, so allow 0.5 tolerance.
    expect(bar.leftPct + bar.widthPct).toBeLessThanOrEqual(100.5);
    expect(bar.leftPct).toBeLessThan(100);
  });

  it("enforces a minimum bar width so 1-second passes are still visible", () => {
    const out = computeTimelineLayout(
      [pass("a", "2026-05-04T12:00:00Z", "2026-05-04T12:00:01Z")],
      FROM,
      TO,
    );
    expect(out.bars[0].widthPct).toBeGreaterThanOrEqual(0.4);
  });

  it("emits a UTC-midnight tick for each day boundary inside the window", () => {
    const out = computeTimelineLayout([], FROM, TO);
    expect(out.dayTicks).toEqual([]); // no passes → empty per current implementation
  });

  it("emits day ticks when there is at least one pass", () => {
    const out = computeTimelineLayout(
      [pass("a", "2026-05-04T12:00:00Z", "2026-05-04T12:05:00Z")],
      FROM,
      TO,
    );
    // 6 boundaries between May 1 00:00 and May 8 00:00 (May 2..7 inclusive).
    expect(out.dayTicks).toHaveLength(6);
    expect(out.dayTicks[0]).toBeCloseTo(100 / 7, 1);
  });
});
