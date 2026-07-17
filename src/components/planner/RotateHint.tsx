import { useState } from "react";
import { RotateCcw, X } from "lucide-react";

interface RotateHintProps {
  lang: "en" | "de";
}

/**
 * Small dismissible banner shown over the canvas on mobile view-only mode
 * while the device is held in portrait -- nudges the user to rotate to
 * landscape for a bigger canvas. Purely a suggestion (view-only mode itself
 * doesn't depend on orientation, see useMobileViewOnly), so dismissing it
 * just hides it for the rest of this mount -- it comes back if the
 * component remounts (e.g. navigating away and back).
 */
export function RotateHint({ lang }: RotateHintProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute top-3 left-1/2 z-30 -translate-x-1/2 flex items-center gap-2 max-w-[92%] rounded-full border border-border/40 bg-background/90 backdrop-blur-md px-3.5 py-2 shadow-lg select-none text-[11px] font-medium text-foreground animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <RotateCcw className="h-3.5 w-3.5 text-primary shrink-0" />
      <span>
        {lang === "de"
          ? "Für mehr Platz das Gerät ins Querformat drehen"
          : "Tilt your device to landscape for more space"}
      </span>
      <button
        onClick={() => setDismissed(true)}
        aria-label={lang === "de" ? "Schließen" : "Dismiss"}
        className="ml-1 shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
