import React from "react";
import type { TranslationStrings } from "@/lib/planner-translations";

interface HintBannerProps {
  t: TranslationStrings;
  lang: string;
  scale: number;
  rulerMode: boolean;
  threeDActive: boolean;
}

export function HintBanner({ t, lang, scale, rulerMode, threeDActive }: HintBannerProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border/30 bg-background/40 backdrop-blur-sm px-3.5 py-2 shadow-sm">
      <p className="text-[11px] text-muted-foreground">
        {threeDActive
          ? lang === "de"
            ? "Ziehen: Drehen • Rechtsklick: Verschieben • Scrollen: Zoomen"
            : "Drag: Rotate • Right-click: Pan • Scroll: Zoom"
          : rulerMode
            ? t.rulerHint
            : t.hint}{" "}
        <span className="font-semibold text-foreground/75">
          {threeDActive ? "" : `(1cm ≈ ${scale.toFixed(2)}px)`}
        </span>
      </p>
    </div>
  );
}
