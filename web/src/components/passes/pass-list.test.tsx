import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { PassList } from "@/components/passes/pass-list";
import { server } from "@/test/msw/server";
import { useObserverStore } from "@/store/observer";
import { useSatelliteStore } from "@/store/satellite";
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
});

describe("PassList", () => {
  it("renders skeletons while loading", () => {
    server.use(
      http.post("/api/passes", async () => {
        await new Promise((r) => setTimeout(r, 30));
        return HttpResponse.json({
          query: "ISS",
          resolved_name: "ISS (ZARYA)",
          passes: [],
          tle_age_seconds: 0,
        });
      }),
    );
    renderWithProviders(<PassList />);
    // Skeletons have animate-pulse class via the Skeleton component.
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders the empty state when the API returns no passes", async () => {
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
    renderWithProviders(<PassList />);
    expect(
      await screen.findByText(/No visible passes/i),
    ).toBeInTheDocument();
  });

  it("renders the error detail when the API responds 500", async () => {
    server.use(
      http.post("/api/passes", () =>
        HttpResponse.json(
          { detail: "OpenTopography API key not set." },
          { status: 500 },
        ),
      ),
    );
    renderWithProviders(<PassList />);
    expect(await screen.findByText(/API key not set/)).toBeInTheDocument();
  });

  it("renders pass cards when passes are returned", async () => {
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
              rise: { time: "2026-05-01T02:00:00Z", azimuth_deg: 30, elevation_deg: 0 },
              peak: { time: "2026-05-01T02:03:00Z", azimuth_deg: 180, elevation_deg: 45 },
              set: { time: "2026-05-01T02:06:00Z", azimuth_deg: 330, elevation_deg: 0 },
              duration_s: 360,
              max_magnitude: null,
              sunlit_fraction: 0,
              tle_epoch: "2026-04-30T00:00:00Z",
            },
          ],
          tle_age_seconds: 120,
        }),
      ),
    );
    renderWithProviders(<PassList />);
    expect(await screen.findByText("ISS (ZARYA)")).toBeInTheDocument();
    expect(screen.getByText(/1 pass · ISS \(ZARYA\)/)).toBeInTheDocument();
  });
});
