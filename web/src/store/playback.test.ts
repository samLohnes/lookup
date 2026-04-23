import { beforeEach, describe, expect, it } from "vitest";
import { usePlaybackStore } from "@/store/playback";

describe("usePlaybackStore", () => {
  beforeEach(() => {
    usePlaybackStore.setState({
      cursorUtc: null,
      isPlaying: false,
      speedMultiplier: 1,
    });
  });

  it("setCursor stores an ISO timestamp", () => {
    usePlaybackStore.getState().setCursor("2026-05-01T02:03:00Z");
    expect(usePlaybackStore.getState().cursorUtc).toBe("2026-05-01T02:03:00Z");
  });

  it("play sets isPlaying true; pause sets it false", () => {
    usePlaybackStore.getState().play();
    expect(usePlaybackStore.getState().isPlaying).toBe(true);
    usePlaybackStore.getState().pause();
    expect(usePlaybackStore.getState().isPlaying).toBe(false);
  });

  it("toggle flips isPlaying", () => {
    usePlaybackStore.getState().toggle();
    expect(usePlaybackStore.getState().isPlaying).toBe(true);
    usePlaybackStore.getState().toggle();
    expect(usePlaybackStore.getState().isPlaying).toBe(false);
  });

  it("setSpeed accepts the three valid multipliers", () => {
    for (const s of [1, 10, 60] as const) {
      usePlaybackStore.getState().setSpeed(s);
      expect(usePlaybackStore.getState().speedMultiplier).toBe(s);
    }
  });

  it("seekTo sets cursor and pauses (so the user sees the new frame, not playback)", () => {
    usePlaybackStore.setState({ isPlaying: true });
    usePlaybackStore.getState().seekTo("2026-05-01T02:00:00Z");
    expect(usePlaybackStore.getState().cursorUtc).toBe("2026-05-01T02:00:00Z");
    expect(usePlaybackStore.getState().isPlaying).toBe(false);
  });
});
