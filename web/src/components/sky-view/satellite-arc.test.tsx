import React from "react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { SatelliteArc } from "@/components/sky-view/satellite-arc";
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
  useSelectionStore.setState({ selectedPassId: "p1" });
});

function svgWrap(children: React.ReactNode) {
  return (
    <svg viewBox="0 0 320 320" data-testid="wrap">
      {children}
    </svg>
  );
}

describe("SatelliteArc", () => {
  it("renders nothing when no pass is selected", async () => {
    useSelectionStore.setState({ selectedPassId: null });
    const { container } = renderWithProviders(svgWrap(<SatelliteArc />));
    await new Promise((r) => setTimeout(r, 30));
    expect(container.querySelector("path")).toBeNull();
  });

  it("renders a path and a peak circle when sky-track samples are available", async () => {
    // The selected pass must exist in the /passes response.
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
        HttpResponse.json({
          resolved_name: "ISS (ZARYA)",
          samples: [
            { time: "2026-05-01T02:00:00Z", lat: 0, lng: 0, alt_km: 400, az: 90,  el: 5,  range_km: 600, velocity_km_s: 7.66, magnitude: null, sunlit: true, observer_dark: true },
            { time: "2026-05-01T02:01:30Z", lat: 0, lng: 0, alt_km: 400, az: 135, el: 30, range_km: 500, velocity_km_s: 7.66, magnitude: null, sunlit: true, observer_dark: true },
            { time: "2026-05-01T02:03:00Z", lat: 0, lng: 0, alt_km: 400, az: 180, el: 60, range_km: 450, velocity_km_s: 7.66, magnitude: null, sunlit: true, observer_dark: true },
            { time: "2026-05-01T02:04:30Z", lat: 0, lng: 0, alt_km: 400, az: 225, el: 30, range_km: 500, velocity_km_s: 7.66, magnitude: null, sunlit: true, observer_dark: true },
            { time: "2026-05-01T02:06:00Z", lat: 0, lng: 0, alt_km: 400, az: 270, el: 5,  range_km: 600, velocity_km_s: 7.66, magnitude: null, sunlit: true, observer_dark: true },
          ],
        }),
      ),
    );

    const { container } = renderWithProviders(svgWrap(<SatelliteArc />));
    // Allow both queries to settle.
    await new Promise((r) => setTimeout(r, 100));
    expect(container.querySelector("path")).not.toBeNull();
    expect(container.querySelector("circle")).not.toBeNull();
  });
});
