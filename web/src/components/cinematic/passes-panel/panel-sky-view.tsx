import { SkyView } from "@/components/sky-view/sky-view";

/** Bordered 260px-tall section hosting the alt-azimuth sky dome. Sized for
 *  the right passes panel — the dome's SVG uses `w-full` +
 *  `preserveAspectRatio="xMidYMid meet"` so it self-centers. */
export function PanelSkyView() {
  return (
    <div className="h-[260px] shrink-0 border-t border-accent-400/12 bg-[rgba(10,8,20,0.5)] p-3 flex items-center justify-center">
      <SkyView />
    </div>
  );
}
