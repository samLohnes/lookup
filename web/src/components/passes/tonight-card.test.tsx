import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { TonightCard } from "@/components/passes/tonight-card";
import { server } from "@/test/msw/server";
import { useObserverStore } from "@/store/observer";
import { useSatelliteStore } from "@/store/satellite";
import { useTimeRangeStore } from "@/store/time-range";

// Pin the clock to 2026-05-02T02:00:00Z — just after sunset for NYC (~21:00 EDT).
// Tonight's window runs from ~01:00 UTC (sunset) to ~10:00 UTC (next sunrise).
const PINNED_NOW = new Date("2026-05-02T02:00:00Z");

beforeEach(() => {
  vi.setSystemTime(PINNED_NOW);
  useObserverStore.setState({
    current: { lat: 40.7128, lng: -74.006, elevation_m: 10, name: "NYC" },
    saved: [],
  });
  useSatelliteStore.setState({ query: "ISS", resolvedName: null });
  // Long enough window that "tonight" passes fit inside it.
  useTimeRangeStore.setState({
    fromUtc: new Date(PINNED_NOW.getTime() - 24 * 3600 * 1000).toISOString(),
    toUtc: new Date(PINNED_NOW.getTime() + 48 * 3600 * 1000).toISOString(),
    mode: "naked-eye",
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TonightCard", () => {
  it("renders nothing when no passes are returned", async () => {
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
    const { container } = renderWithProviders(<TonightCard />);
    await new Promise((r) => setTimeout(r, 50));
    expect(container.firstChild).toBeNull();
  });

  it("renders the tonight summary when at least one pass is in the tonight window", async () => {
    // Place a synthetic pass at 03:00 UTC — clearly inside tonight's window
    // (sunset ~01:00 UTC, sunrise ~10:00 UTC for NYC on 2026-05-02).
    const passRise = "2026-05-02T03:00:00Z";
    const passSet = "2026-05-02T03:05:00Z";
    const inOneHour = passRise;
    const inOneHourPlus5 = passSet;
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
              rise: { time: inOneHour, azimuth_deg: 90, elevation_deg: 0 },
              peak: { time: inOneHour, azimuth_deg: 180, elevation_deg: 65 },
              set: { time: inOneHourPlus5, azimuth_deg: 270, elevation_deg: 0 },
              duration_s: 300,
              max_magnitude: -3,
              sunlit_fraction: 1,
              tle_epoch: "2026-04-30T00:00:00Z",
            },
          ],
          tle_age_seconds: 0,
        }),
      ),
    );
    renderWithProviders(<TonightCard />);
    expect(await screen.findByText("Tonight")).toBeInTheDocument();
    expect(screen.getByText(/Visible passes/)).toBeInTheDocument();
    expect(screen.getAllByText(/ISS \(ZARYA\)/).length).toBeGreaterThan(0);
  });
});
