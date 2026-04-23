import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { SavedLocations } from "@/components/observer/saved-locations";
import { useObserverStore } from "@/store/observer";

beforeEach(() => {
  localStorage.clear();
  useObserverStore.setState({
    current: { lat: 40.7128, lng: -74.006, elevation_m: 10, name: "NYC" },
    saved: [],
  });
});

describe("SavedLocations", () => {
  it("shows the empty hint when no saved locations exist", () => {
    renderWithProviders(<SavedLocations />);
    expect(screen.getByText(/Save the current location below/)).toBeInTheDocument();
  });

  it("save button is disabled when name is empty, enabled when filled", async () => {
    renderWithProviders(<SavedLocations />);
    const button = screen.getByRole("button", { name: /save/i });
    expect(button).toBeDisabled();

    await userEvent.type(
      screen.getByPlaceholderText(/save current as/i),
      "Backyard",
    );
    expect(button).not.toBeDisabled();
  });

  it("clicking Save adds to the store and clears the input", async () => {
    renderWithProviders(<SavedLocations />);
    await userEvent.type(
      screen.getByPlaceholderText(/save current as/i),
      "Backyard",
    );
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(useObserverStore.getState().saved).toHaveLength(1);
    expect(useObserverStore.getState().saved[0].name).toBe("Backyard");
  });

  it("clicking a saved row applies it; the × button removes it", async () => {
    useObserverStore.setState({
      current: { lat: 0, lng: 0, elevation_m: 0, name: "X" },
      saved: [
        { id: "id1", name: "Cabin", lat: 45, lng: -73, elevation_m: 500 },
      ],
    });
    renderWithProviders(<SavedLocations />);

    await userEvent.click(screen.getByRole("button", { name: "Cabin" }));
    expect(useObserverStore.getState().current.name).toBe("Cabin");

    await userEvent.click(screen.getByRole("button", { name: /remove cabin/i }));
    expect(useObserverStore.getState().saved).toHaveLength(0);
  });
});
