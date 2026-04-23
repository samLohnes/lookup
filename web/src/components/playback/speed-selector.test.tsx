import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { SpeedSelector } from "@/components/playback/speed-selector";
import { usePlaybackStore } from "@/store/playback";

beforeEach(() => {
  usePlaybackStore.setState({
    cursorUtc: null,
    isPlaying: false,
    speedMultiplier: 1,
  });
});

describe("SpeedSelector", () => {
  it("renders three buttons for 1×, 10×, 60×", () => {
    renderWithProviders(<SpeedSelector />);
    expect(screen.getByRole("button", { name: "1×" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10×" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "60×" })).toBeInTheDocument();
  });

  it("clicking 60× sets speedMultiplier to 60", async () => {
    renderWithProviders(<SpeedSelector />);
    await userEvent.click(screen.getByRole("button", { name: "60×" }));
    expect(usePlaybackStore.getState().speedMultiplier).toBe(60);
  });
});
