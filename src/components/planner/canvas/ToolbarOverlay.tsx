import React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Ruler, Box, X } from "lucide-react";
import type { Point } from "@/types/planner";
import type { TranslationStrings } from "@/lib/planner-translations";

interface ToolbarOverlayProps {
  t: TranslationStrings;
  rulerMode: boolean;
  setRulerMode: React.Dispatch<React.SetStateAction<boolean>>;
  threeDActive: boolean;
  setThreeDActive: React.Dispatch<React.SetStateAction<boolean>>;
  rulerStart: Point | null;
  rulerEnd: Point | null;
  clearRuler: () => void;
  /** Mobile view-only mode (see useMobileViewOnly): the ruler is an editing
   * tool, not a view option, so it's hidden along with everything else --
   * only the 2D/3D toggle stays. */
  hideRuler?: boolean;
  /** Mobile view-only mode + portrait orientation (see useMobileViewOnly):
   * 3D mode needs real screen space, so entering it is locked until the
   * device is rotated to landscape. Only gates turning 3D ON -- once
   * already active, switching back to 2D always works regardless of
   * orientation. */
  mobileLandscapeRequired?: boolean;
  lang?: "en" | "de";
}

export function ToolbarOverlay({
  t,
  rulerMode,
  setRulerMode,
  threeDActive,
  setThreeDActive,
  rulerStart,
  rulerEnd,
  clearRuler,
  hideRuler,
  mobileLandscapeRequired,
  lang = "en",
}: ToolbarOverlayProps) {
  const threeDLocked = !threeDActive && !!mobileLandscapeRequired;
  return (
    <div
      className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 backdrop-blur-md px-3.5 py-1.5 shadow-lg select-none"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {!hideRuler && (
        <>
          {/* Ruler toggle */}
          <Button
            id="tour-ruler"
            variant={rulerMode ? "secondary" : "ghost"}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setRulerMode((v) => !v);
            }}
            disabled={threeDActive}
            title={t.rulerHint}
            className={`h-8 rounded-full px-3 text-xs gap-1.5 font-medium ${
              rulerMode
                ? "text-sky-600 bg-sky-500/10 hover:bg-sky-500/20 dark:text-sky-400 dark:bg-sky-400/10 dark:hover:bg-sky-400/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Ruler className="h-3.5 w-3.5" />
            {rulerMode ? t.rulerOn : t.ruler}
          </Button>

          {rulerMode && (rulerStart || rulerEnd) && (
            <>
              <div className="h-4 w-px bg-border/40" />
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  clearRuler();
                }}
                className="h-8 rounded-full px-3 text-xs gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
                {t.rulerClear}
              </Button>
            </>
          )}

          <div className="h-4 w-px bg-border/40" />
        </>
      )}

      {/* 3D toggle -- deliberately never gets the native `disabled`
          attribute while locked, so a tap still fires onClick and can show
          the rotate-to-landscape toast; only the styling communicates
          "disabled" visually. */}
      <Button
        id="tour-3d-toggle"
        variant={threeDActive ? "secondary" : "ghost"}
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          if (threeDLocked) {
            toast.info(
              lang === "de"
                ? "Bitte drehe dein Gerät ins Querformat, um den 3D-Modus zu nutzen."
                : "Rotate your device to landscape to use 3D mode.",
            );
            return;
          }
          setThreeDActive((v) => !v);
        }}
        title={
          threeDLocked
            ? lang === "de"
              ? "3D-Modus benötigt Querformat"
              : "3D mode requires landscape orientation"
            : undefined
        }
        className={`h-8 rounded-full px-3 text-xs gap-1.5 font-medium ${
          threeDLocked
            ? "text-muted-foreground/40 cursor-not-allowed"
            : threeDActive
              ? "text-purple-600 bg-purple-500/10 hover:bg-purple-500/20 dark:text-purple-400 dark:bg-purple-400/10 dark:hover:bg-purple-400/20"
              : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Box className="h-3.5 w-3.5" />
        {threeDActive ? t.twoDMode : t.threeDMode}
      </Button>
    </div>
  );
}
