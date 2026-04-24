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
  useCurrentPasses: () => ({ data: { passes: [{ id: "a" }] } }),
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
