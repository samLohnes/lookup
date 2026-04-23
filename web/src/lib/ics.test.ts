import { describe, expect, it } from "vitest";
import { formatPassAsIcs } from "@/lib/ics";
import type { PassResponse } from "@/types/api";

const PASS: PassResponse = {
  kind: "single",
  id: "25544-20260501020000",
  norad_id: 25544,
  name: "ISS (ZARYA)",
  rise: { time: "2026-05-01T02:00:00Z", azimuth_deg: 90, elevation_deg: 0 },
  peak: { time: "2026-05-01T02:03:00Z", azimuth_deg: 180, elevation_deg: 60 },
  set: { time: "2026-05-01T02:06:00Z", azimuth_deg: 270, elevation_deg: 0 },
  duration_s: 360,
  max_magnitude: -2.5,
  sunlit_fraction: 1,
  tle_epoch: "2026-04-30T00:00:00Z",
};

describe("formatPassAsIcs", () => {
  it("includes BEGIN/END VCALENDAR + VEVENT envelope", () => {
    const ics = formatPassAsIcs(PASS, { observerName: "Brooklyn" });
    expect(ics).toMatch(/^BEGIN:VCALENDAR/);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toMatch(/END:VCALENDAR\s*$/);
  });

  it("encodes DTSTART/DTEND in basic UTC format (YYYYMMDDTHHMMSSZ)", () => {
    const ics = formatPassAsIcs(PASS, { observerName: "Brooklyn" });
    expect(ics).toContain("DTSTART:20260501T020000Z");
    expect(ics).toContain("DTEND:20260501T020600Z");
  });

  it("uses the satellite name in SUMMARY", () => {
    const ics = formatPassAsIcs(PASS, { observerName: "Brooklyn" });
    expect(ics).toMatch(/SUMMARY:ISS \(ZARYA\) pass/);
  });

  it("uses observer name in LOCATION", () => {
    const ics = formatPassAsIcs(PASS, { observerName: "Brooklyn" });
    expect(ics).toContain("LOCATION:Brooklyn");
  });

  it("includes peak az/el and magnitude in DESCRIPTION", () => {
    const ics = formatPassAsIcs(PASS, { observerName: "Brooklyn" });
    expect(ics).toMatch(/peak 60° at azimuth 180°/);
    expect(ics).toMatch(/magnitude -2\.5/);
  });

  it("UID is stable for the same pass", () => {
    const a = formatPassAsIcs(PASS, { observerName: "Brooklyn" });
    const b = formatPassAsIcs(PASS, { observerName: "Brooklyn" });
    const uidA = a.match(/UID:(.+)/)?.[1];
    const uidB = b.match(/UID:(.+)/)?.[1];
    expect(uidA).toBe(uidB);
  });
});
