import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { ConfigChips } from "./config-chips";
import { renderWithProviders } from "@/test/render";
import { useDraftInputsStore } from "@/store/draft-inputs";
import { useObserverStore } from "@/store/observer";
import { useSatelliteStore } from "@/store/satellite";
import { useTimeRangeStore } from "@/store/time-range";

// Mock inner panels so we don't render Leaflet / catalog / etc.
vi.mock("@/components/observer/observer-panel", () => ({
  ObserverPanel: () => <div data-testid="observer-panel-stub">obs</div>,
}));
vi.mock("@/components/satellite/satellite-search-body", () => ({
  SatelliteSearchBody: () => <div data-testid="satellite-body-stub">sat</div>,
}));
vi.mock("@/components/time/time-range-picker", () => ({
  TimeRangePicker: () => <div data-testid="time-picker-stub">time</div>,
}));
vi.mock("@/hooks/use-current-passes", () => ({
  useCurrentPasses: () => ({ isFetching: false, isError: false, data: null }),
}));
vi.mock("@/hooks/use-observer-timezone", () => ({
  useObserverTimezone: () => ({ data: { timezone: "America/New_York" } }),
}));

function seed() {
  useObserverStore.setState({
    current: { lat: 40.7, lng: -74.0, elevation_m: 10, name: "Brooklyn, NY" },
  });
  useSatelliteStore.setState({ query: "ISS", resolvedName: null });
  useTimeRangeStore.setState({
    fromUtc: "2026-04-24T22:00:00Z",
    toUtc: "2026-04-25T10:00:00Z",
    mode: "line-of-sight",
  });
  useDraftInputsStore.getState().initFromCommitted();
}

describe("ConfigChips", () => {
  beforeEach(seed);

  it("renders all five chips with committed values", () => {
    renderWithProviders(<ConfigChips />);
    expect(screen.getByText("OBSERVER")).toBeInTheDocument();
    expect(screen.getByText(/Brooklyn/)).toBeInTheDocument();
    expect(screen.getByText("SATELLITE")).toBeInTheDocument();
    expect(screen.getByText("ISS")).toBeInTheDocument();
    expect(screen.getByText("WINDOW")).toBeInTheDocument();
    expect(screen.getByText("VISIBILITY")).toBeInTheDocument();
    expect(screen.getByText("Line-of-sight")).toBeInTheDocument();
    expect(screen.getByText("READY")).toBeInTheDocument();
  });

  it("opens Observer popover on click and renders ObserverPanel", () => {
    renderWithProviders(<ConfigChips />);
    fireEvent.click(screen.getByRole("button", { name: /observer:/i }));
    expect(screen.getByTestId("observer-panel-stub")).toBeInTheDocument();
  });

  it("Cmd-K opens Satellite popover", () => {
    renderWithProviders(<ConfigChips />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByTestId("satellite-body-stub")).toBeInTheDocument();
  });

  it("Cmd-K is ignored when focus is in an input", () => {
    renderWithProviders(
      <>
        <ConfigChips />
        <input data-testid="probe" />
      </>,
    );
    const probe = screen.getByTestId("probe");
    probe.focus();
    fireEvent.keyDown(probe, { key: "k", metaKey: true });
    expect(screen.queryByTestId("satellite-body-stub")).not.toBeInTheDocument();
  });
});
