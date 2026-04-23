import { useEffect, useState } from "react";

/** Reactive window.innerWidth — re-renders on resize events. Returns a
 *  sensible default in non-browser environments (SSR). */
export function useWindowWidth(): number {
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? 1024 : window.innerWidth,
  );
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
}
