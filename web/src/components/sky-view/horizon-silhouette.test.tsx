import React from "react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { HorizonSilhouette } from "@/components/sky-view/horizon-silhouette";
import { server } from "@/test/msw/server";
import { useObserverStore } from "@/store/observer";

beforeEach(() => {
  useObserverStore.setState({
    current: { lat: 40.7128, lng: -74.006, elevation_m: 10, name: "NYC" },
    saved: [],
  });
});

function svgWrap(children: React.ReactNode) {
  return (
    <svg viewBox="0 0 320 320" data-testid="wrap">
      {children}
    </svg>
  );
}

describe("HorizonSilhouette", () => {
  it("renders a polygon when the API returns a horizon mask", async () => {
    server.use(
      http.get("/api/horizon", () =>
        HttpResponse.json({
          lat: 40.7128,
          lng: -74.006,
          radius_km: 50,
          samples_deg: new Array(360).fill(0),
        }),
      ),
    );
    const { container, findByTestId } = renderWithProviders(svgWrap(<HorizonSilhouette />));
    await findByTestId("wrap");
    // Wait briefly for the query to resolve and re-render.
    await new Promise((r) => setTimeout(r, 60));
    expect(container.querySelector("polygon")).not.toBeNull();
  });

  it("renders nothing when the API errors", async () => {
    server.use(
      http.get("/api/horizon", () =>
        HttpResponse.json({ detail: "fail" }, { status: 500 }),
      ),
    );
    const { container } = renderWithProviders(svgWrap(<HorizonSilhouette />));
    await new Promise((r) => setTimeout(r, 60));
    expect(container.querySelector("polygon")).toBeNull();
  });
});
