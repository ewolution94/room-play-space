import type {
  Item,
  ItemLayer,
  Lang,
  Opening,
  Point,
  RoomFlooring,
  RoomLayout,
} from "@/types/planner";
import { PRESET_BY_KEY } from "@/lib/planner-presets";
import { buildStraightHallwayCorners } from "@/lib/hallway-shapes";
import { DEFAULT_FLOORING } from "@/lib/floor-materials";

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
  opts: {
    rotation?: number;
    elevation?: number;
    swapDims?: boolean;
    // Rare escape hatches for the handful of items that are a deliberate
    // resize/recolor away from their catalog default (e.g. a bigger
    // kitchen island, a narrower wardrobe, a differently-painted PC
    // tower) -- everything else keeps deriving width/length/color from
    // the live preset so it never goes stale.
    width?: number;
    length?: number;
    color?: string;
  } = {},
): Item {
  const preset = PRESET_BY_KEY[key];
  if (!preset) throw new Error(`default-apartment.ts: unknown preset key "${key}"`);
  // swapDims: this item has no kitModel/proceduralModel (a plain flat box,
  // e.g. a runner rug), so there's no 3D mesh to distort -- swapping which
  // of the preset's own w/l becomes width/length is a safe, cheap way to
  // lay it out rotated 90 degrees (long axis along the room's x instead of
  // its y) without needing an actual THREE.js rotation.
  const width = opts.width ?? (opts.swapDims ? preset.l : preset.w);
  const length = opts.length ?? (opts.swapDims ? preset.w : preset.l);
  const item: Item = {
    id: nextId(key),
    name: preset.nameEn,
    width,
    length,
    color: opts.color ?? preset.color,
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
  flooring?: RoomFlooring;
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
    flooring: spec.flooring ?? { ...DEFAULT_FLOORING },
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
      mkItem("sofa", 16.5569247483989, 18.069318961573657),
      mkItem("coffee-table", 79.72209515096066, 151.69165999542543),
      mkItem("armchair", 293.41913026075025, 33.30741079597439, {
        rotation: 35.97467566958363,
      }),
      mkItem("tv-stand", 13.901032136322058, 325.83928979871916, { rotation: 180 }),
      mkItem("rug", 28.47452538883806, 121.53905535224152),
      mkItem("floor-lamp", 379.932096294602, 119.3572735590119),
      mkItem("plant", 360, 320),
      mkItem("tv-65", 22.053136436413524, 338.7541456999085, {
        rotation: 180,
        elevation: 45,
      }),
      mkItem("table-lamp", 85.55473753430924, 168.16924462488564, { elevation: 45 }),
      mkItem("books-stack", 146.30017726440988, 160.90769384720952, { elevation: 45 }),
    ],
    flooring: { key: "wood-herringbone", color: "#a9744f" },
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
    openings: [doorOpening("bottom", 115), windowOpening("top", 126.21755758570583, 100)],
    items: [
      mkItem("stove", 119.11725182982616, 6.072592634949679),
      mkItem("sink", 183.01663998170173, 5.22665542086002),
      mkItem("fridge", 245.98431781793226, 4.369496225983532),
      // Sized up from the 120x80 catalog default -- a deliberate bigger
      // island for this layout.
      mkItem("kitchen-island", 87.77620620526343, 128.45216551854045, {
        width: 140,
        length: 100,
      }),
      mkItem("trash-bin", 52.28159393331899, 5.9118942064474425),
      mkItem("kitchen-wall-cabinet", -19.499999999999993, 26.506461573650505, {
        rotation: 270,
      }),
      mkItem("kitchen-wall-cabinet", -19.499999999999993, 107.85857529196491, {
        rotation: 270,
      }),
      mkItem("toaster", 183.16009297131478, 149.75525402292664, {
        rotation: 28.26814763817356,
        elevation: 90,
      }),
      mkItem("stand-mixer", 99.00658939239007, 191.3829583983639, { elevation: 90 }),
    ],
    flooring: { key: "tile-large", color: "#dcdad5" },
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
      mkItem("shower-stall", 3.5072621225983482, 3.491822964318388),
      mkItem("bathroom-sink-vanity", 118.62076852698993, 7.7676120768527),
      mkItem("toilet", 159.06593092406223, 176.93218206770356, { rotation: 90 }),
      mkItem("bath-mat", 128.09040484903934, 62.0145242451967),
      mkItem("vanity-mirror", 122.65433440073195, 3),
      mkItem("towel-rack", -20.78573879231473, 160.99062214089665, { rotation: 270 }),
    ],
    flooring: { key: "tile-square", color: "#e8e6e1" },
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
      // Narrowed from the 150cm catalog default -- a deliberate slimmer
      // wardrobe for this layout.
      mkItem("wardrobe", 4.8179322964318345, 4.688286253430924, { width: 130 }),
      mkItem("bed-double", 142.3160881747484, 135.04395871454713, { rotation: 180 }),
      mkItem("nightstand", 95.1681867566331, 294.29015610704477, { rotation: 180 }),
      mkItem("nightstand", 304.88442074565415, 294.7081570219579, { rotation: 180 }),
      mkItem("rug-small", 72.11151932753887, 185.2044973696249, { rotation: 90 }),
      mkItem("table-lamp", 97.69399016468435, 307.83951852698993, { elevation: 55 }),
      mkItem("plant-small", 327.2385349954254, 312.86768069533395, { elevation: 55 }),
      mkItem("rug-small", 280.17726440988105, 183.72764181152792, { rotation: 90 }),
      mkItem("bedside-bench", 169.299962831656, 94.44134549405305),
    ],
    flooring: { key: "carpet-plush", color: "#a9998a" },
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
      mkItem("bookshelf", 4.738534995425432, 4.600440301921317),
      mkItem("chair-office", 142.38443915087268, 128.4569419030192, {
        rotation: 14.556701930061536,
      }),
      mkItem("desk", 97.41193961573649, 198.50644013037513, { rotation: 180 }),
      mkItem("monitor", 148.111490736505, 246.2568261093321, {
        rotation: 180,
        elevation: 75,
      }),
      mkItem("desk-lamp", 230.31929037053982, 243.9622526875572, { elevation: 75 }),
      mkItem("bookshelf", 235.1445276761208, 4.821248856358647),
      mkItem("planter-tall", 274.2483417200366, 234.67586344922233),
      // Recolored from the catalog's dark-slate default to a lighter gray
      // metal for this layout.
      mkItem("pc-tower", 72.71707742451967, 206.05834715233306, { color: "#6c757d" }),
      mkItem("computer-keyboard", 166.08558011207685, 211.06392240393413, {
        rotation: 180,
        elevation: 75,
      }),
      mkItem("computer-mouse", 144.20432582342175, 213.21915027447395, {
        rotation: 159.9423079725584,
        elevation: 75,
      }),
      mkItem("filing-cabinet", -4.499999999999993, 81.84156278591034, { rotation: 270 }),
    ],
    flooring: { key: "concrete-polished", color: "#a8adb4" },
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
      mkItem("sideboard", 196.0996111619396, 4.439687214089663),
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
    flooring: { key: "wood-hardwood", color: "#8b5a2b" },
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
      mkItem("coat-rack", 108.46185200668899, 7.895746237458194),
      mkItem("wall-sconce", 300.45678302675583, 3),
      mkItem("wall-sconce", 839.2570025083612, 3),
      mkItem("shoe-rack", 361.47794732441474, 3),
      mkItem("router-box", 414.7072533444816, 9.40739966555184, { elevation: 60 }),
      mkItem("table-lamp", 364.7437813545151, 4.03051839464883, { elevation: 60 }),
    ],
    openings: [
      doorOpening("left", Math.round((HALLWAY_WIDTH - doorWidth) / 2), doorWidth),
      doorOpening("right", Math.round((HALLWAY_WIDTH - doorWidth) / 2), doorWidth),
    ],
    corners,
    wallColors: {},
    roomKind: "hallway",
    flooring: { key: "wood-laminate", color: "#c9a06b" },
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
