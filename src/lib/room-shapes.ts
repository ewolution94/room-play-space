import type { Point } from "@/types/planner";
import {
  lineIntersection,
  polygonBoundingBox,
  wallOutwardNormal,
  wallSegments,
} from "@/lib/hallway-shapes";

// Standalone-room shape templates + the constrained wall-drag interaction
// for the IKEA-inspired room wizard. Deliberately separate from
// hallway-shapes.ts's own L/T builders: those assume one shared armWidth
// for a thin corridor bending around a corner, which is a different shape
// family from a room with a rectangular notch or a chamfered corner cut
// out of it. Both modules share the same generic polygon primitives
// (wallSegments, wallOutwardNormal, lineIntersection, polygonBoundingBox),
// imported from hallway-shapes.ts rather than duplicated.

export type RoomShapeKind = "rectangle" | "l" | "cut-corner";

// Line-intersection and scaling math produces long floating-point results
// (e.g. 501.60711669921875) -- rounding to 2 decimal places whenever a
// result is committed keeps stored corners clean, which is what actually
// fixes every downstream "20 digits after the decimal point" display, not
// just the one label a user happens to be looking at.
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function roundPoint(p: Point): Point {
  return { x: round2(p.x), y: round2(p.y) };
}

// Every template is authored starting at the origin, growing right/down --
// same "clockwise on screen" winding convention as every other polygon
// room in this codebase (see hallway-shapes.ts's module doc comment).

export function buildRectangleCorners(width: number, length: number): Point[] {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: length },
    { x: 0, y: length },
  ];
}

/** Rectangle with a rectangular notch removed from the top-right corner --
 * the most common non-rectangular room shape in real floor plans (e.g. an
 * open-plan living/dining L). `notchWidth`/`notchDepth` must each be
 * smaller than `width`/`length` respectively or the shape degenerates. */
export function buildLShapeCorners(
  width: number,
  length: number,
  notchWidth: number,
  notchDepth: number,
): Point[] {
  return [
    { x: 0, y: 0 },
    { x: width - notchWidth, y: 0 },
    { x: width - notchWidth, y: notchDepth },
    { x: width, y: notchDepth },
    { x: width, y: length },
    { x: 0, y: length },
  ];
}

/** Rectangle with the top-right corner chamfered off diagonally -- for an
 * angled wall/bay-style room. `cutWidth`/`cutDepth` are how far the chamfer
 * eats into the top wall and right wall respectively. */
export function buildCutCornerCorners(
  width: number,
  length: number,
  cutWidth: number,
  cutDepth: number,
): Point[] {
  return [
    { x: 0, y: 0 },
    { x: width - cutWidth, y: 0 },
    { x: width, y: cutDepth },
    { x: width, y: length },
    { x: 0, y: length },
  ];
}

export interface RoomShapeTemplate {
  key: RoomShapeKind;
  nameEn: string;
  nameDe: string;
  /** Sensible starting corners for a fresh pick in the wizard's gallery. */
  defaultCorners: Point[];
}

const DEFAULT_W = 400;
const DEFAULT_L = 350;

export const ROOM_SHAPE_TEMPLATES: RoomShapeTemplate[] = [
  {
    key: "rectangle",
    nameEn: "Rectangle",
    nameDe: "Rechteck",
    defaultCorners: buildRectangleCorners(DEFAULT_W, DEFAULT_L),
  },
  {
    key: "l",
    nameEn: "L-Shape",
    nameDe: "L-Form",
    defaultCorners: buildLShapeCorners(DEFAULT_W, DEFAULT_L, DEFAULT_W * 0.4, DEFAULT_L * 0.4),
  },
  {
    key: "cut-corner",
    nameEn: "Cut Corner",
    nameDe: "Abgeschrägte Ecke",
    defaultCorners: buildCutCornerCorners(DEFAULT_W, DEFAULT_L, DEFAULT_W * 0.3, DEFAULT_L * 0.3),
  },
];

// Any single wall, after a drag, must stay at least this long -- prevents
// collapsing a wall (or the notch/chamfer next to it) down to nothing.
export const MIN_WALL_LENGTH = 60;

/**
 * The wizard's core interaction: drag wall `wallIndex` and have both its
 * endpoints move together (never a single free corner) while every other
 * wall keeps its own direction unchanged -- "constrained whole-wall
 * parallel translation," not the old free-form per-vertex dragging
 * (CanvasArea.tsx's disabled onCornerPointerDown) that let a single corner
 * move anywhere and could self-intersect the room.
 *
 * Only the component of `dragDelta` along the wall's own outward normal is
 * used -- dragging is "push/pull this wall in or out," not "slide it
 * sideways along its own length." The wall's new (translated) line is then
 * re-intersected with each of its two neighboring walls' UNCHANGED lines to
 * get the two new corner positions, so every adjacent wall's angle is
 * preserved exactly. Works identically for axis-aligned and diagonal walls
 * (the chamfer in "cut-corner") since it never assumes axis alignment.
 */
export function dragWallEdge(corners: Point[], wallIndex: number, dragDelta: Point): Point[] {
  const n = corners.length;
  if (n < 3) return corners;
  const i = ((wallIndex % n) + n) % n;
  const a = corners[i];
  const b = corners[(i + 1) % n];
  const prev = corners[(i - 1 + n) % n];
  const next = corners[(i + 2) % n];

  const wallDir = { x: b.x - a.x, y: b.y - a.y };
  if (Math.hypot(wallDir.x, wallDir.y) < 1e-6) return corners;
  const normal = wallOutwardNormal(a, b);

  const dist = dragDelta.x * normal.x + dragDelta.y * normal.y;
  const newA = { x: a.x + normal.x * dist, y: a.y + normal.y * dist };
  const newB = { x: b.x + normal.x * dist, y: b.y + normal.y * dist };

  const prevDir = { x: a.x - prev.x, y: a.y - prev.y };
  const nextDir = { x: next.x - b.x, y: next.y - b.y };

  const newCornerA = lineIntersection(prev, prevDir, newA, wallDir) ?? newA;
  const newCornerB = lineIntersection(newB, wallDir, b, nextDir) ?? newB;

  const newWallLength = Math.hypot(newCornerB.x - newCornerA.x, newCornerB.y - newCornerA.y);
  if (newWallLength < MIN_WALL_LENGTH) return corners;

  // Cheap degeneracy guard suited to this wizard's controlled templates
  // (every corner is a 90 or 270 degree turn, or the cut-corner's one
  // diagonal) -- not a full self-intersection solver, but sufficient to
  // catch the failure mode that actually happens when dragging a notch/
  // chamfer too far: newCornerA/B crossing back past prev/next and
  // inverting that neighboring wall. A valid drag always keeps
  // (newCorner - neighbor) pointing the same way the original
  // (corner - neighbor) did; a negative dot product means it flipped.
  const prevOk = (newCornerA.x - prev.x) * prevDir.x + (newCornerA.y - prev.y) * prevDir.y > 0;
  const nextOk = (next.x - newCornerB.x) * nextDir.x + (next.y - newCornerB.y) * nextDir.y > 0;
  if (!prevOk || !nextOk) return corners;

  const result = [...corners];
  result[i] = roundPoint(newCornerA);
  result[(i + 1) % n] = roundPoint(newCornerB);

  // The check above only guards the DRAGGED wall's own length and its two
  // immediate neighbors -- it says nothing about a wall on the far side of
  // the room. Dragging a rectangle's top wall down past its bottom wall,
  // for instance, leaves the top wall itself perfectly long (still spans
  // the full width) while the room's actual depth collapses to nothing.
  // Guard the overall footprint directly instead of trying to identify
  // "the opposite wall" for an arbitrary polygon.
  const bb = polygonBoundingBox(result);
  if (bb.width < MIN_WALL_LENGTH || bb.height < MIN_WALL_LENGTH) return corners;

  return result;
}

/** Uniformly scales every corner from the polygon's own min-x/min-y corner
 * (every template here is authored starting at the origin) -- the numeric
 * width/length fields' fallback to dragging. Notch/chamfer proportions are
 * preserved (a 40%-deep notch stays 40%-deep), only absolute size changes. */
export function resizeRoomShape(corners: Point[], newWidth: number, newLength: number): Point[] {
  const bb = polygonBoundingBox(corners);
  const scaleX = bb.width > 0 ? newWidth / bb.width : 1;
  const scaleY = bb.height > 0 ? newLength / bb.height : 1;
  return corners.map((c) =>
    roundPoint({
      x: (c.x - bb.minX) * scaleX + bb.minX,
      y: (c.y - bb.minY) * scaleY + bb.minY,
    }),
  );
}

/**
 * A generous, STABLE SVG viewBox for RoomShapeCanvas -- computed once from
 * a shape's starting corners and then held fixed for the rest of that
 * editing session, deliberately never recomputed as the user drags a wall.
 * Recomputing it from the live (changing) corners on every drag frame is
 * what caused the "constantly zooming in and out" behavior reported after
 * the first version of this wizard: the on-screen canvas size is fixed, so
 * a viewBox that tracks the shrinking/growing bounding box makes everything
 * inside visibly rescale in lockstep with the drag. Centered on the shape
 * with 1.3x padding on each side (so the room can roughly triple in size
 * before approaching the edge) rather than a snug fit.
 */
export function computeStableViewBox(corners: Point[]): string {
  const bb = polygonBoundingBox(corners);
  const span = Math.max(bb.width, bb.height, 1);
  const cx = bb.minX + bb.width / 2;
  const cy = bb.minY + bb.height / 2;
  const half = span * 1.3;
  return `${round2(cx - half)} ${round2(cy - half)} ${round2(half * 2)} ${round2(half * 2)}`;
}

/**
 * Sets one wall's length, for any shape -- not just rectangles.
 *
 * A wall's length isn't its own property: it's the distance between the two
 * walls it runs between. So this doesn't move the wall you named, it moves
 * that wall's NEXT neighbour along the neighbour's own normal, which is what
 * lengthens or shortens the named wall. Reusing dragWallEdge for that keeps
 * every existing guard (minimum size, neighbour inversion, the 2-decimal
 * rounding) in force -- typing a length can't produce a shape a drag
 * couldn't.
 *
 * Iterates because the relationship is only exactly linear when the moved
 * neighbour is perpendicular to the target wall. On a cut-corner shape the
 * neighbour can be diagonal, where one step overshoots or undershoots; a
 * handful of passes converges. The direction is probed on the first pass
 * rather than derived, since which way "outward" lengthens the target
 * depends on the polygon's winding at that corner.
 */
export function setWallLength(corners: Point[], wallIndex: number, targetLength: number): Point[] {
  const n = corners.length;
  if (n < 3 || !Number.isFinite(targetLength) || targetLength <= 0) return corners;
  const i = ((wallIndex % n) + n) % n;
  const neighbour = (i + 1) % n;

  let out = corners;
  let sign = 1;
  for (let iter = 0; iter < 8; iter++) {
    const segs = wallSegments(out);
    const diff = targetLength - segs[i].length;
    if (Math.abs(diff) < 0.05) break;

    const nb = segs[neighbour];
    const nrm = wallOutwardNormal(nb.a, nb.b);
    const next = dragWallEdge(out, neighbour, {
      x: nrm.x * diff * sign,
      y: nrm.y * diff * sign,
    });

    // Rejected outright (would invert a neighbour or go below the minimum).
    if (next === out) {
      if (iter === 0 && sign === 1) {
        sign = -1;
        continue;
      }
      break;
    }

    // First pass doubles as the direction probe: if the move took the wall
    // FURTHER from the target, "outward" was the wrong way at this corner.
    if (iter === 0 && Math.abs(targetLength - wallSegments(next)[i].length) > Math.abs(diff)) {
      sign = -1;
      continue;
    }
    out = next;
  }
  return out;
}
