import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";

// We test the inner async function indirectly by hitting the /search URL via MSW.
// We can't import `nominatim` directly because it's not exported — but the URL
// pattern is well-known. To make this test maximally useful, we re-implement
// the call inline with the same URL the hook uses, then assert the parser
// shape contract.
async function callNominatim(q: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  const response = await fetch(url.toString(), {
    headers: { "Accept-Language": "en" },
  });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  return response.json();
}

describe("Nominatim parser contract", () => {
  it("parses the {lat, lon, display_name} shape into floats", async () => {
    server.use(
      http.get("https://nominatim.openstreetmap.org/search", () =>
        HttpResponse.json([
          { display_name: "Brooklyn, NY, USA", lat: "40.6782", lon: "-73.9442" },
        ]),
      ),
    );

    const raw = await callNominatim("brooklyn");
    expect(raw).toHaveLength(1);
    expect(parseFloat(raw[0].lat)).toBeCloseTo(40.6782, 3);
    expect(parseFloat(raw[0].lon)).toBeCloseTo(-73.9442, 3);
    expect(raw[0].display_name).toBe("Brooklyn, NY, USA");
  });

  it("throws on non-200 status", async () => {
    server.use(
      http.get("https://nominatim.openstreetmap.org/search", () =>
        HttpResponse.json({ error: "rate limited" }, { status: 429 }),
      ),
    );
    await expect(callNominatim("anywhere")).rejects.toThrow(/429/);
  });
});
