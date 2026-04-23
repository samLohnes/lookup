import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { CinematicLayout } from "./cinematic-layout";
import { renderWithProviders } from "@/test/render";

// Stub heavy children — their behavior is tested in their own files.
vi.mock("@/components/earth-view/earth-view", () => ({
  EarthView: () => <div data-testid="earth-stub">EarthView</div>,
}));
vi.mock("@/components/cinematic/left-drawer", () => ({
  LeftDrawer: () => <div data-testid="left-drawer-stub">LeftDrawer</div>,
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
  it("composes earth + chrome + drawer + rail + dock + pip", async () => {
    renderWithProviders(<CinematicLayout />);
    // EarthView is lazy inside a Suspense; give it a tick to resolve.
    expect(await screen.findByTestId("earth-stub")).toBeInTheDocument();
    expect(screen.getByTestId("left-drawer-stub")).toBeInTheDocument();
    expect(screen.getByTestId("pass-rail-stub")).toBeInTheDocument();
    expect(screen.getByTestId("playback-dock-stub")).toBeInTheDocument();
    expect(screen.getByTestId("pip-stub")).toBeInTheDocument();
    // ChromeCluster renders at least the mode toggle.
    expect(screen.getByRole("button", { name: /Cinematic|Research/i })).toBeInTheDocument();
  });
});
