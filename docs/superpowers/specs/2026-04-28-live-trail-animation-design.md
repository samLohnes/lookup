# Live Trail Animation Design

**Status:** Drafted 2026-04-28. Follows the live-globe-position feature ([spec](2026-04-27-live-globe-position-design.md), shipping on `feat/live-globe-position`).

**Goal:** Replace the static uniform-opacity live trail with an animated visual that conveys satellite motion at globe scale. Two combined effects: (a) head-bright/tail-transparent fade gradient and (b) marching-dashes that flow toward the marker. At smoke-test it became clear the existing trail's slow head-creep doesn't read as motion — the animation closes that perception gap.

**Architecture:** Replace `LineBasicMaterial` in `web/src/components/earth-view/live-trails-mesh.ts` with a small custom `ShaderMaterial` that handles both effects in one shader. Vertex shader passes two varyings (`vAge`, `vDistance`) computed from a per-vertex `aLineDistance` attribute written at `setTrails()` time. Fragment shader multiplies the gradient by a moving dash mask. The earth-view rAF loop calls a new `liveTrails.tick(timeMs)` once per frame to advance the dash phase.

**Tech Stack:** Three.js + GLSL (small inline shader). No new dependencies.

---

## 1. Context

The shipped live-mode feature draws a faint orange polyline behind each live satellite marker, ~10 minutes of trailing samples appended at 5s polling cadence. At globe scale and LEO speeds, the marker moves ~6% of its own diameter per second — perceptually slow. During smoke testing, the trail "looked static" even though the head-end was creeping forward as samples landed. The user explicitly asked for "some sort of animation on the tail to imply movement."

Two visual cues that imply motion in a static-camera moving-object scene:

- **Head-to-tail fade gradient.** Brighter near the moving end, fading to transparent at the oldest end. The marker pulls the bright tip with it as it moves; the asymmetry implies "this is the trailing end."
- **Marching dashes.** Dashes that flow along the trail in the direction of motion. Active animation in the visual itself — communicates motion without requiring the user to notice slow per-frame change.

This spec combines both ("option C" from the brainstorm).

---

## 2. Goals & Non-Goals

### 2.1 Goals

1. **Custom `ShaderMaterial`** replaces `LineBasicMaterial` in `live-trails-mesh.ts`. One material, shared across all live trails (preserves the current pool architecture).
2. **Per-vertex `aLineDistance` attribute** written at `setTrails()` time. Stores cumulative-fraction-normalized distance: 0.0 at the head (newest sample), 1.0 at the tail (oldest sample). Independent of absolute trail length — same shader works for trails of varying point counts.
3. **Vertex shader** passes `vAge = 1.0 - aLineDistance` (head-bright fraction) and `vDistance = aLineDistance` (raw position-along-line) to the fragment shader.
4. **Fragment shader** computes `alpha = pow(vAge, 2.5) * uPeakOpacity * dashMask`:
   - `dashMask = step(gapFrac, fract(vDistance * dashCount - uTime * cyclesPerSec))`
   - The `-uTime` direction makes dashes flow *away* from the head: dash crests satisfy `x*N - t*S = const`, so as `t` grows `x` migrates to higher values (toward the tail), reading as "trail being shed behind the satellite" — matching comet-tail / exhaust visual intuition.
   - The `pow(vAge, 2.5)` curve (instead of plain `vAge`) tapers the trail's ink density aggressively. At the middle of the trail, `vAge=0.5` produces alpha ≈ 0.18 instead of 0.5. Visually reads as thinning toward the tail without changing actual pixel width.
5. **`liveTrails.tick(timeMs: number)`** new method on the public API. Updates the shared material's `uTime` uniform. Called once per frame from `earth-view.tsx`'s rAF loop.
6. **Color and opacity** stay close to current: orange `0xffae60`, peak alpha 0.6 at the head (slightly brighter than current 0.35 because the fade-out at the tail compensates for the average brightness budget). Material is `transparent: true`.
7. **Dash parameters (uniforms — fixed at material construction):** `dashCount = 6.0`, `gapFrac = 0.4`, `cyclesPerSec = 1.0`. Tunable as constants in the file; not user-configurable.

### 2.2 Non-Goals

- **Trail color shift based on sunlit state.** Existing pass-arc trail doesn't do this; pattern can be added later if it matters.
- **Per-NORAD color hashing.** Spec §2.1 of the live-globe-position design explicitly chose uniform color; this spec preserves that decision.
- **Variable dash speed based on satellite velocity.** The orbital-period variation across LEO sats is small enough that fixed dash speed reads identically for all of them.
- **Slerp camera tween for the Locate button.** Separate pre-existing follow-up.
- **Dashes for the pass-arc ground track.** That's a different visual surface with progress-cursor semantics; not changed by this spec.
- **Configurable dash parameters via UI.** YAGNI.
- **Distance-from-camera fade (LOD).** Trail is faint enough at all distances that this doesn't matter visually.

---

## 3. File-level changes

### 3.1 `web/src/components/earth-view/live-trails-mesh.ts`

Replace the existing `material` construction. Pseudocode:

```typescript
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
    float alpha = pow(vAge, 2.5) * uPeakOpacity * dashMask;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

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
```

### 3.2 Per-vertex `aLineDistance` computation

`setTrails()` extended to write the new attribute alongside `position`. The trail array order in our store is **oldest → newest** (latest sample appended at the end via `applyPoll`). For the fade we want the newest (head) at `aLineDistance = 0` and the oldest (tail) at `aLineDistance = 1`, so we count down from index `n-1` to `0`:

```typescript
function trailToAttributes(trail: TrailPoint[]): {
  positions: Float32Array;
  lineDistances: Float32Array;
} {
  const n = trail.length;
  const positions = new Float32Array(n * 3);
  const lineDistances = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const { lat, lng, alt_km } = trail[i];
    const v = latLngAltToVec3(lat, lng, alt_km);
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
    // i = 0 is oldest (tail, fully faded), i = n-1 is newest (head, fully bright)
    lineDistances[i] = 1.0 - i / Math.max(1, n - 1);
  }
  return { positions, lineDistances };
}
```

(Naming kept as `lineDistances` for symmetry with Three.js's built-in `computeLineDistances()` even though the values are normalized index-fractions, not arc-length. The shader treats them as a parameter from 0 to 1; absolute distance doesn't matter for the fade or dash pattern.)

`setTrails()` writes both `position` and `aLineDistance` attributes:

```typescript
geometries[i].setAttribute("position", new THREE.BufferAttribute(positions, 3));
geometries[i].setAttribute("aLineDistance", new THREE.BufferAttribute(lineDistances, 1));
geometries[i].computeBoundingSphere();
```

### 3.3 New `tick(timeMs)` method on the `LiveTrails` API

```typescript
function tick(timeMs: number): void {
  // Convert ms to seconds for the shader.
  material.uniforms.uTime.value = timeMs / 1000.0;
}
```

Returned from `createLiveTrails` alongside `setTrails`/`setVisible`/`dispose`. Public API.

### 3.4 `web/src/components/earth-view/earth-view.tsx`

In the existing rAF loop's live-mode active branch (currently lines ~111-155 from the E2 commit), after `liveTrails.setTrails(trails)`, add:

```typescript
handles.liveTrails.setTrails(trails);
handles.liveTrails.tick(performance.now());  // ← new
handles.liveTrails.setVisible(true);
```

`tick()` must run every frame (not only when trails change), so the dash pattern keeps moving even when no new poll has arrived. The render loop already runs at 60fps, so this is free.

### 3.5 Tests

Extend `web/src/components/earth-view/live-trails-mesh.test.ts`:

- **Existing tests** (initial state, multi-trail creation, sub-2 sample filter, pool shrink, visibility toggle, vertex-position regression guard) all still pass — the geometry attributes and group structure are unchanged.
- **New test 1: `aLineDistance` attribute is written.** After `setTrails([...])`, assert `geometries[0].getAttribute("aLineDistance")` exists, has the right `count`, and the values are `[1.0, 0.5, 0.0]` for a 3-point trail (oldest=1, middle=0.5, newest=0).
- **New test 2: `tick(timeMs)` updates the material's `uTime` uniform.** Get the (private but accessible-via-mesh) material, call `tick(2500)`, assert `material.uniforms.uTime.value === 2.5`.

The shader output itself isn't unit-testable in jsdom (no GPU), so visual correctness is verified manually in the smoke test (Task F1 from the parent spec).

---

## 4. Risk register

| Risk | Mitigation |
|---|---|
| Shader compilation fails on some GPUs | The shader uses only ES 1.0 features (`fract`, `step`, `attribute`, `varying`) supported universally. No control flow, no textures, no extensions. |
| Dashes strobe at high frame rates | `cyclesPerSec = 1.0` → dash pattern shifts ~16.7% of one dash per frame at 60fps. Well below the strobing threshold (sub-Nyquist for the dash density). |
| `tick(timeMs)` not called → dashes freeze | If the rAF loop fails to call `tick()`, dashes stop moving but the gradient still works — graceful degradation. |
| `discard` in fragment shader hurts perf | At ~6 dashes × 0.4 gap = ~40% pixel discard rate. Negligible at the trail's small screen footprint (typically <0.1% of viewport pixels). |
| `aLineDistance` attribute disposal leak | `geom.dispose()` already releases all attributes including the new one — no extra work needed. |
| Rapid `tick()` calls mutate the shared uniform during a frame | The uniform is read once per draw call; concurrent writes from multiple call sites would still resolve to the last-written value before the next render. Practically: only earth-view's rAF loop calls `tick()`, so no concurrency. |

---

## 5. Out of scope (explicitly)

- Trail color shift based on satellite sunlit state.
- Per-NORAD color hashing.
- Variable dash speed based on satellite velocity (km/s field on each sample).
- User-configurable dash parameters.
- Slerp camera tween.
- Dashes for the pass-arc ground track.
- Distance-from-camera LOD fade.
