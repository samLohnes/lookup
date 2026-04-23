import { ModeToggle } from "./mode-toggle";
import { VisibilityModeToggle } from "./visibility-mode-toggle";
import { DisplayTzToggle } from "./display-tz-toggle";

/** Top-right floating cluster of chrome pills used in both cinematic and
 *  research layouts. Consumers position this absolutely over the scene. */
export function ChromeCluster() {
  return (
    <div className="flex items-center gap-2">
      <ModeToggle />
      <VisibilityModeToggle />
      <DisplayTzToggle />
    </div>
  );
}
