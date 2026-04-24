import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { PassRow } from "./pass-row";
import { renderWithProviders } from "@/test/render";
import type { PassResponse } from "@/types/api";

const mockPass: PassResponse = {
  kind: "single",
  id: "pass-1",
  norad_id: 25544,
  name: "ISS",
  rise: { time: "2026-04-25T03:22:04Z", azimuth_deg: 270, elevation_deg: 10 }, // W
  peak: { time: "2026-04-25T03:25:10Z", azimuth_deg: 180, elevation_deg: 76 }, // S
  set: { time: "2026-04-25T03:28:16Z", azimuth_deg: 67.5, elevation_deg: 10 },
  duration_s: 372,
  max_magnitude: -2.1,
  sunlit_fraction: 1.0,
  tle_epoch: "2026-04-24T00:00:00Z",
};

describe("PassRow", () => {
  it("renders peak time and rise-direction summary (collapsed)", () => {
    renderWithProviders(
      <PassRow pass={mockPass} isExpanded={false} isSelected={false} onToggle={() => {}} />,
    );
    // Peak time — locale-dependent; match "AM" or "PM" presence
    expect(screen.getByText(/AM|PM/)).toBeInTheDocument();
    // Rise direction + peak elevation summary
    expect(screen.getByText(/rises W · peaks 76°/)).toBeInTheDocument();
  });

  it("calls onToggle with pass.id when clicked", () => {
    const onToggle = vi.fn();
    renderWithProviders(
      <PassRow pass={mockPass} isExpanded={false} isSelected={false} onToggle={onToggle} />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledWith("pass-1");
  });

  it("renders expanded accordion body when isExpanded=true", () => {
    renderWithProviders(
      <PassRow pass={mockPass} isExpanded={true} isSelected={true} onToggle={() => {}} />,
    );
    // Expanded body shows section labels
    expect(screen.getByText("Timing")).toBeInTheDocument();
    expect(screen.getByText("Geometry")).toBeInTheDocument();
  });

  it("does NOT render expanded body when isExpanded=false", () => {
    renderWithProviders(
      <PassRow pass={mockPass} isExpanded={false} isSelected={false} onToggle={() => {}} />,
    );
    expect(screen.queryByText("Timing")).not.toBeInTheDocument();
  });

  it("applies selected styling when isSelected=true", () => {
    renderWithProviders(
      <PassRow pass={mockPass} isExpanded={false} isSelected={true} onToggle={() => {}} />,
    );
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/accent-400\/45/);
  });

  it("has aria-expanded reflecting isExpanded", () => {
    const { rerender } = renderWithProviders(
      <PassRow pass={mockPass} isExpanded={false} isSelected={false} onToggle={() => {}} />,
    );
    expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe("false");
    rerender(
      <PassRow pass={mockPass} isExpanded={true} isSelected={true} onToggle={() => {}} />,
    );
    // When expanded, PassRowExpanded renders its own ICS button inside this row,
    // so there are two buttons — the outer row button is the first one.
    expect(screen.getAllByRole("button")[0].getAttribute("aria-expanded")).toBe("true");
  });
});
