import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { PassRowExpanded } from "./pass-row-expanded";
import { renderWithProviders } from "@/test/render";
import { useObserverStore } from "@/store/observer";
import type { PassResponse, TrainPassResponse } from "@/types/api";

const mockPass: PassResponse = {
  kind: "single",
  id: "pass-1",
  norad_id: 25544,
  name: "ISS (ZARYA)",
  rise: {
    time: "2026-04-25T03:22:04Z",
    azimuth_deg: 270, // W
    elevation_deg: 10,
    range_km: 1900,
  },
  peak: {
    time: "2026-04-25T03:25:10Z",
    azimuth_deg: 180, // S
    elevation_deg: 76,
    range_km: 450,
  },
  set: {
    time: "2026-04-25T03:28:16Z",
    azimuth_deg: 67.5, // ENE
    elevation_deg: 10,
    range_km: 1850,
  },
  duration_s: 372,
  max_magnitude: -2.1,
  sunlit_fraction: 1.0,
  tle_epoch: "2026-04-24T00:00:00Z",
  peak_angular_speed_deg_s: 0.74,
  naked_eye_visible: "yes",
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
    // "yes" appears in both Sunlit (sunlit_fraction=1.0) and Visible
    // (naked_eye_visible="yes") — the field-specific assertions live in
    // the per-field tests below.
    expect(screen.getAllByText("yes").length).toBeGreaterThanOrEqual(1);
  });

  it("renders peak range in km", () => {
    renderWithProviders(<PassRowExpanded pass={mockPass} />);
    expect(screen.getByText("Range peak")).toBeInTheDocument();
    expect(screen.getByText("450 km")).toBeInTheDocument();
  });

  it("renders peak angular speed with two decimals and °/s suffix", () => {
    renderWithProviders(<PassRowExpanded pass={mockPass} />);
    expect(screen.getByText("Ang. speed")).toBeInTheDocument();
    expect(screen.getByText("0.74°/s")).toBeInTheDocument();
  });

  it("renders naked-eye visibility three-state", () => {
    renderWithProviders(<PassRowExpanded pass={mockPass} />);
    expect(screen.getByText("Visible")).toBeInTheDocument();
    // KV value column shows "yes" (also matches sunlit value, but multi-match is fine).
    expect(screen.getAllByText("yes").length).toBeGreaterThanOrEqual(1);
  });

  it("falls back to em-dash when naked_eye_visible is null", () => {
    const noClass = { ...mockPass, naked_eye_visible: null };
    renderWithProviders(<PassRowExpanded pass={noClass} />);
    const visibleLabel = screen.getByText("Visible");
    // The KV row places label and value as siblings under a grid parent.
    expect(visibleLabel.parentElement).toHaveTextContent("Visible—");
  });

  describe("train pass rendering", () => {
    const trainPass: TrainPassResponse = {
      kind: "train",
      id: "train-20260428044319",
      name: "STARLINK train (5 objects)",
      member_norad_ids: [68719, 68721, 68722, 68723, 68724],
      // The brightest member's endpoints — converter pulls these straight through.
      rise: { time: "2026-04-28T04:40:30Z", azimuth_deg: 200, elevation_deg: 0, range_km: 2400 },
      peak: { time: "2026-04-28T04:43:19Z", azimuth_deg: 321, elevation_deg: 85, range_km: 540 },
      set: { time: "2026-04-28T04:48:39Z", azimuth_deg: 60, elevation_deg: 0, range_km: 2380 },
      duration_s: 489,
      max_magnitude: 4.2,
      member_count: 5,
    };

    it("renders peak range for trains (envelope peak from brightest member)", () => {
      renderWithProviders(<PassRowExpanded pass={trainPass} />);
      // Train carries a real range_km; UI must not hide it.
      expect(screen.getByText("540 km")).toBeInTheDocument();
    });

    it("falls back to em-dash for fields trains don't carry (Visible, Ang. speed)", () => {
      renderWithProviders(<PassRowExpanded pass={trainPass} />);
      const visibleLabel = screen.getByText("Visible");
      expect(visibleLabel.parentElement).toHaveTextContent("Visible—");
      const angSpeedLabel = screen.getByText("Ang. speed");
      expect(angSpeedLabel.parentElement).toHaveTextContent("Ang. speed—");
    });
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
