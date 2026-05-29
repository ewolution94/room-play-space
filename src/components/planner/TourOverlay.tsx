import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { TourOverlayProps } from "@/types/planner";

export function TourOverlay({ t, tourOpen, tourStep, setTourStep, closeTour }: TourOverlayProps) {
  if (!tourOpen) return null;

  const steps = [
    { key: "welcome" as const },
    { key: "catalog" as const },
    { key: "canvas" as const },
    { key: "openings" as const },
    { key: "ruler" as const },
    { key: "reset" as const },
  ];
  const step = steps[Math.min(tourStep, steps.length - 1)];
  const content = t.tour[step.key];
  const isLast = tourStep >= steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-lg border bg-background p-5 shadow-xl">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold">{content.title}</h2>
          <button
            type="button"
            onClick={closeTour}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">{content.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {tourStep + 1} / {steps.length}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={closeTour}>
              {t.tourSkip}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTourStep((s) => Math.max(0, s - 1))}
              disabled={tourStep === 0}
            >
              {t.tourBack}
            </Button>
            {isLast ? (
              <Button size="sm" onClick={closeTour}>
                {t.tourDone}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setTourStep((s) => s + 1)}>
                {t.tourNext}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
