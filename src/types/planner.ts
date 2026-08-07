import type React from "react";
import type { TranslationStrings } from "@/lib/planner-translations";
import type { WallOpenInterval } from "@/lib/room-adjacency";
import type { WallSlopeMap } from "@/lib/wall-slopes";

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
  // If set, this item rides on top of another placed item (by id) instead
  // of standing directly on the floor -- lets ANY item (not just the
  // built-in "on-top" layer) be pinned to another regardless of its own
  // layer. The host's id, not a full reference, so it survives JSON
  // export/import and undo/redo snapshots the same way every other
  // id-based relationship in this app already does. While set, the item's
  // OWN `elevation` above is ignored for rendering -- see
  // resolveEffectiveElevation in ThreeDView.tsx, which derives the actual
  // render height from the host's current height + elevation instead, so
  // moving/resizing the host keeps this item visually correct without
  // needing to eagerly rewrite every attached item's own elevation field.
  // Position (x/y), by contrast, IS written directly: use-room-planner.ts's
  // drag handler moves an attached item by the same delta as its host
  // whenever the host is dragged (see onItemPointerDown), and
  // collidesWithOthers (lib/planner-math.ts) exempts a host/child pair from
  // colliding with each other in both directions.
  placedOnId?: string;
  // The size this item was when it came out of the catalog, in cm.
  //
  // Only the *3D render-mode* decision uses it (resolveRenderMode in
  // lib/kit-models.ts), which asks how far the item has been resized from
  // its natural size before a stretched kit model would look wrong. That
  // question needs the size THIS item was added at, and `icon` alone can't
  // answer it: an IKEA "HEMNES Bed (Queen)" and the generic double bed
  // share the icon `bed-double` but are 167x213x66 and 160x200x45
  // respectively. Judged against the generic preset, a HEMNES sat at 1.47x
  // on height the moment it was placed -- already at the edge of the old
  // tolerance, for a reason invisible to the user.
  //
  // Optional: an item saved before this existed falls back to its preset's
  // dimensions, exactly as everything did before.
  catalogDims?: { w: number; h: number; l: number };
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

// A user's own saved catalog entry -- "My Own Catalog" (src/lib/
// custom-catalog.ts) and the built-in IKEA catalog (src/lib/ikea-catalog.ts)
// are BOTH just arrays of this one type, so every UI piece that renders/adds
// one works identically for either source, even though they live in
// different places: My Catalog's own saved items render in
// MyCatalogSection.tsx, while IKEA_CATALOG is folded into the regular
// built-in catalog grid as its own section (see buildCatalogByLayer() in
// lib/custom-catalog.ts, consumed by CatalogSection.tsx). Deliberately
// shaped like a thin diff over an existing Preset rather than a full
// standalone item definition: `sourceKey`, when set, points back at a real
// Preset.key (planner-presets.ts) that this entry's entire visual identity
// (icon, kitModel/proceduralModel, material, layer, shape) is borrowed from --
// see customCatalogItemToPreset() in lib/custom-catalog.ts, which is the one
// place that borrowing happens. That adapter is what lets a placed instance
// of a custom/IKEA item flow through addPreset() completely unchanged and
// come out the other side rendering with the exact same kit-model/procedural
// 3D machinery as any other catalog item -- only name/width/length/color (and,
// for IKEA entries, height) actually differ from the source preset.
// `layer`/`shape` are only ever consulted when `sourceKey` is absent (a
// custom item created with no catalog basis at all, mirroring the existing
// boxless "Custom Item" creator) -- when `sourceKey` IS set, the source
// preset's own layer/shape always win, so a customized item can never end up
// on a different collision layer than the piece it's visually based on.
export interface CustomCatalogItem {
  id: string;
  nameEn: string;
  nameDe: string;
  w: number; // cm
  l: number; // cm
  // Height, in cm. Set by the save dialog from whatever the item measured
  // when it was saved, and by every built-in IKEA entry (where the real
  // product's height differs from its sourceKey's generic preset).
  //
  // This used to be IKEA-only: the save dialog exposed name/width/length/
  // color and nothing else, so a user who resized an item's HEIGHT and saved
  // it got a catalog entry that silently inherited the source preset's
  // height instead. In a planner whose whole point is 3D fit, height is not
  // a lesser dimension than width and length.
  h?: number;
  // Height above the floor, in cm. Same story as `h` -- a wall-mounted
  // sconce saved at 180cm is a different object from one at 150cm, and
  // "where it hangs" is part of what you saved.
  //
  // Absent means "no opinion": the entry falls back to its source preset's
  // elevation, and failing that to the layer's default (see addPreset).
  elevation?: number;
  color: string;
  layer?: ItemLayer;
  shape?: ItemShape;
  sourceKey?: string;
  createdAt: number;
}

/** What seeds the "Save to My Catalog" dialog (SaveToCatalogDialog.tsx) --
 * built by whichever entry point opened it. The only entry point is the
 * Inspector's "Save to My Catalog" action on a selected canvas item
 * (InspectorSection.tsx), plus MyCatalogSection.tsx's own "Edit" action on an
 * already-saved entry -- kept here (not defined in the dialog component
 * itself) for the same reason ExportPreviewData/ImportValidationResult above
 * are: both call sites (InspectorSection, MyCatalogSection) need the shape
 * without importing from each other or from a UI component file. `editingId`
 * set means Save updates that existing My Catalog entry in place; absent
 * means it creates a new one. `sourceKey`/`layer`/`shape` ride along
 * unedited -- the dialog itself only ever exposes name/width/length/color
 * (see customCatalogItemToPreset in lib/custom-catalog.ts for why layer/
 * shape/material/3D model are never independently editable there: they're
 * always inherited from `sourceKey`'s own preset when one is set). */
export interface CatalogSaveDraft {
  editingId?: string;
  name: string;
  w: number;
  l: number;
  /** Seeded with the item's *effective* height and elevation -- the same
   * two numbers the Inspector shows for it, resolved defaults and all --
   * rather than its raw optional fields, so the dialog can't display a blank
   * where the room clearly shows a value. */
  h: number;
  elevation: number;
  color: string;
  sourceKey?: string;
  layer?: ItemLayer;
  shape?: ItemShape;
}

/** Return shape of useCustomCatalog() (hooks/use-custom-catalog.ts) -- kept
 * here rather than in the hook file so every route/component that receives
 * it as a prop (Sidebar, MyCatalogSection) doesn't need to import from the
 * hook module just for its type, mirroring UseRoomPlannerReturn below. */
export interface UseCustomCatalogReturn {
  items: CustomCatalogItem[];
  addItem: (draft: Omit<CustomCatalogItem, "id" | "createdAt">) => CustomCatalogItem;
  updateItem: (id: string, patch: Partial<Omit<CustomCatalogItem, "id" | "createdAt">>) => void;
  removeItem: (id: string) => void;
  /** Wholesale replace -- used by the catalog's own import flow (see
   * MyCatalogSection.tsx's ExportImportDialog usage) once a file has already
   * been validated. */
  replaceAll: (items: CustomCatalogItem[]) => void;
}

export type PlannerView = "2d" | "3d";

/**
 * What "continue where you left off" should reopen. "room" and
 * "single-room" both carry a roomId but resolve against different stores
 * and different routes (see RoomSource below) -- collapsing them into one
 * variant is exactly how a standalone room ends up being reopened inside
 * the multi-room UI.
 *
 * Every variant carries every id its route needs. "room" carries a homeId
 * as well as its roomId because /home/$homeId/room/$roomId needs both, and
 * because searching every home for a room id is exactly the "look it up and
 * guess" pattern the two-stores split exists to avoid (docs/LEARNINGS.md).
 * Which *floor* inside the home isn't recorded: the home route restores its
 * own active floor (see loadActiveFloorId in lib/homes.ts).
 *
 * There used to be a fourth, id-less `{ type: "floor" }` variant, from when
 * there was exactly one implicit building to send someone back to. A stored
 * one is upgraded to `{ type: "home" }` on read -- see normalize() in
 * lib/settings.ts.
 */
export type LastActiveTarget =
  | { type: "room"; roomId: string; homeId: string }
  | { type: "single-room"; roomId: string }
  | { type: "home"; homeId: string };

export interface PlannerSettings {
  lang: Lang;
  /** When true, `/` skips the dashboard and jumps straight to lastActive. */
  quickEntry: boolean;
  defaultView: PlannerView;
  defaultZoom: number;
  collisionDefault: boolean;
  lastActive: LastActiveTarget | null;
}

/** Return shape of useSettings() (hooks/use-settings.ts) -- kept here for
 * the same reason as UseCustomCatalogReturn above: components that only
 * need the type (Header, SettingsDialog, Dashboard) shouldn't have to
 * import the hook module itself. */
export interface UseSettingsReturn {
  settings: PlannerSettings;
  /** False until the real localStorage value has been read (see
   * use-settings.ts's doc comment) -- `settings` is DEFAULT_SETTINGS until
   * then. Callers that need to seed one-time state from `settings` (rather
   * than just render it) should wait for this to flip true first, or they'll
   * capture the SSR-safe placeholder instead of the user's real value. */
  hydrated: boolean;
  update: (patch: Partial<PlannerSettings>) => void;
  recordLastActive: (target: LastActiveTarget) => void;
}

// Rectangular rooms (exactly 4 corners) address a wall by name, as they
// always have. Polygon rooms (hallways with an L/T floor shape, 5+ corners)
// address a wall by its numeric index into `corners` -- see
// src/lib/hallway-shapes.ts for the winding convention and
// resolveWallSegment(), which is the single place both conventions are
// resolved to physical points.
/**
 * What can be put in a wall.
 *
 * "terrace-door" is a glazed door to a garden or balcony -- the thing that
 * separates it from a window is that it's *bodentief*: it starts at the
 * floor instead of on a 90cm sill, and you walk through it, so it swings and
 * eats floor space like a door. See lib/openings.ts, which is where the
 * dimensional difference between the three actually lives.
 */
export type OpeningKind = "door" | "window" | "terrace-door";

export interface Opening {
  id: string;
  wall: "top" | "bottom" | "left" | "right" | number;
  position: number;
  width: number;
  kind: OpeningKind;
  hinge?: "start" | "end"; // doors + terrace doors
  swing?: "in" | "out"; // doors + terrace doors
  /** Terrace doors only: one leaf ("einflügelig") or two ("zweiflügelig").
   * Absent means one -- so every opening saved before terrace doors existed
   * keeps its exact meaning. A two-leaf door swings from both ends, each
   * leaf half the total width. */
  leaves?: 1 | 2;
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
  ceilingHeight?: number;
  wallSlopes?: WallSlopeMap;
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
  // Floor-to-ceiling height in cm. Absent means DEFAULT_CEILING_HEIGHT
  // (lib/wall-slopes.ts) -- which is the 240 the 3D view used to hardcode,
  // so every room saved before this field existed renders exactly as it
  // did. Needed in its own right (2.4m is not universal) and a hard
  // prerequisite for wallSlopes below: "the ceiling is lower over there"
  // is meaningless without a "there" to be lower than.
  ceilingHeight?: number;
  // Sloped ceilings / "Dachschrägen", keyed exactly like `wallColors` (see
  // wallColorKey() in hallway-shapes.ts). Each entry says this wall's
  // ceiling starts at `kneeHeight` and rises to `ceilingHeight` over `run`
  // cm measured perpendicular into the room. Absent = a flat ceiling.
  // Deliberately does NOT touch `corners`: the floor footprint is unchanged
  // by a slope, so collision, adjacency and openings all stay correct
  // without knowing about this. See lib/wall-slopes.ts for the full model.
  wallSlopes?: WallSlopeMap;
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

/**
 * A place someone is planning: a flat, or a house with storeys. Owns 1..N
 * floors, index 0 being ground level.
 *
 * This exists because floors previously had no owner. `planner-multi-floors`
 * was a flat `Floor[]` that *was* the one implicit building, so the dashboard
 * listed its storeys as though each were a separate document and "create a
 * floor plan" quietly appended a storey to the only building there was.
 * A Home is to floors what the single-room store is to rooms: an independent
 * document with its own dashboard row and its own route.
 *
 * Called "Home" rather than "Apartment" because a two-storey house is not an
 * apartment, and rather than "Building" because that reads industrial for a
 * home planner. See docs/HOMES-PROPOSAL.md.
 */
export interface Home {
  id: string;
  /** null means "display the position-based default" -- same convention and
   * the same reasoning as Floor.name above. */
  name: string | null;
  floors: Floor[];
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
  // These three accept an extra `includeCatalog` argument (vs.
  // UseRoomPlannerReturn's own same-named, catalog-agnostic versions below)
  // because Header.tsx's ExportImportDialog instances now offer an "Include
  // My Catalog items" checkbox -- routes/index.tsx (the one place that
  // actually owns both `planner` and `customCatalog`) supplies wrapped
  // versions of use-room-planner.ts's own functions that bundle/extract/
  // merge the customCatalog array on top, so use-room-planner.ts itself
  // stays entirely unaware custom catalogs exist. See lib/custom-catalog.ts's
  // extractBundledCustomCatalog/mergeCustomCatalog.
  buildRoomExportPreview: (includeCatalog: boolean) => ExportPreviewData;
  validateRoomImport: (raw: unknown, includeCatalog: boolean) => ImportValidationResult;
  applyRoomImport: (raw: unknown, includeCatalog: boolean) => void;
  /** Current My Catalog item count -- just for the export checkbox's hint
   * text, so Header.tsx doesn't need the whole customCatalog object. */
  customCatalogCount: number;
  setResetMode: (mode: "items" | "all" | null) => void;
  setTourOpen: (open: boolean) => void;
  setTourStep: (step: React.SetStateAction<number>) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  /** Opens SettingsDialog -- owned by the route (rooms.$roomId.tsx), not by
   * Header itself, same reasoning as every other dialog trigger here. */
  onOpenSettings: () => void;
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
  oKind: OpeningKind;
  setOKind: (kind: OpeningKind) => void;
  /** Terrace doors only -- see Opening.leaves. */
  oLeaves: 1 | 2;
  setOLeaves: (leaves: 1 | 2) => void;
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
  selectedOpeningId: string | null;
  setSelectedOpeningId: React.Dispatch<React.SetStateAction<string | null>>;
  openWalls: Map<string, WallOpenInterval[]>;
  /** Items too tall for the sloped ceiling where they sit -- computed once
   * in useRoomPlanner and shared with the canvas, so the Elements list and
   * the plan can never disagree about what's flagged. */
  slopeIssues: Map<string, SlopeFitIssue>;
  // "My Own Catalog" -- lifted to the route level (not owned by Sidebar
  // itself) because the Inspector's own "Save to My Catalog" action
  // (InspectorSection.tsx, rendered inside CanvasArea) needs to open the
  // exact same dialog/list, and CanvasArea/Sidebar are siblings, not nested.
  // See CanvasAreaProps.openSaveDialog below for the other half.
  customCatalog: UseCustomCatalogReturn;
  openSaveDialog: (draft: CatalogSaveDraft) => void;
  // Manual collapse toggle (see useSidebarCollapsed) -- independent of the
  // automatic useMobileViewOnly cutoff, this owns the grid template on the
  // route itself, so it's threaded through as props rather than local state.
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export interface CanvasAreaProps {
  t: TranslationStrings;
  lang: Lang;
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
  // Room height + sloped ceilings -- see RoomLayout's own doc comments and
  // lib/wall-slopes.ts. The canvas needs both to draw the slope overlay and
  // to work out what fits where.
  ceilingHeight: number;
  setCeilingHeight: React.Dispatch<React.SetStateAction<number>>;
  wallSlopes: WallSlopeMap;
  setWallSlopes: React.Dispatch<React.SetStateAction<WallSlopeMap>>;
  slopeIssues: Map<string, SlopeFitIssue>;
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
  // canvas that navigates here -- "/home/$homeId" for a room opened from a
  // home's floor plan (home.$homeId.room.$roomId.tsx), "/dashboard" for a
  // standalone single room (room.$roomId.tsx), which has no overview to
  // return to.
  // Previously this lived as a small icon-only button in the header
  // instead; see Header.tsx's doc comment on why it moved.
  backUrl?: string;
  // Overrides the pill's default "Back to Overview" wording. Required
  // wherever backUrl doesn't actually point at the multi-room overview --
  // sending someone to the dashboard under an "Overview" label is exactly
  // the single-room/multi-room conflation this route split exists to undo.
  backLabel?: string;
  // Opens the "Save to My Catalog" dialog, prefilled from a draft --
  // threaded down to InspectorSection's "Save to My Catalog" action on a
  // selected item. See SidebarProps.openSaveDialog's doc comment for why
  // this lives at the route level instead of being owned by either side.
  openSaveDialog: (draft: CatalogSaveDraft) => void;
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

/**
 * Which store a room being edited actually lives in -- the two are
 * genuinely separate systems, not two views of one dataset:
 *
 * - "floor": a room on one floor of a Home (lib/homes.ts's
 *   `planner-homes-v1`), edited at /home/$homeId/room/$roomId, aware of its
 *   sibling rooms on that same floor for wall-adjacency purposes. Which
 *   home is never inferred from the room id -- the route passes it.
 * - "single": a standalone room (lib/single-rooms.ts's
 *   `planner-single-rooms`), edited at /room/$roomId. Has no siblings and
 *   no floor to go "back" to.
 *
 * Passed explicitly to useRoomPlanner rather than inferred by looking the
 * id up in both stores: an id-based guess would silently pick the wrong
 * backend if the two ever collided, and "which system am I in" is a fact
 * the route already knows for certain.
 */
export type RoomSource = "floor" | "single";

/** One item that doesn't fit under the sloped ceiling where it currently
 * sits. `required` includes whatever the item is raised by, so something on
 * a desk is measured from the desk's surface. Computed once in
 * useRoomPlanner and shared by the canvas and the Elements list, so the two
 * can never disagree about what's flagged. */
export interface SlopeFitIssue {
  available: number;
  required: number;
  shortfall: number;
}

export interface UseRoomPlannerReturn {
  // State
  lang: Lang;
  setLang: (lang: Lang) => void;
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
  oKind: OpeningKind;
  setOKind: React.Dispatch<React.SetStateAction<OpeningKind>>;
  oLeaves: 1 | 2;
  setOLeaves: React.Dispatch<React.SetStateAction<1 | 2>>;
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
  ceilingHeight: number;
  setCeilingHeight: React.Dispatch<React.SetStateAction<number>>;
  wallSlopes: WallSlopeMap;
  setWallSlopes: React.Dispatch<React.SetStateAction<WallSlopeMap>>;
  slopeIssues: Map<string, SlopeFitIssue>;
}
