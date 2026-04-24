import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { VisibilityChip } from "./visibility-chip";
import { renderWithProviders } from "@/test/render";
import { useTimeRangeStore } from "@/store/time-range";

describe("VisibilityChip", () => {
  beforeEach(() => {
    useTimeRangeStore.setState({
      fromUtc: "2026-04-24T18:00:00Z",
      toUtc: "2026-04-25T06:00:00Z",
      mode: "line-of-sight",
    });
  });

  it("renders label VISIBILITY and the current mode value", () => {
    renderWithProviders(<VisibilityChip />);
    expect(screen.getByText("VISIBILITY")).toBeInTheDocument();
    expect(screen.getByText("Line-of-sight")).toBeInTheDocument();
  });

  it("click flips between line-of-sight and naked-eye", () => {
    renderWithProviders(<VisibilityChip />);
    const button = screen.getByRole("button", { name: /Visibility/i });
    fireEvent.click(button);
    expect(useTimeRangeStore.getState().mode).toBe("naked-eye");
    expect(screen.getByText("Naked-eye")).toBeInTheDocument();
    fireEvent.click(button);
    expect(useTimeRangeStore.getState().mode).toBe("line-of-sight");
  });

  it("never renders a dirty dot", () => {
    const { container } = renderWithProviders(<VisibilityChip />);
    expect(container.querySelector("[data-testid='chip-dirty-dot']")).not.toBeInTheDocument();
  });

  it("Cmd-V flips visibility mode", () => {
    renderWithProviders(<VisibilityChip />);
    fireEvent.keyDown(window, { key: "v", metaKey: true });
    expect(useTimeRangeStore.getState().mode).toBe("naked-eye");
  });

  it("Cmd-V is ignored when focus is in an input", () => {
    renderWithProviders(
      <>
        <VisibilityChip />
        <input data-testid="probe" />
      </>,
    );
    const probe = screen.getByTestId("probe");
    probe.focus();
    fireEvent.keyDown(probe, { key: "v", metaKey: true });
    expect(useTimeRangeStore.getState().mode).toBe("line-of-sight");
  });
});
