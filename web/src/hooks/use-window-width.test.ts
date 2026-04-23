import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useWindowWidth } from "./use-window-width";

describe("useWindowWidth", () => {
  it("returns the current window width", () => {
    const { result } = renderHook(() => useWindowWidth());
    expect(result.current).toBe(window.innerWidth);
  });

  it("updates on resize", () => {
    const { result } = renderHook(() => useWindowWidth());
    act(() => {
      Object.defineProperty(window, "innerWidth", {
        value: 500,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(500);
  });
});
