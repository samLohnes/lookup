import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { RunButton } from "./run-button";
import { useDraftInputsStore } from "@/store/draft-inputs";
import { useObserverStore } from "@/store/observer";

describe("RunButton", () => {
  beforeEach(() => {
    useObserverStore.setState({
      current: { lat: 40.7128, lng: -74.006, elevation_m: 10, name: "Brooklyn" },
    });
    useDraftInputsStore.getState().initFromCommitted();
  });

  it("is disabled when no changes", () => {
    render(<RunButton />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is enabled and shows count when dirty", () => {
    act(() =>
      useDraftInputsStore.getState().setDraftObserver({
        lat: 51.5,
        lng: -0.12,
        elevation_m: 10,
        name: "London",
      }),
    );
    render(<RunButton />);
    expect(screen.getByRole("button")).toBeEnabled();
    expect(screen.getByRole("button")).toHaveTextContent(/1 change/i);
  });

  it("click commits draft and resets dirty", () => {
    act(() =>
      useDraftInputsStore.getState().setDraftObserver({
        lat: 51.5,
        lng: -0.12,
        elevation_m: 10,
        name: "London",
      }),
    );
    render(<RunButton />);
    fireEvent.click(screen.getByRole("button"));
    expect(useObserverStore.getState().current.name).toBe("London");
    expect(useDraftInputsStore.getState().isDirty()).toBe(false);
  });
});
