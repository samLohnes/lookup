import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { PassList } from "./pass-list";
import { renderWithProviders } from "@/test/render";
import { useSelectionStore } from "@/store/selection";
import type { PassResponse, TrainPassResponse } from "@/types/api";

const p = (id: string, peakAz: number, peakEl: number): PassResponse => ({
  kind: "single",
  id,
  norad_id: 25544,
  name: "ISS",
  rise: { time: "2026-04-25T03:22:04Z", azimuth_deg: 270, elevation_deg: 10, range_km: 1900 },
  peak: { time: "2026-04-25T03:25:10Z", azimuth_deg: peakAz, elevation_deg: peakEl, range_km: 450 },
  set: { time: "2026-04-25T03:28:16Z", azimuth_deg: 67.5, elevation_deg: 10, range_km: 1850 },
  duration_s: 372,
  max_magnitude: -2.1,
  sunlit_fraction: 1.0,
  tle_epoch: "2026-04-24T00:00:00Z",
  peak_angular_speed_deg_s: 0.74,
  naked_eye_visible: "yes",
});

vi.mock("@/hooks/use-current-passes", () => ({
  useCurrentPasses: vi.fn(),
}));
import { useCurrentPasses } from "@/hooks/use-current-passes";

describe("PassList", () => {
  beforeEach(() => {
    useSelectionStore.setState({ selectedPassId: null });
  });

  it("renders 'No passes tonight' when the list is empty", () => {
    (useCurrentPasses as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { passes: [] },
    });
    renderWithProviders(<PassList />);
    expect(screen.getByText(/No passes tonight/i)).toBeInTheDocument();
  });

  it("renders one PassRow per pass", () => {
    (useCurrentPasses as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { passes: [p("a", 180, 50), p("b", 90, 30), p("c", 270, 20)] },
    });
    renderWithProviders(<PassList />);
    // 3 header buttons when none expanded.
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("clicking a row expands it AND selects the pass globally", () => {
    (useCurrentPasses as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { passes: [p("a", 180, 50), p("b", 90, 30)] },
    });
    renderWithProviders(<PassList />);
    const rows = screen.getAllByRole("button");
    fireEvent.click(rows[0]);
    expect(useSelectionStore.getState().selectedPassId).toBe("a");
    expect(rows[0].getAttribute("aria-expanded")).toBe("true");
  });

  it("clicking a second row collapses the first and expands the second", () => {
    (useCurrentPasses as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { passes: [p("a", 180, 50), p("b", 90, 30)] },
    });
    renderWithProviders(<PassList />);
    const rows = screen.getAllByRole("button");
    fireEvent.click(rows[0]);
    fireEvent.click(rows[1]);
    expect(rows[0].getAttribute("aria-expanded")).toBe("false");
    expect(rows[1].getAttribute("aria-expanded")).toBe("true");
    expect(useSelectionStore.getState().selectedPassId).toBe("b");
  });

  it("renders train passes (kind === 'train') without crashing", () => {
    const trainPass: TrainPassResponse = {
      kind: "train",
      id: "train-20260426220000",
      name: "STARLINK train (5 objects)",
      member_norad_ids: [90001, 90002, 90003, 90004, 90005],
      rise: {
        time: "2026-04-26T22:00:00Z",
        azimuth_deg: 180,
        elevation_deg: 0,
        range_km: 1500,
      },
      peak: {
        time: "2026-04-26T22:04:00Z",
        azimuth_deg: 180,
        elevation_deg: 60,
        range_km: 500,
      },
      set: {
        time: "2026-04-26T22:08:00Z",
        azimuth_deg: 180,
        elevation_deg: 0,
        range_km: 1500,
      },
      duration_s: 480,
      max_magnitude: -1.0,
      member_count: 5,
    };
    (useCurrentPasses as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { passes: [trainPass] },
    });
    renderWithProviders(<PassList />);
    // Header button renders for the train pass — peak elevation shown in row.
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByText(/peaks 60°/)).toBeInTheDocument();
  });

  it("clicking an expanded row collapses it but keeps selection", () => {
    (useCurrentPasses as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { passes: [p("a", 180, 50)] },
    });
    renderWithProviders(<PassList />);
    const row = screen.getByRole("button");
    fireEvent.click(row);
    expect(row.getAttribute("aria-expanded")).toBe("true");
    expect(useSelectionStore.getState().selectedPassId).toBe("a");
    fireEvent.click(row);
    expect(row.getAttribute("aria-expanded")).toBe("false");
    // Selection persists across collapse.
    expect(useSelectionStore.getState().selectedPassId).toBe("a");
  });
});
