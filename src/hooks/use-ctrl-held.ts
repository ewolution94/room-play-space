import { useEffect, useState } from "react";

/**
 * Tracks whether the Control key is currently held down. Used to
 * temporarily activate multi-select on the canvas (see multiSelectMode in
 * use-room-planner.ts / MultiRoomCanvas.tsx) without requiring the "Enable
 * Multi-Select" checkbox to be toggled on first -- hold Control, drag a
 * marquee, release Control, back to panning.
 *
 * Resets on window blur and tab visibility change in addition to the
 * regular keyup: a keyup can be silently swallowed by the OS if focus
 * leaves the browser entirely while the key is still physically held down
 * (e.g. Alt-Tab, clicking into another app), which would otherwise leave
 * multi-select stuck "on" until the next unrelated keydown/keyup cycle.
 */
export function useCtrlHeld(): boolean {
  const [ctrlHeld, setCtrlHeld] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control") setCtrlHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") setCtrlHeld(false);
    };
    const reset = () => setCtrlHeld(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, []);

  return ctrlHeld;
}
