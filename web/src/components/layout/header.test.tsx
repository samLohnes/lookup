import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { Header } from "@/components/layout/header";
import { server } from "@/test/msw/server";
import { useSatelliteStore } from "@/store/satellite";

beforeEach(() => {
  useSatelliteStore.setState({ query: "ISS", resolvedName: null });
});

describe("Header", () => {
  it("renders brand and tagline", () => {
    renderWithProviders(<Header />);
    expect(screen.getByText(/Orbit Observer/)).toBeInTheDocument();
    expect(screen.getByText(/Research-grade satellite tracker/i)).toBeInTheDocument();
  });

  it("shows the satellite name and a TLE-age line when freshness data arrives", async () => {
    server.use(
      http.get("/api/tle-freshness", () =>
        HttpResponse.json([
          {
            norad_id: 25544,
            name: "ISS (ZARYA)",
            tle_epoch: "2026-04-30T00:00:00Z",
            fetched_age_seconds: 7200, // 2 h
          },
        ]),
      ),
    );
    renderWithProviders(<Header />);
    expect(await screen.findByText(/ISS \(ZARYA\) · TLE 2 h old/)).toBeInTheDocument();
  });

  it("shows a fallback when no satellite is selected", () => {
    useSatelliteStore.setState({ query: "", resolvedName: null });
    renderWithProviders(<Header />);
    expect(screen.getByText(/none selected/i)).toBeInTheDocument();
  });
});
