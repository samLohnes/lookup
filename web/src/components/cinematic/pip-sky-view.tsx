import { useEffect, useState } from "react";
import { usePipSkyStore } from "@/store/pip-sky";
import { useSelectionStore } from "@/store/selection";
import { useObserverStore } from "@/store/observer";
import { SkyView } from "@/components/sky-view/sky-view";

/** Floating, draggable, resizable PiP sky view. Auto-opens when a pass is
 *  selected; user can close, drag, or resize (aspect locked 1:1). */
export function PipSkyView() {
  const { isOpen, position, size, open, close, setPosition, setSize } =
    usePipSkyStore();
  const selectedPassId = useSelectionStore((s) => s.selectedPassId);
  const observerName = useObserverStore((s) => s.current.name);

  // Auto-open whenever selection changes to a non-null value.
  useEffect(() => {
    if (selectedPassId !== null) open();
  }, [selectedPassId, open]);

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
        setPosition({
          x: e.clientX - dragging.dx,
          y: e.clientY - dragging.dy,
        });
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed z-20 rounded-full border border-accent/40 bg-bg-raised/95 backdrop-blur shadow-xl overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-6 flex items-center justify-between px-3 text-[10px] text-fg-muted cursor-move z-10"
        onPointerDown={(e) => {
          setDragging({
            dx: e.clientX - position.x,
            dy: e.clientY - position.y,
          });
        }}
      >
        <span>sky · {observerName}</span>
        <button
          type="button"
          aria-label="Close PiP"
          onClick={(e) => {
            e.stopPropagation();
            close();
          }}
          className="text-fg-subtle hover:text-fg text-sm leading-none"
        >
          ✕
        </button>
      </div>
      <div className="absolute inset-0 pt-6">
        <SkyView />
      </div>
      <div
        className="absolute bottom-1 right-1 w-3 h-3 cursor-nwse-resize z-10"
        style={{
          borderRight: "2px solid rgba(120, 180, 240, 0.5)",
          borderBottom: "2px solid rgba(120, 180, 240, 0.5)",
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
      />
    </div>
  );
}
