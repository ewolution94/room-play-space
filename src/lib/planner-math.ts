import type { Item, Point } from "@/types/planner";
import { insetRectilinearPolygon } from "@/lib/hallway-shapes";

export function rotatedAABB(w: number, l: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { w: w * c + l * s, h: w * s + l * c };
}

/** Half the 6cm wall thickness. The usable floor is the room's polygon
 * inset by this much on every side -- the same number `clampPos` has always
 * used, named because the polygon path below needs it too. */
const WALL_HALF_THICKNESS = 3;

/**
 * The bounding-box clamp, unchanged: the fast path for ordinary 4-corner
 * rooms and the last-resort fallback for a polygon room where the item fits
 * nowhere (see `clampPos`).
 */
function clampToBoundingBox(item: Item, corners: Point[], x: number, y: number) {
  const aabb = rotatedAABB(item.width, item.length, item.rotation);
  const cx = x + item.width / 2;
  const cy = y + item.length / 2;

  // Interior usable area is the polygon's own bounding box, inset by half
  // the wall thickness on every side. For a plain axis-aligned rectangle
  // this is identical to the old corners[0]/[1]/[2]/[3]-indexed formula (the
  // min/max of all 4 corners equals those specific pairs for a rectangle).
  const halfThick = WALL_HALF_THICKNESS;
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const leftBound = Math.min(...xs) + halfThick;
  const rightBound = Math.max(...xs) - halfThick;
  const topBound = Math.min(...ys) + halfThick;
  const bottomBound = Math.max(...ys) - halfThick;

  const w = Math.max(10, rightBound - leftBound);
  const l = Math.max(10, bottomBound - topBound);

  const minCx = leftBound + aabb.w / 2;
  const maxCx = rightBound - aabb.w / 2;
  const minCy = topBound + aabb.h / 2;
  const maxCy = bottomBound - aabb.h / 2;

  const ncx = aabb.w > w ? leftBound + w / 2 : Math.max(minCx, Math.min(maxCx, cx));
  const ncy = aabb.h > l ? topBound + l / 2 : Math.max(minCy, Math.min(maxCy, cy));
  return { x: ncx - item.width / 2, y: ncy - item.length / 2 };
}

/** The four corners of an item's rotated AABB, pulled 0.01cm inward before
 * testing. An item resting exactly flush against a wall puts its corners
 * exactly on the inset polygon's edge, where ray casting is entitled to
 * answer either way (see `pointInPolygon`); 0.01cm is far below anything
 * the app can express and makes flush placement answer "inside" every
 * time. */
function aabbInsidePolygon(
  cx: number,
  cy: number,
  aabb: { w: number; h: number },
  poly: Point[],
): boolean {
  const eps = 0.01;
  const hw = Math.max(0, aabb.w / 2 - eps);
  const hh = Math.max(0, aabb.h / 2 - eps);
  return (
    pointInPolygon({ x: cx - hw, y: cy - hh }, poly) &&
    pointInPolygon({ x: cx + hw, y: cy - hh }, poly) &&
    pointInPolygon({ x: cx + hw, y: cy + hh }, poly) &&
    pointInPolygon({ x: cx - hw, y: cy + hh }, poly)
  );
}

/**
 * Clamps an item's top-left position so the item stays on the room's floor.
 *
 * A plain rectangle (`corners.length === 4` -- every room that isn't a
 * shaped room or a hallway) takes the bounding-box path and nothing else,
 * so the common case provably cannot regress.
 *
 * For a polygon room the bounding box is larger than the floor: an L/T/U's
 * notch lies inside the box without being floor, which is how a sofa could
 * be dragged into thin air. The rule for those:
 *
 * 1. If the item's rotated AABB lies entirely inside the inset polygon (all
 *    four corners test interior), accept the position as-is. Asking "is the
 *    item on floor" rather than "does the item fit inside one rectangle of
 *    a decomposition" is what lets a sofa legitimately span both arms of
 *    an L.
 * 2. Otherwise clamp into whichever floor rectangle the item fits in that
 *    leaves it nearest the requested point, so a drag into the notch slides
 *    along the notch's edge instead of stopping dead.
 * 3. If it fits in no rectangle at all, fall back to the bounding-box
 *    result. A drag that silently does nothing reads as a broken app, and
 *    that fallback is exactly the behaviour this function had for years.
 *
 * Step 1 is marginally permissive by construction -- an item big enough to
 * bridge a notch with all four corners on floor and its middle over the gap
 * is accepted. Nothing in the catalog is that shape relative to a real
 * notch, whereas a strict fits-in-one-rectangle rule refuses ordinary
 * placements that are genuinely fine, which is the more visible wrong
 * answer.
 */
export function clampPos(item: Item, corners: Point[], x: number, y: number) {
  const boxed = clampToBoundingBox(item, corners, x, y);
  if (corners.length === 4) return boxed;

  const floor = insetRectilinearPolygon(corners, WALL_HALF_THICKNESS);
  const aabb = rotatedAABB(item.width, item.length, item.rotation);
  const boxedCx = boxed.x + item.width / 2;
  const boxedCy = boxed.y + item.length / 2;
  if (aabbInsidePolygon(boxedCx, boxedCy, aabb, floor)) return boxed;

  const wantCx = x + item.width / 2;
  const wantCy = y + item.length / 2;
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (const r of rectilinearPolygonSpanRects(floor)) {
    // Tolerance, not slack: inset corners are floating-point, so an item
    // exactly as wide as its arm must not be rejected by a 1e-13 shortfall.
    if (aabb.w > r.width + 1e-9 || aabb.h > r.height + 1e-9) continue;
    const cx = Math.max(r.x + aabb.w / 2, Math.min(r.x + r.width - aabb.w / 2, wantCx));
    const cy = Math.max(r.y + aabb.h / 2, Math.min(r.y + r.height - aabb.h / 2, wantCy));
    const dist = (cx - wantCx) ** 2 + (cy - wantCy) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = { x: cx, y: cy };
    }
  }
  if (!best) return boxed;
  return { x: best.x - item.width / 2, y: best.y - item.length / 2 };
}

export function obbCorners(item: {
  x: number;
  y: number;
  width: number;
  length: number;
  rotation: number;
}) {
  const cx = item.x + item.width / 2;
  const cy = item.y + item.length / 2;
  const r = (item.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const hw = item.width / 2;
  const hl = item.length / 2;
  const pts: [number, number][] = [
    [-hw, -hl],
    [hw, -hl],
    [hw, hl],
    [-hw, hl],
  ];
  return pts.map(([x, y]) => ({ x: cx + x * cos - y * sin, y: cy + x * sin + y * cos }));
}

export function obbOverlap(
  a: Parameters<typeof obbCorners>[0],
  b: Parameters<typeof obbCorners>[0],
) {
  const A = obbCorners(a);
  const B = obbCorners(b);
  const eps = 0.5;
  for (const poly of [A, B]) {
    for (let i = 0; i < 4; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % 4];
      const ex = p2.x - p1.x;
      const ey = p2.y - p1.y;
      const len = Math.hypot(ex, ey) || 1;
      const ax = -ey / len;
      const ay = ex / len;
      let aMin = Infinity,
        aMax = -Infinity,
        bMin = Infinity,
        bMax = -Infinity;
      for (const p of A) {
        const d = p.x * ax + p.y * ay;
        if (d < aMin) aMin = d;
        if (d > aMax) aMax = d;
      }
      for (const p of B) {
        const d = p.x * ax + p.y * ay;
        if (d < bMin) bMin = d;
        if (d > bMax) bMax = d;
      }
      if (aMax - eps <= bMin || bMax - eps <= aMin) return false;
    }
  }
  return true;
}

/**
 * Returns the minimum penetration depth between two OBBs using SAT.
 * Returns 0 if the shapes do not overlap.
 */
export function obbOverlapDepth(
  a: Parameters<typeof obbCorners>[0],
  b: Parameters<typeof obbCorners>[0],
): number {
  const A = obbCorners(a);
  const B = obbCorners(b);
  const eps = 0.5;
  let minDepth = Infinity;
  for (const poly of [A, B]) {
    for (let i = 0; i < 4; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % 4];
      const ex = p2.x - p1.x;
      const ey = p2.y - p1.y;
      const len = Math.hypot(ex, ey) || 1;
      const ax = -ey / len;
      const ay = ex / len;
      let aMin = Infinity,
        aMax = -Infinity,
        bMin = Infinity,
        bMax = -Infinity;
      for (const p of A) {
        const d = p.x * ax + p.y * ay;
        if (d < aMin) aMin = d;
        if (d > aMax) aMax = d;
      }
      for (const p of B) {
        const d = p.x * ax + p.y * ay;
        if (d < bMin) bMin = d;
        if (d > bMax) bMax = d;
      }
      if (aMax - eps <= bMin || bMax - eps <= aMin) return 0;
      const depth = Math.min(aMax - bMin, bMax - aMin);
      if (depth < minDepth) minDepth = depth;
    }
  }
  return minDepth;
}

/** The four corners of a plain axis-aligned rectangle, as a closed polygon
 * point list -- a convenience for feeding a simple {x,y,width,length} box
 * into the polygon-based room collision helpers below. */
export function rectCorners(r: { x: number; y: number; width: number; length: number }): Point[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.length },
    { x: r.x, y: r.y + r.length },
  ];
}

/** Standard ray-casting point-in-polygon test. Works for both convex and
 * concave simple polygons regardless of winding order. A point exactly on
 * the boundary may return either result (as with any ray-casting
 * implementation) -- callers that care about that edge case should test at
 * a point guaranteed to be strictly interior, as rectilinearPolygonRects
 * below does (it only ever tests grid-cell midpoints, which can never sit
 * exactly on an edge of a rectilinear polygon). */
export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y;
    const xj = poly[j].x,
      yj = poly[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Decomposes an axis-aligned rectilinear polygon (every corner a 90 or 270
 * degree turn -- true of every room shape in this app: plain rectangles and
 * every L/T hallway template in hallway-shapes.ts) into a set of
 * axis-aligned rectangles whose union exactly equals the polygon's
 * interior. This is what makes exact room-vs-room collision for an L/T
 * hallway tractable: rather than a general (and, for concave shapes,
 * fiddly) polygon-vs-polygon intersection routine, two rectilinear
 * polygons overlap if and only if some rectangle from one's decomposition
 * overlaps some rectangle from the other's -- ordinary axis-aligned
 * rectangle overlap, which is simple and already well-tested (see
 * rectilinearPolygonsOverlap below).
 *
 * Standard "grid cell" technique: every distinct x and y coordinate among
 * the polygon's corners partitions the plane into a small grid (at most
 * ~4x4 for a T-shape), and a cell belongs to the polygon iff its own
 * midpoint tests as interior. A plain rectangle reduces to exactly one
 * cell -- itself -- so this is pixel/behavior-identical to a simple
 * rectangle for every existing (non-hallway) room.
 */
export function rectilinearPolygonRects(
  poly: Point[],
): { x: number; y: number; width: number; height: number }[] {
  const xs = Array.from(new Set(poly.map((p) => p.x))).sort((a, b) => a - b);
  const ys = Array.from(new Set(poly.map((p) => p.y))).sort((a, b) => a - b);
  const rects: { x: number; y: number; width: number; height: number }[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const midX = (xs[i] + xs[i + 1]) / 2;
      const midY = (ys[j] + ys[j + 1]) / 2;
      if (pointInPolygon({ x: midX, y: midY }, poly)) {
        rects.push({ x: xs[i], y: ys[j], width: xs[i + 1] - xs[i], height: ys[j + 1] - ys[j] });
      }
    }
  }
  return rects;
}

/**
 * Every *maximal* axis-aligned rectangle that fits entirely inside a
 * rectilinear polygon, built from the same corner-coordinate grid as
 * `rectilinearPolygonRects` above.
 *
 * The difference matters for furniture. That function returns the polygon's
 * grid *cells*, and a cell is routinely much smaller than the floor it
 * belongs to: a T-shaped room's 400cm-wide bar is sliced into three ~133cm
 * cells by the stem's two side walls, so a 150cm sofa fits in no cell of a
 * bar it obviously fits in. A run of adjacent cells is a valid rectangle
 * iff every cell in the run is interior, which recovers the bar as one
 * 400cm rectangle.
 *
 * Rectangles contained in another are dropped: a subset can never be the
 * nearest fit for anything its container isn't, and the maximal set is the
 * one a caller can reason about. Grids here are at most ~4x4 corners, so
 * the brute-force enumeration is a few dozen checks -- cheap enough to run
 * per pointer-move.
 */
export function rectilinearPolygonSpanRects(
  poly: Point[],
): { x: number; y: number; width: number; height: number }[] {
  const xs = Array.from(new Set(poly.map((p) => p.x))).sort((a, b) => a - b);
  const ys = Array.from(new Set(poly.map((p) => p.y))).sort((a, b) => a - b);
  const nx = xs.length - 1;
  const ny = ys.length - 1;
  const interior: boolean[][] = [];
  for (let i = 0; i < nx; i++) {
    interior.push([]);
    for (let j = 0; j < ny; j++) {
      const midX = (xs[i] + xs[i + 1]) / 2;
      const midY = (ys[j] + ys[j + 1]) / 2;
      interior[i].push(pointInPolygon({ x: midX, y: midY }, poly));
    }
  }

  const rects: { x: number; y: number; width: number; height: number }[] = [];
  for (let i1 = 0; i1 < nx; i1++) {
    for (let i2 = i1; i2 < nx; i2++) {
      for (let j1 = 0; j1 < ny; j1++) {
        for (let j2 = j1; j2 < ny; j2++) {
          let solid = true;
          for (let i = i1; i <= i2 && solid; i++) {
            for (let j = j1; j <= j2; j++) {
              if (!interior[i][j]) {
                solid = false;
                break;
              }
            }
          }
          if (solid) {
            rects.push({
              x: xs[i1],
              y: ys[j1],
              width: xs[i2 + 1] - xs[i1],
              height: ys[j2 + 1] - ys[j1],
            });
          }
        }
      }
    }
  }

  return rects.filter(
    (r, idx) =>
      !rects.some(
        (o, k) =>
          k !== idx &&
          o.x <= r.x &&
          o.y <= r.y &&
          o.x + o.width >= r.x + r.width &&
          o.y + o.height >= r.y + r.height,
      ),
  );
}

/**
 * Exact overlap test between two axis-aligned rectilinear polygons (see
 * rectilinearPolygonRects above) -- the room-vs-room analog of obbOverlap,
 * used so an L/T-shaped hallway's collision footprint matches its visual
 * silhouette exactly rather than its rectangular bounding box, allowing
 * another room to be placed directly into the notch/leg of an L or T shape.
 * `eps` mirrors obbOverlap's tolerance: two rectangles exactly flush
 * (zero-gap touching, the common "0-4 walls" flush-room workflow) are not
 * considered overlapping.
 */
export function rectilinearPolygonsOverlap(polyA: Point[], polyB: Point[], eps = 0.5): boolean {
  const rectsA = rectilinearPolygonRects(polyA);
  const rectsB = rectilinearPolygonRects(polyB);
  return rectsA.some((ra) =>
    rectsB.some((rb) => {
      const noOverlapX = ra.x + ra.width - eps <= rb.x || rb.x + rb.width - eps <= ra.x;
      const noOverlapY = ra.y + ra.height - eps <= rb.y || rb.y + rb.height - eps <= ra.y;
      return !noOverlapX && !noOverlapY;
    }),
  );
}

export function collidesWithOthers(
  candidate: Item,
  others: Item[],
  ignoreIds?: Set<string>,
  collisionEnabled = true,
): boolean {
  if (!collisionEnabled) return false;
  // Only "main" layer items participate in collision at all. "under" items
  // (rugs, mats) sit beneath everything and "on-top" items (lamps, laptops)
  // sit on top of a main item -- neither should ever block a move or be
  // treated as an obstacle, regardless of how much their footprints
  // overlap something else. Missing layer means "main" (pre-existing items
  // from before this field existed keep colliding exactly as before).
  if ((candidate.layer ?? "main") !== "main") return false;
  return others.some(
    (o) =>
      o.id !== candidate.id &&
      // A declared host/child pair (see Item.placedOnId) is EXPECTED to
      // share a footprint -- one is intentionally sitting on top of the
      // other -- so neither ever blocks the other, in either direction,
      // regardless of layer. Checked both ways since `candidate` is
      // sometimes the child (has placedOnId === o.id) and sometimes the
      // host being tested against its own already-placed child (o has
      // placedOnId === candidate.id).
      o.id !== candidate.placedOnId &&
      o.placedOnId !== candidate.id &&
      (o.layer ?? "main") === "main" &&
      !(ignoreIds && ignoreIds.has(o.id)) &&
      obbOverlap(candidate, o),
  );
}

export function findFreeSpot(
  item: Item,
  others: Item[],
  corners: Point[],
  collisionEnabled = true,
): { x: number; y: number } | null {
  const step = 10;
  // Bounding box of the room's own polygon -- see clampPos above for why
  // this is behavior-identical to the old 4-indexed-corner formula for a
  // plain rectangle, and an intentional bounding-box approximation for a
  // polygon (hallway) room.
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const leftBound = Math.min(...xs);
  const rightBound = Math.max(...xs);
  const topBound = Math.min(...ys);
  const bottomBound = Math.max(...ys);

  // Try to find a non-overlapping spot first (always nice to avoid stacking)
  for (let y = topBound; y <= bottomBound; y += step) {
    for (let x = leftBound; x <= rightBound; x += step) {
      const c = clampPos(item, corners, x, y);
      const candidate = { ...item, x: c.x, y: c.y };
      if (!collidesWithOthers(candidate, others, undefined, true)) return c;
    }
  }
  // If collision is disabled and we couldn't find a free spot, just return a clamped default position (e.g. center)
  if (!collisionEnabled) {
    return clampPos(item, corners, (leftBound + rightBound) / 2, (topBound + bottomBound) / 2);
  }
  return null;
}

/**
 * Resolves a drag from `from` toward `target`, binary-searching along the
 * straight-line path when the direct target collides so a large per-event
 * pointer delta (e.g. at low zoom) can't "tunnel" the dragged shape straight
 * through an obstacle -- only testing the endpoint would miss anything the
 * path crosses on the way there. Falls back to sliding along a single axis
 * (still swept the same way) so a diagonal drag toward a neighbor slides
 * flush along its face instead of stopping dead the moment either axis
 * touches something. Returns null if every attempt is blocked, including
 * the case where `from` itself already collides (e.g. collision was just
 * re-enabled while overlapping) -- there's nothing safe to resolve from.
 *
 * `collidesAt` and `clamp` are injected so this stays pure and reusable for
 * both the multi-room master plan (clamped to the floor) and, potentially,
 * single-room item drags -- neither React state nor room/item shape is
 * referenced here directly.
 */
export function resolveSweptMove(
  from: Point,
  target: Point,
  collidesAt: (x: number, y: number) => boolean,
  clamp: (x: number, y: number) => Point = (x, y) => ({ x, y }),
): Point | null {
  const resolve = (toX: number, toY: number): Point | null => {
    const to = clamp(toX, toY);
    if (!collidesAt(to.x, to.y)) return to;
    if (collidesAt(from.x, from.y)) return null;

    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const t = (lo + hi) / 2;
      const p = clamp(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
      if (!collidesAt(p.x, p.y)) lo = t;
      else hi = t;
    }
    const resolved = clamp(from.x + (to.x - from.x) * lo, from.y + (to.y - from.y) * lo);
    return resolved.x === from.x && resolved.y === from.y ? null : resolved;
  };

  return resolve(target.x, target.y) ?? resolve(target.x, from.y) ?? resolve(from.x, target.y);
}

/**
 * Finds which "main" layer item (if any) a just-dropped "on-top" item (a
 * lamp, TV, console, ...) now overlaps in the top-down footprint, so it can
 * be auto-elevated to rest on that item's surface instead of keeping
 * whatever elevation it happened to have before the drag. When the
 * footprint overlaps multiple main items, the one with the highest top
 * surface wins (the most plausible "resting on top of").
 *
 * `getHeight` is injected (rather than importing the catalog's
 * getDefaultHeight here) so this stays pure and independent of
 * planner-presets.ts, matching the pattern used by resolveSweptMove above.
 */
export function findOnTopHost(
  candidate: Item,
  others: Item[],
  getHeight: (it: Item) => number,
): Item | null {
  const hosts = others.filter(
    (o) => o.id !== candidate.id && (o.layer ?? "main") === "main" && obbOverlap(candidate, o),
  );
  if (!hosts.length) return null;
  return hosts.reduce((best, h) => {
    const bestTop = (best.elevation ?? 0) + getHeight(best);
    const hTop = (h.elevation ?? 0) + getHeight(h);
    return hTop > bestTop ? h : best;
  });
}

/**
 * The elevation an "on-top" item should have after being dropped at its
 * current position: the top surface of whatever main item it now overlaps,
 * or 0 (floor level) if it isn't over anything.
 */
export function computeOnTopElevation(
  candidate: Item,
  others: Item[],
  getHeight: (it: Item) => number,
): number {
  const host = findOnTopHost(candidate, others, getHeight);
  if (!host) return 0;
  return (host.elevation ?? 0) + getHeight(host);
}

export function readableText(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#000";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#111" : "#fff";
}
