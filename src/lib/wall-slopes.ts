import type { Point } from "@/types/planner";
import { resolveWallSegment, wallOutwardNormal } from "@/lib/hallway-shapes";
import { obbCorners, pointInPolygon } from "@/lib/planner-math";

/**
 * Sloped ceilings ("Dachschrägen") -- the geometry half.
 *
 * An attic room isn't a box: the ceiling drops toward the eaves, so the
 * usable height varies across the floor. That's the whole reason someone
 * plans an attic in the first place -- a 200cm wardrobe simply cannot go
 * where the ceiling is 120cm, and no amount of 2D floor-plan area tells you
 * that.
 *
 * The model here is deliberately NOT "arbitrary 3D ceiling geometry". A
 * slope is attached to a WALL and described the way people actually
 * describe attics: a low knee wall ("Kniestock") of `kneeHeight`, from
 * which the ceiling rises to the room's full height over a horizontal
 * distance `run` measured perpendicular into the room. Two numbers per
 * wall, both directly measurable with a tape measure.
 *
 * Why attach to walls rather than model a roof:
 * - The floor polygon (`corners`) stays completely untouched, so footprint
 *   collision, room adjacency, wall openings and the overview grid all keep
 *   working exactly as they do today. Nothing existing has to learn about
 *   slopes to stay correct.
 * - It composes: the classic gabled attic is just two opposite walls each
 *   sloping toward a ridge in the middle, and availableHeightAt() takes the
 *   minimum, so where two slopes overlap the lower one wins automatically.
 * - It degrades: a room with no slopes is a plain box, exactly as now.
 *
 * What it deliberately cannot express (and shouldn't, at this stage):
 * dormers ("Gauben"), hipped ends over a non-parallel wall, curved or
 * multi-pitch roofs. Those want real roof geometry; this wants to answer
 * one question well -- "how tall can something be at this spot?"
 */

/** Fallback when a room carries no explicit ceiling height. Matches the
 * value ThreeDView has hardcoded today, so introducing slopes changes
 * nothing for rooms that don't use them. */
export const DEFAULT_CEILING_HEIGHT = 240;

/** Head height for an adult standing comfortably. The "you can stand up
 * past here" line is the single most useful thing to draw on an attic floor
 * plan, so it's a named constant rather than a magic number in a component. */
export const STANDING_HEIGHT = 190;

export interface WallSlope {
  /** Ceiling height in cm where this wall meets the floor -- the knee wall
   * ("Kniestock"). 0 means the roof meets the floor at this wall. */
  kneeHeight: number;
  /** Horizontal distance in cm, measured perpendicular into the room, over
   * which the ceiling rises from `kneeHeight` to the room's full ceiling
   * height. Past this distance the ceiling is flat. */
  run: number;
}

/** Keyed exactly like `wallColors` -- see wallColorKey() in
 * hallway-shapes.ts: a name ("top"/"right"/...) for a 4-corner room, a
 * numeric wall index for a polygon room. */
export type WallSlopeMap = Record<string, WallSlope>;

/** A slope with no run, or one that never actually dips below the ceiling,
 * constrains nothing -- treated as absent rather than as a degenerate case
 * every caller has to guard. */
function isEffective(slope: WallSlope, ceilingHeight: number): boolean {
  return slope.run > 0 && slope.kneeHeight < ceilingHeight;
}

/**
 * WallSlopeMap keys are strings because that's what an object key is, but
 * they mean one of two things (see WallSlopeMap): a wall NAME for a
 * 4-corner room, or a numeric wall INDEX for a polygon room.
 * resolveWallSegment wants those as their real types, so this is the one
 * place that conversion happens -- shared with the canvas overlay so the
 * geometry and the drawing can't disagree about which wall a key means.
 */
export function parseWallKey(key: string): string | number {
  return key === "" || isNaN(Number(key)) ? key : Number(key);
}

/**
 * Unit normal pointing INTO the room from a wall.
 *
 * Deliberately does not trust winding order. `wallOutwardNormal` derives its
 * direction from a->b, but resolveWallSegment's named-wall convention walks
 * "bottom" and "left" in reverse of forward winding on purpose (kept that
 * way so existing rectangular rooms render identically) -- so for those two
 * walls it returns the inward normal, not the outward one. Anything that
 * needs a genuinely inward direction has to determine it geometrically
 * instead, which is what the probe below does: step off the wall's midpoint
 * and see which side is actually inside the polygon.
 *
 * Only drawing needs this. availableHeightAt() is unaffected because it
 * measures an absolute distance to the wall's infinite line, which is
 * signless by construction.
 */
export function inwardNormal(corners: Point[], a: Point, b: Point): Point {
  const out = wallOutwardNormal(a, b);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  // 1cm off the wall -- big enough to be unambiguous, small enough to stay
  // inside even a very shallow room.
  const probe = { x: mid.x - out.x, y: mid.y - out.y };
  return pointInPolygon(probe, corners) ? { x: -out.x, y: -out.y } : out;
}

/** Perpendicular distance from a point to the infinite line through a
 * wall's endpoints. Distance to the LINE, not the segment: the slope plane
 * continues across the room's full width, so a point past a wall's end is
 * still under that roof pitch. */
function distanceToWallLine(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Infinity;
  return Math.abs(dx * (p.y - a.y) - dy * (p.x - a.x)) / len;
}

/**
 * Usable ceiling height (cm) at one point on the floor. The minimum over
 * every sloped wall, so overlapping slopes compose correctly.
 */
export function availableHeightAt(
  point: Point,
  corners: Point[],
  slopes: WallSlopeMap | undefined,
  ceilingHeight: number = DEFAULT_CEILING_HEIGHT,
): number {
  if (!slopes) return ceilingHeight;

  let lowest = ceilingHeight;
  for (const [wallKey, slope] of Object.entries(slopes)) {
    if (!isEffective(slope, ceilingHeight)) continue;
    const seg = resolveWallSegment(corners, parseWallKey(wallKey));
    if (!seg) continue;

    const d = distanceToWallLine(point, seg.a, seg.b);
    if (d >= slope.run) continue;

    const h = slope.kneeHeight + ((ceilingHeight - slope.kneeHeight) * d) / slope.run;
    if (h < lowest) lowest = h;
  }
  return lowest;
}

/**
 * How far from a sloped wall you have to stand before your head clears
 * `targetHeight` -- the distance at which to draw the "you can stand up
 * past here" line. Returns 0 when the wall already clears it.
 */
export function distanceToClearHeight(
  slope: WallSlope,
  targetHeight: number,
  ceilingHeight: number = DEFAULT_CEILING_HEIGHT,
): number {
  if (!isEffective(slope, ceilingHeight)) return 0;
  if (slope.kneeHeight >= targetHeight) return 0;
  if (targetHeight >= ceilingHeight) return slope.run;
  return (slope.run * (targetHeight - slope.kneeHeight)) / (ceilingHeight - slope.kneeHeight);
}

/**
 * Converts the two ways people describe the same roof. A builder quotes a
 * pitch angle; a tape measure gives a run. Both produce the other.
 */
export function runFromPitch(
  kneeHeight: number,
  pitchDegrees: number,
  ceilingHeight: number = DEFAULT_CEILING_HEIGHT,
): number {
  const rise = ceilingHeight - kneeHeight;
  if (rise <= 0) return 0;
  const t = Math.tan((pitchDegrees * Math.PI) / 180);
  if (t <= 0) return Infinity;
  return rise / t;
}

export function pitchFromRun(
  kneeHeight: number,
  run: number,
  ceilingHeight: number = DEFAULT_CEILING_HEIGHT,
): number {
  const rise = ceilingHeight - kneeHeight;
  if (run <= 0) return 90;
  return (Math.atan(rise / run) * 180) / Math.PI;
}

/**
 * The lowest ceiling anywhere over an item's footprint. Sampled at the
 * footprint's four corners: the ceiling plane is linear across the room, so
 * over a convex rectangle its minimum is always attained at a corner --
 * sampling the interior would find nothing lower.
 */
export function minHeightOverFootprint(
  footprint: Point[],
  corners: Point[],
  slopes: WallSlopeMap | undefined,
  ceilingHeight: number = DEFAULT_CEILING_HEIGHT,
): number {
  if (!slopes || footprint.length === 0) return ceilingHeight;
  let lowest = ceilingHeight;
  for (const p of footprint) {
    const h = availableHeightAt(p, corners, slopes, ceilingHeight);
    if (h < lowest) lowest = h;
  }
  return lowest;
}

/**
 * Whether an item physically fits where it's been put. `requiredHeight` is
 * the item's own height plus whatever it's raised by (an item on a desk
 * needs the desk's height too -- see computeOnTopElevation in
 * planner-math.ts).
 *
 * Returns the shortfall as well as the verdict so the caller can say *how
 * much* too tall it is, which is far more actionable than a bare "doesn't
 * fit".
 */
export function checkItemFitsUnderSlopes(
  item: { x: number; y: number; width: number; length: number; rotation: number },
  requiredHeight: number,
  corners: Point[],
  slopes: WallSlopeMap | undefined,
  ceilingHeight: number = DEFAULT_CEILING_HEIGHT,
): { fits: boolean; availableHeight: number; shortfallCm: number } {
  const available = minHeightOverFootprint(obbCorners(item), corners, slopes, ceilingHeight);
  const shortfall = requiredHeight - available;
  return {
    fits: shortfall <= 0,
    availableHeight: Math.round(available * 100) / 100,
    shortfallCm: Math.max(0, Math.round(shortfall * 100) / 100),
  };
}
