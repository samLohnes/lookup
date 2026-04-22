import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { api, ApiError } from "@/lib/api";
import { server } from "@/test/msw/server";

describe("api client", () => {
  it("catalogSearch returns parsed hits", async () => {
    const hits = await api.catalogSearch("iss");
    expect(hits[0].display_name).toBe("ISS (ZARYA)");
  });

  it("throws ApiError with detail on 500", async () => {
    server.use(
      http.get("/api/catalog/search", () =>
        HttpResponse.json(
          { detail: "OpenTopography API key not set." },
          { status: 500 },
        ),
      ),
    );

    await expect(api.catalogSearch("iss")).rejects.toMatchObject({
      status: 500,
      detail: expect.stringContaining("API key"),
    });
  });

  it("throws ApiError instance on 500", async () => {
    server.use(
      http.get("/api/catalog/search", () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    await expect(api.catalogSearch("iss")).rejects.toBeInstanceOf(ApiError);
  });
});
