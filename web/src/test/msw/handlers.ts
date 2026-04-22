import { http, HttpResponse } from "msw";

// Default handlers — tests override per-test as needed via server.use(...)
export const handlers = [
  http.get("/api/catalog/search", ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.toLowerCase() ?? "";
    if (!q) return HttpResponse.json([]);
    if (q.includes("iss")) {
      return HttpResponse.json([
        {
          display_name: "ISS (ZARYA)",
          match_type: "satellite",
          norad_ids: [25544],
          score: 100,
        },
      ]);
    }
    return HttpResponse.json([]);
  }),

  http.post("/api/passes", async () =>
    HttpResponse.json({
      query: "ISS",
      resolved_name: "ISS (ZARYA)",
      passes: [],
      tle_age_seconds: 0,
    }),
  ),
];
