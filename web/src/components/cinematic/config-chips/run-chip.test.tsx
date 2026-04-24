import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { RunChip } from "./run-chip";
import { renderWithProviders } from "@/test/render";
import { useDraftInputsStore } from "@/store/draft-inputs";
import { useObserverStore } from "@/store/observer";
import { useSatelliteStore } from "@/store/satellite";
import { useTimeRangeStore } from "@/store/time-range";

// Mock useCurrentPasses to control isFetching.
vi.mock("@/hooks/use-current-passes", () => ({
  useCurrentPasses: vi.fn(),
}));
import { useCurrentPasses } from "@/hooks/use-current-passes";

function seed() {
  useObserverStore.setState({
    current: { lat: 40.7, lng: -74.0, elevation_m: 10, name: "NYC" },
  });
  useSatelliteStore.setState({ query: "ISS", resolvedName: null });
  useTimeRangeStore.setState({
    fromUtc: "2026-04-24T18:00:00Z",
    toUtc: "2026-04-25T06:00:00Z",
    mode: "line-of-sight",
  });
  useDraftInputsStore.getState().initFromCommitted();
}

describe("RunChip", () => {
  beforeEach(() => {
    seed();
    (useCurrentPasses as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isFetching: false, isError: false, data: null,
    });
  });

  it("idle state: label READY, value Run, disabled", () => {
    renderWithProviders(<RunChip />);
    expect(screen.getByText("READY")).toBeInTheDocument();
    expect(screen.getByText("Run")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /Run \(no changes\)/i });
    expect(btn).toBeDisabled();
  });

  it("dirty state: label PENDING when any draft diverges", () => {
    useDraftInputsStore.getState().setDraftSatellite({ query: "STARLINK" });
    renderWithProviders(<RunChip />);
    expect(screen.getByText("PENDING")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run — \d+ pending/i })).toBeEnabled();
  });

  it("clicking in dirty state commits drafts", () => {
    useDraftInputsStore.getState().setDraftSatellite({ query: "STARLINK" });
    renderWithProviders(<RunChip />);
    fireEvent.click(screen.getByRole("button", { name: /Run —/i }));
    expect(useSatelliteStore.getState().query).toBe("STARLINK");
    // After commit, draft matches committed, so isDirty is false.
    expect(useDraftInputsStore.getState().isDirty()).toBe(false);
  });

  it("loading state: label RUNNING when isFetching", () => {
    (useCurrentPasses as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isFetching: true, isError: false, data: null,
    });
    renderWithProviders(<RunChip />);
    expect(screen.getByText("RUNNING")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Running/i })).toBeDisabled();
  });
});
