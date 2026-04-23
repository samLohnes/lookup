import { beforeEach, describe, expect, it } from "vitest";
import { useSelectionStore } from "@/store/selection";

describe("useSelectionStore", () => {
  beforeEach(() => {
    useSelectionStore.setState({ selectedPassId: null });
  });

  it("select sets the pass id", () => {
    useSelectionStore.getState().select("25544-20260501020000");
    expect(useSelectionStore.getState().selectedPassId).toBe(
      "25544-20260501020000",
    );
  });

  it("select(null) clears the selection", () => {
    useSelectionStore.setState({ selectedPassId: "x" });
    useSelectionStore.getState().select(null);
    expect(useSelectionStore.getState().selectedPassId).toBeNull();
  });
});
