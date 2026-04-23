import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAppModeStore } from "./app-mode";

describe("app-mode store", () => {
  beforeEach(() => {
    localStorage.clear();
    useAppModeStore.setState({ mode: "cinematic" });
  });

  it("defaults to cinematic", () => {
    const { result } = renderHook(() => useAppModeStore());
    expect(result.current.mode).toBe("cinematic");
  });

  it("setMode updates the value", () => {
    const { result } = renderHook(() => useAppModeStore());
    act(() => result.current.setMode("research"));
    expect(result.current.mode).toBe("research");
  });

  it("persists to localStorage under key satvis.app-mode", () => {
    const { result } = renderHook(() => useAppModeStore());
    act(() => result.current.setMode("research"));
    const raw = localStorage.getItem("satvis.app-mode");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.mode).toBe("research");
  });
});
