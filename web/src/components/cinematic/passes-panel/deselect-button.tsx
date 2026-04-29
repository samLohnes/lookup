import { useSelectionStore } from "@/store/selection";

/** Small icon button in the passes-panel header. Deselects the
 *  currently-selected pass, which causes useLivePolling to reactivate
 *  (live polling starts again). Single-purpose: does NOT reframe the
 *  camera — that's the LocateButton's job, which becomes available
 *  once live polling returns its first sample (~1s later).
 *
 *  Disabled when no pass is selected.
 */
export function DeselectButton() {
  const selectedPassId = useSelectionStore((s) => s.selectedPassId);
  const select = useSelectionStore((s) => s.select);
  const disabled = selectedPassId === null;

  const handleClick = () => {
    if (selectedPassId === null) return;
    select(null);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={disabled ? "No pass selected" : "Deselect pass"}
      aria-label="Deselect pass"
      className={
        "shrink-0 inline-flex items-center justify-center w-7 h-7 rounded " +
        "text-[14px] font-mono " +
        (disabled
          ? "text-[#5a5040] cursor-not-allowed"
          : "text-[#c5a888] hover:text-[#e8d8c0] hover:bg-accent-400/10 cursor-pointer")
      }
    >
      ↩
    </button>
  );
}
