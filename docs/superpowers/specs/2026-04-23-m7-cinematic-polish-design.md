# M7 — Cinematic Polish Design

**Status:** Drafted 2026-04-23. Targets shipping after v0.6.0 (m6-cinematic).

**Goal:** Apply a unified "Observatory" aesthetic across the cinematic mode — paired display serif + sans typography, amber-gold accent, cinematic motion, and a procedural Milky Way starfield replacing the pixelated texture. Plus two small polish items: atmosphere shader tuning and a redesigned Observer Elevation field.

**Architecture:** No structural changes. One new procedural starfield mesh (replaces the textured sphere; drops ~2 MB from the earth-view chunk), a new typography + color token layer, a motion-token constants module, and targeted visual edits to six existing components (chrome pills, left drawer, pass rail, PiP, bottom dock, elevation field). Zero new backend or data-layer work.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind 3, Three.js (fragment shader for starfield). New web fonts: Fraunces (serif) + JetBrains Mono — loaded from Google Fonts. No new JS dependencies.

---

## 1. Context

v0.6.0 shipped cinematic mode (full-viewport 3D earth, drawers, PiP sky view, mode toggle, commit-then-query). The functional structure works; the visual layer is currently generic — default system sans, plain chrome pills, faceted/pixelated starfield, unpolished elevation field. This spec unifies the visual layer under a single aesthetic direction so the product reads as a deliberate "observatory interface" instead of a dashboard.

### 1.1 Design reference

**Aesthetic direction: Observatory.**
- Display serif (Fraunces, upright — not italic) for section titles, rail headers, rooted-in-the-product labels
- Inter for body, UI chrome, controls
- JetBrains Mono for tabular numerics (telemetry, time codes, coordinates)
- Amber-gold accent (`#ffae60` and tints) — already present as the satellite marker color; now unified across active states, focus rings, pass rail highlights, PiP chrome
- Deep navy backgrounds (`#0a0d14` / `#040810` family) — unchanged
- Cinematic motion — longer durations with `cubic-bezier(0.22, 1, 0.36, 1)` (snappy-to-land), 180-300ms depending on surface

---

## 2. Goals & Non-Goals

### 2.1 Goals

1. **Fix starfield pixelation** by replacing the 4K JPEG on a 32-segment sphere with a procedural fragment shader (infinite resolution, per-pixel stars + subtle Milky Way band).
2. **Introduce a typography pairing** (Fraunces + Inter + JetBrains Mono) and apply it consistently across cinematic surfaces.
3. **Unify the amber-gold accent** across chrome pills, pass rail, PiP, drawer, bottom dock — so "active" / "focused" / "selected" reads as one visual language.
4. **Replace snap-open/close drawer and PiP transitions** with cinematic motion (260ms drawer slide, 220ms PiP fade-and-scale, 180ms chrome hover, all using the same easing curve).
5. **Upgrade chrome pill interactions** — proper hover/active/focus-visible states, optional keyboard-hint badges (⌘M / ⌘T / ⌘V).
6. **Refine PiP chrome** — larger header with gradient fade, circular amber close button, thicker/larger resize handle.
7. **Redesign Observer elevation field** as a compact card with the auto-sampled value displayed prominently, an `[auto]` / `[overridden]` state chip, and an `[Override]` button that expands the numeric input.
8. **Tune atmosphere shader** — bump intensity `1.1 → 1.4`, shift color `0x7ab0e0 → 0x6aa5e8` so the halo reads against the new starfield.
9. **Respect `prefers-reduced-motion`** — all motion reduces to instant where appropriate.

### 2.2 Non-goals

- **Earth-view loader redesign** (deferred to future polish)
- **Pass rail compact bar redesign** (magnitude bar / direction arrow — deferred)
- **Bottom playback dock functional changes** (just visual treatment — no scrubber redesign)
- **Day/night terminator re-enablement** (explicitly left disabled per prior decision)
- **Ground-track fractional tip precision** (deferred)
- **Research mode polish** (this milestone is cinematic-only; research mode inherits typography + color via the Tailwind tokens but gets no layout changes)
- **Research mode earth view** (remains absent)
- **Mobile cinematic** (still desktop-only)

---

## 3. Typography System

### 3.1 Fonts

- **Fraunces** — display serif. Google Fonts. Used upright (NOT italic), weights 400/500. Variable font so we load once.
- **Inter** — body sans. Google Fonts. Weights 400/500/600. Variable font.
- **JetBrains Mono** — tabular numerics. Google Fonts. Weight 400.

Load via a single `<link>` tag in `web/index.html` using Google Fonts' variable-font URLs. Total network cost: ~180 KB compressed (all three variable fonts together).

### 3.2 Type scale

| Role | Face | Size | Weight | Use |
|---|---|---|---|---|
| Display | Fraunces | 22-28px | 500 | PiP header, major drawer section titles |
| Heading | Fraunces | 13-16px | 500 | "Passes" rail header, drawer section labels (Observer/Satellite/Window) |
| Body | Inter | 12-14px | 400 | Field labels, dropdown items, addresses |
| UI | Inter | 10.5-11px | 500 | Chrome pills, buttons, status chips |
| Caption | Inter | 9-10px | 500 | Kickers (e.g. "5 tonight"), label-upper text |
| Label (tiny caps) | Inter | 8.5-9px | 600 | Telemetry prefixes (alt / el / mag) — uppercase with 0.08em letter-spacing |
| Mono data | JetBrains Mono | 10-12px | 400 | Coordinates, time codes, telemetry values — tabular nums |

### 3.3 Tailwind tokens

Add to `web/tailwind.config.js`:

```js
fontFamily: {
  serif: ['Fraunces', 'Georgia', 'serif'],
  sans: ['Inter', 'system-ui', 'sans-serif'],  // already there; explicit
  mono: ['JetBrains Mono', 'Menlo', 'monospace'],
}
```

Existing Inter tokens stay; add Fraunces + JetBrains Mono.

---

## 4. Color Palette

### 4.1 Amber-gold accent (the big addition)

New tokens for the Observatory accent:

| Token | Hex | Role |
|---|---|---|
| `accent-50` | `#fff5e6` | High-contrast text on amber fills |
| `accent-200` | `#ffdcaa` | Active pill text, PiP header accent |
| `accent-400` | `#ffae60` | Primary accent (matches satellite marker) |
| `accent-500` | `#ff9650` | Hover/pressed primary |
| `accent-border` | `rgba(255, 174, 96, 0.3)` | Active pill borders, drawer tab borders |
| `accent-fill-08` | `rgba(255, 174, 96, 0.08)` | Subtle amber backgrounds |
| `accent-fill-14` | `rgba(255, 174, 96, 0.14)` | Active state backgrounds |
| `accent-glow` | `rgba(255, 174, 96, 0.5)` | Shadow/glow emissions |

Add to Tailwind as both fixed colors (`accent-400`) and arbitrary alpha variants. Put these under a `satvis/` prefix if needed to avoid colliding with existing `accent` usage — check first.

### 4.2 Preserved existing tokens

- `bg` / `bg-raised` / `bg-sunken` — unchanged
- `fg` / `fg-muted` / `fg-subtle` — unchanged
- `edge` — unchanged
- Existing `observer` blue (`#4a9eff`) — unchanged (used for observer pin)

---

## 5. Motion Library

### 5.1 Tokens

New `web/src/lib/motion.ts`:

```ts
/** Cinematic motion tokens used across chrome, drawers, PiP, and pass rail. */
export const MOTION = {
  /** "Snappy-to-land" curve — quick start, gentle stop. Use for all transitions. */
  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
  /** Fast: hover / color shifts. */
  fast: 180,
  /** Medium: PiP open/close, modal fade. */
  medium: 220,
  /** Slow: drawer slides, layout shifts. */
  slow: 260,
  /** Cinematic: camera reframes, major layout transitions. */
  cinematic: 300,
} as const;

/** Returns a Tailwind-friendly `transition` string combining duration + curve. */
export function cssTransition(
  properties: string,
  duration: keyof Omit<typeof MOTION, "ease"> = "fast",
): string {
  return `${properties} ${MOTION[duration]}ms ${MOTION.ease}`;
}
```

Usage in components: apply `transition` attributes inline via style or via Tailwind classes.

### 5.2 Surface-specific motion

| Surface | Trigger | Duration | Properties |
|---|---|---|---|
| Chrome pill | hover | 180ms | `background`, `border-color`, `color` |
| Chrome pill | focus-visible | 180ms | `box-shadow` (focus ring) |
| Drawer | open/close | 260ms | `transform: translateX(...)`, `opacity` |
| PiP | open/close (auto) | 220ms | `opacity`, `transform: scale(0.96 → 1)` |
| PiP | drag / resize | — | no transition (real-time follow pointer) |
| Pass rail | expand/collapse | 260ms | `width` |
| Pass bar | active-state change | 180ms | `background`, `border-color` |

### 5.3 `prefers-reduced-motion`

Wrap animation class application in a helper or use media query. Durations collapse to 0ms; transform properties can still apply instantly (no visible motion, just state swap).

---

## 6. Procedural Starfield

### 6.1 Approach

Replace the current `MeshBasicMaterial({ map: texture })` sphere with a `ShaderMaterial` whose fragment shader generates stars per-pixel based on the fragment's world-space direction from the camera.

**Shader architecture:**

```glsl
// vertex — pass through world position
varying vec3 vWorldPos;
void main() {
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

// fragment — hash the direction, generate stars + milky way
varying vec3 vWorldPos;

float hash(vec3 p) {
  p = fract(p * vec3(443.8975, 397.2973, 491.1871));
  p += dot(p, p.yxz + 19.19);
  return fract((p.x + p.y) * p.z);
}

vec3 starColor(float rand) {
  // Slight color variation: bluer / white / warmer based on hash value
  if (rand > 0.97) return vec3(1.0, 0.85, 0.65);  // rare warm
  if (rand > 0.92) return vec3(0.75, 0.85, 1.0);  // rare cool
  return vec3(1.0, 0.97, 0.9);                     // common white-warm
}

void main() {
  vec3 dir = normalize(vWorldPos);

  // Tier 1: dense fine stars (small, subtle)
  vec3 q1 = dir * 800.0;
  float h1 = hash(floor(q1));
  float star1 = smoothstep(0.997, 1.0, h1);

  // Tier 2: medium stars
  vec3 q2 = dir * 250.0;
  float h2 = hash(floor(q2));
  float star2 = smoothstep(0.992, 1.0, h2) * 0.8;

  // Tier 3: rare bright stars
  vec3 q3 = dir * 80.0;
  float h3 = hash(floor(q3));
  float star3 = smoothstep(0.985, 1.0, h3) * 1.1;

  // Milky Way band: along a tilted plane
  vec3 galacticPlane = normalize(vec3(sin(0.38), 0.0, cos(0.38)));
  float bandDist = abs(dot(dir, galacticPlane));
  float band = smoothstep(0.35, 0.0, bandDist) * 0.12;
  vec3 bandColor = vec3(0.55, 0.48, 0.68);

  vec3 color = band * bandColor;
  float bright = max(star1, max(star2, star3));
  float hueSelector = h1 * 2.0; // reuse hash for color variation
  color += bright * starColor(hueSelector);

  gl_FragColor = vec4(color, 1.0);
}
```

### 6.2 Mesh structure

- Geometry: `SphereGeometry(earthRadius * 10, 64, 32)` — doubled subdivision vs. the old 32/16 (ensures the per-vertex interpolation to the fragment shader is smooth; with a shader-based material, vertex count affects normal smoothness only).
- Material: `ShaderMaterial` with `side: THREE.BackSide`, `depthWrite: false`.
- No texture uniform, no image loading — the mesh becomes sync-ready (no async in `createStarfieldMesh`).

### 6.3 File changes

**Modified:** `web/src/components/earth-view/starfield-mesh.ts` — swap to ShaderMaterial.

**New:**
- `web/src/components/earth-view/shaders/starfield.vert`
- `web/src/components/earth-view/shaders/starfield.frag`

**Deleted:**
- `web/public/star-field-4k.jpg` (saves 2.2 MB from the build output)

### 6.4 Tuning

The tier thresholds (`0.997`, `0.992`, `0.985`) are calibrated to produce roughly the following densities on a 1920x1080 viewport:
- Tier 1: ~200-300 faint stars
- Tier 2: ~80-120 medium stars
- Tier 3: ~20-40 bright stars

Values may need adjustment during implementation based on visual playtest — the spec commits the algorithm, not exact star counts.

### 6.5 Async signature change

`createStarfieldMesh` currently returns `Promise<StarfieldHandle>` because of texture loading. With the shader approach there's nothing to await. Change the signature to `StarfieldHandle` (synchronous).

`scene-factory.ts` currently does `const [earth, starfield] = await Promise.all([createEarthMesh(R), createStarfieldMesh(R)])`. Update to only await earth; starfield is sync:

```ts
const earth = await createEarthMesh(EARTH_RADIUS_UNITS);
const starfield = createStarfieldMesh(EARTH_RADIUS_UNITS);
```

---

## 7. Chrome Pills Refinement

### 7.1 States

| State | Background | Border | Text |
|---|---|---|---|
| Default | `rgba(14, 22, 34, 0.78)` | `accent-border` @ 0.18 opacity | `fg-muted` |
| Hover | Same bg | `accent-border` @ 0.35 opacity | `fg` |
| Active (selected) | `accent-fill-14` | `accent-border` @ 0.5 opacity | `accent-200` |
| Focus-visible | Same as previous | Plus `box-shadow: 0 0 0 2px accent-400 inset` | same |
| Disabled (narrow viewport ModeToggle) | Same bg | Same border, 50% opacity | 50% opacity, `cursor-not-allowed` |

### 7.2 Transitions

Apply `transition: background 180ms cubic-bezier(0.22, 1, 0.36, 1), border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), color 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1)` to the pill trigger.

### 7.3 Keyboard hints

New prop `shortcut?: string` on each pill (optional). When set, pill renders an inline `<span className="kbd">` after the caret showing the shortcut. Hints are visible on hover only, fade in at 180ms.

- ModeToggle: `⌘M`
- VisibilityModeToggle: `⌘V`
- DisplayTzToggle: `⌘T`

Global `keydown` listener mounted in `CinematicLayout` handles the three shortcuts, cycling their values (e.g. ⌘V toggles between LOS/naked-eye).

### 7.4 Files changed

- `web/src/components/layout/mode-toggle.tsx`
- `web/src/components/layout/visibility-mode-toggle.tsx`
- `web/src/components/layout/display-tz-toggle.tsx`
- `web/src/components/layout/chrome-cluster.tsx` — wire global keyboard shortcuts
- Existing tests updated for new states/shortcuts

---

## 8. Left Drawer Refinement

### 8.1 Tab (collapsed state)

Same size/position, new treatment:
- Border uses `accent-border` @ 0.18 opacity
- Text color `#c5a888` (warm tan — mid-contrast, Observatory-warm)
- Hover: border lightens to 0.35, background tint adds `accent-fill-08`
- Letter-spacing `0.05em` for a touch of breathing room

### 8.2 Expanded drawer

**Header row ("Configure" label + close `×`):**
- "Configure" → Fraunces serif, 13px, weight 500, color `#e8d8c0`
- Close button → amber-tinted circle (same treatment as PiP close — see §9)

**Section headers (Observer / Satellite / Window):**
- Change from uppercase tiny-label to Fraunces serif, 14px, weight 500, color `#e8d8c0`
- Remove the current `uppercase text-[10px]` classes
- Add 12px of margin below each header (was 8px)

**Content breathing room:**
- `space-y-6` → `space-y-7` between sections
- Each section's internal field spacing: `space-y-3` (was `space-y-2`)

**Run button:**
- Already-primary button inherits the accent palette via Tailwind tokens
- Add the motion token: `transition` on background + border-color at 180ms ease

### 8.3 Slide transition

`<LeftDrawer />` currently toggles between tab and full-drawer via conditional render. This snap-swap needs a slide transition:

```tsx
<aside
  className={`fixed left-0 top-[52px] bottom-[60px] w-[360px] ...`}
  style={{
    transform: open ? "translateX(0)" : "translateX(-100%)",
    opacity: open ? 1 : 0,
    transition: `transform ${MOTION.slow}ms ${MOTION.ease}, opacity ${MOTION.slow}ms ${MOTION.ease}`,
  }}
  aria-hidden={!open}
>
  ...
</aside>
```

Keep the tab visible when drawer is closed (it's a separate element). Drawer itself slides in from `translateX(-100%)` on open, out on close. When closed, `pointer-events: none` so it doesn't block clicks.

### 8.4 Files changed

- `web/src/components/cinematic/left-drawer.tsx` (typography + motion + structure)
- `web/src/components/observer/observer-panel.tsx` (section-level typography tweak)
- Tests updated

---

## 9. PiP Sky View Refinement

### 9.1 Header

- Height: 26px (was 24px — minor increase)
- Gradient background: `linear-gradient(180deg, rgba(14, 10, 24, 0.85) 0%, rgba(14, 10, 24, 0.4) 70%, transparent 100%)` — fades into the dome below it, no hard edge
- Font: Inter 11px weight 500, color `#d8c4a8`
- Text format: "Sky · [observer name]" (unchanged)

### 9.2 Close button

- 18px circle (was a bare `×` glyph, ~14px tap target)
- Background: `accent-fill-14`
- Color: `accent-200`
- Border: 1px `accent-border` @ 0.3 opacity
- Hover: bg → `accent-fill-14` at 0.22 opacity, color → `accent-50`
- 180ms `cubic-bezier(0.22, 1, 0.36, 1)` on background + color

### 9.3 Resize handle

- Size: 16px (was 12px)
- Two stroke borders (right + bottom) at 2px thickness in `accent-400` @ 0.55 opacity (was at 0.5)
- On hover: opacity ramps to 0.85 at 180ms

### 9.4 Open/close transition

PiP currently appears instantly via `isOpen ? <PiP/> : null`. Replace with a CSS transition that fades + scales.

Approach: always render the PiP wrapper (visibility controlled via `opacity` and `transform: scale()`), with `pointer-events: none` when closed. This keeps the DOM stable and lets CSS handle the transition:

```tsx
<div
  className="fixed z-20 ..."
  style={{
    ...positioning,
    opacity: isOpen ? 1 : 0,
    transform: `scale(${isOpen ? 1 : 0.96})`,
    transition: `opacity ${MOTION.medium}ms ${MOTION.ease}, transform ${MOTION.medium}ms ${MOTION.ease}`,
    pointerEvents: isOpen ? "auto" : "none",
  }}
  aria-hidden={!isOpen}
>
```

Drag / resize still use direct `setPosition` / `setSize` calls that apply position/size immediately (no transition for pointer-tracking).

### 9.5 Files changed

- `web/src/components/cinematic/pip-sky-view.tsx`

---

## 10. Pass Rail Typography

Small tweak, big impact:

- Header: "Passes" in Fraunces 13px, weight 500, color `#e8d8c0`
- Sub-header kicker: "{N} tonight" in Inter 9px uppercase, letter-spacing 0.12em, color `#8a7c68`
- Active pass bar: bg → `accent-fill-14`, border → `accent-border` @ 0.4, text → `accent-200`
- Hover on any pass bar: bg → white-alpha 0.05, border → `accent-border` @ 0.15, 180ms transition
- Expand/collapse button footer: text `#8a7c68`, hover color → `accent-200`, 180ms transition

Files changed: `web/src/components/cinematic/pass-rail.tsx`.

---

## 11. Bottom Dock

Visual refresh only — no functional changes:

- Border: `accent-border` @ 0.15 (was `edge/40`)
- Telemetry labels: uppercase 8.5px tiny-caps in Inter weight 600, letter-spacing 0.08em, color `#6a5d48`
- Telemetry values: JetBrains Mono 10px, color `#a89a84`
- Play button: color `accent-200` when playing, `fg-muted` when paused
- Speed selector pill: amber active state (matches pass rail active)

Files changed: `web/src/components/cinematic/playback-dock.tsx`.

---

## 12. Atmosphere Shader Tweak

Minimal change — two constants:

In `web/src/components/earth-view/atmosphere-mesh.ts`:

```ts
uniforms: {
  glowColor: { value: new THREE.Color(0x6aa5e8) },  // was 0x7ab0e0 — cooler
  intensity: { value: 1.4 },                         // was 1.1 — brighter
},
```

The intensity bump compensates for the slightly cooler (therefore less warm/visible against the starfield) color, and the cooler color reads as more "deep space atmosphere" rather than "sky blue."

Files changed: `web/src/components/earth-view/atmosphere-mesh.ts`.

---

## 13. Observer Elevation Field Redesign

### 13.1 Current state

`web/src/components/observer/elevation-field.tsx`:
- `<Label>` + `<Input type="number">` + `<Button>Reset</Button>` in a flex row
- Small "(looking up…)" / "(elevation unknown)" caption below
- Sits directly in the observer drawer section

Functional but visually inconsistent with the Observatory direction.

### 13.2 Redesigned

Card-style panel:

```
┌─ Elevation ──────────────────────────────────┐
│                                              │
│ 4,205 m                             [auto]   │  ← Fraunces serif 28px + chip
│ Sampled from terrain at this point           │  ← Inter 11px muted
│                                              │
│ ──────────────────────────────────────────── │
│                                              │
│ [Override elevation]                         │  ← Inter 11px button
│                                              │
└──────────────────────────────────────────────┘
```

When override button is clicked, the button's row is replaced with:

```
│ [ 4205 ]  meters above sea level   [✓] [✕]   │
```

where `✓` commits the override (updates `draftObserver.elevation_m`) and `✕` reverts to the looked-up value (or the previous value if the user already customized).

### 13.3 State chip

- Default (value matches lookup): `[auto]` — gray chip, Inter 10px uppercase
- User overridden: `[overridden]` — amber chip (`accent-fill-14` bg, `accent-200` text)
- Lookup in flight: `[looking up…]` — gray chip

### 13.4 Loading + error states

- Lookup in flight (first time): value area shows `— m` with `[looking up…]` chip
- Lookup failed: value shows `0 m` with `[unknown]` chip and caption "Elevation unknown — set manually"

### 13.5 Files changed

- `web/src/components/observer/elevation-field.tsx` — rewrite
- `web/src/components/observer/elevation-field.test.tsx` — updated for new states (auto / overridden / looking up / unknown)

---

## 14. Component Map

### 14.1 New files

- `web/src/lib/motion.ts` — motion tokens
- `web/src/components/earth-view/shaders/starfield.vert`
- `web/src/components/earth-view/shaders/starfield.frag`

### 14.2 Modified files

- `web/index.html` — add Google Fonts `<link>` for Fraunces + Inter + JetBrains Mono
- `web/tailwind.config.js` — add `fontFamily.serif`, `fontFamily.mono`, amber-gold color tokens
- `web/src/components/earth-view/starfield-mesh.ts` — procedural shader (no texture)
- `web/src/components/earth-view/atmosphere-mesh.ts` — intensity + color tweak
- `web/src/components/earth-view/scene-factory.ts` — `starfield` becomes sync, drop `await`
- `web/src/components/layout/mode-toggle.tsx` — new states + shortcut prop
- `web/src/components/layout/visibility-mode-toggle.tsx` — same
- `web/src/components/layout/display-tz-toggle.tsx` — same
- `web/src/components/layout/chrome-cluster.tsx` — wire global keyboard shortcuts
- `web/src/components/cinematic/left-drawer.tsx` — typography + slide transition
- `web/src/components/cinematic/pass-rail.tsx` — typography + hover states
- `web/src/components/cinematic/pip-sky-view.tsx` — header/close/resize + open transition
- `web/src/components/cinematic/playback-dock.tsx` — amber border + telemetry typography
- `web/src/components/observer/observer-panel.tsx` — section-header typography
- `web/src/components/observer/elevation-field.tsx` — redesigned

### 14.3 Deleted files

- `web/public/star-field-4k.jpg` (2.2 MB — no longer referenced)

---

## 15. Testing Strategy

### 15.1 Unit tests — new or updated

- `web/src/lib/motion.test.ts` — `cssTransition()` helper produces expected strings
- `web/src/components/layout/mode-toggle.test.tsx` — three existing tests + one new test for `⌘M` keyboard shortcut dispatch
- `web/src/components/layout/visibility-mode-toggle.test.tsx` — keyboard shortcut
- `web/src/components/layout/display-tz-toggle.test.tsx` — keyboard shortcut
- `web/src/components/layout/chrome-cluster.test.tsx` — global keydown handler fires correct toggle per combo
- `web/src/components/cinematic/left-drawer.test.tsx` — existing tests pass (slide transition applies via style — assert presence of the transition style, not the transition itself)
- `web/src/components/cinematic/pip-sky-view.test.tsx` — existing tests pass; add one for the new `aria-hidden` + `pointer-events: none` when closed
- `web/src/components/observer/elevation-field.test.tsx` — rewrite for new auto / overridden / looking-up / unknown chip states

### 15.2 Visual verification — manual

- Starfield renders without pixelation at any viewport size
- Milky Way band is visible as a subtle violet tint along a tilted plane
- All chrome pills have visible hover state + focus rings
- Drawer slides in from left, not snap-appears
- PiP fades + scales on open
- Observer elevation field's auto/overridden chip responds to manual edits
- `prefers-reduced-motion` disables transitions (System Settings → Accessibility on macOS)

### 15.3 Not tested

- Shader output (same policy as existing atmosphere/ground-track — visual only)
- Font loading (Google Fonts is a standard CDN with high uptime; no test)

---

## 16. Implementation Sequencing

Rough dependency order — writing-plans skill will refine into bite-sized tasks:

1. **Foundation** — fonts, Tailwind tokens, motion library, CSS globals
2. **Starfield shader** — replaces textured starfield (self-contained, no deps)
3. **Atmosphere shader tweak** — tiny, self-contained
4. **Chrome pills** — new states + keyboard shortcuts
5. **Left drawer** — typography + slide transition
6. **PiP** — header/close/resize + open transition
7. **Pass rail** — typography + hover states
8. **Bottom dock** — visual treatment
9. **Observer elevation field** — rewrite
10. **Final gates + tag**

---

## 17. Definition of Done

- [ ] Procedural starfield renders with no pixelation at any viewport size; Milky Way band visible
- [ ] 4K star texture (`star-field-4k.jpg`) deleted from `web/public/`
- [ ] Fonts load (Fraunces + Inter + JetBrains Mono) and are applied per the type scale
- [ ] All three chrome pills show hover/active/focus-visible states with 180ms transitions
- [ ] `⌘M` / `⌘V` / `⌘T` cycle the corresponding pill values
- [ ] Left drawer slides (260ms) on open/close; section headers use Fraunces
- [ ] PiP fades + scales on open (220ms); close button is an 18px amber circle; resize handle is 16px amber
- [ ] Pass rail header uses Fraunces ("Passes") + Inter kicker ("N tonight"); active bar uses amber fill
- [ ] Bottom dock uses amber border + mono tabular telemetry
- [ ] Atmosphere renders with new color (`0x6aa5e8`) and intensity (1.4)
- [ ] Observer elevation field uses card design with auto/overridden/looking-up state chip
- [ ] `prefers-reduced-motion` disables all transitions
- [ ] All frontend tests pass (count up from 204 — expect +5-8 new tests)
- [ ] Lint clean, build clean
- [ ] Git tag `m7-cinematic-polish` + `v0.7.0` pushed to origin

---

## 18. Open Questions

- Fraunces has an optional `SOFT` axis (varying softness). Default is fine; if the vibe calls for a more rounded serif we can add `"SOFT" 50` to the variation settings. Test during implementation.
- Atmosphere intensity `1.4` may need further tuning based on how it reads against the procedural starfield (which is brighter/more detailed than the current textured one). Acceptable to ship at 1.4 and iterate later.
