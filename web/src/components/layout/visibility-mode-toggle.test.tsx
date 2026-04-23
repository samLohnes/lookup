import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VisibilityModeToggle } from "./visibility-mode-toggle";
import { useTimeRangeStore } from "@/store/time-range";

describe("VisibilityModeToggle", () => {
  beforeEach(() => {
    useTimeRangeStore.setState({ mode: "line-of-sight" } as never);
  });

  it("renders current mode label", () => {
    render(<VisibilityModeToggle />);
    expect(screen.getByRole("button", { name: /Line-of-sight/i })).toBeInTheDocument();
  });

  it("clicking a different mode switches the store", async () => {
    render(<VisibilityModeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /Line-of-sight/i }));
    const naked = await screen.findByRole("button", { name: /Naked-eye/i });
    fireEvent.click(naked);
    expect(useTimeRangeStore.getState().mode).toBe("naked-eye");
  });
});
