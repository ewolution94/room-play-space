import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { RoomShapeCanvas } from "@/components/dashboard/RoomShapeCanvas";
import { ColorSwatchPicker } from "@/components/dashboard/ColorSwatchPicker";
import {
  ROOM_SHAPE_TEMPLATES,
  resizeRoomShape,
  computeStableViewBox,
  type RoomShapeKind,
} from "@/lib/room-shapes";
import { NAMED_WALLS, polygonBoundingBox, resolveWallSegment } from "@/lib/hallway-shapes";
import { createRoomLayoutWithCorners } from "@/lib/multi-room-actions";
import { useCreateSingleRoom } from "@/hooks/use-create-single-room";
import { STRINGS } from "@/lib/planner-translations";
import { SWATCHES } from "@/lib/swatches";
import type { Lang, Opening, Point } from "@/types/planner";
import { ArrowLeft, ArrowRight, DoorOpen, Home, RectangleHorizontal } from "lucide-react";

interface IkeaRoomWizardProps {
  lang: Lang;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WizardStep = "shape" | "dimensions" | "openings";

const DEFAULT_OPENING_WIDTH = 90;

/**
 * The IKEA-inspired room creation flow: pick a shape, drag its walls to
 * size it, then click directly on a wall to place doors/windows -- the
 * click-to-place interaction replaced an earlier dropdown-based form after
 * user feedback that a dropdown made it "too hard to guess how it will
 * look on the 2D canvas." Deliberately isolated from CanvasArea.tsx's
 * existing (disabled) corner-drag code -- this wizard's own small
 * RoomShapeCanvas has none of that canvas's furniture/collision concerns.
 */
export function IkeaRoomWizard({ lang, open, onOpenChange }: IkeaRoomWizardProps) {
  const createSingleRoom = useCreateSingleRoom();
  const t = STRINGS[lang];

  const [step, setStep] = useState<WizardStep>("shape");
  const [shapeKind, setShapeKind] = useState<RoomShapeKind | null>(null);
  const [corners, setCorners] = useState<Point[]>([]);
  const [viewBox, setViewBox] = useState("");
  const [roomName, setRoomName] = useState("");
  const [color, setColor] = useState(SWATCHES[0].value);
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [openingKind, setOpeningKind] = useState<"door" | "window">("door");

  // Fresh start every time the wizard is (re)opened.
  useEffect(() => {
    if (!open) return;
    setStep("shape");
    setShapeKind(null);
    setCorners([]);
    setViewBox("");
    setRoomName("");
    setColor(SWATCHES[0].value);
    setOpenings([]);
    setOpeningKind("door");
  }, [open]);

  const pickShape = (kind: RoomShapeKind) => {
    const template = ROOM_SHAPE_TEMPLATES.find((tpl) => tpl.key === kind);
    if (!template) return;
    setShapeKind(kind);
    setCorners(template.defaultCorners);
    // Computed once here, then held fixed for the rest of this wizard
    // session (see computeStableViewBox's doc comment) -- never
    // recomputed from the live corners as the user drags.
    setViewBox(computeStableViewBox(template.defaultCorners));
    setStep("dimensions");
  };

  const bb = polygonBoundingBox(corners);

  const applyBoundingSize = (width: number, length: number) => {
    setCorners((prev) => resizeRoomShape(prev, width, length));
  };

  // A plain 4-corner room keeps the app's established named-wall
  // convention (matches every other rectangular room -- resolveWallSegment,
  // the Inspector's own wall picker, etc.); anything else uses the numeric
  // convention -- exactly the same isPolygon distinction the old
  // OpeningsDialog-based step used to make.
  const wallKeyFor = (wallIndex: number): Opening["wall"] =>
    corners.length === 4 ? NAMED_WALLS[wallIndex] : wallIndex;

  const handleWallClick = (wallIndex: number, positionAlongWall: number) => {
    const wallKey = wallKeyFor(wallIndex);
    const seg = resolveWallSegment(corners, wallKey);
    if (!seg) return;
    const wallLength = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
    if (wallLength < DEFAULT_OPENING_WIDTH) {
      toast.error(lang === "de" ? "Diese Wand ist zu kurz." : "This wall is too short.");
      return;
    }
    // Center the new opening on the click point, then clamp it onto the
    // wall's own span.
    let position = positionAlongWall - DEFAULT_OPENING_WIDTH / 2;
    position = Math.max(0, Math.min(position, wallLength - DEFAULT_OPENING_WIDTH));

    const overlapsExisting = openings.some(
      (o) =>
        String(o.wall) === String(wallKey) &&
        position < o.position + o.width &&
        o.position < position + DEFAULT_OPENING_WIDTH,
    );
    if (overlapsExisting) {
      toast.error(
        lang === "de" ? "Überschneidet ein vorhandenes Element." : "Overlaps an existing opening.",
      );
      return;
    }

    setOpenings((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        kind: openingKind,
        wall: wallKey,
        position: Math.round(position * 100) / 100,
        width: DEFAULT_OPENING_WIDTH,
        ...(openingKind === "door" ? { hinge: "start" as const, swing: "in" as const } : {}),
      },
    ]);
  };
  const removeOpening = (id: string) => setOpenings((prev) => prev.filter((o) => o.id !== id));

  const finish = () => {
    if (!shapeKind || corners.length === 0) return;
    const trimmedName = roomName.trim() || (lang === "de" ? "Neuer Raum" : "New Room");
    const room = createRoomLayoutWithCorners([], {
      name: trimmedName,
      corners,
      color,
      openings,
      x: 0,
      y: 0,
    });
    onOpenChange(false);
    createSingleRoom(room);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {step === "shape" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Home className="h-5 w-5 text-primary" />
                {lang === "de" ? "Raumform wählen" : "Choose a Room Shape"}
              </DialogTitle>
              <DialogDescription>
                {lang === "de"
                  ? "Starte mit einer Form -- du kannst die Wände als Nächstes anpassen."
                  : "Start with a shape -- you'll adjust the walls next."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-3 py-2">
              {ROOM_SHAPE_TEMPLATES.map((template) => (
                <button
                  key={template.key}
                  type="button"
                  onClick={() => pickShape(template.key)}
                  className="flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-accent hover:border-primary/40"
                >
                  <ShapePreviewIcon corners={template.defaultCorners} />
                  <span className="text-sm font-medium">
                    {lang === "de" ? template.nameDe : template.nameEn}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === "dimensions" && (
          <>
            <DialogHeader>
              <DialogTitle>{lang === "de" ? "Wände anpassen" : "Adjust the Walls"}</DialogTitle>
              <DialogDescription>
                {lang === "de"
                  ? "Ziehe eine Wand, um die Größe zu ändern -- die gegenüberliegende Wand bleibt an Ort und Stelle."
                  : "Drag a wall to resize -- the opposite wall stays put."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center rounded-lg border bg-muted/20 py-4">
              <RoomShapeCanvas
                corners={corners}
                viewBox={viewBox}
                onCornersChange={setCorners}
                mode="drag"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{lang === "de" ? "Breite (cm)" : "Width (cm)"}</Label>
                <NumberField
                  min={100}
                  max={2000}
                  value={Math.round(bb.width)}
                  onCommit={(w) => applyBoundingSize(w, bb.height)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{lang === "de" ? "Länge (cm)" : "Length (cm)"}</Label>
                <NumberField
                  min={100}
                  max={2000}
                  value={Math.round(bb.height)}
                  onCommit={(l) => applyBoundingSize(bb.width, l)}
                />
              </div>
            </div>
            <DialogFooter className="sm:justify-between">
              <Button variant="outline" onClick={() => setStep("shape")}>
                <ArrowLeft className="h-4 w-4" />
                {lang === "de" ? "Zurück" : "Back"}
              </Button>
              <Button onClick={() => setStep("openings")}>
                {lang === "de" ? "Weiter" : "Next"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "openings" && (
          <>
            <DialogHeader>
              <DialogTitle>
                {lang === "de"
                  ? "Türen, Fenster & letzter Schliff"
                  : "Doors, Windows & Final Touches"}
              </DialogTitle>
              <DialogDescription>
                {lang === "de"
                  ? "Klicke unten auf eine Wand, um Türen und Fenster hinzuzufügen."
                  : "Click a wall below to add doors and windows."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-center gap-2">
              <Button
                type="button"
                variant={openingKind === "door" ? "default" : "outline"}
                size="sm"
                onClick={() => setOpeningKind("door")}
              >
                <DoorOpen className="h-4 w-4" />
                {t.door}
              </Button>
              <Button
                type="button"
                variant={openingKind === "window" ? "default" : "outline"}
                size="sm"
                onClick={() => setOpeningKind("window")}
              >
                <RectangleHorizontal className="h-4 w-4" />
                {t.window}
              </Button>
            </div>

            <div className="flex justify-center rounded-lg border bg-muted/20 py-3">
              <RoomShapeCanvas
                corners={corners}
                viewBox={viewBox}
                mode="openings"
                openings={openings}
                onWallClick={handleWallClick}
                onRemoveOpening={removeOpening}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{lang === "de" ? "Name" : "Name"}</Label>
              <Input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder={lang === "de" ? "Wohnzimmer" : "Living Room"}
                autoFocus
              />
            </div>
            <ColorSwatchPicker lang={lang} value={color} onChange={setColor} />

            <DialogFooter className="sm:justify-between">
              <Button variant="outline" onClick={() => setStep("dimensions")}>
                <ArrowLeft className="h-4 w-4" />
                {lang === "de" ? "Zurück" : "Back"}
              </Button>
              <Button onClick={finish}>
                <Home className="h-4 w-4" />
                {lang === "de" ? "Raum erstellen" : "Create Room"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Small static (non-interactive) preview of a shape template for the
 * gallery -- same cm-as-viewBox-units trick as RoomShapeCanvas, just
 * without any of its drag machinery. */
function ShapePreviewIcon({ corners }: { corners: Point[] }) {
  const bb = polygonBoundingBox(corners);
  const margin = Math.max(bb.width, bb.height) * 0.1;
  const viewBox = `${bb.minX - margin} ${bb.minY - margin} ${bb.width + margin * 2} ${bb.height + margin * 2}`;
  const points = corners.map((c) => `${c.x},${c.y}`).join(" ");
  return (
    <svg viewBox={viewBox} className="h-12 w-12 text-primary">
      <polygon
        points={points}
        className="fill-primary/10 stroke-current"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
