import React, { useState } from "react";
import type { RoomLayout } from "@/types/planner";
import type { TranslationStrings } from "@/lib/planner-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberField } from "@/components/ui/number-field";
import { Label } from "@/components/ui/label";
import {
  Plus,
  FolderOpen,
  LayoutGrid,
  DoorOpen,
  Route,
} from "lucide-react";
import { createRoomLayout, createHallwayLayout } from "@/lib/multi-room-actions";
import {
  buildStraightHallwayCorners,
  buildLHallwayCorners,
  buildTHallwayCorners,
  polygonBoundingBox,
  type HallwayShape,
} from "@/lib/hallway-shapes";

interface MultiRoomSidebarProps {
  t: TranslationStrings;
  rooms: RoomLayout[];
  setRooms: React.Dispatch<React.SetStateAction<RoomLayout[]>>;
  selectedRoomId: string | null;
  setSelectedRoomId: (id: string | null) => void;
  selectedRoomIds: Set<string>;
  setSelectedRoomIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  lang: "en" | "de";
}

// Preset color options for premium look and feel
const COLOR_PRESETS = [
  "#3b82f6", // Sky Blue
  "#10b981", // Emerald Green
  "#f59e0b", // Warm Amber
  "#ef4444", // Soft Red
  "#8b5cf6", // Lavendar Purple
  "#ec4899", // Cozy Pink
  "#14b8a6", // Mint Teal
  "#6b7280", // Cool Gray
  "#b45309", // Terracotta
];

// Small normalized (0-100 viewBox) outline preview for each hallway shape
// option, built from the exact same corner templates used to actually
// create the room -- so what you see in the picker is the true shape, not
// a hand-drawn stand-in.
const HALLWAY_SHAPES: { value: HallwayShape; labelEn: string; labelDe: string }[] = [
  { value: "straight", labelEn: "Straight", labelDe: "Gerade" },
  { value: "l", labelEn: "L-Shape", labelDe: "L-Form" },
  { value: "l-mirrored", labelEn: "L-Shape (mirrored)", labelDe: "L-Form (gespiegelt)" },
  { value: "t", labelEn: "T-Shape", labelDe: "T-Form" },
];

function shapePreviewPoints(shape: HallwayShape): string {
  const armWidth = 30;
  const corners =
    shape === "straight"
      ? buildStraightHallwayCorners(armWidth, 100)
      : shape === "t"
        ? buildTHallwayCorners(armWidth, 100, 70).corners
        : buildLHallwayCorners(armWidth, 100, 100, shape === "l-mirrored").corners;
  const bb = polygonBoundingBox(corners);
  return corners.map((c) => `${c.x - bb.minX},${c.y - bb.minY}`).join(" ");
}

export function MultiRoomSidebar({
  t,
  rooms,
  setRooms,
  selectedRoomId,
  setSelectedRoomId,
  selectedRoomIds,
  setSelectedRoomIds,
  lang,
}: MultiRoomSidebarProps) {
  const [createMode, setCreateMode] = useState<"room" | "hallway">("room");
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomW, setNewRoomW] = useState(400);
  const [newRoomL, setNewRoomL] = useState(300);
  const [newRoomColor, setNewRoomColor] = useState(COLOR_PRESETS[0]);

  const [hallwayShape, setHallwayShape] = useState<HallwayShape>("straight");
  const [hallwayArmWidth, setHallwayArmWidth] = useState(120);
  // "straight": hallwayLegX = total length (hallwayLegY unused).
  // "l"/"l-mirrored": hallwayLegX/hallwayLegY = each arm's full extent.
  // "t": hallwayLegX = bar length, hallwayLegY = stem length.
  const [hallwayLegX, setHallwayLegX] = useState(400);
  const [hallwayLegY, setHallwayLegY] = useState(300);

  const addRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newRoomName.trim() || `${lang === "de" ? "Raum" : "Room"} ${rooms.length + 1}`;

    // Choose a random color from presets if newRoomColor is somehow empty
    const color = newRoomColor || COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)];

    const room = createRoomLayout(rooms, { name, width: newRoomW, length: newRoomL, color });

    setRooms(prev => [...prev, room]);
    setSelectedRoomId(room.id);
    setNewRoomName("");
    // Choose a different color for the next room
    setNewRoomColor(COLOR_PRESETS[(COLOR_PRESETS.indexOf(color) + 1) % COLOR_PRESETS.length]);
  };

  const addHallway = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newRoomName.trim() || (lang === "de" ? "Flur" : "Hallway");
    const color = newRoomColor || COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)];

    const hallway = createHallwayLayout(rooms, {
      name,
      shape: hallwayShape,
      armWidth: hallwayArmWidth,
      legX: hallwayLegX,
      legY: hallwayLegY,
      color,
    });

    setRooms((prev) => [...prev, hallway]);
    setSelectedRoomId(hallway.id);
    setNewRoomName("");
    setNewRoomColor(COLOR_PRESETS[(COLOR_PRESETS.indexOf(color) + 1) % COLOR_PRESETS.length]);
  };

  return (
    <aside className="w-full flex flex-col gap-4 select-none lg:h-full lg:overflow-y-auto pr-1">
      {/* SECTION: Add New Room / Hallway */}
      <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-1.5 font-semibold text-primary border-b pb-2">
          <Plus className="h-4 w-4 text-emerald-500" />
          <span>
            {createMode === "hallway"
              ? lang === "de"
                ? "Flur hinzufügen"
                : "Create New Hallway"
              : lang === "de"
                ? "Raum hinzufügen"
                : "Create New Room"}
          </span>
        </div>

        {/* Room / Hallway mode toggle */}
        <div className="grid grid-cols-2 gap-1.5 rounded-lg border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setCreateMode("room")}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors ${
              createMode === "room"
                ? "bg-card shadow-sm text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <DoorOpen className="h-3.5 w-3.5" />
            {lang === "de" ? "Raum" : "Room"}
          </button>
          <button
            type="button"
            onClick={() => setCreateMode("hallway")}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors ${
              createMode === "hallway"
                ? "bg-card shadow-sm text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Route className="h-3.5 w-3.5" />
            {lang === "de" ? "Flur" : "Hallway"}
          </button>
        </div>

        {createMode === "room" ? (
          <form onSubmit={addRoom} className="flex flex-col gap-3">
            <div>
              <Label className="text-xs">{lang === "de" ? "Name" : "Name"}</Label>
              <Input
                placeholder={lang === "de" ? "z. B. Wohnzimmer" : "e.g. Living Room"}
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{lang === "de" ? "Breite (cm)" : "Width (cm)"}</Label>
                <NumberField
                  min={50}
                  max={1500}
                  value={newRoomW}
                  onCommit={setNewRoomW}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{lang === "de" ? "Länge (cm)" : "Length (cm)"}</Label>
                <NumberField
                  min={50}
                  max={1500}
                  value={newRoomL}
                  onCommit={setNewRoomL}
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>

            <Button type="submit" size="sm" className="w-full text-xs h-8 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white mt-1 gap-1">
              <Plus className="h-3.5 w-3.5" />
              <span>{t.addRoom}</span>
            </Button>
          </form>
        ) : (
          <form onSubmit={addHallway} className="flex flex-col gap-3">
            <div>
              <Label className="text-xs">{lang === "de" ? "Name" : "Name"}</Label>
              <Input
                placeholder={lang === "de" ? "z. B. Flur" : "e.g. Hallway"}
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">{lang === "de" ? "Grundriss" : "Floor shape"}</Label>
              <div className="grid grid-cols-4 gap-1.5 mt-1">
                {HALLWAY_SHAPES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setHallwayShape(s.value)}
                    title={lang === "de" ? s.labelDe : s.labelEn}
                    className={`flex aspect-square flex-col items-center justify-center rounded-md border p-1 transition-colors ${
                      hallwayShape === s.value
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:border-primary/40"
                    }`}
                  >
                    <svg viewBox="0 0 100 100" className="h-7 w-7">
                      <polygon
                        points={shapePreviewPoints(s.value)}
                        className={
                          hallwayShape === s.value
                            ? "fill-primary/30 stroke-primary"
                            : "fill-muted-foreground/20 stroke-muted-foreground/70"
                        }
                        strokeWidth={4}
                      />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{lang === "de" ? "Breite (cm)" : "Width (cm)"}</Label>
                <NumberField
                  min={60}
                  max={400}
                  value={hallwayArmWidth}
                  onCommit={setHallwayArmWidth}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">
                  {hallwayShape === "straight"
                    ? lang === "de"
                      ? "Länge (cm)"
                      : "Length (cm)"
                    : hallwayShape === "t"
                      ? lang === "de"
                        ? "Balkenlänge (cm)"
                        : "Bar length (cm)"
                      : lang === "de"
                        ? "Arm 1 (cm)"
                        : "Arm 1 (cm)"}
                </Label>
                <NumberField
                  min={100}
                  max={1500}
                  value={hallwayLegX}
                  onCommit={setHallwayLegX}
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>

            {hallwayShape !== "straight" && (
              <div>
                <Label className="text-xs">
                  {hallwayShape === "t"
                    ? lang === "de"
                      ? "Stiellänge (cm)"
                      : "Stem length (cm)"
                    : lang === "de"
                      ? "Arm 2 (cm)"
                      : "Arm 2 (cm)"}
                </Label>
                <NumberField
                  min={100}
                  max={1500}
                  value={hallwayLegY}
                  onCommit={setHallwayLegY}
                  className="h-8 text-xs mt-1"
                />
              </div>
            )}

            <Button type="submit" size="sm" className="w-full text-xs h-8 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white mt-1 gap-1">
              <Plus className="h-3.5 w-3.5" />
              <span>{lang === "de" ? "Flur hinzufügen" : "Add Hallway"}</span>
            </Button>
          </form>
        )}
      </div>

      {/* SECTION: List of Rooms */}
      <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col gap-2">
        <div className="flex items-center gap-1.5 font-semibold text-primary border-b pb-2 mb-1">
          <FolderOpen className="h-4 w-4 text-sky-500" />
          <span>{lang === "de" ? "Räume Liste" : "Rooms List"} ({rooms.length})</span>
        </div>

        {rooms.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-4">
            {lang === "de" ? "Noch keine Räume erstellt. Füge oben einen hinzu!" : "No rooms created yet. Add one above!"}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-[250px] overflow-y-auto">
            {rooms.map(room => (
              <div
                key={room.id}
                onClick={() => {
                  setSelectedRoomIds(new Set());
                  setSelectedRoomId(room.id === selectedRoomId ? null : room.id);
                }}
                className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer select-none transition-colors
                  ${
                    room.id === selectedRoomId || selectedRoomIds.has(room.id)
                      ? "border-primary bg-primary/5 font-semibold"
                      : "border-border hover:bg-accent/40"
                  }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {room.roomKind === "hallway" ? (
                    <Route className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate">{room.name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0 ml-2">
                  {room.width}x{room.length}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
