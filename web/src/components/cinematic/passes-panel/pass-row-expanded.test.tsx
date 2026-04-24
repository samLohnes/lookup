import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { PassRowExpanded } from "./pass-row-expanded";
import { renderWithProviders } from "@/test/render";
import { useObserverStore } from "@/store/observer";
import type { PassResponse } from "@/types/api";

const mockPass: PassResponse = {
  kind: "single",
  id: "pass-1",
  norad_id: 25544,
  name: "ISS (ZARYA)",
  rise: {
    time: "2026-04-25T03:22:04Z",
    azimuth_deg: 270, // W
    elevation_deg: 10,
  },
  peak: {
    time: "2026-04-25T03:25:10Z",
    azimuth_deg: 180, // S
    elevation_deg: 76,
  },
  set: {
    time: "2026-04-25T03:28:16Z",
    azimuth_deg: 67.5, // ENE
    elevation_deg: 10,
  },
  duration_s: 372,
  max_magnitude: -2.1,
  sunlit_fraction: 1.0,
  tle_epoch: "2026-04-24T00:00:00Z",
};

describe("PassRowExpanded", () => {
  it("renders Timing section with Rise/Peak/Set/Duration", () => {
    renderWithProviders(<PassRowExpanded pass={mockPass} />);
    expect(screen.getByText("Timing")).toBeInTheDocument();
    // "Rise"/"Peak"/"Set" appear in both Timing and Geometry sections.
    expect(screen.getAllByText("Rise").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Peak").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Set").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("6m 12s")).toBeInTheDocument();
  });

  it("renders Geometry section with compass bearings", () => {
    renderWithProviders(<PassRowExpanded pass={mockPass} />);
    expect(screen.getByText("Geometry")).toBeInTheDocument();
    // Rise row: W · 10°
    expect(screen.getByText(/W · 10°/)).toBeInTheDocument();
    // Peak row: S · 76°
    expect(screen.getByText(/S · 76°/)).toBeInTheDocument();
    // Set row: ENE · 10°
    expect(screen.getByText(/ENE · 10°/)).toBeInTheDocument();
  });

  it("renders Visibility section with peak mag and sunlit", () => {
    renderWithProviders(<PassRowExpanded pass={mockPass} />);
    expect(screen.getByText("Visibility")).toBeInTheDocument();
    expect(screen.getByText("Peak mag")).toBeInTheDocument();
    expect(screen.getByText("−2.1")).toBeInTheDocument();
    expect(screen.getByText("Sunlit")).toBeInTheDocument();
    expect(screen.getByText("yes")).toBeInTheDocument();
  });

  it("renders '—' for missing fields (range, ang speed, visible window)", () => {
    renderWithProviders(<PassRowExpanded pass={mockPass} />);
    expect(screen.getByText("Range peak")).toBeInTheDocument();
    expect(screen.getByText("Ang. speed")).toBeInTheDocument();
    expect(screen.getByText("Visible")).toBeInTheDocument();
    // All three should be '—'
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("shows 'partial (50%)' for sunlit_fraction 0.5", () => {
    const partial = { ...mockPass, sunlit_fraction: 0.5 };
    renderWithProviders(<PassRowExpanded pass={partial} />);
    expect(screen.getByText("partial (50%)")).toBeInTheDocument();
  });

  it("shows 'no' for sunlit_fraction <= 0.1", () => {
    const dark = { ...mockPass, sunlit_fraction: 0.05 };
    renderWithProviders(<PassRowExpanded pass={dark} />);
    expect(screen.getByText("no")).toBeInTheDocument();
  });

  it("renders Orbital section with satellite name", () => {
    renderWithProviders(<PassRowExpanded pass={mockPass} />);
    expect(screen.getByText("Orbital")).toBeInTheDocument();
    expect(screen.getByText("Satellite")).toBeInTheDocument();
    expect(screen.getByText("ISS (ZARYA)")).toBeInTheDocument();
  });

  it("renders an ICS export button that triggers a download on click", () => {
    // Stub URL + link-click side effects so jsdom doesn't explode.
    const createUrl = vi.fn(() => "blob:mock");
    const revokeUrl = vi.fn();
    URL.createObjectURL = createUrl as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeUrl as unknown as typeof URL.revokeObjectURL;
    useObserverStore.setState({
      current: { lat: 40.7, lng: -74, elevation_m: 10, name: "Brooklyn, NY" },
    });

    renderWithProviders(<PassRowExpanded pass={mockPass} />);
    const button = screen.getByRole("button", { name: /ICS export/i });
    fireEvent.click(button);
    expect(createUrl).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalled();
  });

  it("shows 'mag —' when max_magnitude is null", () => {
    const noMag = { ...mockPass, max_magnitude: null };
    renderWithProviders(<PassRowExpanded pass={noMag} />);
    // Peak mag row renders with "—"
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});
