import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * Two-finger pinch-to-zoom for the custom pointer-event-driven 2D canvases
 * (CanvasArea.tsx, MultiRoomCanvas.tsx) -- mobile view-only mode only (see
 * useMobileViewOnly). Those canvases run with touchAction:"none" so a
 * single-finger drag can pan/select instead of the page scrolling, which
 * also suppresses the browser's own native pinch-zoom gesture -- this
 * reimplements pinch explicitly, driving the same zoomFactor the desktop
 * Zoom slider does.
 *
 * Once a second finger joins, the whole gesture is tracked via WINDOW-level
 * pointermove/pointerup/pointercancel listeners rather than the stage
 * element's own React pointer props. This is deliberate, not incidental:
 * during a real pinch, fingers spread apart and routinely drift outside
 * the canvas's own bounding box (especially on a small phone screen) --
 * without pointer capture (which single-finger pan relies on, but which a
 * second finger never gets here) or a window-level listener, that
 * pointer's future move/up events stop being delivered to the canvas
 * element entirely, since Pointer Events target whatever's currently
 * under the finger. A window listener has no such blind spot: it sees the
 * pointer's events wherever they land, right up to a guaranteed pointerup
 * or pointercancel. Earlier versions of this hook attached move/up to the
 * canvas element directly, which could leave the gesture's internal
 * "active" flag stuck true forever if that final event was ever missed --
 * silently swallowing every future touch on the canvas until the page was
 * reloaded. The `blur` listener below is a second safety net for the same
 * failure mode (app switch, permission dialog, etc. can end a touch
 * sequence without ever dispatching pointerup/pointercancel at all).
 */

interface UsePinchZoomOptions {
  /** Only wire up pinch handling when true (mobile view-only mode). When
   * false, every event passes straight through to the on*PointerDown/Move/
   * Up callbacks below, unchanged from not using this hook at all. */
  enabled: boolean;
  zoomFactor: number;
  setZoomFactor: (zoom: number) => void;
  min: number;
  max: number;
  /** The canvas's normal single-finger pan/select/marquee/ruler handlers.
   * Called for every pointer event that isn't part of an active pinch. */
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
}

export function usePinchZoom({
  enabled,
  zoomFactor,
  setZoomFactor,
  min,
  max,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: UsePinchZoomOptions) {
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const startRef = useRef<{ dist: number; zoom: number } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  // Read from inside the window listeners below without needing to tear
  // down and re-attach them every time zoomFactor changes mid-pinch.
  const zoomFactorRef = useRef(zoomFactor);
  zoomFactorRef.current = zoomFactor;
  const boundsRef = useRef({ min, max });
  boundsRef.current = { min, max };

  const endPinch = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    pointersRef.current.clear();
    startRef.current = null;
  }, []);

  // Unmount / tab-blur safety nets -- see the module doc comment above for
  // why these matter as much as the pointerup/pointercancel handling does.
  useEffect(() => {
    window.addEventListener("blur", endPinch);
    return () => {
      window.removeEventListener("blur", endPinch);
      endPinch();
    };
  }, [endPinch]);

  const startPinch = useCallback(() => {
    const move = (ev: PointerEvent) => {
      if (!pointersRef.current.has(ev.pointerId)) return;
      pointersRef.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pointersRef.current.size !== 2 || !startRef.current) return;
      const [a, b] = Array.from(pointersRef.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = dist / startRef.current.dist;
      const { min: lo, max: hi } = boundsRef.current;
      const next = Math.max(lo, Math.min(hi, startRef.current.zoom * ratio));
      setZoomFactor(Math.round(next * 100) / 100);
    };
    // pointerup AND pointercancel both end the gesture the same way --
    // cancel fires when the OS/browser takes the gesture over for
    // something else (edge-swipe navigation, a notification pull-down,
    // etc.), and treating it identically to a clean release is what
    // guarantees this can never get stuck.
    const end = (ev: PointerEvent) => {
      if (!pointersRef.current.has(ev.pointerId)) return;
      endPinch();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [endPinch, setZoomFactor]);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (enabled) {
        // A pinch is already active (or a third finger just landed
        // mid-pinch) -- ignore rather than trying to fold it in.
        if (cleanupRef.current) return;
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointersRef.current.size === 2) {
          const [a, b] = Array.from(pointersRef.current.values());
          startRef.current = {
            dist: Math.hypot(a.x - b.x, a.y - b.y),
            zoom: zoomFactorRef.current,
          };
          startPinch();
          return;
        }
        // Exactly one finger tracked so far -- fall through to the normal
        // single-finger handler below, same as if this hook weren't here.
      }
      onPointerDown(e);
    },
    [enabled, onPointerDown, startPinch],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent) => {
      // While a pinch owns the gesture, every move is driven by the
      // window-level listener in startPinch above instead.
      if (enabled && cleanupRef.current) return;
      onPointerMove(e);
    },
    [enabled, onPointerMove],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent) => {
      if (enabled && cleanupRef.current) return;
      onPointerUp(e);
    },
    [enabled, onPointerUp],
  );

  return { handlePointerDown, handlePointerMove, handlePointerUp };
}
