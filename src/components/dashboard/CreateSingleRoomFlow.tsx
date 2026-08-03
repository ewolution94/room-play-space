import { useState } from "react";
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
import { ColorSwatchPicker } from "@/components/room-creation/ColorSwatchPicker";
import { ROOM_SWATCHES } from "@/lib/swatches";
import { createRoomLayout } from "@/lib/multi-room-actions";
import { useCreateSingleRoom } from "@/hooks/use-create-single-room";
import type { Lang } from "@/types/planner";
import { DoorOpen } from "lucide-react";

interface CreateSingleRoomFlowProps {
  lang: Lang;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The "single room, from scratch" dialog -- a plain name/dimensions/color
 * form. The card's other two options need no form of their own ("from
 * example" builds one known room and opens it; "guided" hands off to
 * IkeaRoomWizard), so this covers only that one path.
 *
 * The room it creates is a genuinely standalone room -- its own store, its
 * own route, no Floor wrapper (see lib/single-rooms.ts and the shared
 * useCreateSingleRoom hook).
 */
export function CreateSingleRoomFlow({ lang, open, onOpenChange }: CreateSingleRoomFlowProps) {
  const createSingleRoom = useCreateSingleRoom();
  const [name, setName] = useState("");
  const [width, setWidth] = useState(400);
  const [length, setLength] = useState(350);
  const [color, setColor] = useState(ROOM_SWATCHES[0].value);

  const createFromScratch = () => {
    const trimmedName = name.trim() || (lang === "de" ? "Neuer Raum" : "New Room");
    const room = createRoomLayout([], {
      name: trimmedName,
      width,
      length,
      color,
      x: 0,
      y: 0,
    });
    setName("");
    onOpenChange(false);
    createSingleRoom(room);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="sm:max-w-lg">
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
          <ColorSwatchPicker lang={lang} value={color} onChange={setColor} />
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
      </DialogContent>
    </Dialog>
  );
}
