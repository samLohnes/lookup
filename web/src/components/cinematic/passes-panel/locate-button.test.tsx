import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { LocateButton } from "./locate-button";
import { renderWithProviders } from "@/test/render";
import { useLivePositionStore } from "@/store/live-position";
import { useCameraTargetStore } from "@/store/camera-target";

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
    useCameraTargetStore.getState().clear();
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
    expect(target?.lat).toBeCloseTo(0, 5);
    expect(target?.lng).toBeCloseTo(45, 5);
  });

  it("disables the button for antipodal satellite positions (degenerate centroid)", () => {
    useLivePositionStore.getState().setActive([25544, 48274]);
    useLivePositionStore.getState().applyPoll(
      [
        { norad_id: 25544, sample: stubSample(0, 0) },
        { norad_id: 48274, sample: stubSample(0, 180) },
      ],
      1000,
    );
    renderWithProviders(<LocateButton />);
    const btn = screen.getByRole("button", { name: "Locate satellite" });
    expect(btn).toBeDisabled();
  });
});
