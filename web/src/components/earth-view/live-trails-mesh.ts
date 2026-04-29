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
  /** Update the shader's viewport-size uniform. Call from EarthView's
   *  resize handler so pixel-space width tapering stays correct under
   *  zoom and viewport changes. */
  setResolution: (width: number, height: number) => void;
  setVisible: (v: boolean) => void;
  dispose: () => void;
}

const TRAIL_COLOR = new THREE.Color(0xffae60);
const TRAIL_PEAK_OPACITY = 0.6;
const WIDTH_HEAD = 5.0;       // pixels, at the marker (newest sample)
const WIDTH_TAIL = 0.5;       // pixels, at the oldest sample
const DASH_COUNT = 6.0;
const GAP_FRAC = 0.4;         // 60% dash, 40% gap per cycle
const CYCLES_PER_SEC = 1.0;   // one full dash-shift per second

const VERTEX_SHADER = /* glsl */ `
  #define WIDTH_HEAD ${WIDTH_HEAD.toFixed(2)}
  #define WIDTH_TAIL ${WIDTH_TAIL.toFixed(2)}
  attribute float aLineDistance;
  attribute float aSide;
  attribute vec3 aTangent;
  uniform vec2 uResolution;

  varying float vAge;
  varying float vDistance;

  void main() {
    vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec4 clipTan = projectionMatrix * modelViewMatrix * vec4(position + aTangent, 1.0);

    // Compute 2D direction in screen pixel space.
    vec2 ndcPos = clipPos.xy / clipPos.w;
    vec2 ndcTan = clipTan.xy / clipTan.w;
    vec2 dirPx = (ndcTan - ndcPos) * uResolution * 0.5;
    if (length(dirPx) < 0.0001) {
      // Degenerate tangent: skip offset, keep vertex at line center.
      vAge = 1.0 - aLineDistance;
      vDistance = aLineDistance;
      gl_Position = clipPos;
      return;
    }
    vec2 dir2D = normalize(dirPx);
    vec2 perp2D = vec2(-dir2D.y, dir2D.x);

    // Width tapers head→tail by linear interpolation on vAge.
    float vAgeLocal = 1.0 - aLineDistance;
    float widthPx = mix(WIDTH_TAIL, WIDTH_HEAD, vAgeLocal);

    // Convert pixel offset to clip-space offset.
    vec2 offsetPx = perp2D * aSide * widthPx * 0.5;
    vec2 offsetClip = (offsetPx / uResolution) * 2.0 * clipPos.w;

    clipPos.xy += offsetClip;
    vAge = vAgeLocal;
    vDistance = aLineDistance;
    gl_Position = clipPos;
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

/** Convert a polyline of N points into the 5 buffer attributes a ribbon
 *  mesh needs: 2N positions (each polyline point duplicated, with the
 *  shader differentiating left/right via aSide), 2N normalized
 *  aLineDistance values (paired), 2N aSide values alternating ±1, 2N
 *  per-vertex aTangent vectors (world-space line direction at each
 *  point), and (N-1)*6 indices for the triangle pairs.
 *
 *  Tangent at point i:
 *    - i = 0:    p_1 - p_0  (forward, since no predecessor exists)
 *    - i >= 1:   p_i - p_{i-1}  (backward, for stability across polls)
 *
 *  Backward-segment tangents are stable when new samples are appended
 *  at the head: every existing point's tangent depends only on itself
 *  and its (unchanging) predecessor. This eliminates the per-poll
 *  ribbon-twist that occurs when interior points are re-tangentized.
 *
 *  Magnitude of aTangent is unimportant — the vertex shader normalizes
 *  the projected direction. Only direction matters. */
function trailToRibbonAttributes(trail: TrailPoint[]): {
  positions: Float32Array;
  lineDistances: Float32Array;
  sides: Float32Array;
  tangents: Float32Array;
  indices: Uint16Array;
} {
  const n = trail.length;
  const positions = new Float32Array(n * 2 * 3);
  const lineDistances = new Float32Array(n * 2);
  const sides = new Float32Array(n * 2);
  const tangents = new Float32Array(n * 2 * 3);
  const indices = new Uint16Array((n - 1) * 6);

  // Convert all polyline points to 3D once (avoids redundant work in the
  // tangent loop below).
  const points: Array<{ x: number; y: number; z: number }> = new Array(n);
  for (let i = 0; i < n; i++) {
    const { lat, lng, alt_km } = trail[i];
    const v = latLngAltToVec3(lat, lng, alt_km);
    points[i] = { x: v.x, y: v.y, z: v.z };
  }

  const denom = Math.max(1, n - 1);
  for (let i = 0; i < n; i++) {
    const p = points[i];

    // Tangent: backward-segment direction for everything except the first
    // (oldest) point, which uses forward-segment because it has no
    // predecessor. This rule is critical for stability across polls — when
    // a new sample is appended at the head, every existing point's tangent
    // is unchanged because each tangent depends only on the point and its
    // predecessor (which never change). Without this, the previously-newest
    // point would shift from "single-segment endpoint" to "averaged
    // interior" tangent on each poll, causing visible mid-ribbon twist
    // (perceived as flicker at the 5s polling boundary).
    let tx: number, ty: number, tz: number;
    if (i === 0) {
      const next = points[1];
      tx = next.x - p.x;
      ty = next.y - p.y;
      tz = next.z - p.z;
    } else {
      const prev = points[i - 1];
      tx = p.x - prev.x;
      ty = p.y - prev.y;
      tz = p.z - prev.z;
    }

    const lineDist = 1.0 - i / denom;
    const baseV = i * 2;

    // Vertex L (aSide = -1)
    positions[baseV * 3] = p.x;
    positions[baseV * 3 + 1] = p.y;
    positions[baseV * 3 + 2] = p.z;
    sides[baseV] = -1;
    lineDistances[baseV] = lineDist;
    tangents[baseV * 3] = tx;
    tangents[baseV * 3 + 1] = ty;
    tangents[baseV * 3 + 2] = tz;

    // Vertex R (aSide = +1) — same position and tangent, opposite side.
    const baseR = baseV + 1;
    positions[baseR * 3] = p.x;
    positions[baseR * 3 + 1] = p.y;
    positions[baseR * 3 + 2] = p.z;
    sides[baseR] = 1;
    lineDistances[baseR] = lineDist;
    tangents[baseR * 3] = tx;
    tangents[baseR * 3 + 1] = ty;
    tangents[baseR * 3 + 2] = tz;

    // Triangle indices for segment i (skip the last point — it has no
    // outgoing segment). Two triangles form the quad between point i and
    // point i+1.
    if (i < n - 1) {
      const a = baseV;       // L of point i
      const b = baseV + 1;   // R of point i
      const c = baseV + 2;   // L of point i+1
      const d = baseV + 3;   // R of point i+1
      const idxBase = i * 6;
      // Triangle 1: L_i, R_i, L_{i+1}
      indices[idxBase] = a;
      indices[idxBase + 1] = b;
      indices[idxBase + 2] = c;
      // Triangle 2: R_i, R_{i+1}, L_{i+1}
      indices[idxBase + 3] = b;
      indices[idxBase + 4] = d;
      indices[idxBase + 5] = c;
    }
  }

  return { positions, lineDistances, sides, tangents, indices };
}

/** Manages N tapered ribbon meshes for the live-mode trailing tracks.
 *
 * Each trail is a triangle-strip ribbon with three combined effects:
 *   - Width taper from WIDTH_HEAD (head, near marker) to WIDTH_TAIL
 *     (oldest end), expanded perpendicular to the line in screen space
 *     by the vertex shader so width stays in pixels regardless of zoom.
 *   - Head-bright fade gradient (head fully visible, fading to
 *     transparent at the tail) drives "this is a trailing tail"
 *     perception.
 *   - Marching dashes flowing away from the marker, advanced via
 *     `tick(timeMs)` from the render loop, drives "the satellite is
 *     leaving stuff behind" comet-tail intuition.
 *
 * Pool grows/shrinks with the trail count. Trails with fewer than 2
 * samples are skipped (can't draw a ribbon).
 *
 * Caller MUST call `setResolution(w, h)` whenever the canvas viewport
 * changes — the screen-space width tapering depends on viewport
 * dimensions. The `_earthRadiusUnits` and `_viewport` constructor
 * parameters are kept for API symmetry with `createGroundTrackMesh`.
 */
export function createLiveTrails(
  _earthRadiusUnits: number,
  _viewport: LiveTrailsViewport,
): LiveTrails {
  const group = new THREE.Group();
  group.visible = false;

  // One ShaderMaterial shared across all live trails. The vertex shader
  // expands each polyline-point pair into a screen-space-aligned ribbon
  // whose width tapers from WIDTH_HEAD (head) to WIDTH_TAIL (tail). The
  // fragment shader combines a head-bright fade gradient with a marching-
  // dash mask. Animation is driven by `tick(timeMs)` from the render loop.
  // DoubleSide is required because the ribbon is a thin 2D strip viewed
  // from a 3D camera; without it, the strip vanishes when viewed edge-on.
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: TRAIL_COLOR },
      uPeakOpacity: { value: TRAIL_PEAK_OPACITY },
      uTime: { value: 0.0 },
      uDashCount: { value: DASH_COUNT },
      uGapFrac: { value: GAP_FRAC },
      uCyclesPerSec: { value: CYCLES_PER_SEC },
      uResolution: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const meshes: THREE.Mesh[] = [];
  const geometries: THREE.BufferGeometry[] = [];

  function ensurePoolSize(n: number): void {
    while (meshes.length < n) {
      const geom = new THREE.BufferGeometry();
      const mesh = new THREE.Mesh(geom, material);
      meshes.push(mesh);
      geometries.push(geom);
      group.add(mesh);
    }
    while (meshes.length > n) {
      const mesh = meshes.pop()!;
      const geom = geometries.pop()!;
      group.remove(mesh);
      geom.dispose();
    }
  }

  function setTrails(trails: TrailPoint[][]): void {
    const drawable = trails.filter((t) => t.length >= 2);
    ensurePoolSize(drawable.length);
    for (let i = 0; i < drawable.length; i++) {
      const { positions, lineDistances, sides, tangents, indices } =
        trailToRibbonAttributes(drawable[i]);
      geometries[i].setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      geometries[i].setAttribute(
        "aLineDistance",
        new THREE.BufferAttribute(lineDistances, 1),
      );
      geometries[i].setAttribute(
        "aSide",
        new THREE.BufferAttribute(sides, 1),
      );
      geometries[i].setAttribute(
        "aTangent",
        new THREE.BufferAttribute(tangents, 3),
      );
      geometries[i].setIndex(new THREE.BufferAttribute(indices, 1));
      geometries[i].computeBoundingSphere();
    }
  }

  function tick(timeMs: number): void {
    // Convert ms to seconds for the shader; CYCLES_PER_SEC is in cycles/s.
    material.uniforms.uTime.value = timeMs / 1000.0;
  }

  function setResolution(width: number, height: number): void {
    material.uniforms.uResolution.value.set(width, height);
  }

  function setVisible(v: boolean): void {
    group.visible = v;
  }

  function dispose(): void {
    material.dispose();
    for (const g of geometries) g.dispose();
    for (const m of meshes) group.remove(m);
    meshes.length = 0;
    geometries.length = 0;
  }

  return { group, setTrails, tick, setResolution, setVisible, dispose };
}
