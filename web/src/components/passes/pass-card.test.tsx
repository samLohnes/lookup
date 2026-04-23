import { describe, expect, it, beforeEach } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { PassCard } from "@/components/passes/pass-card";
import { useSelectionStore } from "@/store/selection";
import type { PassResponse, TrainPassResponse } from "@/types/api";

const SINGLE: PassResponse = {
  kind: "single",
  id: "25544-20260501020000",
  norad_id: 25544,
  name: "ISS (ZARYA)",
  rise: { time: "2026-05-01T02:00:00Z", azimuth_deg: 30, elevation_deg: 0 },
  peak: { time: "2026-05-01T02:03:00Z", azimuth_deg: 180, elevation_deg: 60 },
  set: { time: "2026-05-01T02:06:00Z", azimuth_deg: 330, elevation_deg: 0 },
  duration_s: 360,
  max_magnitude: -2.5,
  sunlit_fraction: 1,
  tle_epoch: "2026-04-30T00:00:00Z",
};

const TRAIN: TrainPassResponse = {
  kind: "train",
  id: "train-20260501020000",
  name: "STARLINK train (4 objects)",
  member_norad_ids: [44713, 44714, 44715, 44716],
  rise: SINGLE.rise,
  peak: SINGLE.peak,
  set: SINGLE.set,
  duration_s: 360,
  max_magnitude: 4,
  member_count: 4,
};

describe("PassCard", () => {
  beforeEach(() => {
    useSelectionStore.setState({ selectedPassId: null });
  });

  it("renders satellite name, duration, peak az/el, and magnitude", () => {
    renderWithProviders(<PassCard pass={SINGLE} />);
    expect(screen.getByText("ISS (ZARYA)")).toBeInTheDocument();
    expect(screen.getByText("6m 00s")).toBeInTheDocument();
    expect(screen.getByText(/peak 60° · 180°/)).toBeInTheDocument();
    expect(screen.getByText(/mag -2\.5/)).toBeInTheDocument();
  });

  it("omits the magnitude line when max_magnitude is null", () => {
    renderWithProviders(<PassCard pass={{ ...SINGLE, max_magnitude: null }} />);
    expect(screen.queryByText(/mag/)).not.toBeInTheDocument();
  });

  it("shows the train member count for TrainPass", () => {
    renderWithProviders(<PassCard pass={TRAIN} />);
    expect(screen.getByText("4 objects")).toBeInTheDocument();
  });

  it("clicking sets the pass as selected in the store", async () => {
    renderWithProviders(<PassCard pass={SINGLE} />);
    await userEvent.click(screen.getByRole("button", { name: "ISS (ZARYA)" }));
    expect(useSelectionStore.getState().selectedPassId).toBe(SINGLE.id);
  });

  it("highlights when its id matches the store's selectedPassId", () => {
    useSelectionStore.setState({ selectedPassId: SINGLE.id });
    renderWithProviders(<PassCard pass={SINGLE} />);
    const button = screen.getByRole("button", { name: "ISS (ZARYA)" });
    // The selected variant has the satellite border color.
    expect(button.className).toContain("border-satellite");
  });
});
