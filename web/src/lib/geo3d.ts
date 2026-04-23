/** Real Earth equatorial radius in km. */
export const EARTH_RADIUS_KM = 6378;

/** Three.js scene units per Earth radius. We use 1 for tidy math. */
export const EARTH_RADIUS_UNITS = 1;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Convert (lat°, lng°, altitude_km) to a Cartesian vector in scene units.
 *
 *  Convention:
 *  - +y up (north pole)
 *  - +x toward (lat=0, lng=0)
 *  - -z toward (lat=0, lng=90°E)  (right-handed coord system, default Three.js)
 *
 *  Altitude scales radius linearly: 1 EARTH_RADIUS_KM of altitude doubles
 *  the distance from origin.
 */
export function latLngAltToVec3(
  lat: number,
  lng: number,
  altitudeKm: number,
): Vec3 {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lng * Math.PI) / 180;
  const r = EARTH_RADIUS_UNITS * (1 + altitudeKm / EARTH_RADIUS_KM);

  return {
    x: r * Math.cos(phi) * Math.cos(lambda),
    y: r * Math.sin(phi),
    z: -r * Math.cos(phi) * Math.sin(lambda),
  };
}
