/** Sub-solar point + sun-direction unit vector for a given UTC Date.
 *
 *  Uses a simplified astronomical approximation — good to ~1° which is
 *  plenty for lighting a sphere. For actual ephemeris precision, use
 *  skyfield; we don't need it here.
 */

/** Earth-fixed Cartesian unit vector pointing at the sun. */
export type Vec3 = { x: number; y: number; z: number };

const DEG = Math.PI / 180;

/** Sub-solar point = (lat, lng) on earth where the sun is directly overhead. */
export function subSolarPoint(date: Date): { lat: number; lng: number } {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start) / 86400000);
  const declDeg = -23.44 * Math.cos(((360 / 365) * (dayOfYear + 10)) * DEG);
  const fractionalHour =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600;
  let lngDeg = -15 * (fractionalHour - 12);
  while (lngDeg > 180) lngDeg -= 360;
  while (lngDeg < -180) lngDeg += 360;
  return { lat: declDeg, lng: lngDeg };
}

/** Earth-fixed sun-direction unit vector.
 *
 *  Uses the same lat/lng → Cartesian convention as `latLngAltToVec3` in
 *  `@/lib/geo3d` (+y = north, -z = east). This is what the earth day/night
 *  shader consumes as the `sunDir` uniform — a divergence from the earth
 *  mesh's own orientation would rotate the terminator around the wrong
 *  axis. */
export function sunDirectionForDate(date: Date): Vec3 {
  const { lat, lng } = subSolarPoint(date);
  const latR = lat * DEG;
  const lngR = lng * DEG;
  return {
    x: Math.cos(latR) * Math.cos(lngR),
    y: Math.sin(latR),
    z: -Math.cos(latR) * Math.sin(lngR),
  };
}
