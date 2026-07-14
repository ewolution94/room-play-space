import React, { useState } from "react";
import type { RoomLayout, TranslationStrings } from "@/types/planner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Trash2, 
  ArrowRight,
  FolderOpen,
  Settings,
  RotateCw,
  Copy,
  LayoutGrid,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { obbOverlap } from "@/lib/planner-math";

interface MultiRoomSidebarProps {
  t: TranslationStrings;
  rooms: RoomLayout[];
  setRooms: React.Dispatch<React.SetStateAction<RoomLayout[]>>;
  selectedRoomId: string | null;
  setSelectedRoomId: (id: string | null) => void;
  lang: "en" | "de";
  collisionEnabled: boolean;
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
  lang,
  collisionEnabled,
}: MultiRoomSidebarProps) {
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomW, setNewRoomW] = useState(400);
  const [newRoomL, setNewRoomL] = useState(300);
  const [newRoomColor, setNewRoomColor] = useState(COLOR_PRESETS[0]);

  // Selected room details editing state
  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  const addRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newRoomName.trim() || `${lang === "de" ? "Raum" : "Room"} ${rooms.length + 1}`;
    
    // Choose a random color from presets if newRoomColor is somehow empty
    const color = newRoomColor || COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)];

    // Place the new room in a collision-free spot using OBB checks
    const margin = 30; // 30cm gap between rooms
    let targetX = 50;
    let targetY = 50;
    let found = false;

    const candidate = {
      x: targetX,
      y: targetY,
      width: newRoomW,
      length: newRoomL,
      rotation: 0
    };

    // Scan grid positions with margin-padded collision checks
    const stepX = Math.max(60, Math.round(newRoomW / 3));
    const stepY = Math.max(60, Math.round(newRoomL / 3));

    for (let cy = 50; cy + newRoomL <= 1450 && !found; cy += stepY) {
      for (let cx = 50; cx + newRoomW <= 1950 && !found; cx += stepX) {
        candidate.x = cx;
        candidate.y = cy;
        // Check with a margin by expanding the candidate slightly for the test
        const paddedCandidate = {
          x: cx - margin,
          y: cy - margin,
          width: newRoomW + margin * 2,
          length: newRoomL + margin * 2,
          rotation: 0
        };
        const hasOverlap = rooms.some(other => obbOverlap(
          paddedCandidate,
          { x: other.x, y: other.y, width: other.width, length: other.length, rotation: other.rotation }
        ));
        if (!hasOverlap) {
          found = true;
        }
      }
    }

    // Fallback: place at bottom-right if no free spot found
    if (!found) {
      const maxY = rooms.reduce((m, r) => Math.max(m, r.y + r.length), 0);
      candidate.x = 50;
      candidate.y = maxY + margin;
    }

    const defaultDoor = {
      id: crypto.randomUUID(),
      wall: "bottom" as const,
      position: Math.max(10, Math.round((newRoomW - 90) / 2)),
      width: 90,
      kind: "door" as const,
      hinge: "start" as const,
      swing: "in" as const,
    };

    const room: RoomLayout = {
      id: crypto.randomUUID(),
      name,
      width: newRoomW,
      length: newRoomL,
      x: candidate.x,
      y: candidate.y,
      rotation: 0,
      color,
      items: [],
      openings: [defaultDoor],
      corners: [
        { x: 0, y: 0 },
        { x: newRoomW, y: 0 },
        { x: newRoomW, y: newRoomL },
        { x: 0, y: newRoomL },
      ],
      wallColors: {
        top: "#f1f5f9",
        right: "#f1f5f9",
        bottom: "#f1f5f9",
        left: "#f1f5f9",
      }
    };

    setRooms(prev => [...prev, room]);
    setSelectedRoomId(room.id);
    setNewRoomName("");
    // Choose a different color for the next room
    setNewRoomColor(COLOR_PRESETS[(COLOR_PRESETS.indexOf(color) + 1) % COLOR_PRESETS.length]);
  };

  const updateSelectedRoom = (patch: Partial<RoomLayout>) => {
    if (!selectedRoomId) return;
    setRooms(prev => prev.map(r => {
      if (r.id !== selectedRoomId) return r;
      
      const updated = { ...r, ...patch };

      // Re-scale corners if width/length changed
      if (patch.width !== undefined || patch.length !== undefined) {
        const w = updated.width;
        const l = updated.length;
        updated.corners = [
          { x: 0, y: 0 },
          { x: w, y: 0 },
          { x: w, y: l },
          { x: 0, y: l },
        ];
      }
      return updated;
    }));
  };

  const rotateRoom = (roomId: string) => {
    setRooms(prev => prev.map(r => {
      if (r.id !== roomId) return r;
      const nextRotation = (r.rotation + 90) % 360;
      const nextW = r.length;
      const nextL = r.width;

      // Rotate openings (doors/windows)
      const rotatedOpenings = r.openings.map(op => {
        let newWall = op.wall;
        let newPosition = op.position;
        if (op.wall === "top") {
          newWall = "right";
          newPosition = op.position;
        } else if (op.wall === "right") {
          newWall = "bottom";
          newPosition = r.length - op.position - op.width;
        } else if (op.wall === "bottom") {
          newWall = "left";
          newPosition = op.position;
        } else if (op.wall === "left") {
          newWall = "top";
          newPosition = r.length - op.position - op.width;
        }
        return { ...op, wall: newWall, position: Math.max(0, newPosition) };
      });

      // Rotate items (furniture)
      const rotatedItems = r.items.map(item => {
        const newX = r.length - (item.y + item.length);
        const newY = item.x;
        const newW = item.length;
        const newL = item.width;
        const newRot = (item.rotation + 90) % 360;
        return {
          ...item,
          x: Math.max(0, newX),
          y: Math.max(0, newY),
          width: newW,
          length: newL,
          rotation: newRot,
        };
      });

      const candidate = {
        ...r,
        rotation: nextRotation,
        width: nextW,
        length: nextL,
        openings: rotatedOpenings,
        items: rotatedItems,
      };

      // Collision check
      const hasCollision = collisionEnabled && prev.some(other => {
        if (other.id === r.id) return false;
        return obbOverlap(
          { x: candidate.x, y: candidate.y, width: candidate.width, length: candidate.length, rotation: candidate.rotation },
          { x: other.x, y: other.y, width: other.width, length: other.length, rotation: other.rotation }
        );
      });

      if (hasCollision) return r;
      return candidate;
    }));
  };

  const duplicateRoom = (roomId: string) => {
    const source = rooms.find(r => r.id === roomId);
    if (!source) return;

    const margin = 30;
    let found = false;

    const candidate = {
      x: source.x + source.width + margin,
      y: source.y,
      width: source.width,
      length: source.length,
      rotation: source.rotation
    };

    // First try placing directly to the right of the source
    const paddedFirst = {
      x: candidate.x - margin,
      y: candidate.y - margin,
      width: source.width + margin * 2,
      length: source.length + margin * 2,
      rotation: source.rotation
    };
    if (
      candidate.x + source.width <= 1950 &&
      !rooms.some(other => obbOverlap(
        paddedFirst,
        { x: other.x, y: other.y, width: other.width, length: other.length, rotation: other.rotation }
      ))
    ) {
      found = true;
    }

    // Grid scan fallback
    if (!found) {
      const stepX = Math.max(60, Math.round(source.width / 3));
      const stepY = Math.max(60, Math.round(source.length / 3));

      for (let cy = 50; cy + source.length <= 1450 && !found; cy += stepY) {
        for (let cx = 50; cx + source.width <= 1950 && !found; cx += stepX) {
          const paddedCandidate = {
            x: cx - margin,
            y: cy - margin,
            width: source.width + margin * 2,
            length: source.length + margin * 2,
            rotation: source.rotation
          };
          const hasOverlap = rooms.some(other => obbOverlap(
            paddedCandidate,
            { x: other.x, y: other.y, width: other.width, length: other.length, rotation: other.rotation }
          ));
          if (!hasOverlap) {
            candidate.x = cx;
            candidate.y = cy;
            found = true;
          }
        }
      }
    }

    // Final fallback: below all existing rooms
    if (!found) {
      const maxY = rooms.reduce((m, r) => Math.max(m, r.y + r.length), 0);
      candidate.x = 50;
      candidate.y = maxY + margin;
    }

    const newRoom: RoomLayout = {
      ...JSON.parse(JSON.stringify(source)),
      id: crypto.randomUUID(),
      name: `${source.name} (${lang === "de" ? "Kopie" : "Copy"})`,
      x: candidate.x,
      y: candidate.y,
    };

    setRooms(prev => [...prev, newRoom]);
    setSelectedRoomId(newRoom.id);
  };

  const deleteRoom = (id: string) => {
    setRooms(prev => prev.filter(r => r.id !== id));
    if (selectedRoomId === id) {
      setSelectedRoomId(null);
    }
  };

  return (
    <aside className="w-full flex flex-col gap-4 select-none lg:h-full lg:overflow-y-auto pr-1">
      {/* SECTION: Selected Room Inspector */}
      {selectedRoom ? (
        <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-1.5 font-semibold text-primary border-b pb-2">
            <Settings className="h-4 w-4 text-sky-500" />
            <span>{lang === "de" ? "Raum bearbeiten" : "Edit Room Properties"}</span>
          </div>

          <div className="flex flex-col gap-2.5">
            <div>
              <Label className="text-xs">{lang === "de" ? "Name" : "Name"}</Label>
              <Input
                value={selectedRoom.name}
                onChange={e => updateSelectedRoom({ name: e.target.value })}
                className="h-8 text-xs mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{lang === "de" ? "Breite (cm)" : "Width (cm)"}</Label>
                <Input
                  type="number"
                  min="50"
                  max="1500"
                  value={selectedRoom.width}
                  onChange={e => updateSelectedRoom({ width: Math.max(50, parseInt(e.target.value, 10) || 0) })}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{lang === "de" ? "Länge (cm)" : "Length (cm)"}</Label>
                <Input
                  type="number"
                  min="50"
                  max="1500"
                  value={selectedRoom.length}
                  onChange={e => updateSelectedRoom({ length: Math.max(50, parseInt(e.target.value, 10) || 0) })}
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
                  onChange={e => updateSelectedRoom({ hideDoors: e.target.checked })}
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
        </div>
      ) : null}

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
              <Input
                type="number"
                min="50"
                max="1500"
                value={newRoomW}
                onChange={e => setNewRoomW(Math.max(50, parseInt(e.target.value, 10) || 0))}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">{lang === "de" ? "Länge (cm)" : "Length (cm)"}</Label>
              <Input
                type="number"
                min="50"
                max="1500"
                value={newRoomL}
                onChange={e => setNewRoomL(Math.max(50, parseInt(e.target.value, 10) || 0))}
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
                onClick={() => setSelectedRoomId(room.id === selectedRoomId ? null : room.id)}
                className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer select-none transition-colors
                  ${room.id === selectedRoomId ? "border-primary bg-primary/5 font-semibold" : "border-border hover:bg-accent/40"}`}
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
