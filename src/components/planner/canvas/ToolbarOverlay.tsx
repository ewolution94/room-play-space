import React from "react";
import { Button } from "@/components/ui/button";
import { Ruler, Zap, ZapOff, Box, X } from "lucide-react";
import type { Point } from "@/types/planner";
import type { TranslationStrings } from "@/lib/planner-translations";

interface ToolbarOverlayProps {
  t: TranslationStrings;
  collisionEnabled: boolean;
  setCollisionEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  rulerMode: boolean;
  setRulerMode: React.Dispatch<React.SetStateAction<boolean>>;
  threeDActive: boolean;
  setThreeDActive: React.Dispatch<React.SetStateAction<boolean>>;
  rulerStart: Point | null;
  rulerEnd: Point | null;
  clearRuler: () => void;
}

export function ToolbarOverlay({
  t,
  collisionEnabled,
  setCollisionEnabled,
  rulerMode,
  setRulerMode,
  threeDActive,
  setThreeDActive,
  rulerStart,
  rulerEnd,
  clearRuler,
}: ToolbarOverlayProps) {
  return (
    <div
      className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 backdrop-blur-md px-3.5 py-1.5 shadow-lg select-none"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Collision toggle */}
      <Button
        variant={collisionEnabled ? "ghost" : "destructive"}
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setCollisionEnabled((v) => !v);
        }}
        disabled={threeDActive}
        title={t.collisionHint}
        className={`h-8 rounded-full px-3 text-xs gap-1.5 font-medium transition-all ${
          collisionEnabled
            ? "text-teal-600 hover:text-teal-700 hover:bg-teal-500/10 dark:text-teal-400 dark:hover:text-teal-300 dark:hover:bg-teal-400/10"
            : ""
        }`}
      >
        {collisionEnabled ? (
          <Zap className="h-3.5 w-3.5" />
        ) : (
          <ZapOff className="h-3.5 w-3.5" />
        )}
        {collisionEnabled ? t.collisionOn : t.collisionOff}
      </Button>

      <div className="h-4 w-px bg-border/40" />

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

      {/* 3D toggle */}
      <Button
        id="tour-3d-toggle"
        variant={threeDActive ? "secondary" : "ghost"}
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setThreeDActive((v) => !v);
        }}
        className={`h-8 rounded-full px-3 text-xs gap-1.5 font-medium ${
          threeDActive
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
