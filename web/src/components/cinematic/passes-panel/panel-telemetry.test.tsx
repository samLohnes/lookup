import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { PanelTelemetry } from "./panel-telemetry";
import { renderWithProviders } from "@/test/render";

vi.mock("@/hooks/use-track-at-cursor", () => ({
  useTrackAtCursor: vi.fn(),
}));
import { useTrackAtCursor } from "@/hooks/use-track-at-cursor";

describe("PanelTelemetry", () => {
  it("renders 6 cells when sample is present", () => {
    (useTrackAtCursor as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sample: {
        time: "2026-04-25T03:25:00Z",
        lat: 40, lng: -74, alt_km: 412, az: 142, el: 56,
        range_km: 478, velocity_km_s: 7.68, magnitude: -2.1,
        sunlit: true, observer_dark: true,
      },
      isLoading: false,
    });
    renderWithProviders(<PanelTelemetry />);
    expect(screen.getByText("alt")).toBeInTheDocument();
    expect(screen.getByText("412 km")).toBeInTheDocument();
    expect(screen.getByText("el")).toBeInTheDocument();
    expect(screen.getByText("56°")).toBeInTheDocument();
    expect(screen.getByText("az")).toBeInTheDocument();
    expect(screen.getByText("142°")).toBeInTheDocument();
    expect(screen.getByText("range")).toBeInTheDocument();
    expect(screen.getByText("478 km")).toBeInTheDocument();
    expect(screen.getByText("velocity")).toBeInTheDocument();
    expect(screen.getByText("7.68 km/s")).toBeInTheDocument();
    expect(screen.getByText("mag")).toBeInTheDocument();
    expect(screen.getByText("−2.1")).toBeInTheDocument();
  });

  it("renders '—' in every value cell when sample is null", () => {
    (useTrackAtCursor as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sample: null,
      isLoading: false,
    });
    renderWithProviders(<PanelTelemetry />);
    const dashes = screen.getAllByText("—");
    expect(dashes).toHaveLength(6);
  });

  it("renders '—' for mag when sample.magnitude is null", () => {
    (useTrackAtCursor as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sample: {
        time: "2026-04-25T03:25:00Z",
        lat: 40, lng: -74, alt_km: 412, az: 142, el: 56,
        range_km: 478, velocity_km_s: 7.68, magnitude: null,
        sunlit: false, observer_dark: true,
      },
      isLoading: false,
    });
    renderWithProviders(<PanelTelemetry />);
    // Only the mag cell is dashed; alt/el/az/range/velocity render.
    const dashes = screen.getAllByText("—");
    expect(dashes).toHaveLength(1);
  });
});
