import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { PassRail } from "./pass-rail";
import { renderWithProviders } from "@/test/render";
import { useSelectionStore } from "@/store/selection";

vi.mock("@/hooks/use-current-passes", () => ({
  useCurrentPasses: () => ({
    data: [
      {
        kind: "single",
        id: "1",
        norad_id: 25544,
        name: "ISS",
        rise: { time: "2026-05-01T07:15:00Z", azimuth_deg: 45, elevation_deg: 0 },
        peak: { time: "2026-05-01T07:18:00Z", azimuth_deg: 120, elevation_deg: 16 },
        set: { time: "2026-05-01T07:21:00Z", azimuth_deg: 180, elevation_deg: 0 },
        duration_s: 342,
        max_magnitude: 2.1,
        sunlit_fraction: 0.8,
        tle_epoch: "2026-04-30T12:00:00Z",
      },
      {
        kind: "single",
        id: "2",
        norad_id: 25544,
        name: "ISS",
        rise: { time: "2026-05-01T08:52:00Z", azimuth_deg: 315, elevation_deg: 0 },
        peak: { time: "2026-05-01T08:55:00Z", azimuth_deg: 0, elevation_deg: 58 },
        set: { time: "2026-05-01T08:59:00Z", azimuth_deg: 135, elevation_deg: 0 },
        duration_s: 431,
        max_magnitude: 0.8,
        sunlit_fraction: 0.9,
        tle_epoch: "2026-04-30T12:00:00Z",
      },
    ],
    isFetching: false,
  }),
}));

describe("PassRail", () => {
  beforeEach(() => {
    useSelectionStore.setState({ selectedPassId: null });
  });

  it("renders one compact bar per pass in collapsed state", () => {
    renderWithProviders(<PassRail />);
    const bars = screen.getAllByRole("button");
    // 2 pass bars + 1 expand button (the rail has an expand handle)
    expect(bars.length).toBeGreaterThanOrEqual(3);
  });

  it("clicking a pass bar selects that pass", () => {
    renderWithProviders(<PassRail />);
    const bars = screen.getAllByRole("button");
    // First two buttons are pass bars (third is expand). Click the second.
    fireEvent.click(bars[1]);
    expect(useSelectionStore.getState().selectedPassId).toBe("2");
  });

  it("expand button widens the rail and exposes duration/magnitude", () => {
    renderWithProviders(<PassRail />);
    const expandBtn = screen.getByRole("button", { name: /expand/i });
    fireEvent.click(expandBtn);
    // Expanded rows show a numeric magnitude label — one per pass.
    expect(screen.getAllByText(/mag/i).length).toBeGreaterThan(0);
  });
});
