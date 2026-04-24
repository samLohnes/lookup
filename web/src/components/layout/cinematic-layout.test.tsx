import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { CinematicLayout } from "./cinematic-layout";
import { renderWithProviders } from "@/test/render";

// Stub heavy children — their behavior is tested in their own files.
vi.mock("@/components/earth-view/earth-view", () => ({
  EarthView: () => <div data-testid="earth-stub">EarthView</div>,
}));
vi.mock("@/components/cinematic/config-chips/config-chips", () => ({
  ConfigChips: () => <div data-testid="config-chips-stub">ConfigChips</div>,
}));
vi.mock("@/components/cinematic/pass-rail", () => ({
  PassRail: () => <div data-testid="pass-rail-stub">PassRail</div>,
}));
vi.mock("@/components/cinematic/playback-dock", () => ({
  PlaybackDock: () => <div data-testid="playback-dock-stub">PlaybackDock</div>,
}));
vi.mock("@/components/cinematic/pip-sky-view", () => ({
  PipSkyView: () => <div data-testid="pip-stub">PipSkyView</div>,
}));

describe("CinematicLayout", () => {
  it("composes earth + chrome + config chips + rail + dock + pip", async () => {
    renderWithProviders(<CinematicLayout />);
    expect(await screen.findByTestId("earth-stub")).toBeInTheDocument();
    expect(screen.getByTestId("config-chips-stub")).toBeInTheDocument();
    expect(screen.getByTestId("pass-rail-stub")).toBeInTheDocument();
    expect(screen.getByTestId("playback-dock-stub")).toBeInTheDocument();
    expect(screen.getByTestId("pip-stub")).toBeInTheDocument();
    // ChromeCluster still renders the mode toggle (right cluster).
    expect(
      screen.getByRole("button", { name: /Cinematic|Research/i }),
    ).toBeInTheDocument();
  });
});
