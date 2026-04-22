import { DOME_CENTER, DOME_RADIUS, altAzToXy } from "./dome-math";

const DIRS = [
  { label: "N", az: 0 },
  { label: "E", az: 90 },
  { label: "S", az: 180 },
  { label: "W", az: 270 },
];

/** Renders N/E/S/W compass labels with tick marks at the horizon. */
export function Compass() {
  return (
    <>
      {DIRS.map((d) => {
        const p = altAzToXy(d.az, -6);
        return (
          <text
            key={d.label}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-fg-muted text-[10px]"
          >
            {d.label}
          </text>
        );
      })}
      {/* cardinal tick marks at the horizon */}
      {DIRS.map((d) => {
        const outer = altAzToXy(d.az, 0);
        const inner = altAzToXy(d.az, 3);
        return (
          <line
            key={`tick-${d.label}`}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
            className="stroke-edge-strong"
            strokeWidth={1}
          />
        );
      })}
      {/* invisible radius guard */}
      <circle
        cx={DOME_CENTER}
        cy={DOME_CENTER}
        r={DOME_RADIUS + 8}
        fill="none"
      />
    </>
  );
}
