import * as THREE from "three";
import { latLngAltToVec3 } from "@/lib/geo3d";

export interface TrailPoint {
  lat: number;
  lng: number;
  alt_km: number;
}

export interface LiveTrailsViewport {
  width: number;
  height: number;
}

export interface LiveTrails {
  group: THREE.Group;
  /** Replace the set of trails. Each trail is a polyline of points. */
  setTrails: (trails: TrailPoint[][]) => void;
  setVisible: (v: boolean) => void;
  dispose: () => void;
}

const TRAIL_COLOR = 0xffae60;
const TRAIL_OPACITY = 0.35;

/** Convert a polyline of points into the flat Float32Array Three.js wants. */
function trailToVertexArray(trail: TrailPoint[]): Float32Array {
  const out = new Float32Array(trail.length * 3);
  for (let i = 0; i < trail.length; i++) {
    const { lat, lng, alt_km } = trail[i];
    const v = latLngAltToVec3(lat, lng, alt_km);
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  return out;
}

/** Manages N parallel polylines for the live-mode trailing tracks.
 *
 * Each trail is a single faint orange line (uniform opacity, no progress
 * gradient — that's a pass-arc affordance). Pool grows/shrinks with the
 * trail count. Trails with fewer than 2 samples are skipped (can't draw
 * a line).
 *
 * The `_earthRadiusUnits` and `_viewport` parameters are kept for API
 * symmetry with `createGroundTrackMesh` even though `latLngAltToVec3`
 * reads `EARTH_RADIUS_UNITS` from `@/lib/geo3d` directly and we use
 * basic `THREE.Line` (no `LineMaterial` viewport sizing needed).
 */
export function createLiveTrails(
  _earthRadiusUnits: number,
  _viewport: LiveTrailsViewport,
): LiveTrails {
  const group = new THREE.Group();
  group.visible = false;

  // One material shared across all lines.
  const material = new THREE.LineBasicMaterial({
    color: TRAIL_COLOR,
    transparent: true,
    opacity: TRAIL_OPACITY,
  });

  const lines: THREE.Line[] = [];
  const geometries: THREE.BufferGeometry[] = [];

  function ensurePoolSize(n: number): void {
    while (lines.length < n) {
      const geom = new THREE.BufferGeometry();
      const line = new THREE.Line(geom, material);
      lines.push(line);
      geometries.push(geom);
      group.add(line);
    }
    while (lines.length > n) {
      const line = lines.pop()!;
      const geom = geometries.pop()!;
      group.remove(line);
      geom.dispose();
    }
  }

  function setTrails(trails: TrailPoint[][]): void {
    const drawable = trails.filter((t) => t.length >= 2);
    ensurePoolSize(drawable.length);
    for (let i = 0; i < drawable.length; i++) {
      const verts = trailToVertexArray(drawable[i]);
      geometries[i].setAttribute(
        "position",
        new THREE.BufferAttribute(verts, 3),
      );
      geometries[i].computeBoundingSphere();
    }
  }

  function setVisible(v: boolean): void {
    group.visible = v;
  }

  function dispose(): void {
    material.dispose();
    for (const g of geometries) g.dispose();
    for (const l of lines) group.remove(l);
    lines.length = 0;
    geometries.length = 0;
  }

  return { group, setTrails, setVisible, dispose };
}
