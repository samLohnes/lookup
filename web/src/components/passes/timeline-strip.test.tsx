import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { TimelineStrip } from "@/components/passes/timeline-strip";
import { server } from "@/test/msw/server";
import { useObserverStore } from "@/store/observer";
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
  useSelectionStore.setState({ selectedPassId: null });
});

describe("TimelineStrip", () => {
  it("renders nothing when there are no passes", async () => {
    server.use(
      http.post("/api/passes", () =>
        HttpResponse.json({
          query: "ISS",
          resolved_name: "ISS (ZARYA)",
          passes: [],
          tle_age_seconds: 0,
        }),
      ),
    );
    const { container } = renderWithProviders(<TimelineStrip />);
    // Wait briefly for the query to resolve.
    await new Promise((r) => setTimeout(r, 30));
    // No bars rendered when passes is empty.
    expect(container.querySelectorAll("button[aria-label^='Pass']")).toHaveLength(0);
  });

  it("renders one bar per pass and routes clicks through the selection store", async () => {
    server.use(
      http.post("/api/passes", () =>
        HttpResponse.json({
          query: "ISS",
          resolved_name: "ISS (ZARYA)",
          passes: [
            {
              kind: "single",
              id: "pa",
              norad_id: 25544,
              name: "ISS (ZARYA)",
              rise: { time: "2026-05-01T02:00:00Z", azimuth_deg: 0, elevation_deg: 0 },
              peak: { time: "2026-05-01T02:03:00Z", azimuth_deg: 0, elevation_deg: 30 },
              set: { time: "2026-05-01T02:06:00Z", azimuth_deg: 0, elevation_deg: 0 },
              duration_s: 360,
              max_magnitude: null,
              sunlit_fraction: 0,
              tle_epoch: "2026-04-30T00:00:00Z",
            },
            {
              kind: "single",
              id: "pb",
              norad_id: 25544,
              name: "ISS (ZARYA)",
              rise: { time: "2026-05-04T02:00:00Z", azimuth_deg: 0, elevation_deg: 0 },
              peak: { time: "2026-05-04T02:03:00Z", azimuth_deg: 0, elevation_deg: 30 },
              set: { time: "2026-05-04T02:06:00Z", azimuth_deg: 0, elevation_deg: 0 },
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
    const { container } = renderWithProviders(<TimelineStrip />);

    // Wait for bars to appear.
    const bars = await screen.findAllByLabelText(/Pass at/);
    expect(bars).toHaveLength(2);

    await userEvent.click(bars[1]);
    expect(useSelectionStore.getState().selectedPassId).toBe("pb");
  });
});
