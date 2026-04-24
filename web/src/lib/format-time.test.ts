import { describe, expect, it } from "vitest";
import {
  clientTimezone,
  formatDateTimeInTz,
  formatDurationShort,
  formatTimeInTz,
  formatWindowChip,
  resolveDisplayTimezone,
  tzOffsetMinutes,
} from "@/lib/format-time";

describe("clientTimezone", () => {
  it("returns a non-empty string", () => {
    const tz = clientTimezone();
    expect(tz).toBeTruthy();
    expect(typeof tz).toBe("string");
  });
});

describe("resolveDisplayTimezone", () => {
  it("returns UTC for mode=utc regardless of observer", () => {
    expect(resolveDisplayTimezone("utc", "America/New_York")).toBe("UTC");
    expect(resolveDisplayTimezone("utc", null)).toBe("UTC");
  });

  it("returns observer tz when mode=observer and observer is set", () => {
    expect(resolveDisplayTimezone("observer", "America/New_York")).toBe("America/New_York");
  });

  it("falls back to client tz when mode=observer and observer is null", () => {
    const fallback = resolveDisplayTimezone("observer", null);
    expect(fallback).toBe(clientTimezone());
  });

  it("returns client tz when mode=client", () => {
    expect(resolveDisplayTimezone("client", "America/Tokyo")).toBe(clientTimezone());
  });
});

describe("formatTimeInTz", () => {
  const ISO = "2026-05-01T14:00:00Z"; // 14:00 UTC

  it("formats in UTC when mode=utc", () => {
    const out = formatTimeInTz(ISO, "utc", null);
    // Should show 14:00 (or 2:00 PM) in UTC regardless of browser tz.
    expect(out).toMatch(/14|2:00/);
  });

  it("formats in the observer's tz when mode=observer", () => {
    const out = formatTimeInTz(ISO, "observer", "America/New_York");
    // NY is UTC-4 in May (EDT); should show 10:00 (or 10 AM).
    expect(out).toMatch(/10/);
  });

  it("falls back to client tz when observer tz is null", () => {
    const a = formatTimeInTz(ISO, "observer", null);
    const b = formatTimeInTz(ISO, "client", null);
    expect(a).toBe(b);
  });
});

describe("formatDateTimeInTz", () => {
  it("includes date and time parts", () => {
    const out = formatDateTimeInTz("2026-05-01T14:00:00Z", "utc", null);
    // Accept Mon, "May", or "05" depending on locale — just check both date-ish and time-ish parts present.
    expect(out).toMatch(/\d{2}/); // digits appear
    expect(out.length).toBeGreaterThan(6);
  });
});

describe("tzOffsetMinutes", () => {
  it("returns ~0 for identical timezones", () => {
    expect(tzOffsetMinutes("America/New_York", "America/New_York")).toBe(0);
  });

  it("returns positive when `a` is ahead of `b`", () => {
    // At any instant in 2026, Tokyo (UTC+9, no DST) is ahead of NY (UTC-5 or -4).
    const at = new Date("2026-05-01T00:00:00Z");
    const offset = tzOffsetMinutes("Asia/Tokyo", "America/New_York", at);
    // Tokyo vs NY in EDT: +9 - (-4) = +13h = +780 min
    expect(offset).toBe(13 * 60);
  });

  it("returns negative when `a` is behind `b`", () => {
    const at = new Date("2026-05-01T00:00:00Z");
    const offset = tzOffsetMinutes("America/Los_Angeles", "America/New_York", at);
    // LA is 3h behind NY → -180 min
    expect(offset).toBe(-3 * 60);
  });
});

describe("formatWindowChip", () => {
  it("returns 'Tonight Xp–Ya' for same-day short window ending before next noon", () => {
    // Fixed anchor: 2026-04-24 18:00 UTC -> 2026-04-25 06:00 UTC
    // In America/New_York (UTC-4), that is 2p -> 2a next day (< noon).
    const out = formatWindowChip(
      "2026-04-24T18:00:00Z",
      "2026-04-25T06:00:00Z",
      "client",
      "America/New_York",
    );
    expect(out).toMatch(/^Tonight /);
    expect(out).toContain("–");
  });

  it("returns 'Mon DD · Xp–Ya' for a multi-day window", () => {
    const out = formatWindowChip(
      "2026-04-24T18:00:00Z",
      "2026-04-27T06:00:00Z",
      "client",
      "America/New_York",
    );
    // Not "Tonight" — the end is more than one night out.
    expect(out).not.toMatch(/^Tonight /);
    // Has a month/day prefix.
    expect(out).toMatch(/Apr \d+/);
  });

  it("honors tzMode='utc'", () => {
    const out = formatWindowChip(
      "2026-04-24T18:00:00Z",
      "2026-04-25T06:00:00Z",
      "utc",
      "America/New_York",
    );
    // In UTC, 18:00 -> 6:00 next day; also fits the "Tonight" rule
      // because it starts today-UTC and ends before noon UTC next day.
    expect(out).toMatch(/^Tonight /);
  });
});

describe("formatDurationShort", () => {
  it("formats minutes and seconds", () => {
    expect(formatDurationShort(372)).toBe("6m 12s");
  });

  it("formats under a minute", () => {
    expect(formatDurationShort(45)).toBe("0m 45s");
  });

  it("formats zero as 0m 0s", () => {
    expect(formatDurationShort(0)).toBe("0m 0s");
  });
});
