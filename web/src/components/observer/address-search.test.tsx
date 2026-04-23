import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { AddressSearch } from "@/components/observer/address-search";
import { server } from "@/test/msw/server";
import { useObserverStore } from "@/store/observer";

beforeEach(() => {
  useObserverStore.setState({
    current: { lat: 0, lng: 0, elevation_m: 0, name: "test" },
    saved: [],
  });
});

describe("AddressSearch", () => {
  it("debounces typed input, fetches, and updates observer on suggestion click", async () => {
    server.use(
      http.get("https://nominatim.openstreetmap.org/search", () =>
        HttpResponse.json([
          {
            display_name: "Brooklyn, Kings County, NY, USA",
            lat: "40.6782",
            lon: "-73.9442",
          },
        ]),
      ),
    );

    renderWithProviders(<AddressSearch />);

    const input = screen.getByPlaceholderText(/Brooklyn, NY/);
    await userEvent.type(input, "brooklyn");

    const suggestion = await screen.findByText(/Brooklyn, Kings County, NY, USA/);
    await userEvent.click(suggestion);

    const obs = useObserverStore.getState().current;
    expect(obs.lat).toBeCloseTo(40.6782, 3);
    expect(obs.lng).toBeCloseTo(-73.9442, 3);
    expect(obs.name).toContain("Brooklyn");
  });
});
