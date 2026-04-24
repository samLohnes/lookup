import { useEffect, useState } from "react";
import { usePipSkyStore } from "@/store/pip-sky";
import { useSelectionStore } from "@/store/selection";
import { useObserverStore } from "@/store/observer";
import { SkyView } from "@/components/sky-view/sky-view";
import { MOTION, cssTransition } from "@/lib/motion";

const INITIAL_MARGIN = 80; // clearance from bottom dock + pass rail

/** Floating, draggable, resizable PiP sky view. Auto-opens when a pass
 *  is selected; user can close, drag, or resize (aspect locked 1:1).
 *  Always rendered in the DOM — open/closed is driven by CSS opacity +
 *  scale so the transition is smooth. */
export function PipSkyView() {
  const { isOpen, position, size, open, close, setPosition, setSize } =
    usePipSkyStore();
  const selectedPassId = useSelectionStore((s) => s.selectedPassId);
  const observerName = useObserverStore((s) => s.current.name);

  // Auto-open whenever selection changes to a non-null value.
  useEffect(() => {
    if (selectedPassId !== null) open();
  }, [selectedPassId, open]);

  // First-open: default bottom-right if still at sentinel coords.
  useEffect(() => {
    if (isOpen && (position.x < 0 || position.y < 0)) {
      const x = window.innerWidth - size.width - INITIAL_MARGIN;
      const y = window.innerHeight - size.height - 68;
      setPosition({ x, y });
    }
  }, [isOpen, position.x, position.y, size.width, size.height, setPosition]);

  const [dragging, setDragging] = useState<null | { dx: number; dy: number }>(
    null,
  );
  const [resizing, setResizing] = useState<
    null | { startW: number; startH: number; startX: number; startY: number }
  >(null);

  useEffect(() => {
    if (!dragging && !resizing) return;
    const onMove = (e: PointerEvent) => {
      if (dragging) {
        setPosition({ x: e.clientX - dragging.dx, y: e.clientY - dragging.dy });
      } else if (resizing) {
        const dx = e.clientX - resizing.startX;
        const dy = e.clientY - resizing.startY;
        const target = Math.max(resizing.startW + dx, resizing.startH + dy);
        setSize({ width: target, height: target });
      }
    };
    const onUp = () => {
      setDragging(null);
      setResizing(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, resizing, setPosition, setSize]);

  return (
    <div
      className="fixed z-20 rounded-full border-[1.5px] border-accent-400/30 bg-[rgba(14,10,24,0.9)] overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        opacity: isOpen ? 1 : 0,
        transform: `scale(${isOpen ? 1 : 0.96})`,
        transformOrigin: "center",
        transition: `opacity ${MOTION.medium}ms ${MOTION.ease}, transform ${MOTION.medium}ms ${MOTION.ease}`,
        pointerEvents: isOpen ? "auto" : "none",
        boxShadow:
          "0 6px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 174, 96, 0.08)",
      }}
      aria-hidden={!isOpen}
    >
      {/* Header — taller with gradient fade */}
      <div
        className="absolute top-0 left-0 right-0 h-[26px] flex items-center justify-between px-3 z-10 text-[11px] text-[#d8c4a8] font-medium cursor-move"
        style={{
          background:
            "linear-gradient(180deg, rgba(14, 10, 24, 0.85) 0%, rgba(14, 10, 24, 0.4) 70%, transparent 100%)",
        }}
        onPointerDown={(e) => {
          setDragging({
            dx: e.clientX - position.x,
            dy: e.clientY - position.y,
          });
        }}
      >
        <span>Sky · {observerName}</span>
        <button
          type="button"
          aria-label="Close PiP"
          onClick={(e) => {
            e.stopPropagation();
            close();
          }}
          className={
            "w-[18px] h-[18px] rounded-full grid place-items-center text-[11px] leading-none " +
            "bg-accent-400/14 border border-accent-400/30 text-accent-200 " +
            "hover:bg-accent-400/22 hover:text-accent-50"
          }
          style={{ transition: cssTransition("background, color", "fast") }}
        >
          ×
        </button>
      </div>

      {/* SkyView — inset so dome centers on PiP circle */}
      <div
        className="absolute"
        style={{
          top: -size.height * 0.07,
          bottom: -size.height * 0.07,
          left: -size.width * 0.07,
          right: -size.width * 0.07,
        }}
      >
        <SkyView />
      </div>

      {/* Resize handle — bigger + thicker stroke */}
      <div
        className="absolute bottom-2 right-2 w-4 h-4 cursor-nwse-resize z-10"
        style={{
          borderRight: "2px solid rgba(255, 174, 96, 0.55)",
          borderBottom: "2px solid rgba(255, 174, 96, 0.55)",
          borderRadius: "0 0 3px 0",
          transition: cssTransition("border-color", "fast"),
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          setResizing({
            startW: size.width,
            startH: size.height,
            startX: e.clientX,
            startY: e.clientY,
          });
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderRightColor = "rgba(255, 174, 96, 0.85)";
          e.currentTarget.style.borderBottomColor = "rgba(255, 174, 96, 0.85)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderRightColor = "rgba(255, 174, 96, 0.55)";
          e.currentTarget.style.borderBottomColor = "rgba(255, 174, 96, 0.55)";
        }}
      />
    </div>
  );
}
