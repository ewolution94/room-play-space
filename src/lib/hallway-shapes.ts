import type { Point } from "@/types/planner";

// Geometry helpers for arbitrary N-corner room polygons, plus corner
// templates for the built-in hallway shapes (straight / L / T). Rectangular
// rooms (exactly 4 corners) keep using their existing named-wall
// ("top"/"bottom"/"left"/"right") convention everywhere else in the app --
// none of that changes. These helpers exist purely for the new polygon (5+
// corner) room path: hallways with an L or T floor shape.
//
// Wall indexing convention for polygon rooms: wall `i` is the segment from
// corners[i] to corners[(i+1) % corners.length], always walked the same
// "forward winding" direction the corners array itself is authored in
// (clockwise on screen, matching the pre-existing rectangle convention of
// corners = [top-left, top-right, bottom-right, bottom-left]). Unlike the
// legacy named walls -- where "bottom" and "left" happen to be measured in
// the *reverse* of that winding order, see resolveWallSegment below -- every
// numbered wall is measured the same way. That's what makes rotation
// trivial (see rotatePolygonCorners): a wall's index and an opening's
// `position` along it never need to change when the room rotates, only the
// corner points themselves move.

export interface WallSegment {
  index: number;
  a: Point;
  b: Point;
  length: number;
}

/** Every edge of the polygon, in forward-winding order. */
export function wallSegments(corners: Point[]): WallSegment[] {
  const n = corners.length;
  const segs: WallSegment[] = [];
  for (let i = 0; i < n; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % n];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    segs.push({ index: i, a, b, length });
  }
  return segs;
}

/**
 * Resolves an Opening's `wall` field to the two physical endpoints of the
 * wall it sits on. Handles both the legacy named convention (only valid --
 * and only ever produced -- for a plain 4-corner rectangular room) and the
 * numeric wall-index convention used by polygon (hallway) rooms. Centralizes
 * what used to be several separately hand-copied 4-branch if/else chains
 * across CanvasArea.tsx, CanvasOpenings.tsx and MultiRoomCanvas.tsx.
 */
export function resolveWallSegment(
  corners: Point[],
  wall: string | number,
): { a: Point; b: Point } | null {
  if (typeof wall === "number") {
    const n = corners.length;
    if (n < 3) return null;
    const i = ((wall % n) + n) % n;
    return { a: corners[i], b: corners[(i + 1) % n] };
  }
  // Legacy named convention -- deliberately mirrors the exact ptA/ptB pairs
  // used historically (note "bottom" and "left" are walked in reverse of
  // forward winding order; this is intentional and must stay exactly as-is
  // for existing rectangular rooms to render/behave identically).
  if (corners.length < 4) return null;
  switch (wall) {
    case "right":
      return { a: corners[1], b: corners[2] };
    case "bottom":
      return { a: corners[3], b: corners[2] };
    case "left":
      return { a: corners[0], b: corners[3] };
    case "top":
    default:
      return { a: corners[0], b: corners[1] };
  }
}

/**
 * Unit normal pointing outward (away from the room interior) for the wall
 * running from `a` to `b`, assuming the standard forward-winding
 * (clockwise-on-screen) corners convention used everywhere in this module.
 * For a wall direction (dx,dy), outward is (dy,-dx) -- e.g. the top wall of
 * a rectangle runs left-to-right (dx=1,dy=0), and (dy,-dx) = (0,-1) points
 * up, away from the room below it, as expected. Reused wherever a label or
 * marker needs to sit just outside a wall line rather than on top of it.
 */
export function wallOutwardNormal(a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dy / len, y: -dx / len };
}

const NAMED_WALLS = ["top", "right", "bottom", "left"];

/**
 * The key used to look up wall `index`'s tint in a room's `wallColors`
 * dict (also reused for translation-string lookups, since those are keyed
 * the same way). A plain rectangular room keeps the existing friendly names
 * ("top"/"right"/"bottom"/"left"); a polygon room uses the wall's own
 * numeric index, stringified -- there's no natural "top/bottom" concept
 * once a room has 6-8 walls.
 */
export function wallColorKey(index: number, cornersLen: number): string {
  if (cornersLen === 4) return NAMED_WALLS[index] ?? String(index);
  return String(index);
}

export function polygonBoundingBox(corners: Point[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Rotates every corner 90 degrees clockwise (on screen) about the polygon's
 * own bounding-box center. For an axis-aligned rectangle this is provably
 * identical to the legacy width/length-swap rotation multi-room-actions.ts
 * used to do by hand for plain rooms (both produce a new bounding box with
 * width/height swapped, still centered at the same point -- true for *any*
 * point set under an exact 90 degree rotation about its own bounding-box
 * center, not just rectangles). Wall indices and opening `position` values
 * stay valid across rotation with zero remapping, because rotation
 * preserves winding order: wall i is still the segment between the
 * (now-rotated) corners[i] and corners[i+1].
 */
export function rotatePolygonCorners(corners: Point[]): Point[] {
  const { minX, maxX, minY, maxY } = polygonBoundingBox(corners);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return corners.map((c) => {
    const dx = c.x - cx;
    const dy = c.y - cy;
    return { x: cx - dy, y: cy + dx };
  });
}

/**
 * Insets a rectilinear (90/270-degree-corners-only) polygon by `inset` on
 * every side -- used to draw the "thick wall" outline in the multi-room
 * overview's room thumbnail as a true polygon for hallways instead of a
 * plain rect. At each corner, the correct offset is the (unnormalized) sum
 * of the two adjacent walls' inward unit normals; for a 90 or 270 degree
 * corner that sum always has the right magnitude to produce a clean inset
 * in both directions at once (verified in hallway-shapes.test.ts against
 * the plain rectangle case, where it reduces to the obvious x+inset/
 * y+inset/etc. on every corner).
 */
export function insetRectilinearPolygon(corners: Point[], inset: number): Point[] {
  const n = corners.length;
  const inwardNormal = (a: Point, b: Point): Point => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
  };
  return corners.map((c, i) => {
    const prev = corners[(i - 1 + n) % n];
    const next = corners[(i + 1) % n];
    const nIn = inwardNormal(prev, c);
    const nOut = inwardNormal(c, next);
    return { x: c.x + inset * (nIn.x + nOut.x), y: c.y + inset * (nIn.y + nOut.y) };
  });
}

// --- Hallway shape templates -------------------------------------------

export type HallwayShape = "straight" | "l" | "l-mirrored" | "t";

export interface HallwayTemplate {
  corners: Point[];
  /** Wall indices that represent an open "end" of the hallway -- where a
   * door is pre-placed by default so the hallway can connect to another
   * room. */
  endWalls: number[];
}

/**
 * A straight hallway is a plain rectangle -- width = armLength (the long
 * axis), length = armWidth (the short axis) -- so it stays entirely on the
 * existing 4-corner/named-wall code path (zero new geometry needed to
 * render, collide with, or extrude it). Ends are the short "left"/"right"
 * walls (handled by the caller via the named convention, not this
 * function's numeric endWalls).
 */
export function buildStraightHallwayCorners(armWidth: number, armLength: number): Point[] {
  return [
    { x: 0, y: 0 },
    { x: armLength, y: 0 },
    { x: armLength, y: armWidth },
    { x: 0, y: armWidth },
  ];
}

/**
 * L-shaped hallway: a vertical arm (width `armWidth`, height `legY`) meeting
 * a horizontal arm (height `armWidth`, width `legX`) at a right angle. Two
 * chiralities are offered ("l" and its mirror) since rotating a single L
 * template in 90 degree steps only ever visits 4 of the 8 possible L
 * placements -- the other 4 need the mirrored template.
 */
export function buildLHallwayCorners(
  armWidth: number,
  legX: number,
  legY: number,
  mirrored: boolean,
): HallwayTemplate {
  const W = armWidth;
  if (!mirrored) {
    return {
      corners: [
        { x: 0, y: 0 },
        { x: W, y: 0 },
        { x: W, y: legY - W },
        { x: legX, y: legY - W },
        { x: legX, y: legY },
        { x: 0, y: legY },
      ],
      endWalls: [0, 3],
    };
  }
  return {
    corners: [
      { x: legX - W, y: 0 },
      { x: legX, y: 0 },
      { x: legX, y: legY },
      { x: 0, y: legY },
      { x: 0, y: legY - W },
      { x: legX - W, y: legY - W },
    ],
    endWalls: [0, 3],
  };
}

/**
 * T-shaped hallway: a horizontal bar (height `armWidth`, width `barLength`)
 * with a stem (width `armWidth`) hanging down from its center, `stemLength`
 * long. Three open ends -- the bar's left arm, the bar's right arm, and the
 * stem.
 */
export function buildTHallwayCorners(
  armWidth: number,
  barLength: number,
  stemLength: number,
): HallwayTemplate {
  const W = armWidth;
  const sx = (barLength - W) / 2;
  const totalL = W + stemLength;
  return {
    corners: [
      { x: 0, y: 0 },
      { x: barLength, y: 0 },
      { x: barLength, y: W },
      { x: sx + W, y: W },
      { x: sx + W, y: totalL },
      { x: sx, y: totalL },
      { x: sx, y: W },
      { x: 0, y: W },
    ],
    endWalls: [1, 4, 7],
  };
}
