import { useDraftInputsStore } from "@/store/draft-inputs";

/**
 * Primary call-to-action that commits the current draft inputs (observer,
 * satellite, time window) to the live committed stores. Disabled while the
 * draft matches committed state; shows a change count otherwise.
 */
export function RunButton() {
  const isDirty = useDraftInputsStore((s) => s.isDirty());
  const count = useDraftInputsStore((s) => s.changeCount());
  const commit = useDraftInputsStore((s) => s.commit);
  return (
    <button
      type="button"
      disabled={!isDirty}
      onClick={commit}
      className={
        "w-full py-2 px-3 rounded-md font-medium text-sm transition-colors " +
        (isDirty
          ? "bg-accent text-accent-foreground hover:bg-accent/90"
          : "bg-bg-raised text-fg-subtle cursor-not-allowed")
      }
    >
      {isDirty
        ? `Run passes (${count} ${count === 1 ? "change" : "changes"})`
        : "Run passes"}
    </button>
  );
}
