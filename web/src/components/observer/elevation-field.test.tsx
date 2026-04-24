import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { ElevationField } from "./elevation-field";
import { renderWithProviders } from "@/test/render";
import { useDraftInputsStore } from "@/store/draft-inputs";

// Mock the elevation lookup hook with a controllable return.
const hookState = {
  data: undefined as { lat: number; lng: number; elevation_m: number } | undefined,
  isFetching: false,
  isError: false,
};

vi.mock("@/hooks/use-observer-elevation", () => ({
  useObserverElevation: () => hookState,
}));

describe("ElevationField", () => {
  beforeEach(() => {
    hookState.data = undefined;
    hookState.isFetching = false;
    hookState.isError = false;
    useDraftInputsStore.getState().initFromCommitted();
    useDraftInputsStore.getState().setDraftObserver({
      lat: 19.82, lng: -155.47, elevation_m: 0, name: "Mauna Kea",
    });
  });

  it("renders lookup-in-flight state with a 'looking up' chip", () => {
    hookState.isFetching = true;
    renderWithProviders(<ElevationField />);
    expect(screen.getByText(/looking up/i)).toBeInTheDocument();
  });

  it("shows the sampled elevation with an 'auto' chip when value matches lookup", () => {
    hookState.data = { lat: 19.82, lng: -155.47, elevation_m: 4205 };
    useDraftInputsStore.getState().setDraftObserver({
      lat: 19.82, lng: -155.47, elevation_m: 4205, name: "Mauna Kea",
    });
    renderWithProviders(<ElevationField />);
    expect(screen.getByText(/4,205/i)).toBeInTheDocument();
    expect(screen.getByText(/auto/i)).toBeInTheDocument();
  });

  it("shows 'overridden' chip when draft elevation differs from lookup", () => {
    hookState.data = { lat: 19.82, lng: -155.47, elevation_m: 4205 };
    useDraftInputsStore.getState().setDraftObserver({
      lat: 19.82, lng: -155.47, elevation_m: 4210, name: "Mauna Kea",
    });
    renderWithProviders(<ElevationField />);
    expect(screen.getByText(/overridden/i)).toBeInTheDocument();
  });

  it("Override button expands a numeric input", async () => {
    hookState.data = { lat: 19.82, lng: -155.47, elevation_m: 4205 };
    useDraftInputsStore.getState().setDraftObserver({
      lat: 19.82, lng: -155.47, elevation_m: 4205, name: "Mauna Kea",
    });
    renderWithProviders(<ElevationField />);
    fireEvent.click(screen.getByRole("button", { name: /override/i }));
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
  });

  it("commits override to draft on confirm button", async () => {
    hookState.data = { lat: 19.82, lng: -155.47, elevation_m: 4205 };
    useDraftInputsStore.getState().setDraftObserver({
      lat: 19.82, lng: -155.47, elevation_m: 4205, name: "Mauna Kea",
    });
    renderWithProviders(<ElevationField />);
    fireEvent.click(screen.getByRole("button", { name: /override/i }));
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "4300" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() => {
      expect(useDraftInputsStore.getState().draft.observer.elevation_m).toBe(4300);
    });
  });

  it("shows unknown state when lookup errors", () => {
    hookState.isError = true;
    renderWithProviders(<ElevationField />);
    expect(screen.getByText(/unknown/i)).toBeInTheDocument();
  });
});
