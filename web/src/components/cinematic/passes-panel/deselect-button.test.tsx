import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { DeselectButton } from "./deselect-button";
import { renderWithProviders } from "@/test/render";
import { useSelectionStore } from "@/store/selection";

describe("DeselectButton", () => {
  beforeEach(() => {
    useSelectionStore.setState({ selectedPassId: null });
  });

  afterEach(() => vi.clearAllMocks());

  it("is disabled when no pass is selected", () => {
    renderWithProviders(<DeselectButton />);
    const btn = screen.getByRole("button", { name: "Deselect pass" });
    expect(btn).toBeDisabled();
  });

  it("is enabled when a pass is selected", () => {
    useSelectionStore.setState({ selectedPassId: "iss-25544" });
    renderWithProviders(<DeselectButton />);
    const btn = screen.getByRole("button", { name: "Deselect pass" });
    expect(btn).not.toBeDisabled();
  });

  it("click deselects the current pass", () => {
    useSelectionStore.setState({ selectedPassId: "iss-25544" });
    renderWithProviders(<DeselectButton />);
    fireEvent.click(screen.getByRole("button", { name: "Deselect pass" }));
    expect(useSelectionStore.getState().selectedPassId).toBeNull();
  });
});
