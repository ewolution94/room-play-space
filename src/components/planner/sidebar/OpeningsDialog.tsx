import React, { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { Button } from "@/components/ui/button";
import { Sliders, Ruler, Square, Plus } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Opening } from "@/types/planner";

interface OpeningsDialogProps {
  t: any;
  lang: string;
  threeDActive: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oKind: "door" | "window";
  setOKind: (kind: "door" | "window") => void;
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
  /** Wall keys (wallColorKey() format) that are currently open (the
   * "0-4 walls" feature -- see room-adjacency.ts). There's nothing to cut
   * a door/window into on an open wall, so it's excluded from the picker
   * entirely. */
  openWalls: Set<string>;
}

export function OpeningsDialog({
  t,
  lang,
  threeDActive,
  open,
  onOpenChange,
  oKind,
  setOKind,
  oWall,
  setOWall,
  oPos,
  setOPos,
  oWidth,
  setOWidth,
  addOpening,
  cornersCount,
  openWalls,
}: OpeningsDialogProps) {
  const isPolygon = cornersCount !== 4;
  const NAMED_WALLS = ["top", "right", "bottom", "left"] as const;
  const availableNamedWalls = NAMED_WALLS.filter((w) => !openWalls.has(w));
  const availableWallIndices = Array.from({ length: cornersCount }, (_, i) => i).filter(
    (i) => !openWalls.has(String(i)),
  );

  // Keep the selected wall valid for whichever room is currently open --
  // switching from a rectangular room to a hallway (or back) while this
  // dialog's state is still around shouldn't leave a stale/invalid value
  // selected in the dropdown. Also re-picks a wall if the currently
  // selected one just became open (nothing to hang a door/window on
  // anymore).
  useEffect(() => {
    if (isPolygon && typeof oWall === "string") {
      setOWall(availableWallIndices[0] ?? 0);
    } else if (!isPolygon && typeof oWall === "number") {
      setOWall(availableNamedWalls[0] ?? "top");
    } else if (isPolygon && openWalls.has(String(oWall)) && availableWallIndices.length > 0) {
      setOWall(availableWallIndices[0]);
    } else if (
      !isPolygon &&
      typeof oWall === "string" &&
      openWalls.has(oWall) &&
      availableNamedWalls.length > 0
    ) {
      setOWall(availableNamedWalls[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPolygon, openWalls]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          id="tour-openings"
          variant="outline"
          size="sm"
          type="button"
          disabled={threeDActive}
          className="h-9 text-xs font-semibold w-full hover:bg-primary/5 active:scale-95 transition-all flex items-center justify-center gap-1.5 border-dashed"
        >
          <Sliders className="h-3.5 w-3.5 text-primary" />
          {lang === "de" ? "Wandöffnungen" : "Openings"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-md border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <Sliders className="h-5 w-5 text-primary" />
            {t.openings}
          </DialogTitle>
          <DialogDescription>
            {lang === "de" ? "Fügen Sie Türen oder Fenster in die Außenwände Ihres Raums ein." : "Add doors or windows to the outer walls of your room."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.type}</Label>
              <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                <span className="pl-2.5 text-muted-foreground/75">
                  <Square className="h-3.5 w-3.5" />
                </span>
                <select
                  className="w-full bg-transparent pl-1.5 pr-2 h-8 text-xs focus:outline-none focus:ring-0 focus:border-0 border-0 cursor-pointer"
                  value={oKind}
                  onChange={(e) => setOKind(e.target.value as "door" | "window")}
                >
                  <option value="door" className="bg-background">{t.door}</option>
                  <option value="window" className="bg-background">{t.window}</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.wall}</Label>
              <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                <span className="pl-2.5 text-muted-foreground/75">
                  <Sliders className="h-3.5 w-3.5" />
                </span>
                <select
                  className="w-full bg-transparent pl-1.5 pr-2 h-8 text-xs focus:outline-none focus:ring-0 focus:border-0 border-0 cursor-pointer"
                  value={oWall}
                  onChange={(e) =>
                    setOWall(
                      (isPolygon
                        ? Number(e.target.value)
                        : e.target.value) as Opening["wall"],
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
                      {!openWalls.has("top") && (
                        <option value="top" className="bg-background">{t.top}</option>
                      )}
                      {!openWalls.has("bottom") && (
                        <option value="bottom" className="bg-background">{t.bottom}</option>
                      )}
                      {!openWalls.has("left") && (
                        <option value="left" className="bg-background">{t.left}</option>
                      )}
                      {!openWalls.has("right") && (
                        <option value="right" className="bg-background">{t.right}</option>
                      )}
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.position}</Label>
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
                <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">cm</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.width}</Label>
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
                <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">cm</span>
              </div>
            </div>
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
