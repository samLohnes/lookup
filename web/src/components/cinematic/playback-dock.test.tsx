import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { PlaybackDock } from "./playback-dock";
import { renderWithProviders } from "@/test/render";
import { useSelectionStore } from "@/store/selection";

vi.mock("@/components/playback/play-button", () => ({
  PlayButton: () => <button data-testid="play-button-stub">Play</button>,
}));
vi.mock("@/components/playback/scrub-bar", () => ({
  ScrubBar: () => <div data-testid="scrub-bar-stub">ScrubBar</div>,
}));
vi.mock("@/components/playback/speed-selector", () => ({
  SpeedSelector: () => <div data-testid="speed-selector-stub">Speed</div>,
}));

describe("PlaybackDock", () => {
  beforeEach(() => {
    useSelectionStore.setState({ selectedPassId: null });
  });

  it("returns null when no pass is selected", () => {
    const { container } = renderWithProviders(<PlaybackDock />);
    expect(container.firstChild).toBeNull();
  });

  it("renders play button + scrubber + speed selector when a pass is selected", () => {
    useSelectionStore.setState({ selectedPassId: "p1" });
    renderWithProviders(<PlaybackDock />);
    expect(screen.getByTestId("play-button-stub")).toBeInTheDocument();
    expect(screen.getByTestId("scrub-bar-stub")).toBeInTheDocument();
    expect(screen.getByTestId("speed-selector-stub")).toBeInTheDocument();
  });

  it("does NOT render inline telemetry (alt/el/mag)", () => {
    useSelectionStore.setState({ selectedPassId: "p1" });
    renderWithProviders(<PlaybackDock />);
    expect(screen.queryByText("alt")).not.toBeInTheDocument();
    expect(screen.queryByText("el")).not.toBeInTheDocument();
    expect(screen.queryByText("mag")).not.toBeInTheDocument();
  });
});
