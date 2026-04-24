import { type ReactNode, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cssTransition } from "@/lib/motion";

interface ConfigChipProps {
  /** Tiny-caps label (e.g. "OBSERVER"). */
  label: string;
  /** Compact committed value (e.g. "San Francisco"). */
  value: string;
  /** Whether the draft for this chip differs from committed. */
  isDirty: boolean;
  /** Shown in the popover header. */
  popoverTitle: string;
  /** Optional callback invoked when the user clicks Discard in the popover
   *  header. Only shown when `isDirty` is true. */
  onDiscard?: () => void;
  /** Width of the popover content in px. Defaults to 320. */
  popoverWidth?: number;
  /** Height (max-height) of the popover in px. If unset, height is auto. */
  popoverHeight?: number;
  /** Optional controlled-open state. When provided, parent controls whether
   *  the popover is open. Used by `ConfigChips` so Cmd-K can open the
   *  Satellite popover from the container. If omitted, `ConfigChip` manages
   *  its own open state internally. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

/** Popover-variant chip shell shared by Observer / Satellite / Window chips.
 *  Uses Radix Popover for positioning (auto-flips to stay in viewport),
 *  focus management, Esc-to-close, and click-outside-to-close — all inherent
 *  Radix behaviors. Draft is preserved on close (onOpenChange is local state
 *  only, no reset). */
export function ConfigChip({
  label,
  value,
  isDirty,
  popoverTitle,
  onDiscard,
  popoverWidth = 320,
  popoverHeight,
  open: openProp,
  onOpenChange,
  children,
}: ConfigChipProps) {
  const [openInternal, setOpenInternal] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openInternal;
  const setOpen = (v: boolean) => {
    if (!isControlled) setOpenInternal(v);
    onOpenChange?.(v);
  };

  const ariaLabel = isDirty
    ? `${label.toLowerCase()}: ${value} (unsaved draft — click to review)`
    : `${label.toLowerCase()}: ${value}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          title={ariaLabel}
          className={
            "relative rounded-md px-3 py-1.5 text-left backdrop-blur " +
            "border bg-bg-raised/72 border-accent-400/20 " +
            "hover:bg-bg-raised/85 hover:border-accent-400/35 " +
            "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_rgba(255,174,96,0.8)] " +
            (open ? "!bg-bg-raised/95 !border-accent-400/55 " : "")
          }
          style={{
            transition: cssTransition("background, border-color, color", "fast"),
          }}
        >
          <div
            className="text-[9px] uppercase tracking-[0.1em] text-[#8a7c68] leading-none mb-1"
          >
            {label}
          </div>
          <div
            className="text-[12px] leading-none"
            style={{ color: isDirty ? "#ffae60" : "#e8d8c0" }}
          >
            {value}
          </div>
          {isDirty && (
            <span
              aria-hidden="true"
              data-testid="chip-dirty-dot"
              className="absolute top-[6px] right-[6px] w-[5px] h-[5px] rounded-full bg-accent-400 animate-chip-dirty-pulse"
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="p-0 border-accent-400/25 bg-bg-raised/95 backdrop-blur-xl"
        style={{
          width: popoverWidth,
          maxHeight: popoverHeight,
          overflowY: popoverHeight ? "auto" : "visible",
        }}
        role="dialog"
        aria-label={popoverTitle}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-accent-400/12">
          <span className="font-serif text-[13px] font-medium text-[#e8d8c0]">
            {popoverTitle}
          </span>
          {isDirty && onDiscard && (
            <button
              type="button"
              onClick={onDiscard}
              className="text-[11px] text-[#8a7c68] hover:text-accent-200"
              style={{ transition: cssTransition("color", "fast") }}
            >
              Discard
            </button>
          )}
        </div>
        <div className="p-3">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
