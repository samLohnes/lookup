import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { PassesPanel } from "./passes-panel";
import { renderWithProviders } from "@/test/render";
import { useSelectionStore } from "@/store/selection";

vi.mock("./pass-list", () => ({
  PassList: () => <div data-testid="pass-list-stub">PassList</div>,
}));
vi.mock("./panel-sky-view", () => ({
  PanelSkyView: () => <div data-testid="panel-sky-view-stub">PanelSkyView</div>,
}));
vi.mock("./panel-telemetry", () => ({
  PanelTelemetry: () => <div data-testid="panel-telemetry-stub">PanelTelemetry</div>,
}));
vi.mock("@/hooks/use-current-passes", () => ({
  useCurrentPasses: () => ({
    data: {
      passes: [
        {
          kind: "single",
          id: "a",
          norad_id: 25544,
          name: "ISS",
          rise: {
            time: "2026-04-27T03:25:00Z",
            azimuth_deg: 0,
            elevation_deg: 0,
            range_km: 1000,
          },
          peak: {
            time: "2026-04-27T03:30:00Z",
            azimuth_deg: 90,
            elevation_deg: 45,
            range_km: 500,
          },
          set: {
            time: "2026-04-27T03:35:00Z",
            azimuth_deg: 180,
            elevation_deg: 0,
            range_km: 1000,
          },
          duration_s: 600,
          max_magnitude: -2,
          sunlit_fraction: 1,
          tle_epoch: "2026-04-27T00:00:00Z",
          peak_angular_speed_deg_s: 1,
          naked_eye_visible: "yes",
        },
      ],
    },
  }),
}));

describe("PassesPanel", () => {
  beforeEach(() => {
    useSelectionStore.setState({ selectedPassId: null });
  });

  it("renders header + pass list always", () => {
    renderWithProviders(<PassesPanel />);
    expect(screen.getByText(/Passes/i)).toBeInTheDocument();
    expect(screen.getByText(/1 tonight/i)).toBeInTheDocument();
    expect(screen.getByTestId("pass-list-stub")).toBeInTheDocument();
  });

  it("does NOT render sky view + telemetry when no pass selected", () => {
    renderWithProviders(<PassesPanel />);
    expect(screen.queryByTestId("panel-sky-view-stub")).not.toBeInTheDocument();
    expect(screen.queryByTestId("panel-telemetry-stub")).not.toBeInTheDocument();
  });

  it("renders sky view + telemetry when a pass is selected", () => {
    useSelectionStore.setState({ selectedPassId: "a" });
    renderWithProviders(<PassesPanel />);
    expect(screen.getByTestId("panel-sky-view-stub")).toBeInTheDocument();
    expect(screen.getByTestId("panel-telemetry-stub")).toBeInTheDocument();
  });
});
