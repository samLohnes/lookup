import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePipSkyStore } from "./pip-sky";

describe("pip-sky store", () => {
  beforeEach(() => {
    usePipSkyStore.setState({
      isOpen: false,
      position: { x: 100, y: 100 },
      size: { width: 300, height: 300 },
    });
  });

  it("open sets isOpen true", () => {
    const { result } = renderHook(() => usePipSkyStore());
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
  });

  it("close sets isOpen false but preserves position and size", () => {
    const { result } = renderHook(() => usePipSkyStore());
    act(() => result.current.open());
    act(() => result.current.setPosition({ x: 500, y: 400 }));
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.position).toEqual({ x: 500, y: 400 });
  });

  it("setSize locks aspect ratio to 1:1", () => {
    const { result } = renderHook(() => usePipSkyStore());
    act(() => result.current.setSize({ width: 400, height: 250 }));
    expect(result.current.size.width).toBe(400);
    expect(result.current.size.height).toBe(400);
  });

  it("setSize clamps to min 200px", () => {
    const { result } = renderHook(() => usePipSkyStore());
    act(() => result.current.setSize({ width: 50, height: 50 }));
    expect(result.current.size.width).toBe(200);
    expect(result.current.size.height).toBe(200);
  });
});
