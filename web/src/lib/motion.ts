/** Cinematic motion tokens used across chrome, drawers, PiP, and pass rail.
 *
 *  All transitions use the same "snappy-to-land" cubic-bezier curve —
 *  quick start, gentle stop. This is the Observatory aesthetic: deliberate
 *  but not slow. Durations scale from hover feedback (180ms) to major
 *  layout shifts (260-300ms). Always pair a duration with `MOTION.ease`. */
export const MOTION = {
  /** The signature easing curve — "snappy-to-land". */
  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
  /** Hover, color shifts, focus rings. */
  fast: 180,
  /** PiP open/close, modal fade. */
  medium: 220,
  /** Drawer slides, layout shifts. */
  slow: 260,
  /** Camera reframes, major layout transitions. */
  cinematic: 300,
} as const;

type DurationKey = Exclude<keyof typeof MOTION, "ease">;

/** Compose a `transition` property value. Example:
 *  `style={{ transition: cssTransition("background, border-color", "fast") }}`
 *  produces `"background, border-color 180ms cubic-bezier(0.22, 1, 0.36, 1)"`. */
export function cssTransition(
  properties: string,
  duration: DurationKey = "fast",
): string {
  return `${properties} ${MOTION[duration]}ms ${MOTION.ease}`;
}
