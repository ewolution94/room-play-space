import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, Download, Upload, RotateCw, Languages } from "lucide-react";
import { toast } from "sonner";
import chairBaseUrl from "@/assets/chair-base.png";

type Lang = "en" | "de";
const STRINGS = {
  en: {
    title: "Room Planner",
    subtitle: "Sketch your home office and drag furniture to find the right layout.",
    roomLabel: "Room",
    export: "Export",
    import: "Import",
    width: "Width (cm)",
    length: "Length (cm)",
    apply: "Apply dimensions",
    openings: "Doors & Windows",
    type: "Type",
    wall: "Wall",
    position: "Position (cm)",
    door: "Door",
    window: "Window",
    top: "Top",
    bottom: "Bottom",
    left: "Left",
    right: "Right",
    addOpening: "Add opening",
    noOpenings: "No openings yet.",
    addFurniture: "Add Furniture",
    furnitureBox: "Furniture (box)",
    officeChair: "Office chair",
    name: "Name",
    namePlaceholder: "e.g. Bookshelf",
    color: "Color",
    addItem: "Add item",
    items: "Items",
    noItems: "No items yet. Add some on the left.",
    hint: "Drag items to reposition. Click an item to select it, then drag the handle above it to rotate.",
    dragToRotate: "Drag to rotate",
    noFreeSpace: "No free space for this item — make it smaller or remove something.",
    exported: "Exported planner state",
    imported: "Planner state imported",
    importFail: "Could not import file: ",
    rotation: "Rotation in degrees",
  },
  de: {
    title: "Raumplaner",
    subtitle: "Skizziere dein Homeoffice und ziehe Möbel, um das richtige Layout zu finden.",
    roomLabel: "Raum",
    export: "Exportieren",
    import: "Importieren",
    width: "Breite (cm)",
    length: "Länge (cm)",
    apply: "Maße übernehmen",
    openings: "Türen & Fenster",
    type: "Typ",
    wall: "Wand",
    position: "Position (cm)",
    door: "Tür",
    window: "Fenster",
    top: "Oben",
    bottom: "Unten",
    left: "Links",
    right: "Rechts",
    addOpening: "Öffnung hinzufügen",
    noOpenings: "Noch keine Öffnungen.",
    addFurniture: "Möbel hinzufügen",
    furnitureBox: "Möbel (Box)",
    officeChair: "Bürostuhl",
    name: "Name",
    namePlaceholder: "z. B. Bücherregal",
    color: "Farbe",
    addItem: "Element hinzufügen",
    items: "Elemente",
    noItems: "Noch keine Elemente. Füge welche links hinzu.",
    hint: "Ziehe Elemente, um sie zu verschieben. Klicke ein Element an und ziehe den Griff darüber, um es zu drehen.",
    dragToRotate: "Zum Drehen ziehen",
    noFreeSpace: "Kein freier Platz — mache es kleiner oder entferne etwas.",
    exported: "Planerstand exportiert",
    imported: "Planerstand importiert",
    importFail: "Datei konnte nicht importiert werden: ",
    rotation: "Drehung in Grad",
  },
} as const;

export const Route = createFileRoute("/")({
  component: RoomPlanner,
});

type ItemKind = "furniture" | "chair";

type Item = {
  id: string;
  name: string;
  width: number; // cm
  length: number; // cm
  color: string;
  x: number; // cm from left (top-left of unrotated rectangle)
  y: number; // cm from top
  rotation: number; // degrees, rotated around center
  kind: ItemKind;
};

// Axis-aligned bounding box of a rotated rectangle, in cm.
function rotatedAABB(w: number, l: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { w: w * c + l * s, h: w * s + l * c };
}

// Clamp item position so its rotated AABB stays inside the room.
function clampPos(item: Item, roomW: number, roomL: number, x: number, y: number) {
  const aabb = rotatedAABB(item.width, item.length, item.rotation);
  const cx = x + item.width / 2;
  const cy = y + item.length / 2;
  const minCx = aabb.w / 2;
  const maxCx = roomW - aabb.w / 2;
  const minCy = aabb.h / 2;
  const maxCy = roomL - aabb.h / 2;
  const ncx = aabb.w > roomW ? roomW / 2 : Math.max(minCx, Math.min(maxCx, cx));
  const ncy = aabb.h > roomL ? roomL / 2 : Math.max(minCy, Math.min(maxCy, cy));
  return { x: ncx - item.width / 2, y: ncy - item.length / 2 };
}

// Corners (in cm) of the rotated item.
function obbCorners(item: { x: number; y: number; width: number; length: number; rotation: number }) {
  const cx = item.x + item.width / 2;
  const cy = item.y + item.length / 2;
  const r = (item.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const hw = item.width / 2;
  const hl = item.length / 2;
  const pts: [number, number][] = [
    [-hw, -hl],
    [hw, -hl],
    [hw, hl],
    [-hw, hl],
  ];
  return pts.map(([x, y]) => ({ x: cx + x * cos - y * sin, y: cy + x * sin + y * cos }));
}

// SAT overlap test between two oriented rectangles. Returns true if they overlap.
function obbOverlap(a: Parameters<typeof obbCorners>[0], b: Parameters<typeof obbCorners>[0]) {
  const A = obbCorners(a);
  const B = obbCorners(b);
  const eps = 0.5; // cm tolerance so touching edges don't count as collision
  for (const poly of [A, B]) {
    for (let i = 0; i < 4; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % 4];
      const ex = p2.x - p1.x;
      const ey = p2.y - p1.y;
      const len = Math.hypot(ex, ey) || 1;
      const ax = -ey / len;
      const ay = ex / len;
      let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
      for (const p of A) {
        const d = p.x * ax + p.y * ay;
        if (d < aMin) aMin = d;
        if (d > aMax) aMax = d;
      }
      for (const p of B) {
        const d = p.x * ax + p.y * ay;
        if (d < bMin) bMin = d;
        if (d > bMax) bMax = d;
      }
      if (aMax - eps <= bMin || bMax - eps <= aMin) return false;
    }
  }
  return true;
}

function collidesWithOthers(candidate: Item, others: Item[]): boolean {
  return others.some((o) => o.id !== candidate.id && obbOverlap(candidate, o));
}

// Try to find a non-overlapping position by scanning a grid inside the room.
function findFreeSpot(item: Item, others: Item[], roomW: number, roomL: number): { x: number; y: number } | null {
  const step = 10;
  for (let y = 0; y <= roomL; y += step) {
    for (let x = 0; x <= roomW; x += step) {
      const c = clampPos(item, roomW, roomL, x, y);
      const candidate = { ...item, x: c.x, y: c.y };
      if (!collidesWithOthers(candidate, others)) return c;
    }
  }
  return null;
}

type Opening = {
  id: string;
  wall: "top" | "bottom" | "left" | "right";
  position: number; // cm along the wall
  width: number; // cm
  kind: "door" | "window";
};

const PX_PER_CM_BASE = 1.2; // will be scaled to fit

function RoomPlanner() {
  const [lang, setLang] = useState<Lang>("en");
  const t = STRINGS[lang];
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("planner-lang") : null;
    if (saved === "en" || saved === "de") setLang(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("planner-lang", lang);
  }, [lang]);

  const [roomW, setRoomW] = useState(520);
  const [roomL, setRoomL] = useState(380);
  const [draftW, setDraftW] = useState("520");
  const [draftL, setDraftL] = useState("380");
  const dirty = draftW !== String(roomW) || draftL !== String(roomL);
  const applyRoom = () => {
    const w = Math.max(50, parseInt(draftW, 10) || 0);
    const l = Math.max(50, parseInt(draftL, 10) || 0);
    setRoomW(w);
    setRoomL(l);
    setDraftW(String(w));
    setDraftL(String(l));
    // clamp items inside new bounds
    setItems((prev) =>
      prev.map((i) => {
        const c = clampPos(i, w, l, i.x, i.y);
        return { ...i, x: c.x, y: c.y };
      }),
    );
  };
  const [items, setItems] = useState<Item[]>([
    { id: crypto.randomUUID(), name: "Desk",           width: 180, length: 75, color: "#6b4a2b", x: 170, y: 25,  rotation: 0,   kind: "furniture" },
    { id: crypto.randomUUID(), name: "Office chair",   width: 60,  length: 60, color: "#1f2937", x: 230, y: 115, rotation: 0,   kind: "chair" },
    { id: crypto.randomUUID(), name: "Bookshelf",      width: 30,  length: 220, color: "#3d2b1f", x: 10,  y: 80,  rotation: 0,   kind: "furniture" },
    { id: crypto.randomUUID(), name: "Sofa",           width: 220, length: 85, color: "#4a6b6f", x: 150, y: 280, rotation: 0,   kind: "furniture" },
    { id: crypto.randomUUID(), name: "Coffee table",   width: 100, length: 55, color: "#8a6a4a", x: 210, y: 210, rotation: 0,   kind: "furniture" },
    { id: crypto.randomUUID(), name: "Plant",          width: 45,  length: 45, color: "#2f6b3a", x: 460, y: 15,  rotation: 0,   kind: "furniture" },
    { id: crypto.randomUUID(), name: "Filing cabinet", width: 60,  length: 45, color: "#9aa0a6", x: 450, y: 90,  rotation: 0,   kind: "furniture" },
    { id: crypto.randomUUID(), name: "Side table",     width: 45,  length: 45, color: "#c9a86a", x: 15,  y: 320, rotation: 0,   kind: "furniture" },
    { id: crypto.randomUUID(), name: "Floor lamp",     width: 30,  length: 30, color: "#e8c97c", x: 470, y: 330, rotation: 0,   kind: "furniture" },
    { id: crypto.randomUUID(), name: "Printer",        width: 50,  length: 40, color: "#2b2b2b", x: 450, y: 200, rotation: 0,   kind: "furniture" },
  ]);
  const [openings, setOpenings] = useState<Opening[]>([
    { id: crypto.randomUUID(), wall: "bottom", position: 380, width: 95,  kind: "door" },
    { id: crypto.randomUUID(), wall: "top",    position: 50,  width: 160, kind: "window" },
    { id: crypto.randomUUID(), wall: "right",  position: 140, width: 110, kind: "window" },
  ]);

  // new item form
  const [nName, setNName] = useState("");
  const [nW, setNW] = useState(80);
  const [nL, setNL] = useState(40);
  const [nColor, setNColor] = useState("#5cbdb9");
  const [nKind, setNKind] = useState<ItemKind>("furniture");

  // new opening form
  const [oKind, setOKind] = useState<"door" | "window">("door");
  const [oWall, setOWall] = useState<Opening["wall"]>("top");
  const [oPos, setOPos] = useState(50);
  const [oWidth, setOWidth] = useState(90);

  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 600, h: 400 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setStageSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // compute scale to fit room into stage with padding
  const pad = 40;
  const scale = Math.min(
    (stageSize.w - pad * 2) / roomW,
    (stageSize.h - pad * 2) / roomL,
  );
  const cm = (v: number) => v * scale;
  const roomPxW = cm(roomW);
  const roomPxL = cm(roomL);
  const offsetX = (stageSize.w - roomPxW) / 2;
  const offsetY = (stageSize.h - roomPxL) / 2;

  const addItem = () => {
    if (!nName.trim()) return;
    const draft: Item = {
      id: crypto.randomUUID(),
      name: nName.trim(),
      width: nW,
      length: nL,
      color: nColor,
      x: 10,
      y: 10,
      rotation: 0,
      kind: nKind,
    };
    const spot = findFreeSpot(draft, items, roomW, roomL);
    if (!spot) {
      toast.error(t.noFreeSpace);
      return;
    }
    setItems((prev) => [...prev, { ...draft, x: spot.x, y: spot.y }]);
    setNName("");
  };

  const removeItem = (id: string) =>
    setItems((p) => p.filter((i) => i.id !== id));
  const updateItem = (id: string, patch: Partial<Item>) =>
    setItems((p) =>
      p.map((i) => {
        if (i.id !== id) return i;
        const merged = { ...i, ...patch };
        const c = clampPos(merged, roomW, roomL, merged.x, merged.y);
        const candidate = { ...merged, x: c.x, y: c.y };
        // If the patch would cause overlap with another item, reject it.
        if (collidesWithOthers(candidate, p)) return i;
        return candidate;
      }),
    );

  const addOpening = () => {
    setOpenings((p) => [
      ...p,
      { id: crypto.randomUUID(), kind: oKind, wall: oWall, position: oPos, width: oWidth },
    ]);
  };
  const removeOpening = (id: string) =>
    setOpenings((p) => p.filter((o) => o.id !== id));

  // Selection + drag/rotate handling
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragRef = useRef<
    | {
        mode: "move";
        id: string;
        startMouseX: number;
        startMouseY: number;
        startX: number;
        startY: number;
      }
    | {
        mode: "rotate";
        id: string;
        centerClientX: number;
        centerClientY: number;
        startAngle: number;
        startRotation: number;
      }
    | null
  >(null);

  const onPointerDown = (e: React.PointerEvent, item: Item) => {
    e.stopPropagation();
    setSelectedId(item.id);
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode: "move",
      id: item.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: item.x,
      startY: item.y,
    };
  };

  const onRotateHandleDown = (e: React.PointerEvent, item: Item) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const stageRect = stageEl.getBoundingClientRect();
    const centerClientX =
      stageRect.left + offsetX + cm(item.x + item.width / 2);
    const centerClientY =
      stageRect.top + offsetY + cm(item.y + item.length / 2);
    const startAngle =
      (Math.atan2(e.clientY - centerClientY, e.clientX - centerClientX) * 180) /
      Math.PI;
    dragRef.current = {
      mode: "rotate",
      id: item.id,
      centerClientX,
      centerClientY,
      startAngle,
      startRotation: item.rotation,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.mode === "move") {
      const dx = (e.clientX - d.startMouseX) / scale;
      const dy = (e.clientY - d.startMouseY) / scale;
      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== d.id) return i;
          const c = clampPos(i, roomW, roomL, d.startX + dx, d.startY + dy);
          const candidate = { ...i, x: c.x, y: c.y };
          if (collidesWithOthers(candidate, prev)) {
            // Try sliding on a single axis to allow grazing past other items.
            const xOnly = clampPos(i, roomW, roomL, d.startX + dx, i.y);
            const cx = { ...i, x: xOnly.x, y: xOnly.y };
            if (!collidesWithOthers(cx, prev)) return cx;
            const yOnly = clampPos(i, roomW, roomL, i.x, d.startY + dy);
            const cy = { ...i, x: yOnly.x, y: yOnly.y };
            if (!collidesWithOthers(cy, prev)) return cy;
            return i;
          }
          return candidate;
        }),
      );
    } else {
      const angle =
        (Math.atan2(e.clientY - d.centerClientY, e.clientX - d.centerClientX) *
          180) /
        Math.PI;
      const delta = angle - d.startAngle;
      const next = ((d.startRotation + delta) % 360 + 360) % 360;
      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== d.id) return i;
          const merged = { ...i, rotation: next };
          const c = clampPos(merged, roomW, roomL, merged.x, merged.y);
          const candidate = { ...merged, x: c.x, y: c.y };
          if (collidesWithOthers(candidate, prev)) return i;
          return candidate;
        }),
      );
    }
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportJSON = () => {
    const payload = {
      version: 1,
      room: { width: roomW, length: roomL },
      openings,
      items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `room-planner-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported planner state");
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const w = Number(data?.room?.width);
      const l = Number(data?.room?.length);
      if (!Number.isFinite(w) || !Number.isFinite(l) || !Array.isArray(data.items) || !Array.isArray(data.openings)) {
        throw new Error("Invalid file format");
      }
      const nextW = Math.max(50, Math.round(w));
      const nextL = Math.max(50, Math.round(l));
      setRoomW(nextW);
      setRoomL(nextL);
      setDraftW(String(nextW));
      setDraftL(String(nextL));
      setOpenings(
        data.openings.map((o: Opening) => ({
          id: o.id || crypto.randomUUID(),
          wall: o.wall,
          position: Number(o.position) || 0,
          width: Number(o.width) || 0,
          kind: o.kind,
        })),
      );
      setItems(
        data.items.map((i: Partial<Item>) => ({
          id: i.id || crypto.randomUUID(),
          name: String(i.name ?? "Item"),
          width: Number(i.width) || 0,
          length: Number(i.length) || 0,
          color: i.color || "#5cbdb9",
          x: Number(i.x) || 0,
          y: Number(i.y) || 0,
          rotation: Number.isFinite(Number(i.rotation)) ? Number(i.rotation) : 0,
          kind: i.kind === "chair" ? "chair" : "furniture",
        })),
      );
      toast.success("Planner state imported");
    } catch (err) {
      toast.error("Could not import file: " + (err as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Room Planner</h1>
            <p className="text-sm text-muted-foreground">
              Sketch your home office and drag furniture to find the right layout.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Room: {roomW} × {roomL} cm
            </span>
            <Button variant="outline" size="sm" onClick={exportJSON}>
              <Download className="mr-1 h-4 w-4" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" /> Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onImportFile}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[300px_1fr_300px]">
        {/* Sidebar */}
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Room</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Width (cm)</Label>
                  <Input
                    type="number"
                    value={draftW}
                    min={50}
                    onChange={(e) => setDraftW(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Length (cm)</Label>
                  <Input
                    type="number"
                    value={draftL}
                    min={50}
                    onChange={(e) => setDraftL(e.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={applyRoom}
                size="sm"
                className="w-full"
                disabled={!dirty}
              >
                Apply dimensions
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Doors & Windows</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Type</Label>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={oKind}
                    onChange={(e) => setOKind(e.target.value as "door" | "window")}
                  >
                    <option value="door">Door</option>
                    <option value="window">Window</option>
                  </select>
                </div>
                <div>
                  <Label>Wall</Label>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={oWall}
                    onChange={(e) => setOWall(e.target.value as Opening["wall"])}
                  >
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div>
                  <Label>Position (cm)</Label>
                  <Input type="number" value={oPos} onChange={(e) => setOPos(+e.target.value || 0)} />
                </div>
                <div>
                  <Label>Width (cm)</Label>
                  <Input type="number" value={oWidth} onChange={(e) => setOWidth(+e.target.value || 0)} />
                </div>
              </div>
              <Button onClick={addOpening} size="sm" className="w-full">
                <Plus className="mr-1 h-4 w-4" /> Add opening
              </Button>
              <Separator />
              <ul className="space-y-1 text-sm">
                {openings.map((o) => (
                  <li key={o.id} className="flex items-center justify-between rounded-md border px-2 py-1">
                    <span className="capitalize">
                      {o.kind} · {o.wall} · {o.position}cm · {o.width}cm
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => removeOpening(o.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
                {openings.length === 0 && (
                  <li className="text-xs text-muted-foreground">No openings yet.</li>
                )}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add Furniture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Type</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={nKind}
                  onChange={(e) => setNKind(e.target.value as ItemKind)}
                >
                  <option value="furniture">Furniture (box)</option>
                  <option value="chair">Office chair</option>
                </select>
              </div>
              <div>
                <Label>Name</Label>
                <Input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="e.g. Bookshelf" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Width (cm)</Label>
                  <Input type="number" value={nW} onChange={(e) => setNW(+e.target.value || 0)} />
                </div>
                <div>
                  <Label>Length (cm)</Label>
                  <Input type="number" value={nL} onChange={(e) => setNL(+e.target.value || 0)} />
                </div>
              </div>
              <div>
                <Label>Color</Label>
                <input
                  type="color"
                  value={nColor}
                  onChange={(e) => setNColor(e.target.value)}
                  className="h-9 w-full cursor-pointer rounded-md border bg-background"
                />
              </div>
              <Button onClick={addItem} className="w-full" size="sm">
                <Plus className="mr-1 h-4 w-4" /> Add item
              </Button>
            </CardContent>
          </Card>

        </aside>

        {/* Stage */}
        <main className="lg:sticky lg:top-24 lg:self-start lg:h-fit">
          <div
            ref={stageRef}
            className="relative h-[75vh] w-full overflow-hidden rounded-lg border bg-muted/30"
            onPointerDown={() => setSelectedId(null)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {scale > 0 && (
              <div
                className="absolute border-2 border-foreground bg-background shadow-sm"
                style={{
                  left: offsetX,
                  top: offsetY,
                  width: roomPxW,
                  height: roomPxL,
                }}
              >
                {/* openings */}
                {openings.map((o) => {
                  const thick = 6;
                  const isH = o.wall === "top" || o.wall === "bottom";
                  const wpx = cm(o.width);
                  const ppx = cm(o.position);
                  const style: React.CSSProperties = {
                    position: "absolute",
                    background: o.kind === "door" ? "var(--background)" : "#bcdcff",
                    border: o.kind === "window" ? "1px solid #3b82f6" : "none",
                  };
                  if (isH) {
                    style.width = wpx;
                    style.height = thick;
                    style.left = ppx;
                    style[o.wall] = -thick / 2;
                  } else {
                    style.height = wpx;
                    style.width = thick;
                    style.top = ppx;
                    style[o.wall] = -thick / 2;
                  }
                  return (
                    <div key={o.id} style={style} title={`${o.kind} (${o.width}cm)`} />
                  );
                })}

                {/* items */}
                {items.map((it) => {
                  const isChair = it.kind === "chair";
                  const isSelected = selectedId === it.id;
                  return (
                    <div
                      key={it.id}
                      onPointerDown={(e) => onPointerDown(e, it)}
                      className={
                        "absolute flex cursor-grab items-center justify-center rounded-sm text-center text-xs font-medium active:cursor-grabbing " +
                        (isChair
                          ? "border-0"
                          : "border border-foreground/30 shadow-sm")
                      }
                      style={{
                        left: cm(it.x),
                        top: cm(it.y),
                        width: cm(it.width),
                        height: cm(it.length),
                        background: isChair ? "transparent" : it.color,
                        backgroundImage: isChair ? `url(${chairBaseUrl})` : undefined,
                        backgroundSize: isChair ? "100% 100%" : undefined,
                        backgroundRepeat: "no-repeat",
                        color: isChair ? "#111" : readableText(it.color),
                        touchAction: "none",
                        userSelect: "none",
                        transform: `rotate(${it.rotation}deg)`,
                        transformOrigin: "center center",
                        outline: isSelected ? "2px solid var(--primary)" : undefined,
                        outlineOffset: isSelected ? 2 : undefined,
                        zIndex: isSelected ? 10 : 1,
                      }}
                    >
                      <span
                        className="pointer-events-none px-1 leading-tight"
                        style={
                          isChair
                            ? {
                                background: "rgba(255,255,255,0.85)",
                                borderRadius: 4,
                                padding: "1px 4px",
                              }
                            : undefined
                        }
                      >
                        {it.name}
                        <br />
                        <span className="text-[10px] opacity-80">
                          {it.width}×{it.length}
                        </span>
                      </span>
                      {isSelected && (
                        <>
                          {/* connector line */}
                          <div
                            className="pointer-events-none absolute left-1/2 h-6 w-px -translate-x-1/2 bg-foreground/60"
                            style={{ top: -24 }}
                          />
                          {/* rotation handle */}
                          <div
                            role="button"
                            title="Drag to rotate"
                            onPointerDown={(e) => onRotateHandleDown(e, it)}
                            className="absolute left-1/2 flex h-5 w-5 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border border-foreground bg-background shadow active:cursor-grabbing"
                            style={{ top: -34, touchAction: "none" }}
                          >
                            <RotateCw className="h-3 w-3" />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Drag items to reposition. Click an item to select it, then drag the handle above it to rotate. Scale: 1cm ≈ {scale.toFixed(2)}px.
          </p>
        </main>

        {/* Right column: Items list */}
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground">No items yet. Add some on the left.</p>
              )}
              {items.map((it) => (
                <div
                  key={it.id}
                  className={
                    "space-y-2 rounded-md border p-2 " +
                    (selectedId === it.id ? "border-foreground" : "")
                  }
                  onClick={() => setSelectedId(it.id)}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={it.color}
                      onChange={(e) => updateItem(it.id, { color: e.target.value })}
                      className="h-7 w-7 cursor-pointer rounded border"
                    />
                    <Input
                      value={it.name}
                      onChange={(e) => updateItem(it.id, { name: e.target.value })}
                      className="h-8"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeItem(it.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      value={it.width}
                      onChange={(e) => updateItem(it.id, { width: +e.target.value || 0 })}
                      className="h-8"
                    />
                    <Input
                      type="number"
                      value={it.length}
                      onChange={(e) => updateItem(it.id, { length: +e.target.value || 0 })}
                      className="h-8"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <RotateCw className="h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="number"
                      value={Math.round(it.rotation)}
                      onChange={(e) =>
                        updateItem(it.id, { rotation: ((+e.target.value || 0) % 360 + 360) % 360 })
                      }
                      className="h-8 flex-1"
                      title="Rotation in degrees"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => updateItem(it.id, { rotation: (it.rotation + 90) % 360 })}
                    >
                      +90°
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function readableText(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#000";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#111" : "#fff";
}

// silence unused
void PX_PER_CM_BASE;
