import { describe, expect, it } from "vitest";

describe("smoke", () => {
  it("jsdom environment is alive", () => {
    expect(document).toBeDefined();
  });

  it("can fetch through msw", async () => {
    const r = await fetch("/api/catalog/search?q=iss");
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body[0].norad_ids).toContain(25544);
  });
});
