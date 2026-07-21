import type React from "react";
import type { TranslationStrings } from "@/lib/planner-translations";
import type { WallOpenInterval } from "@/lib/room-adjacency";

export type Lang = "en" | "de";

export type ItemKind = "furniture" | "chair";

// Which "level" an item sits at in the room. "main" items are the
// freestanding furniture that make up most of the catalog and collide with
// each other normally. "under" items (rugs, mats) sit beneath everything
// else and never collide with anything. "on-top" items (lamps, laptops,
// vases) sit on top of a main item (a desk, a table) and also never
// collide -- placement on a valid surface is a visual convention, not an
// enforced constraint. "wall" items (sconces, art, mirrors, pendant
// lights) are mounted on a wall at a fixed height regardless of what's on
// the floor beneath them: like "on-top" they never collide with anything
// (see collidesWithOthers in planner-math.ts, which already treats any
// non-"main" layer this way) and are excluded from findOnTopHost/
// computeOnTopElevation's auto-settle-onto-furniture behavior (which only
// ever looks at "on-top" items -- see the pointer-up handler in
// use-room-planner.ts), so dragging a wall item never resets its elevation
// to the floor or to whatever furniture happens to be under it. Missing/
// undefined always means "main", so rooms saved before this field existed
// keep behaving exactly as before.
export type ItemLayer = "under" | "main" | "on-top" | "wall";

// Visual shape of the item's rendered swatch. The collision footprint is
// always the item's width x length rectangle regardless of shape -- this
// only affects how it's drawn (e.g. a round table renders as an inscribed
// ellipse instead of a rectangle). Missing/undefined means "rect".
export type ItemShape = "rect" | "circle";

// Shared shapes for the ExportImportDialog component (see
// src/components/planner/ExportImportDialog.tsx) -- kept here rather than
// defined in that component file so both it and every route/hook that
// feeds it data (use-room-planner.ts, rooms.index.tsx) can reference the
// same types without the data layer importing from a UI component.

/** One selectable export/import target the dialog can offer -- e.g. "This
 * room" vs "Current floor" vs "All floors". A caller with only one valid
 * scope (the single-room editor) passes an array of length 1; the
 * dialog's scope picker just doesn't render in that case. */
export interface ExportImportScope {
  id: string;
  label: string;
}

/** What a `buildExport` function returns: enough for the dialog to show a
 * human-readable preview AND the exact JSON it'll download, without the
 * dialog needing to know anything about rooms/items/floors itself. */
export interface ExportPreviewData {
  summaryLines: string[];
  filename: string;
  json: unknown;
}

/** What a `validateImport` function returns -- either a preview-ready
 * summary, or a human-readable reason the file can't be imported. */
export type ImportValidationResult =
  | { ok: true; summaryLines: string[] }
  | { ok: false; error: string };

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

// Explicit surface-material hint for the 3D view (see ThreeDView.tsx's
// materialForPreset), replacing an earlier version that *guessed* a
// material from keywords in the item's icon key/name -- that heuristic had
// real gaps (several wood/fabric/metal pieces fell through to a flat
// generic material) and at least one outright bug (a bed-frame keyword
// match made "bunk-bed" render in upholstery fabric). Every preset below
// sets this explicitly. `undefined` (only ever true for legacy custom
// boxes, which have no catalog key at all) falls back to a plain
// MeshStandardMaterial with no procedural texture.
export type PresetMaterial =
  | "wood"
  | "fabric"
  | "leather"
  | "metal"
  | "ceramic"
  | "stone"
  | "glass"
  | "plant"
  | "rug"
  | "plastic";

// A room's floor surface -- fully separate from the pre-existing "Floor"
// building-level concept (Floor.rooms in this same file, edited via the
// FloorSwitcher). This is the visual floor MATERIAL rendered under a
// room's furniture in both the 2D canvas and 3D view. See
// src/lib/floor-materials.ts for the actual catalog (FLOOR_MATERIALS) of
// family x pattern combinations this `key` can reference, and
// src/lib/floor-pattern-svg.tsx / src/lib/floor-textures.ts for the
// procedural 2D SVG / 3D canvas-texture renderers keyed off `family` +
// `pattern`.
export type FloorFamily = "wood" | "concrete" | "tile" | "carpet" | "plain";

export type FloorPattern =
  | "laminate"
  | "hardwood"
  | "herringbone"
  | "polished"
  | "raw"
  | "square-tile"
  | "large-tile"
  | "checkerboard"
  | "plush"
  | "flat";

// A room's chosen floor material + a freely-picked tint color. `key` looks
// up a FloorMaterialOption in FLOOR_MATERIALS (floor-materials.ts) for its
// family/pattern; `color` is applied on top (the pattern's linework/grain
// is derived from this color via shadeColor(), not baked into the option
// itself), which is what lets every material be recolored freely rather
// than only offering a fixed palette. Optional on RoomLayout so rooms
// saved before this feature existed keep rendering (see
// DEFAULT_FLOORING in floor-materials.ts for the fallback).
export interface RoomFlooring {
  key: string;
  color: string;
}

// A real, extracted Kenney Furniture Kit (CC0) model available to render in
// place of the flat procedural box, for presets where a kit model is a good
// silhouette/proportion match (see the mapping built into PRESETS in
// planner-presets.ts -- roughly 70 of ~130 presets have one; the rest keep
// the box, either because the kit has no matching piece or because scaling
// one to this preset's shape would visibly distort it).
//
// `file` names a .glb copied into public/models/kenney/, loaded via
// GLTFLoader at runtime (see ThreeDView.tsx). min/max are that model's OWN
// bounding box, in cm, read directly from its glTF accessor min/max --
// Kenney authors each piece with its floor-contact corner at/near the local
// origin rather than centered (confirmed by inspecting every mapped file),
// so these are NOT symmetric around 0 in general. ThreeDView.tsx uses them
// to position a scaled instance so its actual geometry -- not some assumed
// centered box -- lines up exactly with the item's own x/y footprint and
// floor elevation. See src/lib/kit-models.ts for the scale-envelope logic
// that decides, per placed item, whether the model still looks acceptable
// at that item's current width/length/height or should fall back to the box.
export interface KitModel {
  file: string;
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

// A low-poly procedural shape to render instead of the flat box, for
// presets with no matching Kenney kit model (see src/lib/procedural-models.ts
// for the actual generator functions and the reasoning behind the
// part/color-offset schema). `family` must be a key of
// PROCEDURAL_GENERATORS there -- checked by a catalog-integrity test rather
// than the type system, since a plain string keeps this file free of a
// dependency on procedural-models.ts's generator implementations. `params`
// are small per-preset knobs (leg thickness, number of drawer lines, lamp
// mount type, ...) forwarded verbatim to that family's generator.
export interface ProceduralModel {
  family: string;
  params?: Record<string, number | boolean | string>;
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
  material?: PresetMaterial;
  // Default mount height (cm) for a "wall" layer preset (see ItemLayer) --
  // e.g. a sconce sits higher than a towel rack. Ignored for every other
  // layer. Falls back to WALL_MOUNT_DEFAULT_ELEVATION (use-room-planner.ts)
  // when a "wall" preset doesn't specify its own.
  elevation?: number;
  // Optional real 3D model to render instead of the box -- see KitModel above.
  kitModel?: KitModel;
  // Optional procedural low-poly shape to render instead of the box, for
  // presets kitModel didn't cover -- see ProceduralModel above. Ignored if
  // kitModel is also set and currently resolving to "model" (see
  // resolveRenderMode/kit-models.ts) -- kitModel always takes priority when
  // usable; this is the fallback below it, one step above the plain box.
  proceduralModel?: ProceduralModel;
  // True for lamp/ceiling-light/sconce-style presets that can actually
  // emit light in the 3D view's toggleable lighting feature (see
  // ThreeDView.tsx's "Enable Lighting" option and per-item light toggle).
  // Purely a 3D-view-session concern -- whether a given placed instance's
  // light is currently on/off is local UI state there, not persisted room
  // data, so this flag only needs to say "this preset CAN light up", not
  // track any on/off state itself.
  isLightSource?: boolean;
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
  flooring?: RoomFlooring;
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
  // Floor surface material + tint -- see RoomFlooring above. Missing/
  // undefined (rooms saved before this field existed) falls back to
  // DEFAULT_FLOORING (floor-materials.ts) wherever this is rendered.
  flooring?: RoomFlooring;
  // "hallway" rooms are otherwise ordinary rooms (same data, same
  // furniture/collision/3D handling) -- this only affects labeling/icons in
  // the UI. A hallway may still be a plain rectangle (corners.length === 4,
  // a "straight" hallway) or a polygon (L/T shape, corners.length > 4).
  roomKind?: "room" | "hallway";
  // Explicit per-wall overrides for the "0-4 walls" feature (rooms can have
  // any subset of their walls removed to merge with a touching neighbor into
  // one continuous space). Keyed exactly like `wallColors` (see
  // wallColorKey() in hallway-shapes.ts: named for a 4-corner room, numeric
  // index for a polygon room). `true` forces a wall open regardless of
  // adjacency, `false` forces it closed even if it's touching a neighbor,
  // and an absent key means "let auto-detected adjacency decide" -- see
  // computeAutoOpenWalls() in room-adjacency.ts. Collision, furniture
  // clamping, and each room's own footprint are entirely unaffected by this
  // -- it is purely which wall segments get drawn/extruded and which walls
  // can host a door/window.
  wallOverrides?: Record<string, boolean>;
}

// A single story of the building (e.g. "Ground Floor", "1st Floor"). Each
// floor owns its own independent set of rooms -- room-to-room adjacency,
// wall-touching detection, and the whole-apartment 3D view (see
// room-adjacency.ts) are all scoped to a single floor's rooms only, since
// two floors never share a physical wall. The array order in
// MultiRoomState.floors below IS the building's vertical stacking order
// (index 0 = lowest), which both the floor-switcher pill tabs (left-to-
// right) and the switch-direction animation (see FloorSwitcher.tsx /
// MultiRoomCanvas.tsx) rely on directly.
export interface Floor {
  id: string;
  // null means "not renamed -- display the position-based default name
  // (see defaultFloorName/floorDisplayName in lib/floors.ts)", which is
  // recomputed from this floor's current index and the active UI language
  // every render, so it re-translates automatically on a language switch
  // and re-numbers automatically after a reorder. Only ever becomes a
  // string once the user explicitly renames the floor via the manage
  // popover -- from that point on it's a fixed custom name, untranslated.
  name: string | null;
  rooms: RoomLayout[];
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
  buildRoomExportPreview: () => ExportPreviewData;
  validateRoomImport: (raw: unknown) => ImportValidationResult;
  applyRoomImport: (raw: unknown) => void;
  setResetMode: (mode: "items" | "all" | null) => void;
  setTourOpen: (open: boolean) => void;
  setTourStep: (step: React.SetStateAction<number>) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  roomsUrl?: string;
  /** Mobile "view only" mode (see useMobileViewOnly) -- strips the header
   * down to just identity + theme/language + navigation, since every
   * editing action (undo/redo/import/export/reset/tour) is meaningless
   * when there's no sidebar or tools to act on. */
  viewOnly?: boolean;
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
  openWalls: Map<string, WallOpenInterval[]>;
  flooring: RoomFlooring;
  setFlooring: React.Dispatch<React.SetStateAction<RoomFlooring>>;
}

export interface CanvasAreaProps {
  t: TranslationStrings;
  stageRef: React.RefObject<HTMLDivElement | null>;
  stageReady: boolean;
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
  // True while Control is held down -- see use-ctrl-held.ts. Temporarily
  // activates multi-select the same as multiSelectMode, without touching
  // its persisted checkbox state.
  ctrlHeld: boolean;
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
  flooring: RoomFlooring;
  setFlooring: React.Dispatch<React.SetStateAction<RoomFlooring>>;
  zoomFactor: number;
  setZoomFactor: React.Dispatch<React.SetStateAction<number>>;
  isDark: boolean;
  updateItem: (id: string, patch: Partial<Item>, options?: { history?: boolean }) => void;
  removeItem: (id: string) => void;
  duplicateSelected: () => void;
  removeSelected: () => void;
  updateOpening: (id: string, patch: Partial<Opening>) => void;
  removeOpening: (id: string) => void;
  // Wall keys (wallColorKey() format) that are effectively open -- merges
  // this room's own wallOverrides with adjacency auto-detected against its
  // siblings in the multi-room overview. See room-adjacency.ts.
  openWalls: Map<string, WallOpenInterval[]>;
  // When set, renders a labeled "back" pill at the bottom-left of the
  // canvas that navigates here -- e.g. "/rooms", for a single room opened
  // from the multi-room overview (see rooms.$roomId.tsx). Undefined on the
  // standalone single-room planner route, which has no overview to return
  // to. Previously this lived as a small icon-only button in the header
  // instead; see Header.tsx's doc comment on why it moved.
  backUrl?: string;
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
  ctrlHeld: boolean;
  isPanning: boolean;
  stageSize: { w: number; h: number };
  stageReady: boolean;
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
  buildRoomExportPreview: () => ExportPreviewData;
  validateRoomImport: (raw: unknown) => ImportValidationResult;
  applyRoomImport: (raw: unknown) => void;
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
  openWalls: Map<string, WallOpenInterval[]>;
  flooring: RoomFlooring;
  setFlooring: React.Dispatch<React.SetStateAction<RoomFlooring>>;
}
