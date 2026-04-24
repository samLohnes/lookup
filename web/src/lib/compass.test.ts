import { describe, expect, it } from "vitest";
import { azimuthToCompass } from "./compass";

describe("azimuthToCompass", () => {
  it("maps cardinals correctly", () => {
    expect(azimuthToCompass(0)).toBe("N");
    expect(azimuthToCompass(90)).toBe("E");
    expect(azimuthToCompass(180)).toBe("S");
    expect(azimuthToCompass(270)).toBe("W");
  });

  it("maps intercardinals correctly", () => {
    expect(azimuthToCompass(45)).toBe("NE");
    expect(azimuthToCompass(135)).toBe("SE");
    expect(azimuthToCompass(225)).toBe("SW");
    expect(azimuthToCompass(315)).toBe("NW");
  });

  it("maps secondary intercardinals correctly", () => {
    expect(azimuthToCompass(22.5)).toBe("NNE");
    expect(azimuthToCompass(67.5)).toBe("ENE");
    expect(azimuthToCompass(112.5)).toBe("ESE");
    expect(azimuthToCompass(157.5)).toBe("SSE");
    expect(azimuthToCompass(202.5)).toBe("SSW");
    expect(azimuthToCompass(247.5)).toBe("WSW");
    expect(azimuthToCompass(292.5)).toBe("WNW");
    expect(azimuthToCompass(337.5)).toBe("NNW");
  });

  it("handles wraparound near 360", () => {
    expect(azimuthToCompass(359)).toBe("N");
    expect(azimuthToCompass(360)).toBe("N");
    expect(azimuthToCompass(361)).toBe("N"); // modulo-safe
  });

  it("handles values in the middle of each bin", () => {
    // 11.25° is the midpoint between N (0) and NNE (22.5), should round to N.
    expect(azimuthToCompass(10)).toBe("N");
    expect(azimuthToCompass(11.3)).toBe("NNE");
    expect(azimuthToCompass(34)).toBe("NE");
  });

  it("handles negative input via modulo", () => {
    expect(azimuthToCompass(-1)).toBe("N");
    expect(azimuthToCompass(-90)).toBe("W");
  });
});
