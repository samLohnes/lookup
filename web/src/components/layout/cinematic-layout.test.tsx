import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { CinematicLayout } from "./cinematic-layout";
import { renderWithProviders } from "@/test/render";

vi.mock("@/components/earth-view/earth-view", () => ({
  EarthView: () => <div data-testid="earth-stub">EarthView</div>,
}));
vi.mock("@/components/cinematic/config-chips/config-chips", () => ({
  ConfigChips: () => <div data-testid="config-chips-stub">ConfigChips</div>,
}));
vi.mock("@/components/cinematic/passes-panel/passes-panel", () => ({
  PassesPanel: () => <div data-testid="passes-panel-stub">PassesPanel</div>,
}));
vi.mock("@/components/cinematic/playback-dock", () => ({
  PlaybackDock: () => <div data-testid="playback-dock-stub">PlaybackDock</div>,
}));

describe("CinematicLayout", () => {
  it("composes earth + chrome + config chips + passes panel + dock", async () => {
    renderWithProviders(<CinematicLayout />);
    expect(await screen.findByTestId("earth-stub")).toBeInTheDocument();
    expect(screen.getByTestId("config-chips-stub")).toBeInTheDocument();
    expect(screen.getByTestId("passes-panel-stub")).toBeInTheDocument();
    expect(screen.getByTestId("playback-dock-stub")).toBeInTheDocument();
    // ChromeCluster still renders the mode toggle (right cluster).
    expect(
      screen.getByRole("button", { name: /Cinematic|Research/i }),
    ).toBeInTheDocument();
  });
});
