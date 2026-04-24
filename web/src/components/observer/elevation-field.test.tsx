import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { ElevationField } from "@/components/observer/elevation-field";
import { useDraftInputsStore } from "@/store/draft-inputs";
import { useObserverStore } from "@/store/observer";
import { server } from "@/test/msw/server";
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from "@/test/render";

/** Reset both stores so each test sees a clean slate. */
function seedDraft(observer: { lat: number; lng: number; elevation_m: number; name: string }) {
  useObserverStore.setState({ current: observer, saved: [] });
  useDraftInputsStore.getState().initFromCommitted();
}

describe("ElevationField", () => {
  it("auto-populates draft.elevation_m from the DEM lookup on first render", async () => {
    server.use(
      http.get("/api/geo/elevation", ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          lat: Number(url.searchParams.get("lat")),
          lng: Number(url.searchParams.get("lng")),
          elevation_m: 4205,
        });
      }),
    );
    seedDraft({ lat: 19.82, lng: -155.47, elevation_m: 0, name: "Mauna Kea" });

    renderWithProviders(<ElevationField />);

    await waitFor(() =>
      expect(useDraftInputsStore.getState().draft.observer.elevation_m).toBe(4205),
    );
  });

  it("does NOT clobber a user's manual edit after the lookup completes", async () => {
    server.use(
      http.get("/api/geo/elevation", () =>
        HttpResponse.json({ lat: 19.82, lng: -155.47, elevation_m: 4200 }),
      ),
    );
    seedDraft({ lat: 19.82, lng: -155.47, elevation_m: 0, name: "Mauna Kea" });

    renderWithProviders(<ElevationField />);

    // Wait for the auto-populate to land at 4200.
    await waitFor(() =>
      expect(useDraftInputsStore.getState().draft.observer.elevation_m).toBe(4200),
    );

    // User manually overrides to 4205 (e.g. 5m telescope above peak).
    const input = screen.getByLabelText(/elevation/i) as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, "4205");

    expect(useDraftInputsStore.getState().draft.observer.elevation_m).toBe(4205);

    // The query result re-resolving from cache must not overwrite the override.
    // Wait long enough for any pending effects to flush.
    await new Promise((r) => setTimeout(r, 50));
    expect(useDraftInputsStore.getState().draft.observer.elevation_m).toBe(4205);
  });

  it("shows an unknown-elevation message on lookup failure", async () => {
    server.use(
      http.get("/api/geo/elevation", () =>
        HttpResponse.json({ detail: "DEM fetch failed" }, { status: 502 }),
      ),
    );
    seedDraft({ lat: 89.9, lng: 0, elevation_m: 0, name: "Pole" });

    renderWithProviders(<ElevationField />);

    await waitFor(
      () => expect(screen.getByText(/elevation unknown/i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it("Reset button re-applies the DEM-sampled value", async () => {
    server.use(
      http.get("/api/geo/elevation", () =>
        HttpResponse.json({ lat: 19.82, lng: -155.47, elevation_m: 4200 }),
      ),
    );
    seedDraft({ lat: 19.82, lng: -155.47, elevation_m: 0, name: "Mauna Kea" });

    renderWithProviders(<ElevationField />);

    await waitFor(() =>
      expect(useDraftInputsStore.getState().draft.observer.elevation_m).toBe(4200),
    );

    const input = screen.getByLabelText(/elevation/i) as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, "9999");
    expect(useDraftInputsStore.getState().draft.observer.elevation_m).toBe(9999);

    await userEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(useDraftInputsStore.getState().draft.observer.elevation_m).toBe(4200);
  });
});
