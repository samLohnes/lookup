# Tapered Ribbon Trail Design

**Status:** Drafted 2026-04-28. Follows the live-trail-animation feature ([spec](2026-04-28-live-trail-animation-design.md)) on `feat/live-globe-position`.

**Goal:** Replace the 1px `THREE.Line` live trail with a tapered triangle-strip ribbon mesh whose width tapers from full at the satellite marker to nearly invisible at the oldest end. Real per-vertex thickness (not just alpha falloff) — the trail visibly tapers in screen-space pixels, matching natural comet-tail intuition. Keeps the existing dash animation, fade gradient, and `tick(timeMs)` API.

**Architecture:** Custom triangle-strip mesh built per trail. Each polyline point becomes 2 vertices (one per side). A custom `ShaderMaterial` (replacing the current line-based one) expands each pair perpendicular to the line direction in screen space, scaled by a width that interpolates from `WIDTH_HEAD = 5px` to `WIDTH_TAIL = 0.5px` along the trail. Resolution-aware: a new `liveTrails.setResolution(w, h)` method propagates viewport size from `EarthView`'s existing `handleResize` flow.

**Tech Stack:** Three.js + GLSL ES 1.0 (custom vertex + fragment shader). Vitest. No new dependencies.

---

## 1. Context

The live-trail-animation feature shipped a 1px `THREE.Line` with a custom shader doing head-bright fade + marching dashes. During smoke testing the user asked for "thicker at the start of the trail at the satellite and then taper as it goes." The previous iteration tried `pow(vAge, 2.5)` for steeper alpha falloff — visually approximated tapering by ink density, but the line stayed 1px wide everywhere.

Real geometric tapering needs a ribbon mesh: instead of drawing a polyline, draw a thin 2D strip where each segment is a quad. Width is per-vertex via an attribute that varies along the trail. The shader expands the geometry in screen space so width stays consistent in pixels regardless of camera distance or zoom.

This is the standard "fat-line" technique used by Three.js's `Line2` internally, but Line2's per-segment width is uniform per material — not per-vertex. We build our own.

---

## 2. Goals & Non-Goals

### 2.1 Goals

1. **Triangle-strip ribbon mesh** replaces `THREE.Line` in `live-trails-mesh.ts`. Each trail polyline of N points → mesh of 2N vertices and (N-1) × 2 triangles (= 6 indices per segment).
2. **Per-vertex width via attribute** plus shader-derived taper: width interpolates from `WIDTH_HEAD = 5.0` px at the head to `WIDTH_TAIL = 0.5` px at the tail. Computed in the vertex shader from `aLineDistance` (already present).
3. **Screen-space expansion** in the vertex shader using a per-vertex `aTangent` attribute (the local line direction). The shader projects position+tangent to NDC, computes the 2D direction in screen space, takes the perpendicular, and offsets each vertex by `aSide * width / 2` pixels.
4. **`aTangent` computation** in JS at `setTrails()` time. For point 0 (oldest): forward-segment direction (`P_1 - P_0`) because no predecessor exists. For all other points (i ≥ 1): backward-segment direction (`P_i - P_{i-1}`). This rule is critical for stability when new samples are appended at the head: every existing point's tangent depends only on itself and its predecessor, neither of which changes when a new point is added at the end. The original "averaged interior" rule caused visible mid-ribbon twist (flicker) at each poll boundary as the previously-newest point was re-tangentized.
5. **`aSide` attribute** alternates -1, +1, -1, +1, ... — pairs share the same `aLineDistance` and `aTangent`, differ only in side.
6. **`liveTrails.setResolution(width, height)`** new method updating a `uResolution` uniform. Called from `EarthView`'s existing `handleResize` and once after scene creation. The shader needs viewport dimensions to convert pixel offsets to clip-space offsets correctly.
7. **Existing animation preserved.** Dash mask, fade gradient (`pow(vAge, 2.5)`), `-uTime` flow direction, `tick(timeMs)` API — all unchanged.
8. **Pool architecture preserved.** One shared `ShaderMaterial` across all trails; each trail has its own `BufferGeometry`. Pool grows/shrinks via existing `ensurePoolSize`.
9. **End caps:** square (no special end-cap geometry). The endpoint tangent is the single-segment direction, so the perpendicular at the very last point is well-defined; the strip simply ends with a vertical edge. Acceptable at 5px thickness.

### 2.2 Non-Goals

- **Round end-caps.** Adds ~30 lines of geometry generation; not visible at the chosen widths.
- **Variable width via dedicated `aLineWidth` attribute.** Width is derived from `aLineDistance` in the shader (one less attribute). If we ever want a non-monotonic taper (e.g., bulge in the middle) we'd add it; not needed now.
- **Mitering / bevel join handling.** At sharp corners (>90°) the averaged-tangent ribbon will narrow visibly. LEO orbits are smooth curves — sharp corners shouldn't appear in normal use.
- **Anti-aliased ribbon edges.** The shader does not soften the perpendicular edges. The dash mask edges already get a `discard` cliff. Real AA would need MSAA or analytic edge distance — overkill for v1.
- **World-space width (instead of screen-space).** Screen-space width is the comet-tail visual we want. World-space would shrink as the camera zooms out, opposite of what's wanted.
- **Per-trail color hashing or sunlit shading.** Same non-goals as the previous trail spec.

---

## 3. File-level changes

### 3.1 `web/src/components/earth-view/live-trails-mesh.ts`

Replace `THREE.Line` with a `THREE.Mesh` per trail, using `THREE.BufferGeometry` with `position`, `aLineDistance`, `aSide`, `aTangent` attributes plus an indexed triangle-strip.

#### 3.1.1 Constants

```typescript
const TRAIL_COLOR = new THREE.Color(0xffae60);
const TRAIL_PEAK_OPACITY = 0.6;
const WIDTH_HEAD = 5.0;       // pixels, at the marker (newest sample)
const WIDTH_TAIL = 0.5;       // pixels, at the oldest sample
const DASH_COUNT = 6.0;
const GAP_FRAC = 0.4;
const CYCLES_PER_SEC = 1.0;
```

#### 3.1.2 Vertex shader

```glsl
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
    // Degenerate tangent: skip offset.
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
```

`WIDTH_HEAD` and `WIDTH_TAIL` are GLSL `const`s injected at material-construction time via shader-string concatenation (see §3.1.4) so the constants live in one TypeScript-side place but become compile-time scalars in the shader.

#### 3.1.3 Fragment shader (unchanged from prior commit)

```glsl
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
  float alpha = pow(vAge, 2.5) * uPeakOpacity * dashMask;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(uColor, alpha);
}
```

#### 3.1.4 ShaderMaterial construction

The vertex shader's `WIDTH_HEAD` / `WIDTH_TAIL` constants are inlined via string concatenation:

```typescript
const VERTEX_SHADER = `
  #define WIDTH_HEAD ${WIDTH_HEAD.toFixed(2)}
  #define WIDTH_TAIL ${WIDTH_TAIL.toFixed(2)}
  attribute float aLineDistance;
  attribute float aSide;
  attribute vec3 aTangent;
  uniform vec2 uResolution;
  varying float vAge;
  varying float vDistance;
  void main() {
    // ... (body from §3.1.2)
  }
`;
```

Material:
```typescript
const material = new THREE.ShaderMaterial({
  uniforms: {
    uColor: { value: TRAIL_COLOR },
    uPeakOpacity: { value: TRAIL_PEAK_OPACITY },
    uTime: { value: 0.0 },
    uDashCount: { value: DASH_COUNT },
    uGapFrac: { value: GAP_FRAC },
    uCyclesPerSec: { value: CYCLES_PER_SEC },
    uResolution: { value: new THREE.Vector2(1, 1) },  // overwritten on first setResolution
  },
  vertexShader: VERTEX_SHADER,
  fragmentShader: FRAGMENT_SHADER,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,  // ribbon must be visible from both sides at camera angles
});
```

#### 3.1.5 Geometry build per trail

`trailToAttributes` becomes `trailToRibbonAttributes`:

```typescript
function trailToRibbonAttributes(trail: TrailPoint[]): {
  positions: Float32Array;       // 2N × 3
  lineDistances: Float32Array;   // 2N × 1
  sides: Float32Array;           // 2N × 1
  tangents: Float32Array;        // 2N × 3
  indices: Uint16Array;          // (N-1) × 6
} {
  const n = trail.length;
  const positions = new Float32Array(n * 2 * 3);
  const lineDistances = new Float32Array(n * 2);
  const sides = new Float32Array(n * 2);
  const tangents = new Float32Array(n * 2 * 3);
  const indices = new Uint16Array((n - 1) * 6);

  // Convert trail points to 3D once.
  const points: Array<{ x: number; y: number; z: number }> = new Array(n);
  for (let i = 0; i < n; i++) {
    const { lat, lng, alt_km } = trail[i];
    const v = latLngAltToVec3(lat, lng, alt_km);
    points[i] = { x: v.x, y: v.y, z: v.z };
  }

  const denom = Math.max(1, n - 1);
  for (let i = 0; i < n; i++) {
    const p = points[i];
    // Tangent: backward-segment for everything except the first (oldest)
    // point. This rule is stable across polls — appending a new sample at
    // the head leaves every existing tangent unchanged.
    let tx: number, ty: number, tz: number;
    if (i === 0) {
      const next = points[1];
      tx = next.x - p.x; ty = next.y - p.y; tz = next.z - p.z;
    } else {
      const prev = points[i - 1];
      tx = p.x - prev.x; ty = p.y - prev.y; tz = p.z - prev.z;
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

    // Vertex R (aSide = +1)
    positions[(baseV + 1) * 3] = p.x;
    positions[(baseV + 1) * 3 + 1] = p.y;
    positions[(baseV + 1) * 3 + 2] = p.z;
    sides[baseV + 1] = 1;
    lineDistances[baseV + 1] = lineDist;
    tangents[(baseV + 1) * 3] = tx;
    tangents[(baseV + 1) * 3 + 1] = ty;
    tangents[(baseV + 1) * 3 + 2] = tz;

    // Indices: for each segment i (0 to n-2), emit 2 triangles.
    if (i < n - 1) {
      const a = baseV;       // L of point i
      const b = baseV + 1;   // R of point i
      const c = baseV + 2;   // L of point i+1
      const d = baseV + 3;   // R of point i+1
      const idxBase = i * 6;
      // Triangle 1: a, b, c  (L_i, R_i, L_{i+1})
      indices[idxBase] = a;
      indices[idxBase + 1] = b;
      indices[idxBase + 2] = c;
      // Triangle 2: b, d, c  (R_i, R_{i+1}, L_{i+1})
      indices[idxBase + 3] = b;
      indices[idxBase + 4] = d;
      indices[idxBase + 5] = c;
    }
  }

  return { positions, lineDistances, sides, tangents, indices };
}
```

The triangle winding is consistent with `THREE.DoubleSide` material so backface culling is irrelevant.

#### 3.1.6 `setTrails` writes all attributes

```typescript
function setTrails(trails: TrailPoint[][]): void {
  const drawable = trails.filter((t) => t.length >= 2);
  ensurePoolSize(drawable.length);
  for (let i = 0; i < drawable.length; i++) {
    const { positions, lineDistances, sides, tangents, indices } =
      trailToRibbonAttributes(drawable[i]);
    geometries[i].setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometries[i].setAttribute("aLineDistance", new THREE.BufferAttribute(lineDistances, 1));
    geometries[i].setAttribute("aSide", new THREE.BufferAttribute(sides, 1));
    geometries[i].setAttribute("aTangent", new THREE.BufferAttribute(tangents, 3));
    geometries[i].setIndex(new THREE.BufferAttribute(indices, 1));
    geometries[i].computeBoundingSphere();
  }
}
```

#### 3.1.7 Pool uses `THREE.Mesh` instead of `THREE.Line`

```typescript
function ensurePoolSize(n: number): void {
  while (meshes.length < n) {
    const geom = new THREE.BufferGeometry();
    const mesh = new THREE.Mesh(geom, material);  // Mesh, not Line
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
```

(Variable rename: `lines` → `meshes` throughout the file.)

#### 3.1.8 New `setResolution` method

```typescript
function setResolution(width: number, height: number): void {
  material.uniforms.uResolution.value.set(width, height);
}
```

Added to the `LiveTrails` interface and returned from `createLiveTrails` alongside `tick`/`setTrails`/`setVisible`/`dispose`:

```typescript
export interface LiveTrails {
  group: THREE.Group;
  setTrails: (trails: TrailPoint[][]) => void;
  tick: (timeMs: number) => void;
  /** Update the shader's viewport-size uniform. Called from EarthView's
   *  resize handler so pixel-space width tapering stays correct. */
  setResolution: (width: number, height: number) => void;
  setVisible: (v: boolean) => void;
  dispose: () => void;
}
```

### 3.2 `web/src/components/earth-view/earth-view.tsx`

Two changes:

1. Inside `handleResize` (currently `~/lines 71-82`), add `handles.liveTrails.setResolution(w, ht)` alongside the existing `renderer.setSize(w, ht)` and `camera.aspect = ...` calls.

2. After `createScene().then((handles) => { ... })` resolves and the initial `handleResize()` fires, no separate call is needed — `handleResize` already sets the resolution. (The first `handleResize` at the end of the createScene `.then` block will propagate the initial viewport size to the trail material.)

### 3.3 Tests — `web/src/components/earth-view/live-trails-mesh.test.ts`

Existing 8 tests adapt as follows:

- **"starts with an empty group and visible=false"** — unchanged.
- **"setTrails creates one polyline per non-empty trail"** — assertion stays (`group.children.length === 2`); each child is now a `THREE.Mesh` instead of `THREE.Line`. Update the cast: `lt.group.children[0] as THREE.Mesh`.
- **"setTrails skips trails with fewer than 2 samples"** — unchanged.
- **"setTrails shrinks the pool when given fewer trails"** — unchanged.
- **"setVisible toggles group visibility"** — unchanged.
- **"setTrails places vertices at latLngAltToVec3 results (regression guard)"** — assertions need to account for 2N vertices instead of N. Update to assert that vertex `0` (L of point 0) and vertex `2` (L of point 1) match the expected positions. Both L and R vertices share the same `position` attribute value — only `aSide` differs.
- **"setTrails writes aLineDistance attribute (1.0 at oldest, 0.0 at newest)"** — count is now 2N (was N). Update expected count to 6 (was 3) for a 3-point trail. Pair indices [0,1] share aLineDistance=1.0; [2,3] share 0.5; [4,5] share 0.0.
- **"tick(timeMs) updates the material uTime uniform"** — material is on a `THREE.Mesh` now; cast accordingly.

New tests added:

- **"setTrails writes aSide attribute alternating -1, +1"** — assert the per-vertex side values for a 3-point trail: `[-1, 1, -1, 1, -1, 1]`.
- **"setTrails writes aTangent attribute (averaged for interior, single-segment for endpoints)"** — for a 3-point trail at known positions, assert the tangent values match `next - p` at index 0, `(next - prev) / 2` at index 1, `p - prev` at index 2.
- **"setTrails writes triangle indices (6 per segment)"** — for a 3-point trail (2 segments), assert `indices.length === 12` and the index pattern `[0,1,2, 1,3,2, 2,3,4, 3,5,4]`.
- **"setResolution updates the uResolution uniform"** — call `setResolution(1024, 768)`, assert `material.uniforms.uResolution.value.x === 1024` and `.y === 768`.

The shader output itself (actual width tapering, screen-space expansion) isn't testable in jsdom — visual correctness lives in the manual smoke step.

---

## 4. Risk register

| Risk | Mitigation |
|---|---|
| Tangent at endpoint of a 1-segment trail is well-defined but the very last point's `aTangent = p - prev` has no future point to average with — could cause visible "snap" at end | Tangent uses last-segment direction only at the endpoint. For a smooth curve (LEO orbit) the snap is sub-pixel. Accept. |
| Sharp corners (>~90° turn) cause the ribbon to pinch at the inside corner because both sides offset by `width/2` from the average tangent | LEO orbits are smooth; sharp corners shouldn't appear. If they do, it'll look like a pinch — visible but not catastrophic. |
| `THREE.DoubleSide` doubles fragment shading cost | Trail screen footprint is ≤ 1% of viewport; cost is negligible. |
| `uResolution` not set before first frame → division by 1×1 produces wrong widths | `setResolution` is called from `handleResize` which fires immediately after `createScene` resolves (existing behavior). First frame after that has correct resolution. Worst case: one frame at degenerate width — invisible. |
| Tangent attribute in world space, not unit-length | The shader normalizes `dirPx = (ndcTan - ndcPos) * uResolution * 0.5` then `dir2D = normalize(dirPx)`. Magnitude of `aTangent` doesn't matter — only direction. ✓ |
| Degenerate tangent (two identical consecutive points) → length(dirPx) ≈ 0 → division by zero | Shader has explicit `if (length(dirPx) < 0.0001) return;` — falls through with no offset. Vertex sits exactly at line center; visually invisible (zero-width segment). |

---

## 5. Out of scope (explicitly)

- Round / butt / arrow end caps.
- Ribbon mitering / bevel joins for sharp corners.
- Anti-aliased ribbon edges (MSAA, signed distance).
- World-space width.
- Per-NORAD color or sunlit shading.
- Variable dash speed by satellite velocity.
- Configurable widths via UI.
- Slerp camera tween (separate pre-existing follow-up).
- Dashes for the pass-arc ground track.
