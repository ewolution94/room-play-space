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
import { RoomShapeCanvas } from "@/components/room-creation/RoomShapeCanvas";
import { ColorSwatchPicker } from "@/components/room-creation/ColorSwatchPicker";
import {
  ROOM_SHAPE_TEMPLATES,
  resizeRoomShape,
  setWallLength,
  computeStableViewBox,
  type RoomShapeKind,
} from "@/lib/room-shapes";
import { NAMED_WALLS, polygonBoundingBox, resolveWallSegment } from "@/lib/hallway-shapes";
import { createRoomLayoutWithCorners } from "@/lib/multi-room-actions";
import { STRINGS } from "@/lib/planner-translations";
import { ROOM_SWATCHES } from "@/lib/swatches";
import type { Lang, Opening, OpeningKind, Point, RoomLayout } from "@/types/planner";
import {
  defaultOpeningWidth,
  isSwingingOpening,
  openingKindLabel,
  openingLeaves,
  openingWidthPresets,
} from "@/lib/openings";
import {
  ArrowLeft,
  ArrowRight,
  DoorOpen,
  Home,
  PanelsTopLeft,
  RectangleHorizontal,
  Trash2,
} from "lucide-react";

interface IkeaRoomWizardProps {
  lang: Lang;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * What to do with the finished room. The wizard deliberately doesn't know
   * whether it's building a standalone room or a room on a floor -- the two
   * live in different stores and only the caller knows which (see
   * lib/single-rooms.ts on why nothing here is allowed to infer it). The
   * dashboard hands this straight to useCreateSingleRoom; the /rooms
   * sidebar appends to the active floor instead.
   */
  onCreate: (room: RoomLayout) => void;
  /**
   * Rooms the new one has to avoid, so it lands in a free spot on a floor
   * plan. Empty (the default) for a standalone room, which has no
   * neighbours -- and whose overview coordinates get pinned to 0 by
   * addSingleRoom regardless.
   */
  siblings?: RoomLayout[];
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
export function IkeaRoomWizard({
  lang,
  open,
  onOpenChange,
  onCreate,
  siblings = [],
}: IkeaRoomWizardProps) {
  const t = STRINGS[lang];

  const [step, setStep] = useState<WizardStep>("shape");
  const [shapeKind, setShapeKind] = useState<RoomShapeKind | null>(null);
  const [corners, setCorners] = useState<Point[]>([]);
  const [viewBox, setViewBox] = useState("");
  const [roomName, setRoomName] = useState("");
  const [color, setColor] = useState(ROOM_SWATCHES[0].value);
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [openingKind, setOpeningKind] = useState<OpeningKind>("door");
  // Terrace doors only (see Opening.leaves) -- a one-leaf door is 90cm, a
  // pair 180, which is why the placed width follows this too.
  const [openingLeavesSel, setOpeningLeavesSel] = useState<1 | 2>(1);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);

  // Fresh start every time the wizard is (re)opened.
  useEffect(() => {
    if (!open) return;
    setStep("shape");
    setShapeKind(null);
    setCorners([]);
    setViewBox("");
    setRoomName("");
    setColor(ROOM_SWATCHES[0].value);
    setOpenings([]);
    setOpeningKind("door");
    setSelectedOpeningId(null);
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

  /**
   * Typing a length straight onto a wall's dimension label. Works on every
   * shape, not just rectangles: setWallLength moves the wall's neighbour
   * through the same dragWallEdge guards a manual drag goes through, so a
   * typed length can never produce a shape a drag couldn't.
   */
  const applyWallLength = (wallIndex: number, lengthCm: number) => {
    setCorners((prev) => setWallLength(prev, wallIndex, lengthCm));
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
    // Real-world width for whatever is being placed (lib/openings.ts), so a
    // two-leaf terrace door doesn't land as a 90cm single.
    const newWidth = defaultOpeningWidth(openingKind, openingLeavesSel);
    if (wallLength < newWidth) {
      toast.error(lang === "de" ? "Diese Wand ist zu kurz." : "This wall is too short.");
      return;
    }
    // Center the new opening on the click point, then clamp it onto the
    // wall's own span.
    let position = positionAlongWall - newWidth / 2;
    position = Math.max(0, Math.min(position, wallLength - newWidth));

    const overlapsExisting = openings.some(
      (o) =>
        String(o.wall) === String(wallKey) &&
        position < o.position + o.width &&
        o.position < position + newWidth,
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
        width: newWidth,
        ...(isSwingingOpening(openingKind)
          ? { hinge: "start" as const, swing: "in" as const }
          : {}),
        ...(openingKind === "terrace-door" ? { leaves: openingLeavesSel } : {}),
      },
    ]);
  };
  const selectedOpening = openings.find((o) => o.id === selectedOpeningId) ?? null;

  const removeOpening = (id: string) => setOpenings((prev) => prev.filter((o) => o.id !== id));

  /** Slide an opening along its wall. Overlap is checked here rather than in
   * the canvas so the drag simply stops against its neighbour instead of
   * jumping through it. */
  const moveOpening = (id: string, position: number) => {
    setOpenings((prev) => {
      const target = prev.find((o) => o.id === id);
      if (!target) return prev;
      const clash = prev.some(
        (o) =>
          o.id !== id &&
          String(o.wall) === String(target.wall) &&
          position < o.position + o.width &&
          o.position < position + target.width,
      );
      if (clash) return prev;
      return prev.map((o) =>
        o.id === id ? { ...o, position: Math.round(position * 100) / 100 } : o,
      );
    });
  };

  /** Resize an opening in place, keeping it on its wall and clear of its
   * neighbours -- so the presets can never produce an invalid layout. */
  const resizeOpening = (id: string, width: number) => {
    setOpenings((prev) => {
      const target = prev.find((o) => o.id === id);
      if (!target) return prev;
      const seg = resolveWallSegment(corners, target.wall);
      if (!seg) return prev;
      const wallLength = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
      if (width > wallLength) return prev;
      const position = Math.max(0, Math.min(target.position, wallLength - width));
      const clash = prev.some(
        (o) =>
          o.id !== id &&
          String(o.wall) === String(target.wall) &&
          position < o.position + o.width &&
          o.position < position + width,
      );
      if (clash) return prev;
      return prev.map((o) => (o.id === id ? { ...o, width, position } : o));
    });
  };

  const finish = () => {
    if (!shapeKind || corners.length === 0) return;
    const trimmedName = roomName.trim() || (lang === "de" ? "Neuer Raum" : "New Room");
    // No explicit x/y: createRoomLayoutWithCorners falls back to a free spot
    // among `siblings`, which is what a floor plan needs and which an empty
    // sibling list makes a no-op anyway.
    const room = createRoomLayoutWithCorners(siblings, {
      name: trimmedName,
      corners,
      color,
      openings,
    });
    onOpenChange(false);
    onCreate(room);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Capped and scrollable, because the openings step -- 440px of canvas
          plus a toolbar, a hint line, a name field, swatches and a footer --
          is taller than a 720px-high window, and DialogContent is centered
          with no max-height of its own: the "Create Room" button simply sat
          below the fold with no way to reach it, and a click aimed at it
          landed on the overlay and dismissed the wizard instead. Capping
          rather than shrinking the canvas, since the canvas being big is the
          point of this step. */}
      <DialogContent className="sm:max-w-4xl max-h-[92dvh] overflow-y-auto">
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
            <div className="flex h-[440px] justify-center rounded-lg border bg-muted/20 py-4">
              <RoomShapeCanvas
                corners={corners}
                viewBox={viewBox}
                onCornersChange={setCorners}
                onWallLengthChange={applyWallLength}
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
              <Button
                type="button"
                variant={openingKind === "terrace-door" ? "default" : "outline"}
                size="sm"
                onClick={() => setOpeningKind("terrace-door")}
              >
                <PanelsTopLeft className="h-4 w-4" />
                {t.terraceDoor}
              </Button>
              {/* Leaves, only while placing a terrace door -- nothing else
                  has them. */}
              {openingKind === "terrace-door" && (
                <div className="flex items-center gap-1 rounded-md border p-0.5">
                  {([1, 2] as const).map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant={openingLeavesSel === n ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setOpeningLeavesSel(n)}
                      className="h-7 px-2 text-xs"
                    >
                      {n === 1 ? t.oneLeaf : t.twoLeaves}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative flex h-[440px] justify-center rounded-lg border bg-muted/20 py-3">
              <RoomShapeCanvas
                corners={corners}
                viewBox={viewBox}
                mode="openings"
                openings={openings}
                ghostKind={openingKind}
                ghostLeaves={openingLeavesSel}
                onWallClick={handleWallClick}
                onRemoveOpening={removeOpening}
                onMoveOpening={moveOpening}
                onSelectOpening={setSelectedOpeningId}
                selectedOpeningId={selectedOpeningId}
              />
            </div>

            {/* Contextual controls for whatever is selected. Placing is a
                click; everything you might then want to change about that
                one opening lives here, so the canvas itself stays free of
                buttons and the destructive action is never a stray click on
                the shape. */}
            {selectedOpening ? (
              <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border bg-background px-3 py-2">
                <span className="text-xs font-medium">{openingKindLabel(selectedOpening, t)}</span>
                <span className="text-xs text-muted-foreground">
                  {lang === "de" ? "Breite" : "Width"}
                </span>
                {openingWidthPresets(selectedOpening.kind, openingLeaves(selectedOpening)).map(
                  (w) => (
                    <Button
                      key={w}
                      type="button"
                      size="sm"
                      variant={selectedOpening.width === w ? "default" : "outline"}
                      onClick={() => resizeOpening(selectedOpening.id, w)}
                      className="h-7 px-2 text-xs"
                    >
                      {w}
                    </Button>
                  ),
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    removeOpening(selectedOpening.id);
                    setSelectedOpeningId(null);
                  }}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {lang === "de" ? "Entfernen" : "Remove"}
                </Button>
              </div>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                {openings.length === 0
                  ? lang === "de"
                    ? "Klicke auf eine Wand, um zu platzieren. Mittig rastet automatisch ein."
                    : "Click a wall to place one. It snaps to the wall's centre."
                  : lang === "de"
                    ? "Zum Verschieben ziehen, zum Bearbeiten anklicken."
                    : "Drag to reposition, click to edit."}
              </p>
            )}

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
