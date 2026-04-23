import { Button } from "@/components/ui/button";
import { downloadIcs, formatPassAsIcs } from "@/lib/ics";
import { useObserverStore } from "@/store/observer";
import type { PassItem } from "@/types/api";

interface Props {
  pass: PassItem;
}

/** A small button that downloads the pass as an .ics calendar file. */
export function PassExportButton({ pass }: Props) {
  const observerName = useObserverStore((s) => s.current.name);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={(e) => {
        e.stopPropagation(); // don't trigger card-level select
        const ics = formatPassAsIcs(pass, { observerName });
        downloadIcs(`pass-${pass.id}.ics`, ics);
      }}
      aria-label="Add to calendar"
    >
      📅 .ics
    </Button>
  );
}
