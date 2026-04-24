import { useEffect, useState } from "react";
import { ObserverPanel } from "@/components/observer/observer-panel";
import { SatelliteSearch } from "@/components/satellite/satellite-search";
import { TimeRangePicker } from "@/components/time/time-range-picker";
import { RunButton } from "@/components/layout/run-button";
import { useDraftInputsStore } from "@/store/draft-inputs";
import { MOTION, cssTransition } from "@/lib/motion";

/** Collapsible left drawer — Observer + Satellite + Window + Run.
 *  Always renders both the tab and the drawer; visibility driven by
 *  CSS transforms + opacity so we get slide transitions (260ms). */
export function LeftDrawer() {
  const [open, setOpen] = useState(false);
  const revert = useDraftInputsStore((s) => s.revert);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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

  return (
    <>
      {/* Tab — always rendered; fades out when drawer is open */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
        className={
          "fixed left-0 top-[40%] z-10 bg-bg-raised/72 border border-accent-400/18 border-l-0 " +
          "px-2 py-3 text-xs text-[#c5a888] rounded-r backdrop-blur " +
          "hover:border-accent-400/35 hover:bg-bg-raised/85 " +
          "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_rgba(255,174,96,0.8)]"
        }
        style={{
          writingMode: "vertical-rl",
          letterSpacing: "0.05em",
          opacity: open ? 0 : 1,
          transition: cssTransition("opacity, border-color, background", "fast"),
          pointerEvents: open ? "none" : "auto",
        }}
      >
        Observer · Satellite · Window
      </button>

      {/* Drawer — always rendered; slides in/out via transform + opacity */}
      <aside
        className={
          "fixed left-0 top-[52px] bottom-[60px] w-[360px] z-10 " +
          "bg-bg-raised/92 border-r border-accent-400/15 backdrop-blur-xl flex flex-col"
        }
        style={{
          transform: open ? "translateX(0)" : "translateX(-100%)",
          opacity: open ? 1 : 0,
          transition: `transform ${MOTION.slow}ms ${MOTION.ease}, opacity ${MOTION.slow}ms ${MOTION.ease}`,
          pointerEvents: open ? "auto" : "none",
        }}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between p-3 border-b border-accent-400/12">
          <span className="font-serif text-[13px] font-medium text-[#e8d8c0]">
            Configure
          </span>
          <button
            type="button"
            onClick={() => {
              revert();
              setOpen(false);
            }}
            className={
              "w-6 h-6 rounded-full grid place-items-center text-sm leading-none " +
              "bg-accent-400/14 border border-accent-400/30 text-accent-200 " +
              "hover:bg-accent-400/22 hover:text-accent-50"
            }
            style={{ transition: cssTransition("background, color", "fast") }}
            title="Close (reverts unsaved changes)"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-7">
          <section className="space-y-3">
            <div className="font-serif text-[14px] font-medium text-[#e8d8c0]">
              Observer
            </div>
            <ObserverPanel />
          </section>
          <section className="space-y-3" data-drawer-satellite-input>
            <div className="font-serif text-[14px] font-medium text-[#e8d8c0]">
              Satellite
            </div>
            <SatelliteSearch />
          </section>
          <section className="space-y-3">
            <div className="font-serif text-[14px] font-medium text-[#e8d8c0]">
              Window
            </div>
            <TimeRangePicker />
          </section>
        </div>
        <div className="p-3 border-t border-accent-400/12">
          <RunButton />
        </div>
      </aside>
    </>
  );
}
