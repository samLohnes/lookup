import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { PlaybackDock } from "./playback-dock";
import { renderWithProviders } from "@/test/render";
import { useSelectionStore } from "@/store/selection";

// Stub heavy playback children to keep this test focused.
vi.mock("@/components/playback/play-button", () => ({
  PlayButton: () => <button type="button">▶</button>,
}));
vi.mock("@/components/playback/scrub-bar", () => ({
  ScrubBar: () => <div data-testid="scrub-stub" />,
}));
vi.mock("@/components/playback/speed-selector", () => ({
  SpeedSelector: () => <div data-testid="speed-stub" />,
}));

describe("PlaybackDock", () => {
  beforeEach(() => {
    useSelectionStore.setState({ selectedPassId: null });
  });

  it("renders nothing when no pass is selected", () => {
    const { container } = renderWithProviders(<PlaybackDock />);
    expect(container.firstChild).toBeNull();
  });

  it("renders play + scrub + speed when a pass is selected", () => {
    useSelectionStore.setState({ selectedPassId: "1" });
    renderWithProviders(<PlaybackDock />);
    expect(screen.getByRole("button", { name: "▶" })).toBeInTheDocument();
    expect(screen.getByTestId("scrub-stub")).toBeInTheDocument();
    expect(screen.getByTestId("speed-stub")).toBeInTheDocument();
  });
});
