import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { TelemetryRail } from "@/components/telemetry/telemetry-rail";
import { server } from "@/test/msw/server";
import { useObserverStore } from "@/store/observer";
import { usePlaybackStore } from "@/store/playback";
import { useSatelliteStore } from "@/store/satellite";
import { useSelectionStore } from "@/store/selection";
import { useTimeRangeStore } from "@/store/time-range";
import { ARC_SAMPLES } from "@/test/fixtures/track-samples";

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
    cursorUtc: null,
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
    http.post("/api/sky-track", () =>
      HttpResponse.json({ resolved_name: "ISS (ZARYA)", samples: ARC_SAMPLES }),
    ),
  );
});

describe("TelemetryRail", () => {
  it("shows hint when cursor is null", () => {
    renderWithProviders(<TelemetryRail />);
    expect(screen.getByText(/Select a pass and press play/)).toBeInTheDocument();
  });

  it("renders telemetry rows when cursor is set within the pass window", async () => {
    usePlaybackStore.setState({ cursorUtc: "2026-05-01T02:03:00Z" });
    renderWithProviders(<TelemetryRail />);

    expect(await screen.findByText("Altitude")).toBeInTheDocument();
    expect(screen.getByText("Range")).toBeInTheDocument();
    expect(screen.getByText("Velocity")).toBeInTheDocument();
    expect(screen.getByText("Az / El")).toBeInTheDocument();
    // Sample at 02:03:00 has az=180, el=60.
    expect(screen.getByText("180° / 60.0°")).toBeInTheDocument();
  });
});
