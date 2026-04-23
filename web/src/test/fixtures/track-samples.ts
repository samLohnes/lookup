import type { TrackSampleResponse } from "@/types/api";

/** Build a TrackSample with sensible defaults — overrides only the fields you care about. */
export function trackSample(
  overrides: Partial<TrackSampleResponse> & { time: string },
): TrackSampleResponse {
  return {
    lat: 0,
    lng: 0,
    alt_km: 400,
    az: 0,
    el: 0,
    range_km: 500,
    velocity_km_s: 7.66,
    magnitude: null,
    sunlit: true,
    observer_dark: true,
    ...overrides,
  };
}

/** A canned 5-sample arc rising in the SE, peaking south, setting SW. */
export const ARC_SAMPLES: TrackSampleResponse[] = [
  trackSample({ time: "2026-05-01T02:00:00Z", az: 90, el: 5, range_km: 600 }),
  trackSample({ time: "2026-05-01T02:01:30Z", az: 135, el: 30, range_km: 500 }),
  trackSample({ time: "2026-05-01T02:03:00Z", az: 180, el: 60, range_km: 450 }),
  trackSample({ time: "2026-05-01T02:04:30Z", az: 225, el: 30, range_km: 500 }),
  trackSample({ time: "2026-05-01T02:06:00Z", az: 270, el: 5, range_km: 600 }),
];
