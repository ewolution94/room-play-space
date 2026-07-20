import type { Item, ItemLayer, Lang, Opening, Point, RoomLayout } from "@/types/planner";
import { PRESET_BY_KEY } from "@/lib/planner-presets";
import { buildStraightHallwayCorners } from "@/lib/hallway-shapes";

/**
 * A deliberately-designed, fully-furnished 6-room apartment (plus a
 * connecting hallway) used as the /rooms route's default layout -- replacing
 * the old randomized 2-3 empty rooms with a proper showcase of the catalog's
 * real Kenney kit models and procedural fallback shapes (see kit-models.ts
 * and procedural-models.ts) across every room type. Every room's door sits
 * flush against the hallway with a door opening inside the touching span, so
 * computeRoomConnectivity (room-adjacency.ts) reports the whole apartment as
 * one connected structure and the whole-apartment 3D view is available
 * immediately -- verified by tests/default-apartment.test.ts rather than by
 * hand, since the touching-wall/connectivity math is exact but the
 * hand-placed coordinates below aren't something to eyeball-trust.
 *
 * Every coordinate below is expressed in each room's OWN local space
 * (0..width x 0..length) for items, and in the shared multi-room floor
 * space for room x/y placement -- exactly like every other room in the app.
 */

// A little breathing room around the whole cluster so it doesn't start
// jammed into the master floor plan's top-left corner.
const OFFSET_X = 380;
const OFFSET_Y = 260;

const HALLWAY_WIDTH = 140;
// y of the hallway's own top/bottom walls in the shared floor space --
// chosen so the tallest north-side room (the living room, 380cm deep) still
// clears the floor's own top edge with margin, and the deepest south-side
// room comfortably clears the floor's bottom edge too.
const HALLWAY_Y = 420;
const HALLWAY_BOTTOM_Y = HALLWAY_Y + HALLWAY_WIDTH;

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * Builds an Item from a catalog preset key, pulling width/length/color
 * straight from the preset's own default (Preset.w/l/color) rather than
 * hand-copying those numbers -- guarantees the item's current size exactly
 * matches the preset default, which is what makes resolveRenderMode
 * (kit-models.ts) resolve to "model" (the real Kenney mesh) instead of the
 * envelope fallback, for every preset below that has a kitModel mapping.
 */
function mkItem(
  key: string,
  x: number,
  y: number,
  opts: { rotation?: number; elevation?: number; swapDims?: boolean } = {},
): Item {
  const preset = PRESET_BY_KEY[key];
  if (!preset) throw new Error(`default-apartment.ts: unknown preset key "${key}"`);
  // swapDims: this item has no kitModel/proceduralModel (a plain flat box,
  // e.g. a runner rug), so there's no 3D mesh to distort -- swapping which
  // of the preset's own w/l becomes width/length is a safe, cheap way to
  // lay it out rotated 90 degrees (long axis along the room's x instead of
  // its y) without needing an actual THREE.js rotation.
  const width = opts.swapDims ? preset.l : preset.w;
  const length = opts.swapDims ? preset.w : preset.l;
  const item: Item = {
    id: nextId(key),
    name: preset.nameEn,
    width,
    length,
    color: preset.color,
    x,
    y,
    rotation: opts.rotation ?? 0,
    kind: "furniture",
    icon: key,
  };
  if (preset.layer) item.layer = preset.layer as ItemLayer;
  if (preset.shape) item.shape = preset.shape;
  if (opts.elevation !== undefined) item.elevation = opts.elevation;
  else if (preset.layer === "wall") item.elevation = preset.elevation ?? 150;
  return item;
}

function doorOpening(wall: Opening["wall"], position: number, width = 90): Opening {
  return {
    id: nextId("door"),
    wall,
    position,
    width,
    kind: "door",
    hinge: "start",
    swing: "in",
  };
}

function windowOpening(wall: Opening["wall"], position: number, width: number): Opening {
  return { id: nextId("window"), wall, position, width, kind: "window" };
}

interface RoomSpec {
  name: string;
  color: string;
  width: number;
  length: number;
  x: number;
  y: number;
  openings: Opening[];
  items: Item[];
}

function buildRoom(spec: RoomSpec): RoomLayout {
  return {
    id: nextId("room"),
    name: spec.name,
    width: spec.width,
    length: spec.length,
    x: spec.x,
    y: spec.y,
    rotation: 0,
    color: spec.color,
    items: spec.items,
    openings: spec.openings,
    corners: [
      { x: 0, y: 0 },
      { x: spec.width, y: 0 },
      { x: spec.width, y: spec.length },
      { x: 0, y: spec.length },
    ],
    wallColors: { top: "#f1f5f9", right: "#f1f5f9", bottom: "#f1f5f9", left: "#f1f5f9" },
  };
}

// --- Living room (north row) ---------------------------------------------
const LIVING_W = 420;
const LIVING_L = 380;
function buildLivingRoom(lang: Lang): RoomLayout {
  const doorPos = 165;
  return buildRoom({
    name: lang === "de" ? "Wohnzimmer" : "Living Room",
    color: "#3b82f6",
    width: LIVING_W,
    length: LIVING_L,
    x: OFFSET_X + 50,
    y: OFFSET_Y + HALLWAY_Y - LIVING_L,
    openings: [
      doorOpening("bottom", doorPos),
      windowOpening("top", 40, 160),
      windowOpening("left", 60, 120),
    ],
    items: [
      // Kenney kit models (and the matching procedural furniture families)
      // are authored facing their own local +Z at rotation:0, which in
      // this app means "faces toward larger y" -- see the doc comment on
      // buildDefaultOfficeItems in use-room-planner.ts for how that was
      // confirmed. The sofa backs up to the top wall (y=30, right under
      // the window) so it needs no rotation. The armchair and TV/stand
      // aren't wall-backed the same way, so they're rotated to face the
      // seating cluster instead of blindly facing south.
      mkItem("sofa", 40, 30),
      mkItem("coffee-table", 90, 140),
      // Angled toward the sofa/coffee-table cluster to the west instead of
      // facing south.
      mkItem("armchair", 280, 40, { rotation: 90 }),
      // Only 20cm from the right wall -- faces west into the room (toward
      // the seating) instead of south.
      mkItem("tv-stand", 240, 230, { rotation: 90 }),
      mkItem("rug", 50, 100),
      mkItem("floor-lamp", 380, 140),
      mkItem("plant", 360, 320),
      mkItem("tv-65", 248, 235, { elevation: 45, rotation: 90 }),
      mkItem("table-lamp", 125, 155, { elevation: 45 }),
      mkItem("books-stack", 155, 170, { elevation: 45 }),
    ],
  });
}

// --- Kitchen (north row) ---------------------------------------------------
const KITCHEN_W = 320;
const KITCHEN_L = 300;
function buildKitchen(lang: Lang): RoomLayout {
  return buildRoom({
    name: lang === "de" ? "Küche" : "Kitchen",
    color: "#f59e0b",
    width: KITCHEN_W,
    length: KITCHEN_L,
    x: OFFSET_X + 500,
    y: OFFSET_Y + HALLWAY_Y - KITCHEN_L,
    openings: [doorOpening("bottom", 115), windowOpening("top", 100, 100)],
    items: [
      mkItem("stove", 20, 20),
      mkItem("sink", 90, 20),
      mkItem("fridge", 160, 15),
      mkItem("kitchen-island", 90, 140),
      mkItem("trash-bin", 240, 20),
      // Backed up to the left wall (x=20) -- faces east into the room.
      mkItem("kitchen-wall-cabinet", 20, 90, { rotation: 270 }),
    ],
  });
}

// --- Bathroom (north row) ---------------------------------------------------
const BATH_W = 220;
const BATH_L = 240;
function buildBathroom(lang: Lang): RoomLayout {
  return buildRoom({
    name: lang === "de" ? "Badezimmer" : "Bathroom",
    color: "#06b6d4",
    width: BATH_W,
    length: BATH_L,
    x: OFFSET_X + 850,
    y: OFFSET_Y + HALLWAY_Y - BATH_L,
    openings: [doorOpening("bottom", 70, 80)],
    items: [
      mkItem("shower-stall", 15, 15),
      mkItem("bathroom-sink-vanity", 120, 15),
      mkItem("toilet", 130, 80),
      mkItem("bath-mat", 125, 85),
    ],
  });
}

// --- Bedroom (south row) ----------------------------------------------------
const BED_W = 380;
const BED_L = 340;
function buildBedroom(lang: Lang): RoomLayout {
  return buildRoom({
    name: lang === "de" ? "Schlafzimmer" : "Bedroom",
    color: "#8b5cf6",
    width: BED_W,
    length: BED_L,
    x: OFFSET_X + 50,
    y: OFFSET_Y + HALLWAY_BOTTOM_Y,
    openings: [doorOpening("top", 135), windowOpening("bottom", 130, 120)],
    items: [
      mkItem("wardrobe", 225, 20),
      // The bed's foot (its unrotated "front") sits only 10cm from the
      // bottom wall while the headboard end is 130cm out in the open
      // room -- backwards from how a bed is actually placed. rotation:180
      // puts the headboard against that wall instead, with the foot (and
      // walking space toward the door on the opposite wall) in the open.
      mkItem("bed-double", 110, 130, { rotation: 180 }),
      mkItem("nightstand", 55, 130),
      mkItem("nightstand", 280, 130),
      mkItem("rug-small", 50, 120),
      mkItem("table-lamp", 65, 140, { elevation: 55 }),
      mkItem("plant-small", 290, 140, { elevation: 55 }),
    ],
  });
}

// --- Home office (south row) -------------------------------------------------
const OFFICE_W = 320;
const OFFICE_L = 280;
function buildOffice(lang: Lang): RoomLayout {
  return buildRoom({
    name: lang === "de" ? "Home-Office" : "Home Office",
    color: "#14b8a6",
    width: OFFICE_W,
    length: OFFICE_L,
    x: OFFSET_X + 460,
    y: OFFSET_Y + HALLWAY_BOTTOM_Y,
    openings: [doorOpening("top", 115), windowOpening("bottom", 100, 120)],
    items: [
      mkItem("bookshelf", 20, 20),
      mkItem("chair-office", 130, 110),
      mkItem("desk", 80, 180),
      mkItem("monitor", 100, 190, { elevation: 75 }),
      mkItem("desk-lamp", 200, 190, { elevation: 75 }),
      mkItem("books-stack", 140, 220, { elevation: 75 }),
    ],
  });
}

// --- Dining room (south row) -------------------------------------------------
const DINING_W = 340;
const DINING_L = 300;
function buildDiningRoom(lang: Lang): RoomLayout {
  return buildRoom({
    name: lang === "de" ? "Esszimmer" : "Dining Room",
    color: "#ef4444",
    width: DINING_W,
    length: DINING_L,
    x: OFFSET_X + 810,
    y: OFFSET_Y + HALLWAY_BOTTOM_Y,
    openings: [doorOpening("top", 20), windowOpening("bottom", 110, 140)],
    items: [
      mkItem("sideboard", 180, 20),
      mkItem("dining-table-rect", 90, 140),
      // The table spans y:140-230. These two chairs sit north of it, so
      // they already face the table (south) at the unrotated default.
      mkItem("dining-chair", 110, 85),
      mkItem("dining-chair", 175, 85),
      // These two sit south of the table and need to face north (back
      // toward it) instead of the unrotated default of facing away.
      mkItem("dining-chair", 110, 235, { rotation: 180 }),
      mkItem("dining-chair", 175, 235, { rotation: 180 }),
      mkItem("pendant-light", 155, 170, { elevation: 175 }),
    ],
  });
}

// --- Connecting hallway ------------------------------------------------------
const HALLWAY_LENGTH = 1160;
function buildHallway(lang: Lang): RoomLayout {
  const corners = buildStraightHallwayCorners(HALLWAY_WIDTH, HALLWAY_LENGTH);
  const doorWidth = 90;
  return {
    id: nextId("room"),
    name: lang === "de" ? "Flur" : "Hallway",
    width: HALLWAY_LENGTH,
    length: HALLWAY_WIDTH,
    x: OFFSET_X + 20,
    y: OFFSET_Y + HALLWAY_Y,
    rotation: 0,
    color: "#94a3b8",
    items: [
      mkItem("runner-rug", 455, 35, { swapDims: true }),
      mkItem("coat-rack", 30, 50),
      mkItem("wall-sconce", 210, 2),
      mkItem("wall-sconce", 900, 2),
    ],
    openings: [
      doorOpening("left", Math.round((HALLWAY_WIDTH - doorWidth) / 2), doorWidth),
      doorOpening("right", Math.round((HALLWAY_WIDTH - doorWidth) / 2), doorWidth),
    ],
    corners,
    wallColors: {},
    roomKind: "hallway",
  };
}

/**
 * Builds the fresh 6-room-plus-hallway apartment used as /rooms' default
 * layout. Deterministic (no randomness, unlike the old
 * generateRandomRoomLayout) -- every reload gets the same deliberately
 * composed, fully-furnished floor plan.
 */
export function generateDefaultApartmentLayout(lang: Lang): RoomLayout[] {
  idCounter = 0;
  return [
    buildLivingRoom(lang),
    buildKitchen(lang),
    buildBathroom(lang),
    buildBedroom(lang),
    buildOffice(lang),
    buildDiningRoom(lang),
    buildHallway(lang),
  ];
}
