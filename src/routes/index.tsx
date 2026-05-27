import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Trash2,
  Plus,
  Download,
  Upload,
  RotateCw,
  Languages,
  Undo2,
  Redo2,
  Copy,
  Eraser,
  Ruler,
  HelpCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import chairBaseUrl from "@/assets/chair-base.png";
import sofaUrl from "@/assets/presets/sofa.png";
import armchairUrl from "@/assets/presets/armchair.png";
import bedUrl from "@/assets/presets/bed.png";
import roundTableUrl from "@/assets/presets/round-table.png";
import plantUrl from "@/assets/presets/plant.png";
import toiletUrl from "@/assets/presets/toilet.png";
import bathtubUrl from "@/assets/presets/bathtub.png";
import stoveUrl from "@/assets/presets/stove.png";
import sinkUrl from "@/assets/presets/sink.png";
import fridgeUrl from "@/assets/presets/fridge.png";


type Lang = "en" | "de";
const STRINGS = {
  en: {
    title: "Room Planner",
    subtitle: "Sketch your home office and drag furniture to find the right layout.",
    roomLabel: "Room",
    export: "Export",
    import: "Import",
    undo: "Undo",
    redo: "Redo",
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
    flipHinge: "Flip hinge side",
    flipSwing: "Flip swing in/out",
    resetItems: "Clear items",
    resetAll: "Clear all",
    confirmReset: "This will remove all items. Continue?",
    confirmResetAll: "This will remove all items and openings. Continue?",
    cancel: "Cancel",
    confirm: "Continue",
    ruler: "Ruler",
    rulerOn: "Ruler on",
    rulerHint: "Click two points to measure",
    rulerClear: "Clear measurement",
    takeTheTour: "Take the tour",
    tourSkip: "Skip",
    tourBack: "Back",
    tourNext: "Next",
    tourDone: "Done",
    tour: {
      welcome: { title: "Welcome to Room Planner", body: "A 30-second tour of the essentials." },
      catalog: { title: "Catalog", body: "Pick furniture presets from the left column to drop into the room." },
      canvas: { title: "Canvas", body: "Drag items, marquee-select, and use arrows or R to nudge/rotate." },
      openings: { title: "Doors & windows", body: "Drag along the wall to reposition. Doors have hinge & swing toggles." },
      ruler: { title: "Ruler", body: "Toggle the ruler then click two points to measure the distance." },
      reset: { title: "Reset", body: "Use Clear items or Clear all to start over." },
    },



    catalog: "Catalog",
    customBox: "Custom box",
    name: "Name",
    namePlaceholder: "e.g. Bookshelf",
    color: "Color",
    addItem: "Add custom box",
    items: "Items",
    noItems: "No items yet. Pick one from the catalog.",
    hint:
      "Click to select. Shift-click or drag a marquee for multi-select. Arrows = 1cm (Shift = 10cm). R = rotate 15°. Ctrl+D duplicate, Del removes. Ctrl+Z/Ctrl+Shift+Z undo/redo.",
    dragToRotate: "Drag to rotate",
    noFreeSpace: "No free space for this item — make it smaller or remove something.",
    exported: "Exported planner state",
    imported: "Planner state imported",
    importFail: "Could not import file: ",
    rotation: "Rotation in degrees",
    duplicate: "Duplicate",
    selectedCount: (n: number) => `${n} selected`,
    categories: {
      seating: "Seating",
      sleeping: "Sleeping",
      tables: "Tables",
      storage: "Storage",
      kitchen: "Kitchen",
      bathroom: "Bathroom",
      decor: "Decor",
    } as Record<string, string>,
  },
  de: {
    title: "Raumplaner",
    subtitle: "Skizziere dein Homeoffice und ziehe Möbel, um das richtige Layout zu finden.",
    roomLabel: "Raum",
    export: "Exportieren",
    import: "Importieren",
    undo: "Rückgängig",
    redo: "Wiederherstellen",
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
    flipHinge: "Anschlagseite wechseln",
    flipSwing: "Öffnung nach innen/außen",
    resetItems: "Möbel löschen",
    resetAll: "Alles löschen",
    confirmReset: "Dadurch werden alle Möbel entfernt. Fortfahren?",
    confirmResetAll: "Dadurch werden alle Möbel und Öffnungen entfernt. Fortfahren?",
    cancel: "Abbrechen",
    confirm: "Fortfahren",
    ruler: "Lineal",
    rulerOn: "Lineal an",
    rulerHint: "Klicke zwei Punkte zum Messen",
    rulerClear: "Messung löschen",
    takeTheTour: "Tour starten",
    tourSkip: "Überspringen",
    tourBack: "Zurück",
    tourNext: "Weiter",
    tourDone: "Fertig",
    tour: {
      welcome: { title: "Willkommen im Raumplaner", body: "Eine 30-Sekunden-Tour durch die wichtigsten Funktionen." },
      catalog: { title: "Katalog", body: "Wähle Möbelvorlagen aus der linken Spalte, um sie im Raum zu platzieren." },
      canvas: { title: "Arbeitsfläche", body: "Ziehe Elemente, wähle mit Rahmen aus und nutze Pfeiltasten oder R zum Verschieben/Drehen." },
      openings: { title: "Türen & Fenster", body: "Entlang der Wand ziehen, um sie zu verschieben. Türen haben Anschlag- und Öffnungsrichtung-Schalter." },
      ruler: { title: "Lineal", body: "Aktiviere das Lineal und klicke zwei Punkte, um den Abstand zu messen." },
      reset: { title: "Zurücksetzen", body: "Mit Möbel löschen oder Alles löschen kannst du neu beginnen." },
    },



    catalog: "Katalog",
    customBox: "Eigene Box",
    name: "Name",
    namePlaceholder: "z. B. Bücherregal",
    color: "Farbe",
    addItem: "Box hinzufügen",
    items: "Elemente",
    noItems: "Noch keine Elemente. Wähle eins aus dem Katalog.",
    hint:
      "Klicken zum Auswählen. Shift-Klick oder Rahmen ziehen für Mehrfachauswahl. Pfeile = 1cm (Shift = 10cm). R = 15° drehen. Strg+D dupliziert, Entf löscht. Strg+Z/Strg+Shift+Z für Rückgängig/Wiederherstellen.",
    dragToRotate: "Zum Drehen ziehen",
    noFreeSpace: "Kein freier Platz — mache es kleiner oder entferne etwas.",
    exported: "Planerstand exportiert",
    imported: "Planerstand importiert",
    importFail: "Datei konnte nicht importiert werden: ",
    rotation: "Drehung in Grad",
    duplicate: "Duplizieren",
    selectedCount: (n: number) => `${n} ausgewählt`,
    categories: {
      seating: "Sitzmöbel",
      sleeping: "Schlafen",
      tables: "Tische",
      storage: "Aufbewahrung",
      kitchen: "Küche",
      bathroom: "Bad",
      decor: "Deko",
    } as Record<string, string>,
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
  icon?: string; // preset key, optional
};

// ---------- Preset catalog ----------
type Preset = {
  key: string;
  category: string;
  nameEn: string;
  nameDe: string;
  w: number;
  l: number;
  color: string;
  iconUrl?: string;
};

const PRESETS: Preset[] = [
  // Seating
  { key: "chair-office", category: "seating", nameEn: "Office chair", nameDe: "Bürostuhl", w: 60, l: 60, color: "#1f2937", iconUrl: chairBaseUrl },
  { key: "armchair", category: "seating", nameEn: "Armchair", nameDe: "Sessel", w: 90, l: 90, color: "#a0522d", iconUrl: armchairUrl },
  { key: "sofa", category: "seating", nameEn: "Sofa", nameDe: "Sofa", w: 220, l: 95, color: "#a8a39b", iconUrl: sofaUrl },
  // Sleeping
  { key: "bed-double", category: "sleeping", nameEn: "Double bed", nameDe: "Doppelbett", w: 160, l: 200, color: "#f5f5f5", iconUrl: bedUrl },
  { key: "bed-single", category: "sleeping", nameEn: "Single bed", nameDe: "Einzelbett", w: 90, l: 200, color: "#f5f5f5", iconUrl: bedUrl },
  // Tables
  { key: "desk", category: "tables", nameEn: "Desk", nameDe: "Schreibtisch", w: 160, l: 75, color: "#6b4a2b" },
  { key: "round-table", category: "tables", nameEn: "Round table", nameDe: "Runder Tisch", w: 110, l: 110, color: "#d4a574", iconUrl: roundTableUrl },
  { key: "coffee-table", category: "tables", nameEn: "Coffee table", nameDe: "Couchtisch", w: 100, l: 55, color: "#8a6a4a" },
  { key: "side-table", category: "tables", nameEn: "Side table", nameDe: "Beistelltisch", w: 45, l: 45, color: "#c9a86a" },
  // Storage
  { key: "bookshelf", category: "storage", nameEn: "Bookshelf", nameDe: "Bücherregal", w: 80, l: 30, color: "#3d2b1f" },
  { key: "wardrobe", category: "storage", nameEn: "Wardrobe", nameDe: "Kleiderschrank", w: 150, l: 60, color: "#4a3729" },
  { key: "filing-cabinet", category: "storage", nameEn: "Filing cabinet", nameDe: "Aktenschrank", w: 60, l: 45, color: "#9aa0a6" },
  // Kitchen
  { key: "stove", category: "kitchen", nameEn: "Stove", nameDe: "Herd", w: 60, l: 60, color: "#c0c0c0", iconUrl: stoveUrl },
  { key: "sink", category: "kitchen", nameEn: "Sink", nameDe: "Spüle", w: 60, l: 50, color: "#c0c0c0", iconUrl: sinkUrl },
  { key: "fridge", category: "kitchen", nameEn: "Fridge", nameDe: "Kühlschrank", w: 70, l: 70, color: "#e8e8e8", iconUrl: fridgeUrl },
  // Bathroom
  { key: "toilet", category: "bathroom", nameEn: "Toilet", nameDe: "Toilette", w: 40, l: 70, color: "#ffffff", iconUrl: toiletUrl },
  { key: "bathtub", category: "bathroom", nameEn: "Bathtub", nameDe: "Badewanne", w: 80, l: 170, color: "#ffffff", iconUrl: bathtubUrl },
  // Decor
  { key: "plant", category: "decor", nameEn: "Plant", nameDe: "Pflanze", w: 50, l: 50, color: "#2f6b3a", iconUrl: plantUrl },
  { key: "floor-lamp", category: "decor", nameEn: "Floor lamp", nameDe: "Stehlampe", w: 30, l: 30, color: "#e8c97c" },
  { key: "rug", category: "decor", nameEn: "Rug", nameDe: "Teppich", w: 200, l: 140, color: "#b7806f" },
];

const PRESET_BY_KEY = Object.fromEntries(PRESETS.map((p) => [p.key, p]));

function iconUrlForItem(it: Item): string | undefined {
  if (it.icon && PRESET_BY_KEY[it.icon]) return PRESET_BY_KEY[it.icon].iconUrl;
  // legacy back-compat
  if (it.kind === "chair") return chairBaseUrl;
  return undefined;
}

// ---------- Geometry helpers ----------
function rotatedAABB(w: number, l: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { w: w * c + l * s, h: w * s + l * c };
}

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

function obbOverlap(a: Parameters<typeof obbCorners>[0], b: Parameters<typeof obbCorners>[0]) {
  const A = obbCorners(a);
  const B = obbCorners(b);
  const eps = 0.5;
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

function collidesWithOthers(candidate: Item, others: Item[], ignoreIds?: Set<string>): boolean {
  return others.some(
    (o) => o.id !== candidate.id && !(ignoreIds && ignoreIds.has(o.id)) && obbOverlap(candidate, o),
  );
}

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
  position: number;
  width: number;
  kind: "door" | "window";
  hinge?: "start" | "end"; // doors only — which end the door is hinged on along the wall
  swing?: "in" | "out"; // doors only — swings into the room or out
};


type Snapshot = {
  items: Item[];
  openings: Opening[];
  roomW: number;
  roomL: number;
};

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

  const [roomW, setRoomW] = useState(480);
  const [roomL, setRoomL] = useState(360);
  const [draftW, setDraftW] = useState("480");
  const [draftL, setDraftL] = useState("360");
  const dirty = draftW !== String(roomW) || draftL !== String(roomL);

  // Cozy living-room + work-nook default. Door is on the bottom wall near the
  // bottom-left corner with its swing arc landing on clear floor space.
  const [items, setItems] = useState<Item[]>(() => [
    { id: crypto.randomUUID(), name: "Desk",           width: 160, length: 75, color: "#6b4a2b", x: 160, y: 15,  rotation: 0, kind: "furniture", icon: "desk" },
    { id: crypto.randomUUID(), name: "Office chair",   width: 60,  length: 60, color: "#1f2937", x: 210, y: 100, rotation: 0, kind: "chair",     icon: "chair-office" },
    { id: crypto.randomUUID(), name: "Bookshelf",      width: 30,  length: 200, color: "#3d2b1f", x: 450, y: 130, rotation: 0, kind: "furniture", icon: "bookshelf" },
    { id: crypto.randomUUID(), name: "Filing cabinet", width: 60,  length: 45, color: "#9aa0a6", x: 340, y: 15,  rotation: 0, kind: "furniture", icon: "filing-cabinet" },
    { id: crypto.randomUUID(), name: "Plant",          width: 50,  length: 50, color: "#2f6b3a", x: 20,  y: 20,  rotation: 0, kind: "furniture", icon: "plant" },
  ]);
  const [openings, setOpenings] = useState<Opening[]>(() => [
    { id: crypto.randomUUID(), wall: "bottom", position: 30, width: 90,  kind: "door",   hinge: "start", swing: "in" },
    { id: crypto.randomUUID(), wall: "top",    position: 60, width: 80,  kind: "window" },
    { id: crypto.randomUUID(), wall: "right",  position: 30, width: 80,  kind: "window" },
  ]);



  // -------- History (undo / redo) --------
  const stateRef = useRef<Snapshot>({ items, openings, roomW, roomL });
  useEffect(() => {
    stateRef.current = { items, openings, roomW, roomL };
  }, [items, openings, roomW, roomL]);

  const historyRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const [, forceHistoryTick] = useState(0);

  const snapshotEqual = (a: Snapshot, b: Snapshot) =>
    JSON.stringify(a) === JSON.stringify(b);

  const pushHistory = () => {
    const snap: Snapshot = JSON.parse(JSON.stringify(stateRef.current));
    const top = historyRef.current[historyRef.current.length - 1];
    if (top && snapshotEqual(top, snap)) return;
    historyRef.current = [...historyRef.current.slice(-99), snap];
    futureRef.current = [];
    forceHistoryTick((n) => n + 1);
  };

  const applySnapshot = (s: Snapshot) => {
    setItems(s.items);
    setOpenings(s.openings);
    setRoomW(s.roomW);
    setRoomL(s.roomL);
    setDraftW(String(s.roomW));
    setDraftL(String(s.roomL));
  };

  const undo = () => {
    if (!historyRef.current.length) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    futureRef.current = [...futureRef.current, JSON.parse(JSON.stringify(stateRef.current))];
    historyRef.current = historyRef.current.slice(0, -1);
    applySnapshot(prev);
    forceHistoryTick((n) => n + 1);
  };

  const redo = () => {
    if (!futureRef.current.length) return;
    const next = futureRef.current[futureRef.current.length - 1];
    historyRef.current = [...historyRef.current, JSON.parse(JSON.stringify(stateRef.current))];
    futureRef.current = futureRef.current.slice(0, -1);
    applySnapshot(next);
    forceHistoryTick((n) => n + 1);
  };

  // -------- Room dims --------
  const applyRoom = () => {
    const w = Math.max(50, parseInt(draftW, 10) || 0);
    const l = Math.max(50, parseInt(draftL, 10) || 0);
    if (w === roomW && l === roomL) return;
    pushHistory();
    setRoomW(w);
    setRoomL(l);
    setDraftW(String(w));
    setDraftL(String(l));
    setItems((prev) =>
      prev.map((i) => {
        const c = clampPos(i, w, l, i.x, i.y);
        return { ...i, x: c.x, y: c.y };
      }),
    );
  };

  // -------- Custom box form --------
  const [nName, setNName] = useState("");
  const [nW, setNW] = useState(80);
  const [nL, setNL] = useState(40);
  const [nColor, setNColor] = useState("#5cbdb9");

  // -------- New opening form --------
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

  // -------- Selection --------
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  // -------- Add items --------
  const addPreset = (preset: Preset) => {
    const draft: Item = {
      id: crypto.randomUUID(),
      name: lang === "de" ? preset.nameDe : preset.nameEn,
      width: preset.w,
      length: preset.l,
      color: preset.color,
      x: 10,
      y: 10,
      rotation: 0,
      kind: preset.iconUrl && preset.key === "chair-office" ? "chair" : "furniture",
      icon: preset.key,
    };
    const spot = findFreeSpot(draft, items, roomW, roomL);
    if (!spot) {
      toast.error(t.noFreeSpace);
      return;
    }
    pushHistory();
    const added = { ...draft, x: spot.x, y: spot.y };
    setItems((prev) => [...prev, added]);
    setSelectedIds(new Set([added.id]));
  };

  const addCustomBox = () => {
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
      kind: "furniture",
    };
    const spot = findFreeSpot(draft, items, roomW, roomL);
    if (!spot) {
      toast.error(t.noFreeSpace);
      return;
    }
    pushHistory();
    const added = { ...draft, x: spot.x, y: spot.y };
    setItems((prev) => [...prev, added]);
    setSelectedIds(new Set([added.id]));
    setNName("");
  };

  const removeItem = (id: string) => {
    pushHistory();
    setItems((p) => p.filter((i) => i.id !== id));
    setSelectedIds((s) => {
      if (!s.has(id)) return s;
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  };

  const removeSelected = () => {
    const ids = selectedIdsRef.current;
    if (!ids.size) return;
    pushHistory();
    setItems((p) => p.filter((i) => !ids.has(i.id)));
    setSelectedIds(new Set());
  };

  const duplicateSelected = () => {
    const ids = selectedIdsRef.current;
    if (!ids.size) return;
    pushHistory();
    setItems((prev) => {
      const toDup = prev.filter((i) => ids.has(i.id));
      const next = [...prev];
      const newIds: string[] = [];
      for (const src of toDup) {
        const draft: Item = { ...src, id: crypto.randomUUID(), x: src.x + 20, y: src.y + 20 };
        const spot = findFreeSpot(draft, next, roomW, roomL);
        if (!spot) continue;
        const added = { ...draft, x: spot.x, y: spot.y };
        next.push(added);
        newIds.push(added.id);
      }
      if (newIds.length) {
        // Defer selection update to after state commit
        queueMicrotask(() => setSelectedIds(new Set(newIds)));
      } else {
        toast.error(t.noFreeSpace);
      }
      return next;
    });
  };

  const updateItem = (id: string, patch: Partial<Item>, options?: { history?: boolean }) => {
    if (options?.history !== false) pushHistory();
    setItems((p) =>
      p.map((i) => {
        if (i.id !== id) return i;
        const merged = { ...i, ...patch };
        const c = clampPos(merged, roomW, roomL, merged.x, merged.y);
        const candidate = { ...merged, x: c.x, y: c.y };
        if (collidesWithOthers(candidate, p)) return i;
        return candidate;
      }),
    );
  };

  const addOpening = () => {
    pushHistory();
    setOpenings((p) => [
      ...p,
      {
        id: crypto.randomUUID(),
        kind: oKind,
        wall: oWall,
        position: oPos,
        width: oWidth,
        ...(oKind === "door" ? { hinge: "start" as const, swing: "in" as const } : {}),
      },
    ]);
  };
  const removeOpening = (id: string) => {
    pushHistory();
    setOpenings((p) => p.filter((o) => o.id !== id));
  };
  const updateOpening = (id: string, patch: Partial<Opening>) => {
    pushHistory();
    setOpenings((p) => p.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };


  // -------- Reset --------
  const [resetMode, setResetMode] = useState<"items" | "all" | null>(null);

  const clearItemsOnly = () => {
    pushHistory();
    setItems([]);
    setSelectedIds(new Set());
  };
  const clearAll = () => {
    pushHistory();
    setItems([]);
    setOpenings([]);
    setSelectedIds(new Set());
  };
  const confirmReset = () => {
    if (resetMode === "items") clearItemsOnly();
    else if (resetMode === "all") clearAll();
    setResetMode(null);
  };

  // -------- Ruler --------
  const [rulerMode, setRulerMode] = useState(false);
  const [rulerStart, setRulerStart] = useState<{ x: number; y: number } | null>(null);
  const [rulerEnd, setRulerEnd] = useState<{ x: number; y: number } | null>(null);
  const [rulerHover, setRulerHover] = useState<{ x: number; y: number } | null>(null);
  const clearRuler = () => {
    setRulerStart(null);
    setRulerEnd(null);
    setRulerHover(null);
  };
  useEffect(() => {
    if (!rulerMode) clearRuler();
  }, [rulerMode]);

  // -------- Onboarding tour --------
  const TOUR_KEY = "planner-tour-v1-done";
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(TOUR_KEY)) {
      setTourOpen(true);
      setTourStep(0);
    }
  }, []);
  const closeTour = () => {
    setTourOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOUR_KEY, "1");
    }
  };


  // -------- Drag & marquee --------




  const dragRef = useRef<
    | {
        mode: "move";
        ids: string[];
        startMouseX: number;
        startMouseY: number;
        startPos: Map<string, { x: number; y: number }>;
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

  const marqueeRef = useRef<{ startCx: number; startCy: number; addToSelection: boolean } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<
    | { x: number; y: number; w: number; h: number }
    | null
  >(null);

  const stageToCm = (clientX: number, clientY: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    return {
      x: (clientX - r.left - offsetX) / scale,
      y: (clientY - r.top - offsetY) / scale,
    };
  };

  const onItemPointerDown = (e: React.PointerEvent, item: Item) => {
    if (rulerMode) {
      e.stopPropagation();
      const p = stageToCm(e.clientX, e.clientY);
      const cmPt = { x: p.x, y: p.y };
      if (!rulerStart || (rulerStart && rulerEnd)) {
        setRulerStart(cmPt);
        setRulerEnd(null);
        setRulerHover(cmPt);
      } else {
        setRulerEnd(cmPt);
      }
      return;
    }
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);

    if (e.shiftKey) {
      // toggle in selection, no drag
      setSelectedIds((s) => {
        const n = new Set(s);
        if (n.has(item.id)) n.delete(item.id);
        else n.add(item.id);
        return n;
      });
      return;
    }

    // Determine drag set: if item is in current selection (>1), drag the group; else select only this and drag.
    const cur = selectedIdsRef.current;
    let ids: string[];
    if (cur.has(item.id) && cur.size > 1) {
      ids = Array.from(cur);
    } else {
      setSelectedIds(new Set([item.id]));
      ids = [item.id];
    }
    const startPos = new Map<string, { x: number; y: number }>();
    for (const it of items) {
      if (ids.includes(it.id)) startPos.set(it.id, { x: it.x, y: it.y });
    }
    pushHistory();
    dragRef.current = {
      mode: "move",
      ids,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPos,
    };
  };

  const onRotateHandleDown = (e: React.PointerEvent, item: Item) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const stageRect = stageEl.getBoundingClientRect();
    const centerClientX = stageRect.left + offsetX + cm(item.x + item.width / 2);
    const centerClientY = stageRect.top + offsetY + cm(item.y + item.length / 2);
    const startAngle =
      (Math.atan2(e.clientY - centerClientY, e.clientX - centerClientX) * 180) / Math.PI;
    pushHistory();
    dragRef.current = {
      mode: "rotate",
      id: item.id,
      centerClientX,
      centerClientY,
      startAngle,
      startRotation: item.rotation,
    };
  };

  const onStagePointerDown = (e: React.PointerEvent) => {
    if (!stageRef.current) return;
    if (rulerMode) {
      const p = stageToCm(e.clientX, e.clientY);
      const cmPt = { x: p.x, y: p.y };
      if (!rulerStart || (rulerStart && rulerEnd)) {
        setRulerStart(cmPt);
        setRulerEnd(null);
        setRulerHover(cmPt);
      } else {
        setRulerEnd(cmPt);
      }
      return;
    }
    // Only fires when not handled by an item child. Start marquee.
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = stageToCm(e.clientX, e.clientY);
    marqueeRef.current = { startCx: p.x, startCy: p.y, addToSelection: e.shiftKey };
    if (!e.shiftKey) setSelectedIds(new Set());
    setMarqueeRect({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onStagePointerMove = (e: React.PointerEvent) => {
    if (rulerMode) {
      const p = stageToCm(e.clientX, e.clientY);
      setRulerHover({ x: p.x, y: p.y });
      return;
    }
    const d = dragRef.current;
    if (d) {
      if (d.mode === "move") {
        const dx = (e.clientX - d.startMouseX) / scale;
        const dy = (e.clientY - d.startMouseY) / scale;
        const idsSet = new Set(d.ids);
        // Collision detection is temporarily disabled while dragging.
        // We only clamp to room bounds here; collisions are validated on pointer up.
        setItems((prev) =>
          prev.map((i) => {
            if (!idsSet.has(i.id)) return i;
            const start = d.startPos.get(i.id)!;
            const c = clampPos(i, roomW, roomL, start.x + dx, start.y + dy);
            return { ...i, x: c.x, y: c.y };
          }),
        );

      } else {
        const angle =
          (Math.atan2(e.clientY - d.centerClientY, e.clientX - d.centerClientX) * 180) / Math.PI;
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
      return;
    }

    const m = marqueeRef.current;
    if (m) {
      const p = stageToCm(e.clientX, e.clientY);
      const x = Math.min(p.x, m.startCx);
      const y = Math.min(p.y, m.startCy);
      const w = Math.abs(p.x - m.startCx);
      const h = Math.abs(p.y - m.startCy);
      setMarqueeRect({ x, y, w, h });
    }
  };

  const onStagePointerUp = () => {
    const d = dragRef.current;
    if (d) {
      if (d.mode === "move") {
        const idsSet = new Set(d.ids);
        // Validate collisions on release; revert selected items if any collide.
        setItems((prev) => {
          let anyCollision = false;
          for (const i of prev) {
            if (!idsSet.has(i.id)) continue;
            if (collidesWithOthers(i, prev, idsSet)) {
              anyCollision = true;
              break;
            }
          }
          if (!anyCollision) return prev;
          return prev.map((i) => {
            if (!idsSet.has(i.id)) return i;
            const start = d.startPos.get(i.id);
            return start ? { ...i, x: start.x, y: start.y } : i;
          });
        });
      }
      dragRef.current = null;
      return;
    }

    const m = marqueeRef.current;
    const r = marqueeRect;
    if (m && r) {
      const picked: string[] = [];
      if (r.w > 1 && r.h > 1) {
        for (const it of items) {
          const cx = it.x + it.width / 2;
          const cy = it.y + it.length / 2;
          if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) picked.push(it.id);
        }
      }
      if (picked.length || m.addToSelection) {
        setSelectedIds((prev) => {
          const next = m.addToSelection ? new Set(prev) : new Set<string>();
          for (const id of picked) next.add(id);
          return next;
        });
      }
    }
    marqueeRef.current = null;
    setMarqueeRect(null);
  };

  // -------- Keyboard --------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Don't hijack typing in inputs
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        // still allow undo/redo
        if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
          // ignore inside fields
        }
        return;
      }

      // Undo/redo
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
        return;
      }

      // Escape clears ruler / exits ruler mode
      if (e.key === "Escape") {
        if (rulerMode) {
          if (rulerStart || rulerEnd) clearRuler();
          else setRulerMode(false);
          e.preventDefault();
          return;
        }
      }

      const ids = selectedIdsRef.current;
      if (!ids.size) return;

      // Duplicate
      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      // Delete
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeSelected();
        return;
      }

      // Rotate
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        const dir = e.shiftKey ? -15 : 15;
        pushHistory();
        setItems((prev) =>
          prev.map((i) => {
            if (!ids.has(i.id)) return i;
            const merged = { ...i, rotation: ((i.rotation + dir) % 360 + 360) % 360 };
            const c = clampPos(merged, roomW, roomL, merged.x, merged.y);
            const candidate = { ...merged, x: c.x, y: c.y };
            if (collidesWithOthers(candidate, prev, ids)) return i;
            return candidate;
          }),
        );
        return;
      }

      // Arrow nudge
      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else if (e.key === "Escape") {
        setSelectedIds(new Set());
        return;
      } else return;

      e.preventDefault();
      pushHistory();
      setItems((prev) => {
        const next = prev.map((i) => {
          if (!ids.has(i.id)) return i;
          const c = clampPos(i, roomW, roomL, i.x + dx, i.y + dy);
          return { ...i, x: c.x, y: c.y };
        });
        // Reject any individual move that collides with non-selected
        for (const i of next) {
          if (!ids.has(i.id)) continue;
          if (collidesWithOthers(i, next, ids)) return prev;
        }
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomW, roomL]);

  // -------- Export / Import --------
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportJSON = () => {
    const payload = {
      version: 2,
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
    toast.success(t.exported);
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
      pushHistory();
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
          hinge: o.kind === "door" ? (o.hinge === "end" ? "end" : "start") : undefined,
          swing: o.kind === "door" ? (o.swing === "out" ? "out" : "in") : undefined,
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
          icon: typeof i.icon === "string" ? i.icon : undefined,
        })),
      );
      setSelectedIds(new Set());
      toast.success(t.imported);
    } catch (err) {
      toast.error(t.importFail + (err as Error).message);
    }
  };

  const canUndo = historyRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  // Group presets by category for catalog rendering
  const categorized = useMemo(() => {
    const map: Record<string, Preset[]> = {};
    for (const p of PRESETS) {
      (map[p.category] ||= []).push(p);
    }
    return map;
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex w-full items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{t.title}</h1>
            <p className="truncate text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {t.roomLabel}: {roomW} × {roomL} cm
              {selectedIds.size > 0 && <> · {t.selectedCount(selectedIds.size)}</>}
            </span>
            <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo} title="Ctrl+Z">
              <Undo2 className="mr-1 h-4 w-4" /> {t.undo}
            </Button>
            <Button variant="outline" size="sm" onClick={redo} disabled={!canRedo} title="Ctrl+Shift+Z">
              <Redo2 className="mr-1 h-4 w-4" /> {t.redo}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLang(lang === "en" ? "de" : "en")}
              title="Language / Sprache"
            >
              <Languages className="mr-1 h-4 w-4" />
              {lang === "en" ? "DE" : "EN"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportJSON}>
              <Download className="mr-1 h-4 w-4" /> {t.export}
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" /> {t.import}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onImportFile}
            />
            <Separator orientation="vertical" className="mx-1 h-6" />
            <Button
              variant={rulerMode ? "default" : "outline"}
              size="sm"
              onClick={() => setRulerMode((v) => !v)}
              title={t.rulerHint}
            >
              <Ruler className="mr-1 h-4 w-4" />
              {rulerMode ? t.rulerOn : t.ruler}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetMode("items")}
              disabled={items.length === 0}
            >
              <Eraser className="mr-1 h-4 w-4" /> {t.resetItems}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetMode("all")}
              disabled={items.length === 0 && openings.length === 0}
            >
              <Trash2 className="mr-1 h-4 w-4" /> {t.resetAll}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTourStep(0);
                setTourOpen(true);
              }}
              title={t.takeTheTour}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <AlertDialog open={resetMode !== null} onOpenChange={(o) => !o && setResetMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {resetMode === "all" ? t.resetAll : t.resetItems}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {resetMode === "all" ? t.confirmResetAll : t.confirmReset}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset}>{t.confirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {tourOpen && (() => {
        const steps = [
          { key: "welcome" as const },
          { key: "catalog" as const },
          { key: "canvas" as const },
          { key: "openings" as const },
          { key: "ruler" as const },
          { key: "reset" as const },
        ];
        const step = steps[Math.min(tourStep, steps.length - 1)];
        const content = t.tour[step.key];
        const isLast = tourStep >= steps.length - 1;
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
            <div className="w-full max-w-md rounded-lg border bg-background p-5 shadow-xl">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold">{content.title}</h2>
                <button
                  type="button"
                  onClick={closeTour}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">{content.body}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {tourStep + 1} / {steps.length}
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={closeTour}>
                    {t.tourSkip}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTourStep((s) => Math.max(0, s - 1))}
                    disabled={tourStep === 0}
                  >
                    {t.tourBack}
                  </Button>
                  {isLast ? (
                    <Button size="sm" onClick={closeTour}>{t.tourDone}</Button>
                  ) : (
                    <Button size="sm" onClick={() => setTourStep((s) => s + 1)}>
                      {t.tourNext}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="grid w-full gap-4 px-4 py-4 lg:grid-cols-[300px_minmax(0,1fr)_280px]">
        {/* Left column */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t.roomLabel}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t.width}</Label>
                  <Input
                    type="number"
                    value={draftW}
                    min={50}
                    onChange={(e) => setDraftW(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t.length}</Label>
                  <Input
                    type="number"
                    value={draftL}
                    min={50}
                    onChange={(e) => setDraftL(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={applyRoom} size="sm" className="w-full" disabled={!dirty}>
                {t.apply}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t.catalog}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(categorized).map(([cat, list]) => (
                <div key={cat}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t.categories[cat] ?? cat}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {list.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => addPreset(p)}
                        className="group flex flex-col items-center gap-1 rounded-md border bg-card p-2 text-center text-[10px] leading-tight transition hover:border-foreground hover:bg-accent"
                        title={`${lang === "de" ? p.nameDe : p.nameEn} (${p.w}×${p.l}cm)`}
                      >
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded"
                          style={{
                            background: p.iconUrl ? "transparent" : p.color,
                          }}
                        >
                          {p.iconUrl ? (
                            <img
                              src={p.iconUrl}
                              alt=""
                              loading="lazy"
                              className="h-10 w-10 object-contain"
                            />
                          ) : (
                            <span className="text-[9px] font-semibold text-white/90 mix-blend-difference">
                              {p.w}×{p.l}
                            </span>
                          )}
                        </div>
                        <span className="line-clamp-2">{lang === "de" ? p.nameDe : p.nameEn}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t.customBox}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>{t.name}</Label>
                <Input value={nName} onChange={(e) => setNName(e.target.value)} placeholder={t.namePlaceholder} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t.width}</Label>
                  <Input type="number" value={nW} onChange={(e) => setNW(+e.target.value || 0)} />
                </div>
                <div>
                  <Label>{t.length}</Label>
                  <Input type="number" value={nL} onChange={(e) => setNL(+e.target.value || 0)} />
                </div>
              </div>
              <div>
                <Label>{t.color}</Label>
                <input
                  type="color"
                  value={nColor}
                  onChange={(e) => setNColor(e.target.value)}
                  className="h-9 w-full cursor-pointer rounded-md border bg-background"
                />
              </div>
              <Button onClick={addCustomBox} className="w-full" size="sm">
                <Plus className="mr-1 h-4 w-4" /> {t.addItem}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t.openings}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{t.type}</Label>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={oKind}
                    onChange={(e) => setOKind(e.target.value as "door" | "window")}
                  >
                    <option value="door">{t.door}</option>
                    <option value="window">{t.window}</option>
                  </select>
                </div>
                <div>
                  <Label>{t.wall}</Label>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={oWall}
                    onChange={(e) => setOWall(e.target.value as Opening["wall"])}
                  >
                    <option value="top">{t.top}</option>
                    <option value="bottom">{t.bottom}</option>
                    <option value="left">{t.left}</option>
                    <option value="right">{t.right}</option>
                  </select>
                </div>
                <div>
                  <Label>{t.position}</Label>
                  <Input type="number" value={oPos} onChange={(e) => setOPos(+e.target.value || 0)} />
                </div>
                <div>
                  <Label>{t.width}</Label>
                  <Input type="number" value={oWidth} onChange={(e) => setOWidth(+e.target.value || 0)} />
                </div>
              </div>
              <Button onClick={addOpening} size="sm" className="w-full">
                <Plus className="mr-1 h-4 w-4" /> {t.addOpening}
              </Button>
              <Separator />
              <ul className="space-y-1 text-sm">
                {openings.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-1 rounded-md border px-2 py-1">
                    <span className="min-w-0 flex-1 truncate capitalize">
                      {o.kind === "door" ? t.door : t.window} · {t[o.wall]} · {Math.round(o.position)}cm · {o.width}cm
                    </span>
                    {o.kind === "door" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            updateOpening(o.id, { hinge: o.hinge === "end" ? "start" : "end" })
                          }
                          title={t.flipHinge}
                        >
                          <span className="text-xs">⇋</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            updateOpening(o.id, { swing: o.swing === "out" ? "in" : "out" })
                          }
                          title={t.flipSwing}
                        >
                          <span className="text-xs">⇵</span>
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeOpening(o.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
                {openings.length === 0 && (
                  <li className="text-xs text-muted-foreground">{t.noOpenings}</li>
                )}
              </ul>

            </CardContent>
          </Card>
        </aside>

        {/* Stage */}
        <main className="min-w-0 lg:sticky lg:top-20 lg:self-start lg:h-[calc(100vh-6rem)]">
          <div
            ref={stageRef}
            className="relative h-[calc(100vh-6rem)] w-full overflow-visible rounded-lg border bg-muted/30"

            onPointerDown={onStagePointerDown}
            onPointerMove={onStagePointerMove}
            onPointerUp={onStagePointerUp}
            style={{ touchAction: "none", cursor: rulerMode ? "crosshair" : undefined }}
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
                  const isH = o.wall === "top" || o.wall === "bottom";
                  const wallLen = isH ? roomW : roomL;
                  const wpx = cm(o.width);
                  const ppx = cm(o.position);
                  const wallThick = 6; // px — covers the room border stroke
                  const jambH = 8; // px — short tick across the wall at each jamb

                  // Canonical local frame (x: 0..wpx along wall hinge→end; -y = into room).
                  // wrapperOrigin = canvas (px) location of canonical (0,0).
                  // rotation rotates the canonical frame to match the wall orientation.
                  let originX = 0;
                  let originY = 0;
                  let rotation = 0;
                  if (o.wall === "bottom") {
                    originX = ppx;
                    originY = roomPxL;
                    rotation = 0;
                  } else if (o.wall === "top") {
                    originX = ppx + wpx;
                    originY = 0;
                    rotation = 180;
                  } else if (o.wall === "left") {
                    originX = 0;
                    originY = ppx;
                    rotation = 90;
                  } else {
                    // right
                    originX = roomPxW;
                    originY = ppx + wpx;
                    rotation = -90;
                  }

                  // hinge=end swaps the hinge to the other end of the opening along the wall
                  const hingeEnd = o.kind === "door" && o.hinge === "end";
                  // swing=out flips the canonical "into the room" direction
                  const swingOut = o.kind === "door" && o.swing === "out";

                  // Apply hinge flip by swapping origin to the opposite end on the wall
                  if (hingeEnd) {
                    if (o.wall === "bottom") originX = ppx + wpx;
                    else if (o.wall === "top") originX = ppx;
                    else if (o.wall === "left") originY = ppx + wpx;
                    else originY = ppx;
                    // and mirror x within the canonical frame
                  }

                  const transform =
                    `translate(${originX}px, ${originY}px) rotate(${rotation}deg)` +
                    (hingeEnd ? " scaleX(-1)" : "") +
                    (swingOut ? " scaleY(-1)" : "");

                  const onOpeningDown = (e: React.PointerEvent) => {
                    e.stopPropagation();
                    e.preventDefault();
                    pushHistory();
                    const startClient = isH ? e.clientX : e.clientY;
                    const startPos = o.position;
                    const id = o.id;
                    const maxPos = Math.max(0, wallLen - o.width);
                    const move = (ev: PointerEvent) => {
                      const cur = isH ? ev.clientX : ev.clientY;
                      const delta = (cur - startClient) / scale;
                      const next = Math.min(maxPos, Math.max(0, startPos + delta));
                      setOpenings((prev) => prev.map((x) => (x.id === id ? { ...x, position: next } : x)));
                    };
                    const up = () => {
                      window.removeEventListener("pointermove", move);
                      window.removeEventListener("pointerup", up);
                    };
                    window.addEventListener("pointermove", move);
                    window.addEventListener("pointerup", up);
                  };

                  // Door angle (degrees from wall). 90° = fully open / perpendicular (architectural standard).
                  const angle = 35; // door panel angle from wall — small enough to not eat into the room
                  const rad = (angle * Math.PI) / 180;
                  const tipX = Math.cos(rad) * wpx;
                  const tipY = -Math.sin(rad) * wpx;

                  return (
                    <svg
                      key={o.id}
                      width={1}
                      height={1}
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        overflow: "visible",
                        transform,
                        transformOrigin: "0 0",
                        zIndex: 5,
                      }}
                    >
                      {/* hit area covering the wall gap — only this is draggable */}
                      <rect
                        x={0}
                        y={-wallThick - 3}
                        width={wpx}
                        height={(wallThick + 3) * 2}
                        fill="transparent"
                        style={{ cursor: isH ? "ew-resize" : "ns-resize", touchAction: "none" }}
                        onPointerDown={onOpeningDown}
                      >
                        <title>{`${o.kind === "door" ? "Door" : "Window"} (${o.width}cm) — drag to move`}</title>
                      </rect>

                      {/* wall gap: hide the room border stroke across the opening */}
                      <rect
                        x={0}
                        y={-wallThick / 2}
                        width={wpx}
                        height={wallThick}
                        fill="hsl(var(--background))"
                        pointerEvents="none"
                      />

                      {o.kind === "door" ? (
                        <>
                          {/* jambs */}
                          <line
                            x1={0}
                            y1={-jambH / 2}
                            x2={0}
                            y2={jambH / 2}
                            stroke="hsl(var(--foreground))"
                            strokeWidth={1.5}
                            pointerEvents="none"
                          />
                          <line
                            x1={wpx}
                            y1={-jambH / 2}
                            x2={wpx}
                            y2={jambH / 2}
                            stroke="hsl(var(--foreground))"
                            strokeWidth={1.5}
                            pointerEvents="none"
                          />
                          {/* swing arc (full quarter from closed to perpendicular) */}
                          <path
                            d={`M ${wpx} 0 A ${wpx} ${wpx} 0 0 0 0 ${-wpx}`}
                            stroke="hsl(var(--foreground) / 0.35)"
                            strokeWidth={1}
                            strokeDasharray="3 3"
                            fill="none"
                            pointerEvents="none"
                          />
                          {/* door panel from hinge (0,0) to (tipX, tipY) */}
                          <line
                            x1={0}
                            y1={0}
                            x2={tipX}
                            y2={tipY}
                            stroke="#8a5a2b"
                            strokeWidth={4}
                            strokeLinecap="round"
                            pointerEvents="none"
                          />
                          {/* knob */}
                          <circle
                            cx={tipX + Math.cos(rad - Math.PI / 2) * 3}
                            cy={tipY + Math.sin(rad - Math.PI / 2) * 3}
                            r={1.8}
                            fill="#3b2210"
                            pointerEvents="none"
                          />
                        </>
                      ) : (
                        <>
                          {/* window frame */}
                          <rect
                            x={0}
                            y={-wallThick / 2 - 1}
                            width={wpx}
                            height={wallThick + 2}
                            fill="hsl(var(--background))"
                            stroke="#3b82f6"
                            strokeWidth={1.25}
                            pointerEvents="none"
                          />
                          {/* double-pane glazing lines */}
                          <line
                            x1={0}
                            y1={-1.2}
                            x2={wpx}
                            y2={-1.2}
                            stroke="#3b82f6"
                            strokeWidth={0.9}
                            pointerEvents="none"
                          />
                          <line
                            x1={0}
                            y1={1.2}
                            x2={wpx}
                            y2={1.2}
                            stroke="#3b82f6"
                            strokeWidth={0.9}
                            pointerEvents="none"
                          />
                          {/* jamb ticks */}
                          <line
                            x1={0}
                            y1={-jambH / 2}
                            x2={0}
                            y2={jambH / 2}
                            stroke="#3b82f6"
                            strokeWidth={1.5}
                            pointerEvents="none"
                          />
                          <line
                            x1={wpx}
                            y1={-jambH / 2}
                            x2={wpx}
                            y2={jambH / 2}
                            stroke="#3b82f6"
                            strokeWidth={1.5}
                            pointerEvents="none"
                          />
                        </>
                      )}
                    </svg>
                  );
                })}



                {/* items */}
                {items.map((it) => {
                  const hasIcon = false;

                  const isSelected = selectedIds.has(it.id);
                  return (
                    <div
                      key={it.id}
                      onPointerDown={(e) => onItemPointerDown(e, it)}
                      className={
                        "absolute flex cursor-grab items-center justify-center rounded-sm text-center text-xs font-medium active:cursor-grabbing " +
                        (hasIcon ? "border-0" : "border border-foreground/30 shadow-sm")
                      }
                      style={{
                        left: cm(it.x),
                        top: cm(it.y),
                        width: cm(it.width),
                        height: cm(it.length),
                        background: it.color,
                        color: readableText(it.color),

                        touchAction: "none",
                        userSelect: "none",
                        transform: `rotate(${it.rotation}deg)`,
                        transformOrigin: "center center",
                        outline: isSelected ? "2px solid var(--primary)" : undefined,
                        outlineOffset: isSelected ? 2 : undefined,
                        zIndex: isSelected ? 10 : 1,
                      }}
                    >
                      {(() => {
                        const minDim = Math.min(it.width, it.length);
                        const fontSize = minDim < 35 ? 8 : minDim < 55 ? 10 : 12;
                        const dimSize = minDim < 35 ? 7 : minDim < 55 ? 9 : 10;
                        return (
                          <div
                            className="pointer-events-none flex flex-col items-center justify-center leading-tight"
                            style={{
                              maxWidth: "100%",
                              maxHeight: "100%",
                              overflow: "hidden",
                              fontSize,
                              padding: "2px 4px",
                              wordBreak: "break-word",
                              background: hasIcon ? "rgba(255,255,255,0.85)" : undefined,
                              borderRadius: hasIcon ? 4 : undefined,
                            }}
                          >
                            <span
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={it.name}
                            >
                              {it.name}
                            </span>
                            <span style={{ fontSize: dimSize, opacity: 0.8 }}>
                              {it.width}×{it.length}
                            </span>
                          </div>
                        );
                      })()}
                      {isSelected && selectedIds.size === 1 && (
                        <>
                          <div
                            className="pointer-events-none absolute left-1/2 h-6 w-px -translate-x-1/2 bg-foreground/60"
                            style={{ top: -24 }}
                          />
                          <div
                            role="button"
                            title={t.dragToRotate}
                            onPointerDown={(e) => onRotateHandleDown(e, it)}
                            className="absolute left-1/2 flex h-5 w-5 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border border-foreground bg-background text-foreground shadow active:cursor-grabbing"
                            style={{ top: -34, touchAction: "none", color: "hsl(var(--foreground, 0 0% 10%))" }}
                          >
                            <RotateCw className="h-3 w-3" strokeWidth={2.5} color="#111" />
                          </div>

                        </>
                      )}
                    </div>
                  );
                })}

                {/* marquee */}
                {marqueeRect && (marqueeRect.w > 0 || marqueeRect.h > 0) && (
                  <div
                    className="pointer-events-none absolute border border-primary bg-primary/10"
                    style={{
                      left: cm(marqueeRect.x),
                      top: cm(marqueeRect.y),
                      width: cm(marqueeRect.w),
                      height: cm(marqueeRect.h),
                    }}
                  />
                )}

                {/* ruler overlay */}
                {rulerMode && rulerStart && (() => {
                  const end = rulerEnd ?? rulerHover ?? rulerStart;
                  const dx = end.x - rulerStart.x;
                  const dy = end.y - rulerStart.y;
                  const distCm = Math.sqrt(dx * dx + dy * dy);
                  const midX = (rulerStart.x + end.x) / 2;
                  const midY = (rulerStart.y + end.y) / 2;
                  const ax = cm(rulerStart.x);
                  const ay = cm(rulerStart.y);
                  const bx = cm(end.x);
                  const by = cm(end.y);
                  const lenPx = Math.hypot(bx - ax, by - ay);
                  const angleDeg = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
                  // tick marks every 10cm along the line
                  const tickStep = 10;
                  const tickCount = Math.max(0, Math.floor(distCm / tickStep));
                  const ticks: { x: number; major: boolean }[] = [];
                  for (let i = 1; i <= tickCount; i++) {
                    ticks.push({ x: cm(i * tickStep), major: i % 10 === 0 });
                  }
                  return (
                    <svg
                      className="pointer-events-none absolute inset-0 text-foreground"
                      width={roomPxW}
                      height={roomPxL}
                      style={{ overflow: "visible" }}
                    >
                      <line
                        x1={ax} y1={ay} x2={bx} y2={by}
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeDasharray="2 5"
                        strokeLinecap="round"
                      />
                      <circle cx={ax} cy={ay} r={4} fill="currentColor" />
                      <circle cx={bx} cy={by} r={4} fill="currentColor" />
                      <g transform={`translate(${cm(midX)}, ${cm(midY)})`}>
                        <rect x={-34} y={-24} width={68} height={20} rx={4} fill="white" stroke="currentColor" />
                        <text x={0} y={-10} textAnchor="middle" fontSize={11} fill="currentColor" style={{ fontWeight: 600 }}>
                          {distCm.toFixed(1)} cm
                        </text>
                      </g>
                    </svg>
                  );
                })()}
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {rulerMode ? t.rulerHint : t.hint} {`(1cm ≈ ${scale.toFixed(2)}px)`}
            </p>
            {rulerMode && (rulerStart || rulerEnd) && (
              <Button variant="ghost" size="sm" onClick={clearRuler}>
                <X className="mr-1 h-3 w-3" /> {t.rulerClear}
              </Button>
            )}
          </div>
        </main>

        {/* Right column: Items list */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                {t.items}
                {selectedIds.size > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    · {t.selectedCount(selectedIds.size)}
                  </span>
                )}
              </CardTitle>
              {selectedIds.size > 0 && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={duplicateSelected} title={t.duplicate}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={removeSelected}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground">{t.noItems}</p>
              )}
              {items.map((it) => (
                <div
                  key={it.id}
                  className={
                    "space-y-2 rounded-md border p-2 " +
                    (selectedIds.has(it.id) ? "border-foreground" : "")
                  }
                  onClick={(e) => {
                    if (e.shiftKey) {
                      setSelectedIds((s) => {
                        const n = new Set(s);
                        if (n.has(it.id)) n.delete(it.id);
                        else n.add(it.id);
                        return n;
                      });
                    } else {
                      setSelectedIds(new Set([it.id]));
                    }
                  }}
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
                      title={t.rotation}
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
