import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/ui/number-field";
import { wallColorKey, wallLabel } from "@/lib/hallway-shapes";
import {
  DEFAULT_CEILING_HEIGHT,
  STANDING_HEIGHT,
  distanceToClearHeight,
  pitchFromRun,
  type WallSlopeMap,
} from "@/lib/wall-slopes";
import type { Point } from "@/types/planner";
import { ArrowUpFromLine, Plus, TriangleRight, X } from "lucide-react";

interface RoomHeightSectionProps {
  // Loosely typed to match InspectorSection's own `t: any` / `lang: string`
  // and wallLabel()'s `Record<string, string>` signature -- the wall-key
  // lookup below (`t[key]`) needs an index signature that
  // TranslationStrings deliberately doesn't have.
  t: Record<string, string>;
  lang: string;
  corners: Point[];
  ceilingHeight: number;
  setCeilingHeight: (h: number) => void;
  wallSlopes: WallSlopeMap;
  setWallSlopes: React.Dispatch<React.SetStateAction<WallSlopeMap>>;
  disabled?: boolean;
}

/** Sensible starting point for a new slope: a knee wall you can sit but not
 * stand beside, over a run that reaches full height in about a metre and a
 * half -- i.e. a fairly typical converted attic, so the first thing a user
 * sees on screen is already roughly the shape they're trying to describe. */
const NEW_SLOPE = { kneeHeight: 110, run: 150 };

/**
 * Room height and sloped ceilings ("Dachschrägen"), in the Inspector next to
 * wall colours -- the same per-wall shape, so it reuses the same wall-key
 * convention (named for a 4-corner room, numeric index for a polygon room,
 * see wallColorKey).
 *
 * Split into its own component rather than inlined because InspectorSection
 * is already very large, and because this is the one place a slope is
 * *authored* -- everything else in the app only reads it.
 */
export function RoomHeightSection({
  t,
  lang,
  corners,
  ceilingHeight,
  setCeilingHeight,
  wallSlopes,
  setWallSlopes,
  disabled,
}: RoomHeightSectionProps) {
  const setSlope = (key: string, patch: Partial<{ kneeHeight: number; run: number }>) => {
    setWallSlopes((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? NEW_SLOPE), ...patch },
    }));
  };

  const removeSlope = (key: string) => {
    setWallSlopes((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <ArrowUpFromLine className="h-3 w-3 text-muted-foreground" />
          {t.roomHeight}
        </Label>
        <NumberField
          min={50}
          max={2000}
          value={ceilingHeight}
          onCommit={setCeilingHeight}
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <TriangleRight className="h-3 w-3 text-muted-foreground" />
          {lang === "de" ? "Dachschrägen" : "Sloped ceilings"}
        </Label>

        <div className="space-y-1.5">
          {Array.from({ length: corners.length }, (_, i) => i).map((i) => {
            const key = wallColorKey(i, corners.length);
            const label = corners.length === 4 ? t[key] || key : wallLabel(i, t, lang);
            const slope = wallSlopes[key];

            if (!slope) {
              return (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={disabled}
                  onClick={() => setSlope(key, NEW_SLOPE)}
                  className="h-7 w-full justify-start gap-1.5 text-[11px] font-normal text-muted-foreground"
                >
                  <Plus className="h-3 w-3" />
                  {lang === "de" ? `Schräge an ${label}` : `Slope on ${label}`}
                </Button>
              );
            }

            // Where an adult can stand upright, and the roof pitch that
            // implies -- both derived, both things people actually quote.
            const standFrom = distanceToClearHeight(slope, STANDING_HEIGHT, ceilingHeight);
            const pitch = pitchFromRun(slope.kneeHeight, slope.run, ceilingHeight);

            return (
              <div key={key} className="rounded-md border border-border/60 bg-muted/20 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium">{label}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={disabled}
                    onClick={() => removeSlope(key)}
                    aria-label={lang === "de" ? "Schräge entfernen" : "Remove slope"}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="block text-[10px] text-muted-foreground">
                      {lang === "de" ? "Kniestock" : "Knee wall"}
                    </span>
                    <NumberField
                      min={0}
                      max={ceilingHeight}
                      value={slope.kneeHeight}
                      onCommit={(v) => setSlope(key, { kneeHeight: v })}
                      disabled={disabled}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[10px] text-muted-foreground">
                      {lang === "de" ? "Tiefe" : "Depth"}
                    </span>
                    <NumberField
                      min={0}
                      max={2000}
                      value={slope.run}
                      onCommit={(v) => setSlope(key, { run: v })}
                      disabled={disabled}
                    />
                  </div>
                </div>
                <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
                  {slope.kneeHeight >= STANDING_HEIGHT
                    ? lang === "de"
                      ? `Überall aufrecht stehen · ${Math.round(pitch)}° Neigung`
                      : `Upright everywhere · ${Math.round(pitch)}° pitch`
                    : lang === "de"
                      ? `Aufrecht stehen ab ${Math.round(standFrom)} cm · ${Math.round(pitch)}° Neigung`
                      : `Stand upright from ${Math.round(standFrom)} cm in · ${Math.round(pitch)}° pitch`}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
