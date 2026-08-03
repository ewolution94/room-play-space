import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NumberField } from "@/components/ui/number-field";
import { Button } from "@/components/ui/button";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  RotateCw,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  LayoutGrid,
} from "lucide-react";
import type { RoomLayout, Point } from "@/types/planner";
import type { TranslationStrings } from "@/lib/planner-translations";
import { wallSegments, wallColorKey } from "@/lib/hallway-shapes";
import type { WallOpenInterval } from "@/lib/room-adjacency";

interface MultiRoomInspectorProps {
  t: TranslationStrings;
  lang: "en" | "de";
  /** Which Home's floor plan this inspector belongs to -- needed to open a
   * room, since a room's editor URL is scoped to its home. Passed down
   * rather than looked up from the room id (see RoomSource's doc comment in
   * types/planner.ts). */
  homeId: string;
  selectedRoom: RoomLayout | null;
  selectedRoomIds: Set<string>;
  // Auto-detected touching span(s) per wall (wallColorKey() format), for
  // selectedRoom specifically -- see room-adjacency.ts. Only used here to
  // show the "touching" badge; the actual Auto/Open/Closed control is
  // still all-or-nothing per wall (see setWallOverride below).
  autoOpenWalls: Map<string, WallOpenInterval[]>;
  updateSelectedRoom: (patch: Partial<RoomLayout>) => void;
  rotateRoom: (id: string) => void;
  duplicateRoom: (id: string) => void;
  deleteRoom: (id: string) => void;
  duplicateSelectedRooms: () => void;
  deleteSelectedRooms: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onHeaderPointerDown: (e: React.PointerEvent) => void;
}

/**
 * Floating draggable inspector for the multi-room master floor plan --
 * mirrors the single-room planner's InspectorSection + its draggable panel
 * wrapper in CanvasArea.tsx (same header/drag-handle/collapse pattern), so
 * editing a room's properties feels consistent between both views instead of
 * living in a static sidebar card.
 */
export function MultiRoomInspector({
  t,
  lang,
  homeId,
  selectedRoom,
  selectedRoomIds,
  autoOpenWalls,
  updateSelectedRoom,
  rotateRoom,
  duplicateRoom,
  deleteRoom,
  duplicateSelectedRooms,
  deleteSelectedRooms,
  isCollapsed,
  onToggleCollapse,
  onHeaderPointerDown,
}: MultiRoomInspectorProps) {
  const isBulk = selectedRoomIds.size > 1;

  // Local (bounding-box-fallback) corners for whichever room is selected --
  // same pattern used everywhere else a room's corners might not exist yet
  // (rooms saved before `corners` did).
  const roomCorners: Point[] = selectedRoom
    ? selectedRoom.corners && selectedRoom.corners.length >= 3
      ? selectedRoom.corners
      : [
          { x: 0, y: 0 },
          { x: selectedRoom.width, y: 0 },
          { x: selectedRoom.width, y: selectedRoom.length },
          { x: 0, y: selectedRoom.length },
        ]
    : [];

  // Sets (or clears, via `undefined`) a manual override for one wall of the
  // selected room -- the "0-4 walls" feature (see room-adjacency.ts).
  // Forcing a wall open is a deliberate action, so it clears any door/
  // window already on it (there's nothing left to cut one into); clearing
  // back to "Auto" or forcing closed never touches opening data.
  const setWallOverride = (key: string, value: boolean | undefined) => {
    if (!selectedRoom) return;
    const nextOverrides = { ...(selectedRoom.wallOverrides ?? {}) };
    if (value === undefined) {
      delete nextOverrides[key];
    } else {
      nextOverrides[key] = value;
    }
    const patch: Partial<RoomLayout> = { wallOverrides: nextOverrides };
    if (value === true) {
      patch.openings = selectedRoom.openings.filter((o) => {
        const wallKey = typeof o.wall === "string" ? o.wall : String(o.wall);
        return wallKey !== key;
      });
    }
    updateSelectedRoom(patch);
  };

  return (
    <Card
      className="border-primary/20 shadow-md bg-card/90 backdrop-blur-md shrink-0 border-t-2 overflow-hidden"
      style={{ transform: "translate3d(0,0,0)", backfaceVisibility: "hidden" }}
    >
      <div
        className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary border-b border-border/20 flex items-center justify-between bg-primary/5 select-none"
        style={{ cursor: "move" }}
        onPointerDown={onHeaderPointerDown}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          <span className="truncate">
            {isBulk
              ? lang === "de"
                ? "Mehrfachauswahl"
                : "Multiple Selection"
              : lang === "de"
                ? "Raum bearbeiten"
                : "Edit Room Properties"}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isBulk && (
            <span className="bg-primary/20 text-primary rounded-full px-1.5 py-0.5 text-[9px] font-bold">
              {selectedRoomIds.size}
            </span>
          )}
          <HoverTooltip
            content={
              isCollapsed
                ? lang === "de"
                  ? "Erweitern"
                  : "Expand"
                : lang === "de"
                  ? "Einklappen"
                  : "Collapse"
            }
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse();
              }}
              className="p-0.5 rounded hover:bg-primary/10 transition-colors"
            >
              {isCollapsed ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </button>
          </HoverTooltip>
        </div>
      </div>

      {!isCollapsed && (
        <CardContent className="p-3 max-h-[60vh] overflow-y-auto">
          {isBulk ? (
            <div className="flex flex-col gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>
                  {selectedRoomIds.size} {lang === "de" ? "Räume ausgewählt" : "rooms selected"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={duplicateSelectedRooms}
                  className="w-full text-xs font-semibold h-8 gap-1.5 text-foreground hover:bg-accent"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>{t.duplicate}</span>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  type="button"
                  onClick={deleteSelectedRooms}
                  className="w-full text-xs font-semibold h-8 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{lang === "de" ? "Löschen" : "Delete"}</span>
                </Button>
              </div>
            </div>
          ) : selectedRoom ? (
            <div className="flex flex-col gap-2.5 animate-in fade-in duration-200">
              <div>
                <Label className="text-xs">{lang === "de" ? "Name" : "Name"}</Label>
                <Input
                  value={selectedRoom.name}
                  onChange={(e) => updateSelectedRoom({ name: e.target.value })}
                  className="h-8 text-xs mt-1"
                />
              </div>

              {selectedRoom.corners && selectedRoom.corners.length !== 4 ? (
                <div className="rounded-lg border bg-muted/20 p-2.5 text-[10.5px] text-muted-foreground leading-relaxed">
                  {lang === "de"
                    ? `Grundriss: ${Math.round(selectedRoom.width)} × ${Math.round(selectedRoom.length)} cm (Begrenzungsrahmen). Ein L/T-Flur wird über seine Form angelegt, nicht über Breite/Länge -- lösche und erstelle ihn neu, um die Form zu ändern.`
                    : `Footprint: ${Math.round(selectedRoom.width)} × ${Math.round(selectedRoom.length)} cm (bounding box). An L/T hallway's shape is set at creation, not by width/length -- delete and re-create it to change the shape.`}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">
                      {lang === "de" ? "Breite (cm)" : "Width (cm)"}
                    </Label>
                    <NumberField
                      min={50}
                      max={1500}
                      value={selectedRoom.width}
                      onCommit={(w) => updateSelectedRoom({ width: w })}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">
                      {lang === "de" ? "Länge (cm)" : "Length (cm)"}
                    </Label>
                    <NumberField
                      min={50}
                      max={1500}
                      value={selectedRoom.length}
                      onCommit={(l) => updateSelectedRoom({ length: l })}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>
              )}

              {/* "0-4 walls" feature: each wall can be Auto (follows
                  whether it's touching a neighbor -- see room-adjacency.ts),
                  forced Open, or forced Closed. Lets you compose complex
                  layouts by placing simple rooms flush against each other
                  and opening the shared walls, rather than needing one big
                  custom polygon room. */}
              <div className="rounded-lg border bg-muted/10 p-2.5 flex flex-col gap-2">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {lang === "de" ? "Wände" : "Walls"}
                </Label>
                <div className="flex flex-col gap-1.5">
                  {wallSegments(roomCorners).map((seg) => {
                    const key = wallColorKey(seg.index, roomCorners.length);
                    const override = selectedRoom.wallOverrides?.[key];
                    const isTouching = autoOpenWalls.has(key);
                    const label =
                      roomCorners.length === 4
                        ? t[key as "top" | "right" | "bottom" | "left"]
                        : lang === "de"
                          ? `Wand ${seg.index + 1}`
                          : `Wall ${seg.index + 1}`;
                    return (
                      <div
                        key={seg.index}
                        className="flex items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{label}</span>
                          {isTouching && override === undefined && (
                            <span className="shrink-0 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 px-1.5 py-0.5 text-[9px] font-semibold">
                              {lang === "de" ? "berührt" : "touching"}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center rounded-md border border-border overflow-hidden shrink-0">
                          <HoverTooltip
                            content={
                              lang === "de"
                                ? "Automatisch (basierend auf berührenden Nachbarräumen)"
                                : "Auto (based on touching neighbors)"
                            }
                          >
                            <button
                              type="button"
                              onClick={() => setWallOverride(key, undefined)}
                              className={`px-1.5 py-1 text-[10px] font-medium transition-colors ${
                                override === undefined
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-accent"
                              }`}
                            >
                              {lang === "de" ? "Auto" : "Auto"}
                            </button>
                          </HoverTooltip>
                          <button
                            type="button"
                            onClick={() => setWallOverride(key, true)}
                            className={`px-1.5 py-1 text-[10px] font-medium transition-colors border-l border-border ${
                              override === true
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-accent"
                            }`}
                          >
                            {lang === "de" ? "Offen" : "Open"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setWallOverride(key, false)}
                            className={`px-1.5 py-1 text-[10px] font-medium transition-colors border-l border-border ${
                              override === false
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-accent"
                            }`}
                          >
                            {lang === "de" ? "Zu" : "Closed"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1.5">
                <Button
                  variant="default"
                  size="sm"
                  asChild
                  className="w-full text-xs font-semibold h-8 bg-sky-600 hover:bg-sky-500 text-white gap-1.5"
                >
                  <Link
                    to="/home/$homeId/room/$roomId"
                    params={{ homeId, roomId: selectedRoom.id }}
                  >
                    <span>{t.enterRoom}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => rotateRoom(selectedRoom.id)}
                  className="w-full text-xs font-semibold h-8 gap-1.5 text-foreground hover:bg-accent"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>{lang === "de" ? "Drehen" : "Rotate"}</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => duplicateRoom(selectedRoom.id)}
                  className="w-full text-xs font-semibold h-8 gap-1.5 text-foreground hover:bg-accent"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>{t.duplicate}</span>
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  type="button"
                  onClick={() => deleteRoom(selectedRoom.id)}
                  className="w-full text-xs font-semibold h-8 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{lang === "de" ? "Löschen" : "Delete"}</span>
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}
