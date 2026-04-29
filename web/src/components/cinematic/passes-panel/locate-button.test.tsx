import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { LocateButton } from "./locate-button";
import { renderWithProviders } from "@/test/render";
import { useLivePositionStore } from "@/store/live-position";
import { useSelectionStore } from "@/store/selection";
import { useCameraTargetStore } from "@/store/camera-target";

vi.mock("@/hooks/use-track-at-cursor", () => ({
  useTrackAtCursor: vi.fn(),
}));
import { useTrackAtCursor } from "@/hooks/use-track-at-cursor";

const stubSample = (lat: number, lng: number) => ({
  time: "2026-04-27T03:25:00Z",
  lat, lng, alt_km: 412,
  az: 0, el: 0, range_km: 478,
  velocity_km_s: 7.68, magnitude: -2.1,
  sunlit: true, observer_dark: true,
});

describe("LocateButton", () => {
  beforeEach(() => {
    useLivePositionStore.getState().clear();
    useSelectionStore.setState({ selectedPassId: null });
    useCameraTargetStore.getState().clear();
    (useTrackAtCursor as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sample: null,
      isLoading: false,
    });
  });

  afterEach(() => vi.clearAllMocks());

  it("is disabled when no live positions are available", () => {
    renderWithProviders(<LocateButton />);
    const btn = screen.getByRole("button", { name: "Locate satellite" });
    expect(btn).toBeDisabled();
  });

  it("is enabled when there is at least one live position", () => {
    useLivePositionStore.getState().setActive([25544]);
    useLivePositionStore.getState().applyPoll(
      [{ norad_id: 25544, sample: stubSample(40, -74) }],
      1000,
    );
    renderWithProviders(<LocateButton />);
    const btn = screen.getByRole("button", { name: "Locate satellite" });
    expect(btn).not.toBeDisabled();
  });

  it("click reframes the camera to the live position", () => {
    useLivePositionStore.getState().setActive([25544]);
    useLivePositionStore.getState().applyPoll(
      [{ norad_id: 25544, sample: stubSample(40, -74) }],
      1000,
    );
    renderWithProviders(<LocateButton />);
    fireEvent.click(screen.getByRole("button", { name: "Locate satellite" }));
    const target = useCameraTargetStore.getState().target;
    expect(target?.lat).toBeCloseTo(40, 5);
    expect(target?.lng).toBeCloseTo(-74, 5);
  });

  it("click deselects the current pass", () => {
    useSelectionStore.setState({ selectedPassId: "iss-25544" });
    useLivePositionStore.getState().setActive([25544]);
    useLivePositionStore.getState().applyPoll(
      [{ norad_id: 25544, sample: stubSample(40, -74) }],
      1000,
    );
    renderWithProviders(<LocateButton />);
    fireEvent.click(screen.getByRole("button", { name: "Locate satellite" }));
    expect(useSelectionStore.getState().selectedPassId).toBeNull();
  });

  it("uses spherical centroid for multiple live positions", () => {
    useLivePositionStore.getState().setActive([25544, 48274]);
    useLivePositionStore.getState().applyPoll(
      [
        { norad_id: 25544, sample: stubSample(0, 0) },
        { norad_id: 48274, sample: stubSample(0, 90) },
      ],
      1000,
    );
    renderWithProviders(<LocateButton />);
    fireEvent.click(screen.getByRole("button", { name: "Locate satellite" }));
    const target = useCameraTargetStore.getState().target;
    // Two equatorial points 90° apart → centroid at (0, 45).
    expect(target?.lat).toBeCloseTo(0, 5);
    expect(target?.lng).toBeCloseTo(45, 5);
  });

  it("disables the button for antipodal satellite positions (degenerate centroid)", () => {
    useLivePositionStore.getState().setActive([25544, 48274]);
    useLivePositionStore.getState().applyPoll(
      [
        { norad_id: 25544, sample: stubSample(0, 0) },
        { norad_id: 48274, sample: stubSample(0, 180) },  // antipode
      ],
      1000,
    );
    renderWithProviders(<LocateButton />);
    const btn = screen.getByRole("button", { name: "Locate satellite" });
    expect(btn).toBeDisabled();
  });

  it("is enabled in pass-selected mode via the pass-marker fallback (catch-22 regression guard)", () => {
    // The bug this guards against: useLivePolling clears the live store
    // when a pass is selected, so the centroid-of-live-positions logic
    // would always disable the button in pass mode. The fix uses
    // useTrackAtCursor's sample as a fallback target when a pass is
    // selected.
    useSelectionStore.setState({ selectedPassId: "iss-25544" });
    // Live store is empty (as useLivePolling would leave it in pass mode).
    useLivePositionStore.getState().clear();
    // But the pass cursor has a sample — that's our fallback target.
    (useTrackAtCursor as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sample: stubSample(40, -74),
      isLoading: false,
    });
    renderWithProviders(<LocateButton />);
    const btn = screen.getByRole("button", { name: "Locate satellite" });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    // After click: pass deselected, camera tweened to the pass-marker location.
    expect(useSelectionStore.getState().selectedPassId).toBeNull();
    const camTarget = useCameraTargetStore.getState().target;
    expect(camTarget?.lat).toBeCloseTo(40, 5);
    expect(camTarget?.lng).toBeCloseTo(-74, 5);
  });
});
