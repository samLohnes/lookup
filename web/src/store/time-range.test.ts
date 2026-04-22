import { describe, expect, it } from "vitest";
import { useTimeRangeStore } from "@/store/time-range";

describe("useTimeRangeStore", () => {
  it("applyPreset shifts to the given window in hours", () => {
    useTimeRangeStore.getState().applyPreset(168); // 7 days
    const s = useTimeRangeStore.getState();
    const span = new Date(s.toUtc).getTime() - new Date(s.fromUtc).getTime();
    // 168 h ± 1 second (for test execution time)
    expect(span).toBeGreaterThan(168 * 3600 * 1000 - 1000);
    expect(span).toBeLessThan(168 * 3600 * 1000 + 1000);
  });

  it("setMode updates mode", () => {
    useTimeRangeStore.getState().setMode("naked-eye");
    expect(useTimeRangeStore.getState().mode).toBe("naked-eye");
  });
});
