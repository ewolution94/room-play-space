import type React from "react";
import type { TranslationStrings } from "@/lib/planner-translations";

export type Lang = "en" | "de";

export type ItemKind = "furniture" | "chair";

// Which "level" an item sits at in the room. "main" items are the
// freestanding furniture that make up most of the catalog and collide with
// each other normally. "under" items (rugs, mats) sit beneath everything
// else and never collide with anything. "on-top" items (lamps, laptops,
// vases) sit on top of a main item (a desk, a table) and also never
// collide -- placement on a valid surface is a visual convention, not an
// enforced constraint. Missing/undefined always means "main", so rooms
// saved before this field existed keep behaving exactly as before.
export type ItemLayer = "under" | "main" | "on-top";

// Visual shape of the item's rendered swatch. The collision footprint is
// always the item's width x length rectangle regardless of shape -- this
// only affects how it's drawn (e.g. a round table renders as an inscribed
// ellipse instead of a rectangle). Missing/undefined means "rect".
export type ItemShape = "rect" | "circle";

export interface Item {
  id: string;
  name: string;
  width: number; // cm
  length: number; // cm
  color: string;
  x: number; // cm from left
  y: number; // cm from top
  rotation: number; // degrees, rotated around center
  kind: ItemKind;
  icon?: string; // preset key, optional
  height?: number; // cm
  elevation?: number; // cm
  layer?: ItemLayer; // defaults to "main"
  shape?: ItemShape; // defaults to "rect"
}

export interface Preset {
  key: string;
  category: string;
  nameEn: string;
  nameDe: string;
  w: number;
  l: number;
  color: string;
  iconUrl?: string;
  h?: number; // default height in cm
  layer?: ItemLayer; // defaults to "main"
  shape?: ItemShape; // defaults to "rect"
}

// Rectangular rooms (exactly 4 corners) address a wall by name, as they
// always have. Polygon rooms (hallways with an L/T floor shape, 5+ corners)
// address a wall by its numeric index into `corners` -- see
// src/lib/hallway-shapes.ts for the winding convention and
// resolveWallSegment(), which is the single place both conventions are
// resolved to physical points.
export interface Opening {
  id: string;
  wall: "top" | "bottom" | "left" | "right" | number;
  position: number;
  width: number;
  kind: "door" | "window";
  hinge?: "start" | "end"; // doors only
  swing?: "in" | "out"; // doors only
  color?: string;
}

export interface Snapshot {
  items: Item[];
  openings: Opening[];
  roomW: number;
  roomL: number;
  corners?: Point[];
  wallColors?: Record<string, string>;
}

export interface RoomLayout {
  id: string;
  name: string;
  width: number; // cm -- for polygon rooms, the shape's bounding-box width
  length: number; // cm -- for polygon rooms, the shape's bounding-box length
  x: number; // overview grid x (cm)
  y: number; // overview grid y (cm)
  rotation: number; // degrees
  color: string; // color of the room
  items: Item[];
  openings: Opening[];
  corners?: Point[];
  wallColors?: Record<string, string>;
  // "hallway" rooms are otherwise ordinary rooms (same data, same
  // furniture/collision/3D handling) -- this only affects labeling/icons in
  // the UI. A hallway may still be a plain rectangle (corners.length === 4,
  // a "straight" hallway) or a polygon (L/T shape, corners.length > 4).
  roomKind?: "room" | "hallway";
}

export interface Point {
  x: number;
  y: number;
}

export interface MarqueeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MarqueeState {
  startCx: number;
  startCy: number;
  addToSelection: boolean;
}

export type DragState =
  | {
      mode: "move";
      ids: string[];
      startMouseX: number;
      startMouseY: number;
      startPos: Map<string, Point>;
    }
  | {
      mode: "rotate";
      id: string;
      centerClientX: number;
      centerClientY: number;
      startAngle: number;
      startRotation: number;
    };

export interface HeaderProps {
  t: TranslationStrings;
  lang: Lang;
  setLang: (lang: Lang) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  items: Item[];
  openings: Opening[];
  exportJSON: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setResetMode: (mode: "items" | "all" | null) => void;
  setTourOpen: (open: boolean) => void;
  setTourStep: (step: React.SetStateAction<number>) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  backUrl?: string;
  roomsUrl?: string;
}

export interface SidebarProps {
  t: TranslationStrings;
  lang: Lang;
  items: Item[];
  openings: Opening[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  nName: string;
  setNName: (name: string) => void;
  nW: number;
  setNW: (width: number) => void;
  nL: number;
  setNL: (length: number) => void;
  nColor: string;
  setNColor: (color: string) => void;
  nLayer: ItemLayer;
  setNLayer: (layer: ItemLayer) => void;
  nShape: ItemShape;
  setNShape: (shape: ItemShape) => void;
  oKind: "door" | "window";
  setOKind: (kind: "door" | "window") => void;
  oWall: Opening["wall"];
  setOWall: (wall: Opening["wall"]) => void;
  oPos: number;
  setOPos: (pos: number) => void;
  oWidth: number;
  setOWidth: (width: number) => void;
  roomW: number;
  roomL: number;
  addPreset: (preset: Preset) => void;
  addCustomBox: () => void;
  addOpening: () => void;
  removeOpening: (id: string) => void;
  removeItem: (id: string) => void;
  threeDActive?: boolean;
  corners: Point[];
  setCorners: React.Dispatch<React.SetStateAction<Point[]>>;
  wallColors: Record<string, string>;
  setWallColors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  selectedOpeningId: string | null;
  setSelectedOpeningId: React.Dispatch<React.SetStateAction<string | null>>;
}

export interface CanvasAreaProps {
  t: TranslationStrings;
  stageRef: React.RefObject<HTMLDivElement | null>;
  scale: number;
  offsetX: number;
  offsetY: number;
  roomPxW: number;
  roomPxL: number;
  cm: (v: number) => number;
  roomW: number;
  roomL: number;
  draftW: string;
  setDraftW: (w: string) => void;
  draftL: string;
  setDraftL: (l: string) => void;
  dirty: boolean;
  applyRoom: (customW?: number, customL?: number) => void;
  collisionEnabled: boolean;
  setCollisionEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  rulerMode: boolean;
  setRulerMode: React.Dispatch<React.SetStateAction<boolean>>;
  openings: Opening[];
  setOpenings: React.Dispatch<React.SetStateAction<Opening[]>>;
  items: Item[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  rulerStart: Point | null;
  rulerEnd: Point | null;
  rulerHover: Point | null;
  clearRuler: () => void;
  marqueeRect: MarqueeRect | null;
  multiSelectMode: boolean;
  setMultiSelectMode: React.Dispatch<React.SetStateAction<boolean>>;
  isPanning: boolean;
  onStagePointerDown: (e: React.PointerEvent) => void;
  onStagePointerMove: (e: React.PointerEvent) => void;
  onStagePointerUp: (e: React.PointerEvent) => void;
  onItemPointerDown: (e: React.PointerEvent, item: Item) => void;
  onRotateHandleDown: (e: React.PointerEvent, item: Item) => void;
  pushHistory: () => void;
  threeDActive: boolean;
  setThreeDActive: React.Dispatch<React.SetStateAction<boolean>>;
  corners: Point[];
  setCorners: React.Dispatch<React.SetStateAction<Point[]>>;
  wallColors: Record<string, string>;
  setWallColors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  selectedOpeningId: string | null;
  setSelectedOpeningId: React.Dispatch<React.SetStateAction<string | null>>;
  zoomFactor: number;
  setZoomFactor: React.Dispatch<React.SetStateAction<number>>;
  isDark: boolean;
  updateItem: (id: string, patch: Partial<Item>, options?: { history?: boolean }) => void;
  removeItem: (id: string) => void;
  duplicateSelected: () => void;
  removeSelected: () => void;
  updateOpening: (id: string, patch: Partial<Opening>) => void;
  removeOpening: (id: string) => void;
}

export interface TourOverlayProps {
  t: TranslationStrings;
  tourOpen: boolean;
  tourStep: number;
  setTourStep: React.Dispatch<React.SetStateAction<number>>;
  closeTour: () => void;
  threeDActive?: boolean;
  setThreeDActive?: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface UseRoomPlannerReturn {
  // State
  lang: Lang;
  setLang: React.Dispatch<React.SetStateAction<Lang>>;
  t: TranslationStrings;
  roomW: number;
  setRoomW: React.Dispatch<React.SetStateAction<number>>;
  roomL: number;
  setRoomL: React.Dispatch<React.SetStateAction<number>>;
  draftW: string;
  setDraftW: React.Dispatch<React.SetStateAction<string>>;
  draftL: string;
  setDraftL: React.Dispatch<React.SetStateAction<string>>;
  dirty: boolean;
  items: Item[];
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
  openings: Opening[];
  setOpenings: React.Dispatch<React.SetStateAction<Opening[]>>;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  rulerMode: boolean;
  setRulerMode: React.Dispatch<React.SetStateAction<boolean>>;
  collisionEnabled: boolean;
  setCollisionEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  rulerStart: Point | null;
  rulerEnd: Point | null;
  rulerHover: Point | null;
  resetMode: "items" | "all" | null;
  setResetMode: React.Dispatch<React.SetStateAction<"items" | "all" | null>>;
  marqueeRect: MarqueeRect | null;
  multiSelectMode: boolean;
  setMultiSelectMode: React.Dispatch<React.SetStateAction<boolean>>;
  isPanning: boolean;
  stageSize: { w: number; h: number };
  scale: number;
  roomPxW: number;
  roomPxL: number;
  offsetX: number;
  offsetY: number;
  canUndo: boolean;
  canRedo: boolean;
  tourOpen: boolean;
  setTourOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tourStep: number;
  setTourStep: React.Dispatch<React.SetStateAction<number>>;
  threeDActive: boolean;
  setThreeDActive: React.Dispatch<React.SetStateAction<boolean>>;
  zoomFactor: number;
  setZoomFactor: React.Dispatch<React.SetStateAction<number>>;

  // Form inputs
  nName: string;
  setNName: React.Dispatch<React.SetStateAction<string>>;
  nW: number;
  setNW: React.Dispatch<React.SetStateAction<number>>;
  nL: number;
  setNL: React.Dispatch<React.SetStateAction<number>>;
  nColor: string;
  setNColor: React.Dispatch<React.SetStateAction<string>>;
  nLayer: ItemLayer;
  setNLayer: React.Dispatch<React.SetStateAction<ItemLayer>>;
  nShape: ItemShape;
  setNShape: React.Dispatch<React.SetStateAction<ItemShape>>;
  oKind: "door" | "window";
  setOKind: React.Dispatch<React.SetStateAction<"door" | "window">>;
  oWall: Opening["wall"];
  setOWall: React.Dispatch<React.SetStateAction<Opening["wall"]>>;
  oPos: number;
  setOPos: React.Dispatch<React.SetStateAction<number>>;
  oWidth: number;
  setOWidth: React.Dispatch<React.SetStateAction<number>>;

  // Refs
  stageRef: React.RefObject<HTMLDivElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  // Helpers / Actions
  cm: (v: number) => number;
  undo: () => void;
  redo: () => void;
  applyRoom: (customW?: number, customL?: number) => void;
  addPreset: (preset: Preset) => void;
  addCustomBox: () => void;
  removeItem: (id: string) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  updateItem: (id: string, patch: Partial<Item>, options?: { history?: boolean }) => void;
  addOpening: () => void;
  removeOpening: (id: string) => void;
  updateOpening: (id: string, patch: Partial<Opening>) => void;
  confirmReset: () => void;
  clearRuler: () => void;
  closeTour: () => void;
  exportJSON: () => void;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onItemPointerDown: (e: React.PointerEvent, item: Item) => void;
  onRotateHandleDown: (e: React.PointerEvent, item: Item) => void;
  onStagePointerDown: (e: React.PointerEvent) => void;
  onStagePointerMove: (e: React.PointerEvent) => void;
  onStagePointerUp: (e: React.PointerEvent) => void;
  pushHistory: () => void;
  corners: Point[];
  setCorners: React.Dispatch<React.SetStateAction<Point[]>>;
  wallColors: Record<string, string>;
  setWallColors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  selectedOpeningId: string | null;
  setSelectedOpeningId: React.Dispatch<React.SetStateAction<string | null>>;
}
