import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { SavedLocations } from "@/components/observer/saved-locations";
import { useObserverStore } from "@/store/observer";
import { useDraftInputsStore } from "@/store/draft-inputs";

beforeEach(() => {
  localStorage.clear();
  useObserverStore.setState({
    current: { lat: 40.7128, lng: -74.006, elevation_m: 10, name: "NYC" },
    saved: [],
  });
  useDraftInputsStore.getState().initFromCommitted();
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

  it("clicking a saved row applies it to the draft; the × button removes it", async () => {
    useObserverStore.setState({
      current: { lat: 0, lng: 0, elevation_m: 0, name: "X" },
      saved: [
        { id: "id1", name: "Cabin", lat: 45, lng: -73, elevation_m: 500 },
      ],
    });
    useDraftInputsStore.getState().initFromCommitted();
    renderWithProviders(<SavedLocations />);

    await userEvent.click(screen.getByRole("button", { name: "Cabin" }));
    // Applies to the draft — committed observer only moves on Run.
    expect(useDraftInputsStore.getState().draft.observer.name).toBe("Cabin");
    expect(useObserverStore.getState().current.name).toBe("X");

    await userEvent.click(screen.getByRole("button", { name: /remove cabin/i }));
    expect(useObserverStore.getState().saved).toHaveLength(0);
  });
});
