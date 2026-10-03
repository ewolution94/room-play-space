import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Item, Opening, Point, RoomFlooring } from "@/types/planner";
import type { TranslationStrings } from "@/lib/planner-translations";
import { RoomPlanSvg } from "@/components/planner/RoomPlanSvg";
import { FLOOR_MATERIALS } from "@/lib/floor-materials";
import { wallColorKey } from "@/lib/hallway-shapes";
import { comparedFloor, paintAllWalls, sameWalls } from "@/lib/material-compare";
import { WALL_SWATCHES } from "@/lib/swatches";

export type CompareTab = "floor" | "walls";

/** The room's floor and walls as they were when the comparison opened, to go back to. */
export interface CompareBefore {
  flooring: RoomFlooring;
  wallColors: Record<string, string>;
}

interface CompareMaterialsDialogProps {
  t: TranslationStrings;
  lang: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The tab it opens on. */
  initialTab: CompareTab;
  before: CompareBefore;
  corners: Point[];
  openings: Opening[];
  items: Item[];
  flooring: RoomFlooring;
  setFlooring: (flooring: RoomFlooring) => void;
  wallColors: Record<string, string>;
  setWallColors: (wallColors: Record<string, string>) => void;
  /** Where focus goes back to on close: there's no DialogTrigger for Radix to return it to. */
  returnFocus: () => void;
}

/**
 * The room drawn once per flooring material or wall paint, side by side, so options can be
 * judged on this room's own shape and furniture rather than as a lone swatch. Picking a tile
 * applies it straight away, as an undo step (picks within a second of each other share one, see
 * lib/history-coalesce.ts). "As it was" is the way back without counting steps: a tile for the
 * walls, and the floor the room had is marked with it.
 */
export function CompareMaterialsDialog({
  t,
  lang,
  open,
  onOpenChange,
  initialTab,
  before,
  corners,
  openings,
  items,
  flooring,
  setFlooring,
  wallColors,
  setWallColors,
  returnFocus,
}: CompareMaterialsDialogProps) {
  const wallKeys = corners.map((_, i) => wallColorKey(i, corners.length));
  const plan = (label: string, floor: RoomFlooring, walls: Record<string, string>) => (
    <RoomPlanSvg
      corners={corners}
      openings={openings}
      items={items}
      flooring={floor}
      wallColors={walls}
      title={label}
      className="h-36 w-full text-slate-700"
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)] sm:max-w-3xl"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          returnFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t.compareTitle}</DialogTitle>
          <DialogDescription>{t.compareBody}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={initialTab} className="flex min-h-0 flex-col gap-3">
          <TabsList className="self-start">
            <TabsTrigger value="floor">{t.compareFloorTab}</TabsTrigger>
            <TabsTrigger value="walls">{t.compareWallsTab}</TabsTrigger>
          </TabsList>
          <TabsContent value="floor" className="min-h-0 overflow-y-auto">
            <TileGrid>
              {FLOOR_MATERIALS.map((option) => {
                const floor = comparedFloor(option, before.flooring);
                const name = lang === "de" ? option.nameDe : option.nameEn;
                return (
                  <Tile
                    key={option.key}
                    label={name}
                    note={option.key === before.flooring.key ? t.compareBefore : undefined}
                    pressed={flooring.key === option.key}
                    onClick={() => setFlooring(floor)}
                  >
                    {plan(name, floor, wallColors)}
                  </Tile>
                );
              })}
            </TileGrid>
          </TabsContent>
          <TabsContent value="walls" className="min-h-0 space-y-2 overflow-y-auto">
            <TileGrid>
              <Tile
                label={t.compareBefore}
                pressed={sameWalls(wallColors, before.wallColors, wallKeys)}
                onClick={() => setWallColors(before.wallColors)}
              >
                {plan(t.compareBefore, flooring, before.wallColors)}
              </Tile>
              {WALL_SWATCHES.map((paint) => {
                const painted = paintAllWalls(before.wallColors, wallKeys, paint.value);
                const name = lang === "de" ? paint.nameDe : paint.nameEn;
                return (
                  <Tile
                    key={paint.value}
                    label={name}
                    pressed={sameWalls(wallColors, painted, wallKeys)}
                    onClick={() => setWallColors(painted)}
                  >
                    {plan(name, flooring, painted)}
                  </Tile>
                );
              })}
            </TileGrid>
            <p className="text-xs text-muted-foreground">{t.compareWallsNote}</p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function TileGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">{children}</div>;
}

function Tile({
  label,
  note,
  pressed,
  onClick,
  children,
}: {
  label: string;
  note?: string;
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        pressed ? "border-primary ring-1 ring-primary" : "border-border/50 hover:border-border"
      }`}
    >
      {/* The label names the tile; the drawing would only repeat it. */}
      <span aria-hidden="true" className="block overflow-hidden rounded-md bg-muted/40">
        {children}
      </span>
      <span className="flex items-baseline justify-between gap-1 px-0.5">
        <span className="truncate text-xs font-medium">{label}</span>
        {note && <span className="shrink-0 text-[10px] text-muted-foreground">{note}</span>}
      </span>
    </button>
  );
}
