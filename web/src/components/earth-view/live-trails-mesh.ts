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
  /** Advance the dash-animation phase to the given time. Caller passes
   *  performance.now() each frame from the render loop. */
  tick: (timeMs: number) => void;
  setVisible: (v: boolean) => void;
  dispose: () => void;
}

const TRAIL_COLOR = new THREE.Color(0xffae60);
const TRAIL_PEAK_OPACITY = 0.6;
const DASH_COUNT = 6.0;
const GAP_FRAC = 0.4;       // 60% dash, 40% gap per cycle
const CYCLES_PER_SEC = 1.0; // one full dash-shift per second

const VERTEX_SHADER = /* glsl */ `
  attribute float aLineDistance;
  varying float vAge;
  varying float vDistance;
  void main() {
    vAge = 1.0 - aLineDistance;
    vDistance = aLineDistance;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPeakOpacity;
  uniform float uTime;
  uniform float uDashCount;
  uniform float uGapFrac;
  uniform float uCyclesPerSec;
  varying float vAge;
  varying float vDistance;
  void main() {
    float phase = fract(vDistance * uDashCount - uTime * uCyclesPerSec);
    float dashMask = step(uGapFrac, phase);
    // Steeper fade than linear vAge — ink density tapers aggressively
    // from full at the head to near-zero at the tail. Visually reads as
    // "thicker at the head" without changing pixel width.
    float alpha = pow(vAge, 2.5) * uPeakOpacity * dashMask;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

/** Convert a polyline of points into both the position vertex array and
 *  the per-vertex normalized line-distance array.
 *
 *  `aLineDistance[i] = 1 - i/(n-1)` so index 0 (the oldest sample) is at
 *  distance 1.0 (tail, fully faded) and index n-1 (the newest, head) is
 *  at distance 0.0 (head, fully bright). The vertex shader maps this to
 *  `vAge = 1.0 - aLineDistance` to drive the head-to-tail fade gradient.
 *  Naming kept as "lineDistance" for symmetry with Three.js's built-in
 *  computeLineDistances even though the values are normalized index-
 *  fractions, not arc-length. */
function trailToAttributes(trail: TrailPoint[]): {
  positions: Float32Array;
  lineDistances: Float32Array;
} {
  const n = trail.length;
  const positions = new Float32Array(n * 3);
  const lineDistances = new Float32Array(n);
  const denom = Math.max(1, n - 1);
  for (let i = 0; i < n; i++) {
    const { lat, lng, alt_km } = trail[i];
    const v = latLngAltToVec3(lat, lng, alt_km);
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
    lineDistances[i] = 1.0 - i / denom;
  }
  return { positions, lineDistances };
}

/** Manages N parallel polylines for the live-mode trailing tracks.
 *
 * Each trail is a single faint orange line with two animated effects:
 *   - Head-bright fade gradient (head fully visible, tail fully
 *     transparent) drives "this is a trailing tail" perception.
 *   - Marching dashes flowing toward the marker, advanced via
 *     `tick(timeMs)` from the render loop, drives "the satellite is
 *     moving in this direction" perception.
 *
 * Pool grows/shrinks with the trail count. Trails with fewer than 2
 * samples are skipped (can't draw a line).
 *
 * The `_earthRadiusUnits` and `_viewport` parameters are kept for API
 * symmetry with `createGroundTrackMesh` even though `latLngAltToVec3`
 * reads `EARTH_RADIUS_UNITS` from `@/lib/geo3d` directly and the
 * ShaderMaterial does not need the viewport.
 */
export function createLiveTrails(
  _earthRadiusUnits: number,
  _viewport: LiveTrailsViewport,
): LiveTrails {
  const group = new THREE.Group();
  group.visible = false;

  // One ShaderMaterial shared across all live trails. Combines a head-
  // bright fade gradient (from `vAge`) with a marching-dash mask
  // (from `vDistance` + `uTime`). Animation is driven by `tick(timeMs)`
  // from the render loop.
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: TRAIL_COLOR },
      uPeakOpacity: { value: TRAIL_PEAK_OPACITY },
      uTime: { value: 0.0 },
      uDashCount: { value: DASH_COUNT },
      uGapFrac: { value: GAP_FRAC },
      uCyclesPerSec: { value: CYCLES_PER_SEC },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
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
      const { positions, lineDistances } = trailToAttributes(drawable[i]);
      geometries[i].setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      geometries[i].setAttribute(
        "aLineDistance",
        new THREE.BufferAttribute(lineDistances, 1),
      );
      geometries[i].computeBoundingSphere();
    }
  }

  function tick(timeMs: number): void {
    // Convert ms to seconds for the shader; CYCLES_PER_SEC is in cycles/s.
    material.uniforms.uTime.value = timeMs / 1000.0;
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

  return { group, setTrails, tick, setVisible, dispose };
}
