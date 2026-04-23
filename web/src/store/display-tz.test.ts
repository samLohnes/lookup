import { beforeEach, describe, expect, it } from "vitest";
import { useDisplayTzStore } from "@/store/display-tz";

describe("useDisplayTzStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useDisplayTzStore.setState({ mode: "client" });
  });

  it("defaults to client mode", () => {
    expect(useDisplayTzStore.getState().mode).toBe("client");
  });

  it("setMode changes the mode", () => {
    useDisplayTzStore.getState().setMode("observer");
    expect(useDisplayTzStore.getState().mode).toBe("observer");
  });

  it("persists the mode to localStorage", () => {
    useDisplayTzStore.getState().setMode("utc");
    const raw = localStorage.getItem("satvis.display-tz");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).state.mode).toBe("utc");
  });
});
