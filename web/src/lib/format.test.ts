import { describe, expect, it } from "vitest";
import { formatAge, formatDuration } from "@/lib/format";

describe("formatDuration", () => {
  it("formats short durations with leading zero on seconds", () => {
    expect(formatDuration(7)).toBe("0m 07s");
    expect(formatDuration(60)).toBe("1m 00s");
    expect(formatDuration(252)).toBe("4m 12s");
  });

  it("handles zero", () => {
    expect(formatDuration(0)).toBe("0m 00s");
  });

  it("handles long durations", () => {
    expect(formatDuration(3661)).toBe("61m 01s"); // 1h 1m 1s shown as minutes
  });
});

describe("formatAge", () => {
  it("uses seconds under 1 minute", () => {
    expect(formatAge(5)).toBe("5 s");
    expect(formatAge(59)).toBe("59 s");
  });
  it("uses minutes between 1 minute and 1 hour", () => {
    expect(formatAge(60)).toBe("1 min");
    expect(formatAge(3599)).toBe("59 min");
  });
  it("uses hours between 1 hour and 1 day", () => {
    expect(formatAge(3600)).toBe("1 h");
    expect(formatAge(86399)).toBe("23 h");
  });
  it("uses days for >= 1 day", () => {
    expect(formatAge(86400)).toBe("1 d");
    expect(formatAge(7 * 86400)).toBe("7 d");
  });
});
