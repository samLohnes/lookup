import { useEffect, useState } from "react";
import { ObserverPanel } from "@/components/observer/observer-panel";
import { SatelliteSearch } from "@/components/satellite/satellite-search";
import { TimeRangePicker } from "@/components/time/time-range-picker";
import { RunButton } from "@/components/layout/run-button";
import { useDraftInputsStore } from "@/store/draft-inputs";

/** Collapsible left drawer — Observer + Satellite + Window + Run.
 *  Default state: collapsed to a vertical tab. ⌘K opens and focuses
 *  the satellite input. Esc reverts draft changes and closes. */
export function LeftDrawer() {
  const [open, setOpen] = useState(false);
  const revert = useDraftInputsStore((s) => s.revert);

  // Global keyboard shortcuts scoped to this component's lifetime.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ⌘K / Ctrl-K → open drawer + focus satellite input.
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        queueMicrotask(() => {
          const input = document.querySelector<HTMLInputElement>(
            '[data-drawer-satellite-input] input',
          );
          input?.focus();
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-0 top-[40%] z-10 bg-bg-raised/85 border border-edge/40 border-l-0 px-2 py-3 text-xs text-fg-muted rounded-r backdrop-blur"
        style={{ writingMode: "vertical-rl" }}
      >
        Observer · Satellite · Window
      </button>
    );
  }

  return (
    <aside className="fixed left-0 top-[52px] bottom-[60px] w-[360px] bg-bg-raised/92 border-r border-edge backdrop-blur-xl z-10 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-edge/50">
        <span className="text-xs uppercase tracking-wider text-fg-muted">
          Configure
        </span>
        <button
          type="button"
          onClick={() => {
            revert();
            setOpen(false);
          }}
          className="text-xs text-fg-subtle hover:text-fg"
          title="Close (reverts unsaved changes)"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section>
          <div className="text-[10px] uppercase tracking-wider text-fg-subtle mb-2">
            Observer
          </div>
          <ObserverPanel />
        </section>
        <section data-drawer-satellite-input>
          <div className="text-[10px] uppercase tracking-wider text-fg-subtle mb-2">
            Satellite
          </div>
          <SatelliteSearch />
        </section>
        <section>
          <div className="text-[10px] uppercase tracking-wider text-fg-subtle mb-2">
            Window
          </div>
          <TimeRangePicker />
        </section>
      </div>
      <div className="p-3 border-t border-edge/50">
        <RunButton />
      </div>
    </aside>
  );
}
