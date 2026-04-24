import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { LeftDrawer } from "./left-drawer";
import { renderWithProviders } from "@/test/render";
import { useDraftInputsStore } from "@/store/draft-inputs";

vi.mock("@/components/observer/observer-panel", () => ({
  ObserverPanel: () => <div data-testid="observer-panel-stub">obs</div>,
}));
vi.mock("@/components/satellite/satellite-search", () => ({
  SatelliteSearch: () => <div data-testid="satellite-search-stub">sat</div>,
}));
vi.mock("@/components/time/time-range-picker", () => ({
  TimeRangePicker: () => <div data-testid="time-range-picker-stub">time</div>,
}));

describe("LeftDrawer", () => {
  beforeEach(() => {
    useDraftInputsStore.getState().initFromCommitted();
  });

  it("starts collapsed — drawer hidden, tab visible", () => {
    renderWithProviders(<LeftDrawer />);
    // Tab is always rendered.
    const tab = screen.getByText(/Observer · Satellite · Window/i);
    expect(tab).toBeInTheDocument();
    expect(tab.getAttribute("aria-hidden")).toBe("false");
    // Drawer is rendered too, but hidden via aria-hidden.
    const drawer = screen.getByRole("complementary", { hidden: true });
    expect(drawer.getAttribute("aria-hidden")).toBe("true");
  });

  it("clicking the tab expands the drawer", () => {
    renderWithProviders(<LeftDrawer />);
    fireEvent.click(screen.getByText(/Observer · Satellite · Window/i));
    const drawer = screen.getByRole("complementary");
    expect(drawer.getAttribute("aria-hidden")).toBe("false");
    expect(screen.getByTestId("observer-panel-stub")).toBeInTheDocument();
    expect(screen.getByTestId("satellite-search-stub")).toBeInTheDocument();
    expect(screen.getByTestId("time-range-picker-stub")).toBeInTheDocument();
  });

  it("expanded drawer contains a Run button", () => {
    renderWithProviders(<LeftDrawer />);
    fireEvent.click(screen.getByText(/Observer · Satellite · Window/i));
    expect(screen.getByRole("button", { name: /Run/i })).toBeInTheDocument();
  });
});
