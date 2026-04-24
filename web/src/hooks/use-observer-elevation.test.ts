import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useObserverElevation } from "@/hooks/use-observer-elevation";
import { server } from "@/test/msw/server";

function wrap() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useObserverElevation", () => {
  it("fetches elevation for the given lat/lng", async () => {
    server.use(
      http.get("/api/geo/elevation", ({ request }) => {
        const url = new URL(request.url);
        const lat = Number(url.searchParams.get("lat"));
        const lng = Number(url.searchParams.get("lng"));
        return HttpResponse.json({ lat, lng, elevation_m: 4205.0 });
      }),
    );

    const { result } = renderHook(
      () => useObserverElevation(19.82, -155.47),
      { wrapper: wrap() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.elevation_m).toBe(4205.0);
    expect(result.current.data?.lat).toBe(19.82);
    expect(result.current.data?.lng).toBe(-155.47);
  });

  it("propagates server errors", async () => {
    server.use(
      http.get("/api/geo/elevation", () =>
        HttpResponse.json({ detail: "DEM fetch failed" }, { status: 502 }),
      ),
    );

    const { result } = renderHook(
      () => useObserverElevation(89.9, 0),
      { wrapper: wrap() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
