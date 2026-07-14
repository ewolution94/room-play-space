import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NumberField } from "@/components/ui/number-field";
import { Button } from "@/components/ui/button";
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
import type { RoomLayout } from "@/types/planner";
import type { TranslationStrings } from "@/lib/planner-translations";

interface MultiRoomInspectorProps {
  t: TranslationStrings;
  lang: "en" | "de";
  selectedRoom: RoomLayout | null;
  selectedRoomIds: Set<string>;
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
  selectedRoom,
  selectedRoomIds,
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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className="p-0.5 rounded hover:bg-primary/10 transition-colors"
            title={isCollapsed ? (lang === "de" ? "Erweitern" : "Expand") : (lang === "de" ? "Einklappen" : "Collapse")}
          >
            {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{lang === "de" ? "Breite (cm)" : "Width (cm)"}</Label>
                  <NumberField
                    min={50}
                    max={1500}
                    value={selectedRoom.width}
                    onCommit={(w) => updateSelectedRoom({ width: w })}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">{lang === "de" ? "Länge (cm)" : "Length (cm)"}</Label>
                  <NumberField
                    min={50}
                    max={1500}
                    value={selectedRoom.length}
                    onCommit={(l) => updateSelectedRoom({ length: l })}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-2.5 shadow-sm transition-colors hover:bg-muted/30 mt-1 select-none">
                <div className="flex flex-col gap-0.5 pointer-events-none">
                  <span className="text-[11px] font-bold text-foreground">
                    {lang === "de" ? "Türen ausblenden" : "Hide Door Swings"}
                  </span>
                  <span className="text-[9.5px] text-muted-foreground leading-normal">
                    {lang === "de" ? "Zeigt nur Wandöffnungen" : "Shows wall openings only"}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!selectedRoom.hideDoors}
                    onChange={(e) => updateSelectedRoom({ hideDoors: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-zinc-300 dark:bg-zinc-700 rounded-full peer peer-checked:after:translate-x-[14px] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-sky-600 dark:peer-checked:bg-sky-500"></div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1.5">
                <Button
                  variant="default"
                  size="sm"
                  asChild
                  className="w-full text-xs font-semibold h-8 bg-sky-600 hover:bg-sky-500 text-white gap-1.5"
                >
                  <Link to="/rooms/$roomId" params={{ roomId: selectedRoom.id }}>
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
