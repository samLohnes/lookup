import { Dome, DOME_SIZE } from "./dome";
import { Compass } from "./compass";

/** SVG sky view showing the dome, elevation rings, and compass labels. */
export function SkyView() {
  return (
    <svg
      viewBox={`0 0 ${DOME_SIZE} ${DOME_SIZE}`}
      className="w-full max-w-[320px] mx-auto"
      role="img"
      aria-label="Sky view — looking up from the observer"
    >
      <Dome />
      <Compass />
    </svg>
  );
}
