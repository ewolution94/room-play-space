import type { Item, Point } from "@/types/planner";

export function rotatedAABB(w: number, l: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { w: w * c + l * s, h: w * s + l * c };
}

export function clampPos(item: Item, corners: Point[], x: number, y: number) {
  const aabb = rotatedAABB(item.width, item.length, item.rotation);
  const cx = x + item.width / 2;
  const cy = y + item.length / 2;

  const halfThick = 3; // 3cm offset to account for half of the 6cm wall thickness
  const leftBound = Math.max(corners[0].x, corners[3].x) + halfThick;
  const rightBound = Math.min(corners[1].x, corners[2].x) - halfThick;
  const topBound = Math.max(corners[0].y, corners[1].y) + halfThick;
  const bottomBound = Math.min(corners[2].y, corners[3].y) - halfThick;

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
  const leftBound = Math.max(corners[0].x, corners[3].x);
  const rightBound = Math.min(corners[1].x, corners[2].x);
  const topBound = Math.max(corners[0].y, corners[1].y);
  const bottomBound = Math.min(corners[2].y, corners[3].y);

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
