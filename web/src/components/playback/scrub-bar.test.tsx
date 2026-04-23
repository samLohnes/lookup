import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, renderWithProviders, screen } from "@/test/render";
import { ScrubBar } from "@/components/playback/scrub-bar";
import { server } from "@/test/msw/server";
import { useObserverStore } from "@/store/observer";
import { usePlaybackStore } from "@/store/playback";
import { useSatelliteStore } from "@/store/satellite";
import { useSelectionStore } from "@/store/selection";
import { useTimeRangeStore } from "@/store/time-range";

beforeEach(() => {
  useObserverStore.setState({
    current: { lat: 40.7128, lng: -74.006, elevation_m: 10, name: "NYC" },
    saved: [],
  });
  useSatelliteStore.setState({ query: "ISS", resolvedName: null });
  useTimeRangeStore.setState({
    fromUtc: "2026-05-01T00:00:00Z",
    toUtc: "2026-05-08T00:00:00Z",
    mode: "line-of-sight",
  });
  useSelectionStore.setState({ selectedPassId: "p1" });
  usePlaybackStore.setState({
    cursorUtc: "2026-05-01T02:00:00Z",
    isPlaying: false,
    speedMultiplier: 1,
  });

  server.use(
    http.post("/api/passes", () =>
      HttpResponse.json({
        query: "ISS",
        resolved_name: "ISS (ZARYA)",
        passes: [
          {
            kind: "single",
            id: "p1",
            norad_id: 25544,
            name: "ISS (ZARYA)",
            rise: { time: "2026-05-01T02:00:00Z", azimuth_deg: 90, elevation_deg: 0 },
            peak: { time: "2026-05-01T02:03:00Z", azimuth_deg: 180, elevation_deg: 60 },
            set: { time: "2026-05-01T02:06:00Z", azimuth_deg: 270, elevation_deg: 0 },
            duration_s: 360,
            max_magnitude: null,
            sunlit_fraction: 0,
            tle_epoch: "2026-04-30T00:00:00Z",
          },
        ],
        tle_age_seconds: 0,
      }),
    ),
  );
});

describe("ScrubBar", () => {
  it("shows a hint when no pass is selected", () => {
    useSelectionStore.setState({ selectedPassId: null });
    renderWithProviders(<ScrubBar />);
    expect(screen.getByText(/Select a pass to scrub/)).toBeInTheDocument();
  });

  it("renders the slider when a pass is selected", async () => {
    renderWithProviders(<ScrubBar />);
    expect(await screen.findByRole("slider")).toBeInTheDocument();
  });

  it("dragging the slider seeks the cursor and pauses", async () => {
    renderWithProviders(<ScrubBar />);
    const slider = (await screen.findByRole("slider")) as HTMLInputElement;
    // Manually fire a change — userEvent.type doesn't drag range inputs in jsdom.
    fireEvent.change(slider, { target: { value: "60000" } }); // +1 minute

    expect(usePlaybackStore.getState().cursorUtc).toBe("2026-05-01T02:01:00.000Z");
    expect(usePlaybackStore.getState().isPlaying).toBe(false);
  });
});
