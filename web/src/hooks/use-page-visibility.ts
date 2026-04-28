import { useEffect, useState } from "react";

/** Returns true when the tab is visible, false when backgrounded.
 *
 * Wraps the Page Visibility API. SSR-safe (returns true if `document` is
 * undefined). Used by `useLivePolling` to pause polling on tab-hide.
 */
export function usePageVisibility(): boolean {
  const [visible, setVisible] = useState<boolean>(() =>
    typeof document === "undefined" ? true : !document.hidden,
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  return visible;
}
