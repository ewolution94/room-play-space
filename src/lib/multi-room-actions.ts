import type { Lang, Opening, Point, RoomLayout } from "@/types/planner";
import { rectCorners, rectilinearPolygonsOverlap } from "@/lib/planner-math";
import { globalCorners } from "@/lib/room-adjacency";
import { DEFAULT_FLOORING } from "@/lib/floor-materials";
import {
  rotatePolygonCorners,
  polygonBoundingBox,
  buildStraightHallwayCorners,
  buildLHallwayCorners,
  buildTHallwayCorners,
  type HallwayShape,
} from "@/lib/hallway-shapes";

// Shared helpers for the multi-room master floor plan.
// Previously this logic (rotate / duplicate / delete a room, plus the
// collision-aware placement scan) was copy-pasted into both
// MultiRoomCanvas.tsx and MultiRoomSidebar.tsx. Keeping a single copy here
// avoids the two views drifting apart when the placement/rotation behavior
// needs to change.

export const FLOOR_W = 2000; // cm, virtual master-plan workspace width
export const FLOOR_L = 1500; // cm, virtual master-plan workspace length

// Room-vs-room collision uses each room's REAL shape (globalCorners --
// local `corners` translated by x/y, with rotation already baked in via
// rotateRoomLayout's width/length swap + corner rebuild, never re-applied
// as an angular transform here) fed through rectilinearPolygonsOverlap, so
// an L/T-shaped hallway's collision footprint matches its visual silhouette
// exactly instead of its rectangular bounding box -- a plain room can now
// be placed directly into the notch/leg of an L or T shape. A plain
// rectangular room's globalCorners already IS its bounding box, so this is
// behavior-identical to the old OBB-based check for every non-hallway room.
// (Item-vs-item collision in planner-math.ts is unrelated and still
// correctly uses each item's real rotation, since items *are* visually
// CSS-rotated in place, unlike rooms.)
function roomOverlap(
  a: Pick<RoomLayout, "x" | "y" | "width" | "length" | "corners">,
  b: Pick<RoomLayout, "x" | "y" | "width" | "length" | "corners">,
): boolean {
  return rectilinearPolygonsOverlap(globalCorners(a), globalCorners(b));
}

/**
 * Rotates a single room 90° clockwise, rotating its openings and items with
 * it. Plain rectangular rooms (corners.length === 4, the overwhelming
 * common case) keep the exact original swap-based implementation --
 * unchanged, zero regression risk. Polygon rooms (L/T-shaped hallways, 5+
 * corners) use a genuinely different algorithm: rotate every corner point
 * (and every item) about the shape's own bounding-box center. That's
 * provably equivalent to the swap-based approach for a rectangle (see the
 * rotatePolygonCorners tests in hallway-shapes.test.ts), and it generalizes
 * correctly to any polygon -- wall indices and opening `position` values
 * don't need remapping at all under rotation, only the corner points move.
 */
export function rotateRoomLayout(
  rooms: RoomLayout[],
  roomId: string,
  collisionEnabled: boolean,
): RoomLayout[] {
  return rooms.map((r) => {
    if (r.id !== roomId) return r;

    const nextRotation = (r.rotation + 90) % 360;
    const isPolygon = !!r.corners && r.corners.length !== 4;

    let nextW: number;
    let nextL: number;
    let rotatedOpenings = r.openings;
    let nextCorners: Point[];

    if (isPolygon) {
      const rotated = rotatePolygonCorners(r.corners!);
      const bb = polygonBoundingBox(rotated);
      // rotatePolygonCorners deliberately preserves the shape's bounding-box
      // CENTER (a rigid rotation about its own middle), not its top-left --
      // so the raw result's bounding box generally does NOT start back at
      // (0,0) in local room space (e.g. it can come out as x:[20,280]
      // instead of [0,260]). Every other consumer of a room's `corners`
      // (single-room rendering's viewBox, this same function's own
      // width/height fields below, and globalCorners()'s room-vs-room
      // collision math) assumes local corners span exactly [0,width] x
      // [0,length] -- so the rotated shape must be re-anchored to (0,0)
      // here, the same way the plain-rectangle branch below always rebuilds
      // its corners fresh at (0,0).
      nextCorners = rotated.map((c) => ({ x: c.x - bb.minX, y: c.y - bb.minY }));
      nextW = bb.width;
      nextL = bb.height;
      // Openings are untouched: numeric wall index + position stay valid
      // across rotation (see hallway-shapes.ts).
    } else {
      nextW = r.length;
      nextL = r.width;
      rotatedOpenings = r.openings.map((op) => {
        let newWall = op.wall;
        let newPosition = op.position;
        if (op.wall === "top") {
          newWall = "right";
          newPosition = op.position;
        } else if (op.wall === "right") {
          newWall = "bottom";
          newPosition = r.length - op.position - op.width;
        } else if (op.wall === "bottom") {
          newWall = "left";
          newPosition = op.position;
        } else if (op.wall === "left") {
          newWall = "top";
          newPosition = r.length - op.position - op.width;
        }
        return { ...op, wall: newWall, position: Math.max(0, newPosition) };
      });
      // Rebuilt fresh from the new width/length rather than carried over
      // stale from before rotation -- corners aren't read anywhere in the
      // multi-room overview, but the single-room detail view uses them
      // directly, and they need to match the room's new orientation the
      // moment you enter it, not just after the next width/length edit.
      nextCorners = [
        { x: 0, y: 0 },
        { x: nextW, y: 0 },
        { x: nextW, y: nextL },
        { x: 0, y: nextL },
      ];
    }

    const rotatedItems = r.items.map((item) => {
      const newX = r.length - (item.y + item.length);
      const newY = item.x;
      return {
        ...item,
        x: Math.max(0, newX),
        y: Math.max(0, newY),
        width: item.length,
        length: item.width,
        rotation: (item.rotation + 90) % 360,
      };
    });

    const candidate: RoomLayout = {
      ...r,
      rotation: nextRotation,
      width: nextW,
      length: nextL,
      openings: rotatedOpenings,
      items: rotatedItems,
      corners: nextCorners,
    };

    const hasCollision =
      collisionEnabled && rooms.some((other) => other.id !== r.id && roomOverlap(candidate, other));

    return hasCollision ? r : candidate;
  });
}

/** Finds a collision-free spot for a room-sized box, scanning the master grid. */
function findFreeRoomSpot(
  rooms: RoomLayout[],
  width: number,
  length: number,
  preferred?: { x: number; y: number },
): { x: number; y: number } {
  const margin = 30; // cm gap kept between rooms

  const overlapsAny = (x: number, y: number) => {
    // Padded box uses the OTHER room's real shape (globalCorners), so a new
    // room can be auto-placed right into an existing hallway's notch
    // instead of being pushed away from its rectangular bounding box.
    const padded = rectCorners({
      x: x - margin,
      y: y - margin,
      width: width + margin * 2,
      length: length + margin * 2,
    });
    return rooms.some((other) => rectilinearPolygonsOverlap(padded, globalCorners(other)));
  };

  if (preferred && preferred.x + width <= FLOOR_W - 50 && preferred.y + length <= FLOOR_L - 50) {
    if (!overlapsAny(preferred.x, preferred.y)) return preferred;
  }

  const stepX = Math.max(60, Math.round(width / 3));
  const stepY = Math.max(60, Math.round(length / 3));

  for (let cy = 50; cy + length <= FLOOR_L - 50; cy += stepY) {
    for (let cx = 50; cx + width <= FLOOR_W - 50; cx += stepX) {
      if (!overlapsAny(cx, cy)) return { x: cx, y: cy };
    }
  }

  // Fallback: stack below everything else
  const maxY = rooms.reduce((m, r) => Math.max(m, r.y + r.length), 0);
  return { x: 50, y: maxY + margin };
}

/** Builds a duplicate of the given room placed in the nearest free spot, or null if the room doesn't exist. */
export function duplicateRoomLayout(
  rooms: RoomLayout[],
  roomId: string,
  lang: Lang,
): RoomLayout | null {
  const source = rooms.find((r) => r.id === roomId);
  if (!source) return null;

  const margin = 30;
  const preferred = { x: source.x + source.width + margin, y: source.y };
  const spot = findFreeRoomSpot(rooms, source.width, source.length, preferred);

  return {
    ...JSON.parse(JSON.stringify(source)),
    id: crypto.randomUUID(),
    name: `${source.name} (${lang === "de" ? "Kopie" : "Copy"})`,
    x: spot.x,
    y: spot.y,
  };
}

/** Builds a brand-new room placed in the nearest free spot (or at an explicit x/y if given). */
export function createRoomLayout(
  rooms: RoomLayout[],
  opts: { name: string; width: number; length: number; color: string; x?: number; y?: number },
): RoomLayout {
  const spot =
    opts.x !== undefined && opts.y !== undefined
      ? { x: opts.x, y: opts.y }
      : findFreeRoomSpot(rooms, opts.width, opts.length);

  return {
    id: crypto.randomUUID(),
    name: opts.name,
    width: opts.width,
    length: opts.length,
    x: spot.x,
    y: spot.y,
    rotation: 0,
    color: opts.color,
    items: [],
    openings: [
      {
        id: crypto.randomUUID(),
        wall: "bottom",
        position: Math.max(10, Math.round((opts.width - 90) / 2)),
        width: 90,
        kind: "door",
        hinge: "start",
        swing: "in",
      },
    ],
    corners: [
      { x: 0, y: 0 },
      { x: opts.width, y: 0 },
      { x: opts.width, y: opts.length },
      { x: 0, y: opts.length },
    ],
    wallColors: {
      top: "#f1f5f9",
      right: "#f1f5f9",
      bottom: "#f1f5f9",
      left: "#f1f5f9",
    },
    flooring: { ...DEFAULT_FLOORING },
  };
}

export function removeRoomLayout(rooms: RoomLayout[], roomId: string): RoomLayout[] {
  return rooms.filter((r) => r.id !== roomId);
}

/**
 * Builds a new hallway room. "straight" is just a plain rectangle (stays on
 * the existing 4-corner/named-wall path entirely); "l"/"l-mirrored"/"t" are
 * true polygon rooms built from the hallway-shapes.ts corner templates.
 * Every shape gets a door pre-placed on each open "end" instead of the
 * single door + no windows a plain room starts with, since a hallway's
 * whole purpose is connecting to other rooms at each end. Every end wall is
 * exactly `armWidth` long by construction (see hallway-shapes.test.ts), so
 * a single door width/position centers correctly on any of them.
 */
export function createHallwayLayout(
  rooms: RoomLayout[],
  opts: {
    name: string;
    shape: HallwayShape;
    armWidth: number;
    // "straight": legX = total length (legY unused).
    // "l"/"l-mirrored": legX/legY = each arm's full extent.
    // "t": legX = bar length, legY = stem length.
    legX: number;
    legY: number;
    color: string;
    x?: number;
    y?: number;
  },
): RoomLayout {
  let corners: Point[];
  let doorWalls: Opening["wall"][];

  if (opts.shape === "straight") {
    corners = buildStraightHallwayCorners(opts.armWidth, opts.legX);
    doorWalls = ["left", "right"];
  } else if (opts.shape === "t") {
    const tpl = buildTHallwayCorners(opts.armWidth, opts.legX, opts.legY);
    corners = tpl.corners;
    doorWalls = tpl.endWalls;
  } else {
    const tpl = buildLHallwayCorners(
      opts.armWidth,
      opts.legX,
      opts.legY,
      opts.shape === "l-mirrored",
    );
    corners = tpl.corners;
    doorWalls = tpl.endWalls;
  }

  const bb = polygonBoundingBox(corners);
  const width = bb.width;
  const length = bb.height;

  const doorWidth = Math.min(90, Math.max(40, opts.armWidth - 20));
  const doorPos = Math.max(0, Math.round((opts.armWidth - doorWidth) / 2));

  const openings: Opening[] = doorWalls.map((wall) => ({
    id: crypto.randomUUID(),
    wall,
    position: doorPos,
    width: doorWidth,
    kind: "door",
    hinge: "start",
    swing: "in",
  }));

  const spot =
    opts.x !== undefined && opts.y !== undefined
      ? { x: opts.x, y: opts.y }
      : findFreeRoomSpot(rooms, width, length);

  return {
    id: crypto.randomUUID(),
    name: opts.name,
    width,
    length,
    x: spot.x,
    y: spot.y,
    rotation: 0,
    color: opts.color,
    items: [],
    openings,
    corners,
    wallColors: {},
    flooring: { ...DEFAULT_FLOORING },
    roomKind: "hallway",
  };
}

/**
 * Builds a new room from an arbitrary polygon (the IKEA-style wizard's
 * shape gallery -- rectangle/L-shape/cut-corner, see room-shapes.ts) --
 * same corners-to-RoomLayout shape as createHallwayLayout above (bounding
 * box for width/length, explicit `corners`, free-spot placement), but for
 * a plain room: no roomKind, no auto-placed doors (the wizard's own
 * openings step decides what -- if anything -- gets added), and openings
 * are supplied by the caller rather than derived from the shape itself.
 */
export function createRoomLayoutWithCorners(
  rooms: RoomLayout[],
  opts: {
    name: string;
    corners: Point[];
    color: string;
    openings?: Opening[];
    x?: number;
    y?: number;
  },
): RoomLayout {
  const bb = polygonBoundingBox(opts.corners);
  const width = bb.width;
  const length = bb.height;

  const spot =
    opts.x !== undefined && opts.y !== undefined
      ? { x: opts.x, y: opts.y }
      : findFreeRoomSpot(rooms, width, length);

  return {
    id: crypto.randomUUID(),
    name: opts.name,
    width,
    length,
    x: spot.x,
    y: spot.y,
    rotation: 0,
    color: opts.color,
    items: [],
    openings: opts.openings ?? [],
    corners: opts.corners,
    wallColors: {},
    flooring: { ...DEFAULT_FLOORING },
  };
}

const RANDOM_ROOM_TEMPLATES: {
  nameEn: string;
  nameDe: string;
  color: string;
  minW: number;
  maxW: number;
  minL: number;
  maxL: number;
}[] = [
  {
    nameEn: "Living Room",
    nameDe: "Wohnzimmer",
    color: "#3b82f6",
    minW: 380,
    maxW: 550,
    minL: 320,
    maxL: 420,
  },
  {
    nameEn: "Home Office",
    nameDe: "Home-Office",
    color: "#14b8a6",
    minW: 280,
    maxW: 400,
    minL: 250,
    maxL: 340,
  },
  {
    nameEn: "Bedroom",
    nameDe: "Schlafzimmer",
    color: "#8b5cf6",
    minW: 300,
    maxW: 420,
    minL: 280,
    maxL: 380,
  },
  {
    nameEn: "Kitchen",
    nameDe: "Küche",
    color: "#f59e0b",
    minW: 260,
    maxW: 380,
    minL: 240,
    maxL: 320,
  },
  {
    nameEn: "Bathroom",
    nameDe: "Badezimmer",
    color: "#06b6d4",
    minW: 180,
    maxW: 260,
    minL: 200,
    maxL: 280,
  },
  {
    nameEn: "Dining Room",
    nameDe: "Esszimmer",
    color: "#ef4444",
    minW: 320,
    maxW: 440,
    minL: 280,
    maxL: 360,
  },
];

function randomInt(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) / 10) * 10;
}

/**
 * A random-ish free spot: tries a handful of random points first (so rooms
 * don't always land back on the same deterministic top-left grid cell), and
 * only falls back to the deterministic scan if nothing random panned out.
 */
function findRandomFreeSpot(
  rooms: RoomLayout[],
  width: number,
  length: number,
): { x: number; y: number } {
  const margin = 30;
  const overlapsAny = (x: number, y: number) => {
    const padded = rectCorners({
      x: x - margin,
      y: y - margin,
      width: width + margin * 2,
      length: length + margin * 2,
    });
    return rooms.some((other) => rectilinearPolygonsOverlap(padded, globalCorners(other)));
  };

  const maxX = Math.max(50, FLOOR_W - width - 50);
  const maxY = Math.max(50, FLOOR_L - length - 50);

  for (let attempt = 0; attempt < 40; attempt++) {
    const x = 50 + Math.round(Math.random() * (maxX - 50));
    const y = 50 + Math.round(Math.random() * (maxY - 50));
    if (!overlapsAny(x, y)) return { x, y };
  }

  return findFreeRoomSpot(rooms, width, length);
}

/**
 * Generates a fresh, randomized set of rooms (varied templates, sizes, and
 * positions) for a clean-slate master floor plan. Used on true app startup so
 * every session starts from uncluttered, non-overlapping positions instead of
 * accumulating leftover test layouts.
 */
export function generateRandomRoomLayout(lang: Lang): RoomLayout[] {
  const pool = [...RANDOM_ROOM_TEMPLATES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const count = 2 + Math.floor(Math.random() * 2); // 2-3 rooms
  let rooms: RoomLayout[] = [];

  for (const template of pool.slice(0, count)) {
    const width = randomInt(template.minW, template.maxW);
    const length = randomInt(template.minL, template.maxL);
    const spot = findRandomFreeSpot(rooms, width, length);
    const room = createRoomLayout(rooms, {
      name: lang === "de" ? template.nameDe : template.nameEn,
      width,
      length,
      color: template.color,
      x: spot.x,
      y: spot.y,
    });
    rooms = [...rooms, room];
  }

  return rooms;
}

/**
 * Clamps a requested width/length change for `room` so it doesn't grow into an
 * overlap with any other room (the room's x/y top-left anchor stays fixed).
 * Used by the "Edit Room Properties" width/height inputs, which previously
 * applied size changes directly with no collision check at all -- unlike
 * dragging or rotating, resizing a room past a neighbor was always silently
 * allowed even with collision enabled.
 */
export function clampRoomResize(
  room: RoomLayout,
  requestedWidth: number,
  requestedLength: number,
  otherRooms: RoomLayout[],
  collisionEnabled: boolean,
): { width: number; length: number } {
  if (!collisionEnabled) return { width: requestedWidth, length: requestedLength };

  const collidesAt = (width: number, length: number) =>
    otherRooms.some(
      (other) =>
        other.id !== room.id &&
        // Width/length resizing only ever reaches a plain rectangular room
        // (the Inspector hides/guards these fields for a polygon hallway --
        // see updateSelectedRoom in MultiRoomCanvas.tsx), so the room being
        // resized is correctly a synthesized rectangle here; the other room
        // uses its real shape (globalCorners), so growing up to the edge of
        // a hallway's actual notch is allowed instead of being blocked by
        // its rectangular bounding box.
        rectilinearPolygonsOverlap(
          rectCorners({ x: room.x, y: room.y, width, length }),
          globalCorners(other),
        ),
    );

  if (!collidesAt(requestedWidth, requestedLength)) {
    return { width: requestedWidth, length: requestedLength };
  }

  // The room's current size is assumed valid (it was already on the floor plan).
  // If it isn't (e.g. collision was toggled on after an overlapping resize),
  // there's nothing safe to interpolate from, so just refuse the growth.
  if (collidesAt(room.width, room.length)) {
    return { width: room.width, length: room.length };
  }

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const t = (lo + hi) / 2;
    const w = room.width + (requestedWidth - room.width) * t;
    const l = room.length + (requestedLength - room.length) * t;
    if (!collidesAt(w, l)) lo = t;
    else hi = t;
  }

  return {
    width: room.width + (requestedWidth - room.width) * lo,
    length: room.length + (requestedLength - room.length) * lo,
  };
}
