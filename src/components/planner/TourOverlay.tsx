import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { TourOverlayProps } from "@/types/planner";

function getClipPath(rect: { left: number; top: number; width: number; height: number } | null) {
  if (!rect) return "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";

  const l = rect.left - 6;
  const t = rect.top - 6;
  const r = rect.left + rect.width + 6;
  const b = rect.top + rect.height + 6;

  return `polygon(
    0% 0%,
    0% 100%,
    ${l}px 100%,
    ${l}px ${t}px,
    ${r}px ${t}px,
    ${r}px ${b}px,
    ${l}px ${b}px,
    ${l}px 100%,
    100% 100%,
    100% 0%
  )`;
}

export function TourOverlay({
  t,
  tourOpen,
  tourStep,
  setTourStep,
  closeTour,
  threeDActive = false,
  setThreeDActive,
}: TourOverlayProps) {
  const [spotlight, setSpotlight] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const steps = [
    { key: "welcome" as const },
    { key: "catalog" as const, selector: "#tour-catalog" },
    { key: "canvas" as const, selector: "#tour-canvas" },
    { key: "inspector" as const, selector: "#tour-inspector" },
    { key: "ruler" as const, selector: "#tour-ruler" },
    { key: "threeD" as const, selector: "#tour-3d-toggle" },
    { key: "threeDControls" as const, selector: "#tour-sidebar" },
  ];

  // Synchronize 3D active state with current tour step
  useEffect(() => {
    if (!tourOpen || !setThreeDActive) return;

    const step = steps[Math.min(tourStep, steps.length - 1)];
    const is3dStep = step.key === "threeD" || step.key === "threeDControls";

    if (is3dStep && !threeDActive) {
      setThreeDActive(true);
    } else if (!is3dStep && threeDActive) {
      setThreeDActive(false);
    }
  }, [tourStep, tourOpen, threeDActive, setThreeDActive]);

  useEffect(() => {
    if (!tourOpen) {
      setSpotlight(null);
      return;
    }

    const currentStep = steps[Math.min(tourStep, steps.length - 1)];
    const selector = currentStep.selector;
    if (!selector) {
      setSpotlight(null);
      return;
    }

    const updateSpotlight = () => {
      const el = document.querySelector(selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setSpotlight({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        });
      } else {
        setSpotlight(null);
      }
    };

    // Small delay to allow elements to render/shift
    const timer = setTimeout(updateSpotlight, 120);

    window.addEventListener("resize", updateSpotlight);
    window.addEventListener("scroll", updateSpotlight, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateSpotlight);
      window.removeEventListener("scroll", updateSpotlight, true);
    };
  }, [tourStep, tourOpen, threeDActive]);

  if (!tourOpen) return null;

  const step = steps[Math.min(tourStep, steps.length - 1)];
  const content = t.tour[step.key];
  const isLast = tourStep >= steps.length - 1;

  return (
    <>
      {/* Blurred dark backdrop with spotlight cutout */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2.5px] transition-all duration-300 pointer-events-auto"
        style={{ clipPath: getClipPath(spotlight) }}
      />

      {/* Glowing spotlight highlight border */}
      {spotlight && (
        <div
          className="fixed z-45 rounded-lg border-2 border-teal-500 dark:border-teal-400 pointer-events-none transition-all duration-300 shadow-[0_0_15px_rgba(20,184,166,0.5)] animate-pulse"
          style={{
            left: spotlight.left - 6,
            top: spotlight.top - 6,
            width: spotlight.width + 12,
            height: spotlight.height + 12,
          }}
        />
      )}

      {/* Tour Modal Card */}
      <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center pointer-events-none">
        <div className="w-full max-w-md rounded-xl border border-border/40 bg-background/95 backdrop-blur-md p-5 shadow-2xl pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h2 className="text-base font-bold text-primary">{content.title}</h2>
            <button
              type="button"
              onClick={closeTour}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{content.body}</p>
          <div className="mt-5 flex items-center justify-between border-t border-border/20 pt-3.5">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {tourStep + 1} / {steps.length}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={closeTour}
                className="h-8 text-xs font-semibold"
              >
                {t.tourSkip}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-semibold"
                onClick={() => setTourStep((s) => Math.max(0, s - 1))}
                disabled={tourStep === 0}
              >
                {t.tourBack}
              </Button>
              {isLast ? (
                <Button
                  size="sm"
                  className="h-8 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/95"
                  onClick={closeTour}
                >
                  {t.tourDone}
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-8 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/95"
                  onClick={() => setTourStep((s) => s + 1)}
                >
                  {t.tourNext}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
