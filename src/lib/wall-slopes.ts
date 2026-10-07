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
 * Dormers ("Gauben") ride on a slope as a second, positive volume carved
 * back out of it: a stretch of the wall where the roof is raised to a flat
 * dormer ceiling (see Dormer). Roof windows sit in the slope itself and are
 * openings (lib/roof-windows.ts). What it still deliberately cannot express:
 * hipped ends over a non-parallel wall, curved or multi-pitch roofs, gabled
 * dormers. Those want real roof geometry; this wants to answer one question
 * well -- "how tall can something be at this spot?"
 */

/** Fallback when a room carries no explicit ceiling height. Matches the
 * value ThreeDView has hardcoded today, so introducing slopes changes
 * nothing for rooms that don't use them. */
export const DEFAULT_CEILING_HEIGHT = 240;

/** Head height for an adult standing comfortably. The "you can stand up
 * past here" line is the single most useful thing to draw on an attic floor
 * plan, so it's a named constant rather than a magic number in a component. */
export const STANDING_HEIGHT = 190;

/**
 * A box dormer ("Schleppgaube" with a flat ceiling): a stretch of a sloped
 * wall where the roof is raised. Inside it the ceiling is flat at `height`
 * from the wall out to where the slope itself reaches that height, with
 * vertical side walls ("Gaubenwangen") and the wall raised to `height` along
 * its front, so a window or door can go there. Measured like an opening:
 * `position` is cm along the wall from resolveWallSegment's `a`.
 */
export interface Dormer {
  id: string;
  position: number;
  width: number;
  /** Ceiling height inside the dormer, cm. Absent: the room's full ceiling
   * height, which is also the most it can be. */
  height?: number;
}

export interface WallSlope {
  /** Ceiling height in cm where this wall meets the floor -- the knee wall
   * ("Kniestock"). 0 means the roof meets the floor at this wall. */
  kneeHeight: number;
  /** Horizontal distance in cm, measured perpendicular into the room, over
   * which the ceiling rises from `kneeHeight` to the room's full ceiling
   * height. Past this distance the ceiling is flat. */
  run: number;
  /** Box dormers in this slope; they go when the slope goes. */
  dormers?: Dormer[];
}

/** A dormer's ceiling height in a room of `ceilingHeight`: never above it. */
export function dormerHeight(dormer: Pick<Dormer, "height">, ceilingHeight: number): number {
  return Math.min(dormer.height ?? ceilingHeight, ceilingHeight);
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

/**
 * Where a point sits relative to a wall: `along`, cm along the wall's line
 * from `a` towards `b` (an opening's or dormer's `position` measures the
 * same way), and `off`, its distance from that line (signless).
 */
export function wallCoordinates(p: Point, a: Point, b: Point): { along: number; off: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { along: 0, off: Infinity };
  return {
    along: (dx * (p.x - a.x) + dy * (p.y - a.y)) / len,
    off: Math.abs(dx * (p.y - a.y) - dy * (p.x - a.x)) / len,
  };
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
 *
 * A dormer raises its own wall's slope to the dormer's height across its
 * stretch of the wall (the max of the two: past the dormer's depth the slope
 * is higher anyway). `dormers: false` gives the bare roof plane instead,
 * which is what the 3D ceiling samples once the dormers are cut out of it.
 */
export function availableHeightAt(
  point: Point,
  corners: Point[],
  slopes: WallSlopeMap | undefined,
  ceilingHeight: number = DEFAULT_CEILING_HEIGHT,
  options: { dormers?: boolean } = {},
): number {
  if (!slopes) return ceilingHeight;
  const withDormers = options.dormers ?? true;

  let lowest = ceilingHeight;
  for (const [wallKey, slope] of Object.entries(slopes)) {
    if (!isEffective(slope, ceilingHeight)) continue;
    const seg = resolveWallSegment(corners, parseWallKey(wallKey));
    if (!seg) continue;

    const { along, off: d } = wallCoordinates(point, seg.a, seg.b);
    if (d >= slope.run) continue;

    let h = slope.kneeHeight + ((ceilingHeight - slope.kneeHeight) * d) / slope.run;
    if (withDormers) {
      for (const dormer of slope.dormers ?? []) {
        if (along >= dormer.position && along <= dormer.position + dormer.width) {
          h = Math.max(h, dormerHeight(dormer, ceilingHeight));
        }
      }
    }
    if (h < lowest) lowest = h;
  }
  return lowest;
}

/** One dormer on the floor plan. */
export interface DormerFootprint {
  wallKey: string;
  dormer: Dormer;
  /** The two ends on the wall line, then the two at `depth`, in that order. */
  outline: [Point, Point, Point, Point];
  /** How far into the room its flat ceiling reaches: where the slope rises
   * to `height` (0 for a dormer no higher than the knee wall). */
  depth: number;
  height: number;
  /** The wall's knee height, where the dormer's side walls start. */
  kneeHeight: number;
}

/**
 * Every dormer in a room, placed on the floor plan. Dormers on an
 * ineffective slope, or on a wall that no longer resolves, are left out.
 */
export function dormerFootprints(
  corners: Point[],
  slopes: WallSlopeMap | undefined,
  ceilingHeight: number = DEFAULT_CEILING_HEIGHT,
): DormerFootprint[] {
  const out: DormerFootprint[] = [];
  for (const [wallKey, slope] of Object.entries(slopes ?? {})) {
    if (!slope.dormers?.length || !isEffective(slope, ceilingHeight)) continue;
    const seg = resolveWallSegment(corners, parseWallKey(wallKey));
    if (!seg) continue;
    const len = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
    if (len === 0) continue;
    const u = { x: (seg.b.x - seg.a.x) / len, y: (seg.b.y - seg.a.y) / len };
    const n = inwardNormal(corners, seg.a, seg.b);
    const at = (along: number, off: number): Point => ({
      x: seg.a.x + u.x * along + n.x * off,
      y: seg.a.y + u.y * along + n.y * off,
    });
    for (const dormer of slope.dormers) {
      const height = dormerHeight(dormer, ceilingHeight);
      const depth = distanceToClearHeight(slope, height, ceilingHeight);
      const end = dormer.position + dormer.width;
      out.push({
        wallKey,
        dormer,
        outline: [at(dormer.position, 0), at(end, 0), at(end, depth), at(dormer.position, depth)],
        depth,
        height,
        kneeHeight: slope.kneeHeight,
      });
    }
  }
  return out;
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
  options: { maxEdgeCm?: number; cutouts?: Point[][] } = {},
): number[] {
  const maxEdgeCm = options.maxEdgeCm ?? 15;
  // Dormers and roof windows are holes in the roof plane: each dormer gets
  // its own flat ceiling and side walls (dormerShell), a roof window its
  // glass. Cut exactly, before subdividing, so the holes keep straight edges.
  const holes = [
    ...dormerFootprints(corners, slopes, ceilingHeight)
      .filter((d) => d.depth > 0)
      .map((d) => d.outline),
    ...(options.cutouts ?? []),
  ];
  let tris = cutOutConvex(triangulate2D(corners), holes);
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
      out.push(p.x, availableHeightAt(p, corners, slopes, ceilingHeight, { dormers: false }), p.y);
    }
  }
  return out;
}

type Tri = [Point, Point, Point];

/** Twice the signed area of a polygon (its sign is its winding). */
function signedArea2(poly: Point[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}

/** The part of a convex polygon on one side of the line p->q: `side` +1 keeps
 * points left of it (cross product >= 0), -1 the right. Sutherland-Hodgman. */
function clipToSide(poly: Point[], p: Point, q: Point, side: 1 | -1): Point[] {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const score = (v: Point) => side * (dx * (v.y - p.y) - dy * (v.x - p.x));
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const next = poly[(i + 1) % poly.length];
    const sc = score(cur);
    const sn = score(next);
    if (sc >= 0) out.push(cur);
    if (sc >= 0 !== sn >= 0) {
      const t = sc / (sc - sn);
      out.push({ x: cur.x + (next.x - cur.x) * t, y: cur.y + (next.y - cur.y) * t });
    }
  }
  return out;
}

/**
 * Triangles minus convex holes, exactly: every piece is split along each
 * hole edge, the parts outside a hole are kept and the part inside all of
 * its edges is dropped. Pieces stay convex, so each is fanned back into
 * triangles; slivers with no area are discarded. Exported for its tests.
 */
export function cutOutConvex(tris: Tri[], holes: Point[][]): Tri[] {
  let pieces: Point[][] = tris.map((t) => [...t]);
  for (const hole of holes) {
    const area = signedArea2(hole);
    if (hole.length < 3 || Math.abs(area) < 1e-9) continue;
    const inward: 1 | -1 = area > 0 ? 1 : -1;
    const next: Point[][] = [];
    for (const piece of pieces) {
      let inside = piece;
      for (let i = 0; i < hole.length && inside.length >= 3; i++) {
        const p = hole[i];
        const q = hole[(i + 1) % hole.length];
        const outside = clipToSide(inside, p, q, inward === 1 ? -1 : 1);
        if (outside.length >= 3) next.push(outside);
        inside = clipToSide(inside, p, q, inward);
      }
    }
    pieces = next;
  }
  const out: Tri[] = [];
  for (const piece of pieces) {
    for (let i = 1; i + 1 < piece.length; i++) {
      const tri: Tri = [piece[0], piece[i], piece[i + 1]];
      if (Math.abs(signedArea2(tri)) > 1e-6) out.push(tri);
    }
  }
  return out;
}

/**
 * What a dormer adds to the 3D shell, as [x, height, y] triangle triples in
 * room cm (like buildCeilingSurface): its flat ceiling, and its two side
 * walls, each a triangle from the knee wall up to the dormer ceiling and
 * back down the slope to where they meet. The raised front wall is the wall
 * builder's job, since doors and windows go into it.
 */
export function dormerShell(fp: DormerFootprint): { ceiling: number[]; cheeks: number[] } {
  const [w0, w1, d1, d0] = fp.outline;
  const h = fp.height;
  const v = (p: Point, y: number) => [p.x, y, p.y];
  if (fp.depth <= 0) return { ceiling: [], cheeks: [] };
  return {
    ceiling: [...v(w0, h), ...v(w1, h), ...v(d1, h), ...v(w0, h), ...v(d1, h), ...v(d0, h)],
    cheeks: [
      ...v(w0, fp.kneeHeight),
      ...v(w0, h),
      ...v(d0, h),
      ...v(w1, fp.kneeHeight),
      ...v(w1, h),
      ...v(d1, h),
    ],
  };
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
