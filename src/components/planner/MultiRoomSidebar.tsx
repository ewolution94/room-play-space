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
} from "lucide-react";
import { createRoomLayout } from "@/lib/multi-room-actions";

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
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomW, setNewRoomW] = useState(400);
  const [newRoomL, setNewRoomL] = useState(300);
  const [newRoomColor, setNewRoomColor] = useState(COLOR_PRESETS[0]);

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

  return (
    <aside className="w-full flex flex-col gap-4 select-none lg:h-full lg:overflow-y-auto pr-1">
      {/* SECTION: Add New Room */}
      <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-1.5 font-semibold text-primary border-b pb-2">
          <Plus className="h-4 w-4 text-emerald-500" />
          <span>{lang === "de" ? "Raum hinzufügen" : "Create New Room"}</span>
        </div>

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
                  <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
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
