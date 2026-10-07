import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NumberField } from "@/components/ui/number-field";
import { NAMED_WALLS, wallColorKey, wallLabel } from "@/lib/hallway-shapes";
import {
  STANDING_HEIGHT,
  distanceToClearHeight,
  pitchFromRun,
  type WallSlope,
  type WallSlopeMap,
} from "@/lib/wall-slopes";
import type { Opening, Point, RoofActions } from "@/types/planner";
import type { TranslationStrings } from "@/lib/planner-translations";
import { ArrowUpFromLine, Plus, Trash2, TriangleRight, X } from "lucide-react";

interface RoomHeightSectionProps {
  t: TranslationStrings;
  lang: string;
  corners: Point[];
  ceilingHeight: number;
  setCeilingHeight: (h: number) => void;
  wallSlopes: WallSlopeMap;
  setWallSlopes: React.Dispatch<React.SetStateAction<WallSlopeMap>>;
  /** Adding or removing a slope and the dormers on it (use-room-planner.ts). */
  roofActions: RoofActions;
  /** To ask before a slope change deletes the openings on its wall. */
  openings: Opening[];
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
  roofActions,
  openings,
  disabled,
}: RoomHeightSectionProps) {
  // A slope change that would delete openings (or dormers) waits here for a yes.
  const [pending, setPending] = useState<{ key: string; slope: WallSlope | null } | null>(null);
  const openingsOnWall = (key: string) => openings.filter((o) => String(o.wall) === key);
  const setSlope = (key: string, patch: Partial<{ kneeHeight: number; run: number }>) => {
    setWallSlopes((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? NEW_SLOPE), ...patch },
    }));
  };

  /** A knee wall only holds doors and windows inside a dormer, and a roof
   * window has nothing to sit in once its slope goes, so adding or removing a
   * slope deletes the openings on that wall (use-room-planner.ts's
   * setWallSlope). That's destructive, so it asks first. */
  const changeSlope = (key: string, slope: WallSlope | null) => {
    const losesSomething =
      openingsOnWall(key).length > 0 || (!slope && (wallSlopes[key]?.dormers?.length ?? 0) > 0);
    if (losesSomething) {
      setPending({ key, slope });
      return;
    }
    roofActions.setWallSlope(key, slope);
  };

  const confirmPending = () => {
    if (!pending) return;
    roofActions.setWallSlope(pending.key, pending.slope);
    setPending(null);
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
            const label = wallLabel(corners.length === 4 ? NAMED_WALLS[i] : i, t, lang);
            const slope = wallSlopes[key];

            if (!slope) {
              return (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={disabled}
                  onClick={() => changeSlope(key, NEW_SLOPE)}
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
                    onClick={() => changeSlope(key, null)}
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

                <div className="mt-2 space-y-1.5 border-t border-border/50 pt-2">
                  {(slope.dormers ?? []).map((dormer, di) => (
                    <div
                      key={dormer.id}
                      className="rounded border border-border/50 bg-background/60 p-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-medium">
                          {t.dormer} {di + 1}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          disabled={disabled}
                          onClick={() => roofActions.removeDormer(key, dormer.id)}
                          aria-label={`${t.removeDormer} ${di + 1}`}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="mt-1 grid grid-cols-3 gap-1.5">
                        <div className="space-y-1">
                          <span className="block text-[10px] text-muted-foreground">
                            {lang === "de" ? "Position" : "Position"}
                          </span>
                          <NumberField
                            min={0}
                            max={10000}
                            value={Math.round(dormer.position)}
                            onCommit={(v) =>
                              roofActions.updateDormer(key, dormer.id, { position: v })
                            }
                            disabled={disabled}
                            aria-label={`${t.dormer} ${di + 1}: Position`}
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="block text-[10px] text-muted-foreground">
                            {lang === "de" ? "Breite" : "Width"}
                          </span>
                          <NumberField
                            min={1}
                            max={10000}
                            value={Math.round(dormer.width)}
                            onCommit={(v) => roofActions.updateDormer(key, dormer.id, { width: v })}
                            disabled={disabled}
                            aria-label={`${t.dormer} ${di + 1}: ${lang === "de" ? "Breite" : "Width"}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="block text-[10px] text-muted-foreground">
                            {t.dormerHeight}
                          </span>
                          {/* At or above the room's height means "full height",
                              stored as no height at all so it follows the
                              ceiling if that changes. */}
                          <NumberField
                            min={1}
                            max={ceilingHeight}
                            value={Math.round(
                              Math.min(dormer.height ?? ceilingHeight, ceilingHeight),
                            )}
                            onCommit={(v) =>
                              roofActions.updateDormer(key, dormer.id, {
                                height: v >= ceilingHeight ? undefined : v,
                              })
                            }
                            disabled={disabled}
                            aria-label={`${t.dormer} ${di + 1}: ${t.dormerHeight}`}
                          />
                        </div>
                      </div>
                      {dormer.height === undefined && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {t.dormerFullHeight}
                        </p>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={disabled}
                    onClick={() => roofActions.addDormer(key)}
                    className="h-7 w-full justify-start gap-1.5 text-[11px] font-normal text-muted-foreground"
                  >
                    <Plus className="h-3 w-3" />
                    {t.addDormer}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.slope ? t.slopeRemovesOpeningsTitle : t.slopeRemoveTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.slope ? t.slopeRemovesOpeningsBody : t.slopeRemoveBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{lang === "de" ? "Abbrechen" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPending}>
              {lang === "de" ? "Entfernen" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
