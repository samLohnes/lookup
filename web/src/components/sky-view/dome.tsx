import { DOME_RADIUS, DOME_CENTER } from "./dome-math";

/** Renders the sky dome: outer horizon ring, dashed elevation rings, zenith dot. */
export function Dome() {
  return (
    <>
      {/* outer horizon ring */}
      <circle
        cx={DOME_CENTER}
        cy={DOME_CENTER}
        r={DOME_RADIUS}
        className="fill-bg-raised stroke-edge"
      />
      {/* elevation rings at 30° and 60° */}
      {[30, 60].map((el) => (
        <circle
          key={el}
          cx={DOME_CENTER}
          cy={DOME_CENTER}
          r={((90 - el) / 90) * DOME_RADIUS}
          className="fill-none stroke-edge"
          strokeDasharray="2 3"
        />
      ))}
      {/* zenith dot */}
      <circle
        cx={DOME_CENTER}
        cy={DOME_CENTER}
        r={1.5}
        className="fill-fg-muted"
      />
    </>
  );
}
