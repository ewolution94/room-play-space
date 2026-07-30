import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { SWATCHES } from "@/lib/swatches";
import { SINGLE_ROOM_TEMPLATES } from "@/lib/single-room-templates";
import { createRoomLayout } from "@/lib/multi-room-actions";
import { createFloor, loadFloors, saveFloors } from "@/lib/floors";
import { TOUR_KEY } from "@/hooks/use-room-planner";
import type { Lang } from "@/types/planner";
import { DoorOpen } from "lucide-react";

interface CreateSingleRoomFlowProps {
  lang: Lang;
  // Which card on the dashboard opened this -- also doubles as the open
  // flag (null = closed), so the dashboard doesn't need a separate boolean.
  mode: "scratch" | "example" | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * One dialog covering both "create a single room" entry points from the
 * dashboard -- a plain name/dimensions/color form for "from scratch", or a
 * gallery of SINGLE_ROOM_TEMPLATES for "from example". Both paths end the
 * same way: wrap the new room in its own one-room floor (the data model
 * has no bare-room concept, see single-room-templates.ts's doc comment)
 * and navigate straight into it.
 */
export function CreateSingleRoomFlow({ lang, mode, onOpenChange }: CreateSingleRoomFlowProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [width, setWidth] = useState(400);
  const [length, setLength] = useState(350);
  const [color, setColor] = useState(SWATCHES[0].value);

  const open = mode !== null;

  const finish = (roomId: string) => {
    // The user just went through this dashboard flow deliberately -- don't
    // also ambush the room they just built with the separate "welcome,
    // here's a tour" modal (useRoomPlanner auto-opens it on any first-ever
    // room mount). Still reachable anytime via Header's "Take the tour."
    window.localStorage.setItem(TOUR_KEY, "1");
    onOpenChange(false);
    navigate({ to: "/rooms/$roomId", params: { roomId } });
  };

  const createFromScratch = () => {
    const trimmedName = name.trim() || (lang === "de" ? "Neuer Raum" : "New Room");
    const floors = loadFloors() ?? [];
    const room = createRoomLayout([], { name: trimmedName, width, length, color });
    saveFloors([...floors, createFloor([room])]);
    setName("");
    finish(room.id);
  };

  const createFromTemplate = (templateKey: string) => {
    const template = SINGLE_ROOM_TEMPLATES.find((tpl) => tpl.key === templateKey);
    if (!template) return;
    const seed = template.build(lang);
    const floors = loadFloors() ?? [];
    const base = createRoomLayout([], {
      name: seed.name,
      width: seed.width,
      length: seed.length,
      color: seed.color,
    });
    const room = { ...base, items: seed.items, openings: seed.openings, flooring: seed.flooring };
    saveFloors([...floors, createFloor([room])]);
    finish(room.id);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="sm:max-w-lg">
        {mode === "scratch" ? (
          <>
            <DialogHeader>
              <DialogTitle>{lang === "de" ? "Neuer Raum" : "New Room"}</DialogTitle>
              <DialogDescription>
                {lang === "de"
                  ? "Lege Namen, Maße und Farbe für deinen neuen Raum fest."
                  : "Set a name, dimensions, and color for your new room."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>{lang === "de" ? "Name" : "Name"}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lang === "de" ? "Wohnzimmer" : "Living Room"}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{lang === "de" ? "Breite (cm)" : "Width (cm)"}</Label>
                  <NumberField min={100} max={2000} value={width} onCommit={setWidth} />
                </div>
                <div className="space-y-1.5">
                  <Label>{lang === "de" ? "Länge (cm)" : "Length (cm)"}</Label>
                  <NumberField min={100} max={2000} value={length} onCommit={setLength} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{lang === "de" ? "Farbe" : "Color"}</Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {SWATCHES.map((sw) => (
                    <button
                      key={sw.value}
                      type="button"
                      onClick={() => setColor(sw.value)}
                      className={`h-6 w-6 rounded-full border transition-all duration-200 hover:scale-110 active:scale-95 ${
                        color.toLowerCase() === sw.value.toLowerCase()
                          ? "ring-2 ring-primary ring-offset-1 border-transparent scale-110"
                          : "border-border/60"
                      }`}
                      style={{ backgroundColor: sw.value }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {lang === "de" ? "Abbrechen" : "Cancel"}
              </Button>
              <Button onClick={createFromScratch}>
                <DoorOpen className="h-4 w-4" />
                {lang === "de" ? "Raum erstellen" : "Create Room"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {lang === "de" ? "Aus Vorlage erstellen" : "Create From Example"}
              </DialogTitle>
              <DialogDescription>
                {lang === "de"
                  ? "Starte mit einem vollständig eingerichteten Raum."
                  : "Start with a fully furnished room."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-2 sm:grid-cols-3">
              {SINGLE_ROOM_TEMPLATES.map((template) => (
                <button
                  key={template.key}
                  type="button"
                  onClick={() => createFromTemplate(template.key)}
                  className="flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors hover:bg-accent hover:border-primary/40"
                >
                  <span
                    className="h-8 w-8 rounded-full border border-border/60"
                    style={{ backgroundColor: template.color }}
                  />
                  <span className="text-sm font-medium">
                    {lang === "de" ? template.nameDe : template.nameEn}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {template.width}×{template.length} cm
                  </span>
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {lang === "de" ? "Abbrechen" : "Cancel"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
