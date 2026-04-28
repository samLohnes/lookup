import type { TrackSampleResponse } from "@/types/api";

export interface InterpolatedPosition {
  lat: number;
  lng: number;
  alt_km: number;
}

/** Linearly extrapolate between two polled samples for the current frame.
 *
 * `latest` and `previous` are consecutive polled positions for the same
 * satellite. `lastPolledMs` is performance.now() at the moment `latest`
 * was applied to the store; `nowMs` is the current frame's timestamp.
 *
 * Falls back to `latest` when there's no previous sample (first poll
 * after a satellite change) or when the two polls share the same `time`
 * (degenerate / mock data).
 *
 * Antimeridian: when the true longitude delta would cross ±180°, the
 * naive (latest - previous) becomes ~360° in the wrong direction. We
 * detect and unwrap by adding/subtracting 360° before interpolating,
 * then re-wrap the result into [-180, 180].
 */
export function extrapolatePosition(
  latest: TrackSampleResponse,
  previous: TrackSampleResponse | undefined,
  nowMs: number,
  lastPolledMs: number,
): InterpolatedPosition {
  if (!previous) {
    return { lat: latest.lat, lng: latest.lng, alt_km: latest.alt_km };
  }

  const dtPollsMs =
    new Date(latest.time).getTime() - new Date(previous.time).getTime();
  if (dtPollsMs === 0) {
    return { lat: latest.lat, lng: latest.lng, alt_km: latest.alt_km };
  }

  const elapsedMs = nowMs - lastPolledMs;
  const t = elapsedMs / dtPollsMs;

  // Longitude unwrap: if naive delta exceeds ±180°, the shorter path
  // crosses the antimeridian. Adjust `previous.lng` so the delta uses
  // the short way around.
  let prevLng = previous.lng;
  const naiveDelta = latest.lng - prevLng;
  if (naiveDelta > 180) prevLng += 360;
  else if (naiveDelta < -180) prevLng -= 360;

  const lat = latest.lat + (latest.lat - previous.lat) * t;
  let lng = latest.lng + (latest.lng - prevLng) * t;
  // Re-wrap into [-180, 180].
  while (lng > 180) lng -= 360;
  while (lng < -180) lng += 360;
  const alt_km = latest.alt_km + (latest.alt_km - previous.alt_km) * t;

  return { lat, lng, alt_km };
}
