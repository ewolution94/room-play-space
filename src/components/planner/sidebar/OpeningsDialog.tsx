import React, { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { Button } from "@/components/ui/button";
import { Sliders, Ruler, Square, Plus, DoorOpen } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Opening, OpeningKind, Point } from "@/types/planner";
import { defaultOpeningWidth, openingWidthPresets } from "@/lib/openings";
import { wallSegments, wallColorKey } from "@/lib/hallway-shapes";
import { closedSubIntervals, type WallOpenInterval } from "@/lib/room-adjacency";

interface OpeningsDialogProps {
  t: any;
  lang: string;
  threeDActive: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oKind: OpeningKind;
  setOKind: (kind: OpeningKind) => void;
  /** Terrace doors only -- one leaf or two (see Opening.leaves). */
  oLeaves: 1 | 2;
  setOLeaves: (leaves: 1 | 2) => void;
  oWall: Opening["wall"];
  setOWall: (wall: Opening["wall"]) => void;
  oPos: number;
  setOPos: (pos: number) => void;
  oWidth: number;
  setOWidth: (width: number) => void;
  addOpening: () => void;
  /** Wall count of the room currently being edited -- 4 for a plain
   * rectangular room (named wall picker, unchanged), anything else for a
   * polygon (L/T-shaped hallway) room (numeric "Wall N" picker). */
  cornersCount: number;
  /** The room's own corners, needed to know each wall's length (to tell a
   * fully-open wall apart from one that's only partly open). */
  corners: Point[];
  /** Open interval(s) per wall (wallColorKey() format) -- see
   * room-adjacency.ts. A wall is excluded from the picker only once it's
   * *fully* open (no closed span left to cut a door/window into); a
   * partially-open wall stays selectable, same as before this feature. */
  openWalls: Map<string, WallOpenInterval[]>;
}

export function OpeningsDialog({
  t,
  lang,
  threeDActive,
  open,
  onOpenChange,
  oKind,
  setOKind,
  oLeaves,
  setOLeaves,
  oWall,
  setOWall,
  oPos,
  setOPos,
  oWidth,
  setOWidth,
  addOpening,
  cornersCount,
  corners,
  openWalls,
}: OpeningsDialogProps) {
  const isPolygon = cornersCount !== 4;
  const NAMED_WALLS = ["top", "right", "bottom", "left"] as const;
  const wallSegs = wallSegments(corners);
  const isWallFullyOpen = (key: string, length: number) =>
    closedSubIntervals(length, openWalls.get(key) ?? []).length === 0;
  const availableNamedWalls = NAMED_WALLS.filter((w, idx) => {
    const seg = wallSegs[idx];
    return !!seg && !isWallFullyOpen(w, seg.length);
  });
  const availableWallIndices = wallSegs
    .filter((seg) => !isWallFullyOpen(wallColorKey(seg.index, corners.length), seg.length))
    .map((seg) => seg.index);
  const isCurrentWallFullyOpen = (() => {
    const key = typeof oWall === "string" ? oWall : String(oWall);
    const seg =
      typeof oWall === "number"
        ? wallSegs[oWall]
        : wallSegs[NAMED_WALLS.indexOf(oWall as (typeof NAMED_WALLS)[number])];
    if (!seg) return false;
    return isWallFullyOpen(key, seg.length);
  })();

  // Keep the selected wall valid for whichever room is currently open --
  // switching from a rectangular room to a hallway (or back) while this
  // dialog's state is still around shouldn't leave a stale/invalid value
  // selected in the dropdown. Also re-picks a wall if the currently
  // selected one just became fully open (nothing left to hang a door/
  // window on) -- a partially-open wall stays selected as-is.
  useEffect(() => {
    if (isPolygon && typeof oWall === "string") {
      setOWall(availableWallIndices[0] ?? 0);
    } else if (!isPolygon && typeof oWall === "number") {
      setOWall(availableNamedWalls[0] ?? "top");
    } else if (isPolygon && isCurrentWallFullyOpen && availableWallIndices.length > 0) {
      setOWall(availableWallIndices[0]);
    } else if (!isPolygon && isCurrentWallFullyOpen && availableNamedWalls.length > 0) {
      setOWall(availableNamedWalls[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPolygon, openWalls]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          id="tour-openings"
          variant="default"
          size="sm"
          type="button"
          disabled={threeDActive}
          className="h-10 text-sm font-semibold w-full active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"
        >
          <DoorOpen className="h-4 w-4" />
          {lang === "de" ? "Tür/Fenster hinzufügen" : "Add Door / Window"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-md border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <Sliders className="h-5 w-5 text-primary" />
            {t.openings}
          </DialogTitle>
          <DialogDescription>
            {lang === "de"
              ? "Fügen Sie Türen oder Fenster in die Außenwände Ihres Raums ein."
              : "Add doors or windows to the outer walls of your room."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t.type}
              </Label>
              <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                <span className="pl-2.5 text-muted-foreground/75">
                  <Square className="h-3.5 w-3.5" />
                </span>
                <select
                  className="w-full bg-transparent pl-1.5 pr-2 h-8 text-xs focus:outline-none focus:ring-0 focus:border-0 border-0 cursor-pointer"
                  value={oKind}
                  onChange={(e) => {
                    const kind = e.target.value as OpeningKind;
                    setOKind(kind);
                    // Each kind has its own real-world size, so the width
                    // follows the choice instead of leaving a 90cm window
                    // or a 120cm door behind. See lib/openings.ts.
                    setOWidth(defaultOpeningWidth(kind, oLeaves));
                  }}
                >
                  <option value="door" className="bg-background">
                    {t.door}
                  </option>
                  <option value="window" className="bg-background">
                    {t.window}
                  </option>
                  <option value="terrace-door" className="bg-background">
                    {t.terraceDoor}
                  </option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t.wall}
              </Label>
              <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                <span className="pl-2.5 text-muted-foreground/75">
                  <Sliders className="h-3.5 w-3.5" />
                </span>
                <select
                  className="w-full bg-transparent pl-1.5 pr-2 h-8 text-xs focus:outline-none focus:ring-0 focus:border-0 border-0 cursor-pointer"
                  value={oWall}
                  onChange={(e) =>
                    setOWall(
                      (isPolygon ? Number(e.target.value) : e.target.value) as Opening["wall"],
                    )
                  }
                >
                  {isPolygon ? (
                    availableWallIndices.map((i) => (
                      <option key={i} value={i} className="bg-background">
                        {lang === "de" ? `Wand ${i + 1}` : `Wall ${i + 1}`}
                      </option>
                    ))
                  ) : (
                    <>
                      {availableNamedWalls.includes("top") && (
                        <option value="top" className="bg-background">
                          {t.top}
                        </option>
                      )}
                      {availableNamedWalls.includes("bottom") && (
                        <option value="bottom" className="bg-background">
                          {t.bottom}
                        </option>
                      )}
                      {availableNamedWalls.includes("left") && (
                        <option value="left" className="bg-background">
                          {t.left}
                        </option>
                      )}
                      {availableNamedWalls.includes("right") && (
                        <option value="right" className="bg-background">
                          {t.right}
                        </option>
                      )}
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Leaves, terrace doors only: a one-leaf door is a door you can
              see through, a two-leaf one is the wide "French" pair that
              opens from the middle. Nothing else in the catalogue has
              leaves, so this appears only when it applies -- and picking
              one resets the width, since 90cm is a single leaf and 180cm a
              pair. */}
          {oKind === "terrace-door" && (
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t.leaves}
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                {([1, 2] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setOLeaves(n);
                      setOWidth(defaultOpeningWidth("terrace-door", n));
                    }}
                    className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                      oLeaves === n
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {n === 1 ? t.oneLeaf : t.twoLeaves}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t.position}
              </Label>
              <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                <span className="pl-2.5 text-muted-foreground/75">
                  <Ruler className="h-3.5 w-3.5" />
                </span>
                <NumberField
                  min={0}
                  value={oPos}
                  onCommit={setOPos}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-7 h-8 text-xs w-full bg-transparent"
                />
                <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">
                  cm
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t.width}
              </Label>
              <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                <span className="pl-2.5 text-muted-foreground/75">
                  <Ruler className="h-3.5 w-3.5" />
                </span>
                <NumberField
                  min={1}
                  value={oWidth}
                  onCommit={setOWidth}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-7 h-8 text-xs w-full bg-transparent"
                />
                <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">
                  cm
                </span>
              </div>
            </div>
          </div>

          {/* The sizes these things are actually sold in, so the common
              case is one click rather than a number you have to know. */}
          <div className="flex flex-wrap gap-1.5">
            {openingWidthPresets(oKind, oLeaves).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setOWidth(w)}
                className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                  oWidth === w
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {w} cm
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              addOpening();
              onOpenChange(false);
            }}
            className="w-full sm:w-auto h-9 text-xs font-semibold"
          >
            <Plus className="mr-1 h-4 w-4" /> {t.addOpening}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
