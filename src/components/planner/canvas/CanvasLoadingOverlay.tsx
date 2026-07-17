import { useEffect, useRef, useState } from "react";

interface CanvasLoadingOverlayProps {
  /** True once the canvas has real, measured layout to show (stage size
   * measured, room data loaded) -- see the stageReady flag in
   * use-room-planner.ts / MultiRoomCanvas.tsx. */
  ready: boolean;
}

// Never shown for less than this long, even if `ready` flips true almost
// immediately -- an overlay that appears and instantly vanishes reads as a
// flicker/glitch, not a deliberate loading state. Fading it out over
// FADE_MS afterwards is what actually sells the "premium" feel, versus a
// hard cut.
const MIN_VISIBLE_MS = 220;
const FADE_MS = 300;

/**
 * Blurred backdrop + ring spinner shown over a canvas stage until it's
 * genuinely ready to be looked at. Both CanvasArea.tsx and
 * MultiRoomCanvas.tsx measure their own stage size asynchronously (a
 * ResizeObserver only fires after the browser has actually laid out the
 * container) -- before that first measurement lands, the room used to
 * render using a hardcoded placeholder size, visibly mis-scaled and
 * shoved into the top-left corner for a moment. This overlay masks that
 * entire window (belt-and-suspenders alongside the synchronous
 * useLayoutEffect measurement that now makes the window itself much
 * shorter -- see stageReady's own doc comment) behind a clean loading
 * state instead, and doubles as the "switching views" transition: since
 * navigating between routes fully unmounts/remounts these components, the
 * exact same mount-time gating naturally reappears on every route switch
 * too.
 */
export function CanvasLoadingOverlay({ ready }: CanvasLoadingOverlayProps) {
  const [mounted, setMounted] = useState(true);
  const [fading, setFading] = useState(false);
  const shownAtRef = useRef(Date.now());

  useEffect(() => {
    if (!ready || !mounted || fading) return;
    const elapsed = Date.now() - shownAtRef.current;
    const delay = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const fadeTimer = setTimeout(() => setFading(true), delay);
    return () => clearTimeout(fadeTimer);
  }, [ready, mounted, fading]);

  useEffect(() => {
    if (!fading) return;
    const unmountTimer = setTimeout(() => setMounted(false), FADE_MS);
    return () => clearTimeout(unmountTimer);
  }, [fading]);

  if (!mounted) return null;

  return (
    <div
      aria-hidden={!ready}
      className={`absolute inset-0 z-[60] flex items-center justify-center rounded-lg bg-background/70 backdrop-blur-md transition-opacity ease-out ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <div className="relative h-11 w-11">
        <div className="absolute inset-0 rounded-full border-2 border-border/40" />
        <div
          className="absolute inset-0 animate-spin rounded-full border-2 border-transparent"
          style={{
            borderTopColor: "var(--color-primary, #0d9488)",
            borderRightColor: "var(--color-secondary-foreground, #0284c7)",
            animationDuration: "700ms",
          }}
        />
      </div>
    </div>
  );
}
