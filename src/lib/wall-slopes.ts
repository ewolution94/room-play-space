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
 * Triangulated ceiling surface for a room, as flat [x, height, y] triples
 * ready to hand to a BufferGeometry. Room-local cm throughout; the caller
 * positions the mesh.
 *
 * `triangulate2D` supplies the polygon's exact triangulation (the renderer
 * has THREE.ShapeGeometry for this; the geometry layer stays free of any
 * three.js dependency by taking it as an argument). Those triangles are
 * then subdivided until their edges are short enough that sampling the
 * ceiling height per-vertex approximates the fold where a slope meets the
 * flat ceiling. Subdivision is midpoint-only, so the room's outline stays
 * exactly the polygon's -- no jagged boundary, unlike sampling a grid and
 * discarding cells that fall outside.
 *
 * A room with no slopes needs none of that: the surface is flat, so the
 * bare triangulation is already exact and subdivision is skipped entirely.
 */
export function buildCeilingSurface(
  corners: Point[],
  slopes: WallSlopeMap | undefined,
  ceilingHeight: number,
  triangulate2D: (corners: Point[]) => [Point, Point, Point][],
  maxEdgeCm = 15,
): number[] {
  let tris = triangulate2D(corners);
  const hasSlopes = !!slopes && Object.keys(slopes).length > 0;

  if (hasSlopes) {
    // Cap the depth rather than looping to convergence: each level
    // quadruples the triangle count, and 5 levels already takes a
    // room-sized triangle well under maxEdgeCm.
    for (let level = 0; level < 5; level++) {
      let anySplit = false;
      const next: [Point, Point, Point][] = [];
      for (const [a, b, c] of tris) {
        const longest = Math.max(
          Math.hypot(b.x - a.x, b.y - a.y),
          Math.hypot(c.x - b.x, c.y - b.y),
          Math.hypot(a.x - c.x, a.y - c.y),
        );
        if (longest <= maxEdgeCm) {
          next.push([a, b, c]);
          continue;
        }
        anySplit = true;
        const ab = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const bc = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
        const ca = { x: (c.x + a.x) / 2, y: (c.y + a.y) / 2 };
        next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
      }
      tris = next;
      if (!anySplit) break;
    }
  }

  const out: number[] = [];
  for (const tri of tris) {
    // Skip any triangle carrying a non-finite vertex rather than emitting
    // it. A single NaN position silently poisons the whole mesh's bounding
    // sphere, and three.js only reports it much later as an opaque
    // "Computed radius is NaN" -- far from whichever triangulator produced
    // it. (That is exactly how the indexed-vs-non-indexed ShapeGeometry bug
    // first showed up.)
    if (!tri.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) continue;
    for (const p of tri) {
      out.push(p.x, availableHeightAt(p, corners, slopes, ceilingHeight), p.y);
    }
  }
  return out;
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

/** One sample of the ceiling height above a wall, `along` cm from its ptA. */
export interface WallProfilePoint {
  along: number;
  height: number;
}

/**
 * How high the ceiling is at each point along a stretch of wall.
 *
 * This is what lets a wall running *into* a Dachschräge be built as a
 * trapezoid instead of a full-height rectangle. The sloped wall itself is
 * already handled -- it's a knee wall and simply stops at `kneeHeight` --
 * but its perpendicular neighbours kept their full height and poked up
 * through the slanted ceiling, which reads as clipping rather than as a
 * roof.
 *
 * Sampled rather than solved. The exact profile is piecewise linear (the
 * distance to a slope's wall line varies linearly along a straight wall,
 * and `availableHeightAt` takes a minimum over the slopes), so the true
 * shape has a kink wherever one slope overtakes another or a run ends.
 * Walking those breakpoints analytically means intersecting every pair of
 * slope planes; sampling every ~15cm -- the same step
 * `buildCeilingSurface` subdivides the ceiling to -- puts any kink within
 * 15cm of where it belongs, which is invisible at furniture scale and far
 * less code to get wrong. Endpoints are always included exactly, so a wall
 * always meets its neighbours at the right height.
 *
 * `startAlong`/`endAlong` are distances from `a`, so a caller can profile
 * one chunk of a wall between openings, or the strip above a door, without
 * re-deriving the geometry.
 */
export function ceilingProfileAlongWall(
  a: Point,
  b: Point,
  startAlong: number,
  endAlong: number,
  corners: Point[],
  slopes: WallSlopeMap | undefined,
  ceilingHeight: number = DEFAULT_CEILING_HEIGHT,
  stepCm = 15,
): WallProfilePoint[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const wallLen = Math.hypot(dx, dy);
  if (wallLen === 0) return [];

  const span = endAlong - startAlong;
  const steps = Math.max(1, Math.ceil(Math.abs(span) / Math.max(1, stepCm)));
  const ux = dx / wallLen;
  const uy = dy / wallLen;

  const out: WallProfilePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const along = startAlong + (span * i) / steps;
    const point = { x: a.x + ux * along, y: a.y + uy * along };
    out.push({
      along,
      height: availableHeightAt(point, corners, slopes, ceilingHeight),
    });
  }
  return out;
}

/**
 * True when a profile is (near enough) a flat run at the full ceiling
 * height -- i.e. this wall is clear of every slope and can stay on the
 * plain box path it has always used.
 *
 * Worth checking rather than always extruding: an unsloped room, and every
 * wall of a sloped room that sits beyond the slope's run, then produce
 * byte-identical geometry to before this feature existed.
 */
export function profileIsFlatAtCeiling(
  profile: WallProfilePoint[],
  ceilingHeight: number,
  epsCm = 0.5,
): boolean {
  return profile.every((p) => Math.abs(p.height - ceilingHeight) <= epsCm);
}
