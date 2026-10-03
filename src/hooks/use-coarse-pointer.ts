import { useEffect, useState } from "react";

/**
 * Whether the main pointer is a finger (`pointer: coarse`), for hit targets that are sized in
 * JS rather than CSS (CSS can use Tailwind's `pointer-coarse:` instead). Starts false so the
 * first client render matches the server's, like useMobileViewOnly, and follows the media query
 * after that (a tablet with a keyboard and trackpad attached switches back).
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return coarse;
}
