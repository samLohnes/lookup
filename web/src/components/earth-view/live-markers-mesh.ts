import * as THREE from "three";
import { latLngAltToVec3 } from "@/lib/geo3d";

export interface LiveMarkerPosition {
  lat: number;
  lng: number;
  alt_km: number;
}

export interface LiveMarkers {
  /** Three.js group containing the marker meshes. Add to a scene. */
  group: THREE.Group;
  /** Replace the set of marker positions. Grows/shrinks the pool. */
  setPositions: (positions: LiveMarkerPosition[]) => void;
  /** Toggle the group visibility. */
  setVisible: (v: boolean) => void;
  /** Release all GPU resources. */
  dispose: () => void;
}

const MARKER_RADIUS = 0.018;
const MARKER_COLOR = 0xffae60;

/** Manages a pool of small orange spheres for the live-mode globe view.
 *
 * Reuses the same shape and color as the existing pass-arc satellite
 * marker (`scene-factory.ts:90-94`) so that live and pass modes share a
 * consistent visual language. Position is set via `latLngAltToVec3` from
 * `@/lib/geo3d` (matching the existing satellite-marker placement at
 * `earth-view.tsx:143`).
 *
 * The `earthRadiusUnits` parameter is kept for API symmetry with
 * `createGroundTrackMesh` even though `latLngAltToVec3` reads
 * `EARTH_RADIUS_UNITS` from `@/lib/geo3d` directly.
 */
export function createLiveMarkers(_earthRadiusUnits: number): LiveMarkers {
  const group = new THREE.Group();
  group.visible = false;

  const geometry = new THREE.SphereGeometry(MARKER_RADIUS, 16, 16);
  const material = new THREE.MeshBasicMaterial({ color: MARKER_COLOR });

  const meshes: THREE.Mesh[] = [];

  function ensurePoolSize(n: number): void {
    while (meshes.length < n) {
      const m = new THREE.Mesh(geometry, material);
      meshes.push(m);
      group.add(m);
    }
    while (meshes.length > n) {
      const m = meshes.pop()!;
      group.remove(m);
    }
  }

  function setPositions(positions: LiveMarkerPosition[]): void {
    ensurePoolSize(positions.length);
    for (let i = 0; i < positions.length; i++) {
      const { lat, lng, alt_km } = positions[i];
      const v = latLngAltToVec3(lat, lng, alt_km);
      meshes[i].position.set(v.x, v.y, v.z);
    }
  }

  function setVisible(v: boolean): void {
    group.visible = v;
  }

  function dispose(): void {
    geometry.dispose();
    material.dispose();
    for (const m of meshes) group.remove(m);
    meshes.length = 0;
  }

  return { group, setPositions, setVisible, dispose };
}
