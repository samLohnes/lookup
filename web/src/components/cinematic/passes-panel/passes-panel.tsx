import { useSelectionStore } from "@/store/selection";
import { useCurrentPasses } from "@/hooks/use-current-passes";
import { EmptyTrains } from "./empty-trains";
import { PassList } from "./pass-list";
import { PanelSkyView } from "./panel-sky-view";
import { PanelTelemetry } from "./panel-telemetry";
import { LocateButton } from "./locate-button";

/** Right-side always-expanded passes panel in cinematic mode.
 *  Three stacked sections: passes (top, flex-grows) → sky view (when
 *  a pass is selected) → telemetry (when a pass is selected). Replaces
 *  the old narrow `PassRail` + floating `PipSkyView` + dock telemetry. */
export function PassesPanel() {
  const selectedPassId = useSelectionStore((s) => s.selectedPassId);
  const { data } = useCurrentPasses();
  const passes = data?.passes ?? [];
  const count = passes.length;
  const hasSelection = selectedPassId !== null;
  const isEmptyTrainQuery =
    data?.resolved_name === "starlink (trains)" && count === 0;

  return (
    <aside
      className="fixed right-0 top-[52px] bottom-[60px] w-[360px] bg-bg-raised/90 border-l border-edge backdrop-blur z-10 flex flex-col overflow-hidden"
      aria-label="Passes panel"
    >
      <div className="shrink-0 px-4 pt-3 pb-2 border-b border-accent-400/12 flex justify-between items-start">
        <div>
          <div className="font-serif text-[18px] font-medium text-[#e8d8c0]">
            Passes
          </div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a7c68] mt-0.5">
            {count} tonight
          </div>
        </div>
        <LocateButton />
      </div>
      {isEmptyTrainQuery ? <EmptyTrains /> : <PassList />}
      {hasSelection && <PanelSkyView />}
      {hasSelection && <PanelTelemetry />}
    </aside>
  );
}
