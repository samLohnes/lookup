import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePageVisibility } from "./use-page-visibility";

describe("usePageVisibility", () => {
  let visibilityValue = false;

  beforeEach(() => {
    visibilityValue = false;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => visibilityValue,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when document.hidden is false", () => {
    visibilityValue = false;
    const { result } = renderHook(() => usePageVisibility());
    expect(result.current).toBe(true);
  });

  it("returns false when document.hidden is true", () => {
    visibilityValue = true;
    const { result } = renderHook(() => usePageVisibility());
    expect(result.current).toBe(false);
  });

  it("flips on visibilitychange event", () => {
    visibilityValue = false;
    const { result } = renderHook(() => usePageVisibility());
    expect(result.current).toBe(true);

    act(() => {
      visibilityValue = true;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe(false);

    act(() => {
      visibilityValue = false;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe(true);
  });
});
