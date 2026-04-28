import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { PanelTelemetry } from "./panel-telemetry";
import { renderWithProviders } from "@/test/render";

vi.mock("@/hooks/use-track-at-cursor", () => ({
  useTrackAtCursor: vi.fn(),
}));
import { useTrackAtCursor } from "@/hooks/use-track-at-cursor";

vi.mock("@/store/live-position", () => ({
  useLivePositionStore: vi.fn(),
}));
import { useLivePositionStore } from "@/store/live-position";

describe("PanelTelemetry", () => {
  beforeEach(() => {
    (useLivePositionStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) =>
      selector({
        activeNorads: [],
        positions: new Map(),
        previousPositions: new Map(),
        trails: new Map(),
        lastPolledAt: null,
        setActive: vi.fn(),
        seedTrails: vi.fn(),
        applyPoll: vi.fn(),
        clear: vi.fn(),
      }),
    );
  });

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

  it("populates from the live store when no pass is selected and exactly one sat is active", () => {
    (useTrackAtCursor as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sample: null,
      isLoading: false,
    });
    const liveSample = {
      time: "2026-04-27T03:25:00Z",
      lat: 40, lng: -74, alt_km: 412, az: 142, el: 56,
      range_km: 478, velocity_km_s: 7.68, magnitude: -2.1,
      sunlit: true, observer_dark: true,
    };
    (useLivePositionStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) =>
      selector({
        activeNorads: [25544],
        positions: new Map([[25544, liveSample]]),
        previousPositions: new Map(),
        trails: new Map(),
        lastPolledAt: 1000,
        setActive: vi.fn(),
        seedTrails: vi.fn(),
        applyPoll: vi.fn(),
        clear: vi.fn(),
      }),
    );
    renderWithProviders(<PanelTelemetry />);
    expect(screen.getByText("412 km")).toBeInTheDocument();
    expect(screen.getByText("7.68 km/s")).toBeInTheDocument();
  });

  it("renders '—' cells when in group live mode (multiple active sats)", () => {
    (useTrackAtCursor as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sample: null,
      isLoading: false,
    });
    (useLivePositionStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) =>
      selector({
        activeNorads: [25544, 48274],
        positions: new Map(),
        previousPositions: new Map(),
        trails: new Map(),
        lastPolledAt: 1000,
        setActive: vi.fn(),
        seedTrails: vi.fn(),
        applyPoll: vi.fn(),
        clear: vi.fn(),
      }),
    );
    renderWithProviders(<PanelTelemetry />);
    const dashes = screen.getAllByText("—");
    expect(dashes).toHaveLength(6);
  });
});
