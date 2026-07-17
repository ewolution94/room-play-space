import { Plus, Minus } from "lucide-react";

interface MobileZoomButtonsProps {
  zoomFactor: number;
  setZoomFactor: (zoom: number) => void;
  min: number;
  max: number;
}

/**
 * Replaces two-finger pinch-to-zoom on mobile (removed -- it kept getting
 * stuck mid-gesture, see use-pinch-zoom.ts's removal). A single finger drag
 * on the mobile canvas is now ALWAYS a plain pan (see the callers of this
 * component), so zooming needs its own dedicated, always-available control.
 * Flush to the right edge, vertically centered, out of the way of the
 * top-right View Options trigger, the top-left dimension badge, and the
 * bottom-center 2D/3D toolbar pill.
 */
export function MobileZoomButtons({ zoomFactor, setZoomFactor, min, max }: MobileZoomButtonsProps) {
  const step = 0.1;
  const round = (v: number) => Math.round(v * 100) / 100;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute right-2 top-1/2 z-40 flex -translate-y-1/2 flex-col overflow-hidden rounded-full border border-border/40 bg-background/85 shadow-md backdrop-blur-md"
    >
      <button
        type="button"
        onClick={() => setZoomFactor(Math.min(max, round(zoomFactor + step)))}
        className="flex h-11 w-11 items-center justify-center text-foreground transition-colors hover:bg-accent active:bg-accent"
        aria-label="Zoom in"
      >
        <Plus className="h-5 w-5" />
      </button>
      <div className="h-px w-full bg-border/40" />
      <button
        type="button"
        onClick={() => setZoomFactor(Math.max(min, round(zoomFactor - step)))}
        className="flex h-11 w-11 items-center justify-center text-foreground transition-colors hover:bg-accent active:bg-accent"
        aria-label="Zoom out"
      >
        <Minus className="h-5 w-5" />
      </button>
    </div>
  );
}
