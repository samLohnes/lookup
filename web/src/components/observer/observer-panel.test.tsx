import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { ObserverPanel } from "@/components/observer/observer-panel";
import { useObserverStore } from "@/store/observer";

// MapPicker uses Leaflet which doesn't work under jsdom. Stub it out so
// ObserverPanel can be tested without Leaflet's DOM coupling.
vi.mock("@/components/observer/map-picker", () => ({
  MapPicker: () => <div data-testid="map-picker-stub" />,
}));

describe("ObserverPanel", () => {
  it("shows the current observer name and rounded coords in the header", () => {
    useObserverStore.setState({
      current: { lat: 40.7128, lng: -74.006, elevation_m: 10, name: "Brooklyn" },
      saved: [],
    });
    renderWithProviders(<ObserverPanel />);
    expect(screen.getByText("Observer")).toBeInTheDocument();
    expect(
      screen.getByText(/Brooklyn · 40\.7128°, -74\.0060°/),
    ).toBeInTheDocument();
  });
});
