import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { SatelliteSearch } from "@/components/satellite/satellite-search";
import { server } from "@/test/msw/server";
import { useSatelliteStore } from "@/store/satellite";
import { useDraftInputsStore } from "@/store/draft-inputs";

beforeEach(() => {
  useSatelliteStore.setState({ query: "ISS", resolvedName: null });
  useDraftInputsStore.getState().initFromCommitted();
});

describe("SatelliteSearch", () => {
  it("renders the current query as the trigger label", () => {
    renderWithProviders(<SatelliteSearch />);
    expect(screen.getByRole("combobox")).toHaveTextContent("ISS");
  });

  it("opens, queries, and selects a hit which updates the draft store", async () => {
    server.use(
      http.get("/api/catalog/search", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("q") === "hubble") {
          return HttpResponse.json([
            {
              display_name: "HUBBLE SPACE TELESCOPE",
              match_type: "satellite",
              norad_ids: [20580],
              score: 100,
            },
          ]);
        }
        return HttpResponse.json([]);
      }),
    );

    renderWithProviders(<SatelliteSearch />);

    await userEvent.click(screen.getByRole("combobox"));
    const input = await screen.findByPlaceholderText(/ISS, starlink/);
    await userEvent.type(input, "hubble");

    const item = await screen.findByText("HUBBLE SPACE TELESCOPE");
    await userEvent.click(item);

    // Writes land on the draft — committed `query` only moves on Run.
    expect(useDraftInputsStore.getState().draft.satellite.query).toBe(
      "HUBBLE SPACE TELESCOPE",
    );
    expect(useSatelliteStore.getState().query).toBe("ISS");
  });
});
