import { describe, expect, it } from "vitest";
import { MOTION, cssTransition } from "./motion";

describe("MOTION tokens", () => {
  it("exposes cinematic curve + duration tiers", () => {
    expect(MOTION.ease).toBe("cubic-bezier(0.22, 1, 0.36, 1)");
    expect(MOTION.fast).toBe(180);
    expect(MOTION.medium).toBe(220);
    expect(MOTION.slow).toBe(260);
    expect(MOTION.cinematic).toBe(300);
  });
});

describe("cssTransition", () => {
  it("composes a properly-formatted transition string (single property)", () => {
    expect(cssTransition("background", "fast")).toBe(
      "background 180ms cubic-bezier(0.22, 1, 0.36, 1)",
    );
  });

  it("defaults to fast duration when not specified", () => {
    expect(cssTransition("opacity")).toBe(
      "opacity 180ms cubic-bezier(0.22, 1, 0.36, 1)",
    );
  });

  it("supports custom duration keys", () => {
    expect(cssTransition("transform", "slow")).toBe(
      "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
    );
  });
});
