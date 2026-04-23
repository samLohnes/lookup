import { describe, expect, it } from "vitest";
import { fromLocalInput, toLocalInput } from "@/lib/datetime";

describe("local <-> ISO round-trip", () => {
  it("round-trips a known UTC instant through local representation", () => {
    // Build a deterministic ISO that lands on a clean minute.
    const iso = new Date(2026, 4, 1, 21, 47, 0, 0).toISOString();
    const local = toLocalInput(iso);
    const back = fromLocalInput(local);
    // The minute is preserved exactly; seconds round-trip to 0 because
    // datetime-local has minute precision.
    expect(new Date(back).getTime()).toBe(new Date(iso).getTime());
  });

  it("toLocalInput produces YYYY-MM-DDTHH:mm format", () => {
    // Use Date constructor with local-tz fields so the output is
    // independent of the test runner's timezone.
    const d = new Date(2026, 4, 1, 9, 7); // local 09:07
    const out = toLocalInput(d.toISOString());
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(out).toBe("2026-05-01T09:07");
  });
});
