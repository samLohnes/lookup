import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { PlayButton } from "@/components/playback/play-button";
import { usePlaybackStore } from "@/store/playback";
import { useSelectionStore } from "@/store/selection";

beforeEach(() => {
  usePlaybackStore.setState({
    cursorUtc: null,
    isPlaying: false,
    speedMultiplier: 1,
  });
  useSelectionStore.setState({ selectedPassId: "p1" });
});

describe("PlayButton", () => {
  it("renders Play when paused, Pause when playing", () => {
    const { rerender } = renderWithProviders(<PlayButton />);
    expect(screen.getByRole("button")).toHaveTextContent(/Play/);
    usePlaybackStore.setState({ isPlaying: true });
    rerender(<PlayButton />);
    expect(screen.getByRole("button")).toHaveTextContent(/Pause/);
  });

  it("toggles isPlaying on click", async () => {
    renderWithProviders(<PlayButton />);
    await userEvent.click(screen.getByRole("button"));
    expect(usePlaybackStore.getState().isPlaying).toBe(true);
  });

  it("is disabled when no pass is selected", () => {
    useSelectionStore.setState({ selectedPassId: null });
    renderWithProviders(<PlayButton />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
