import type { Item } from "@/types/planner";

export function rotatedAABB(w: number, l: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { w: w * c + l * s, h: w * s + l * c };
}

export function clampPos(item: Item, roomW: number, roomL: number, x: number, y: number) {
  const aabb = rotatedAABB(item.width, item.length, item.rotation);
  const cx = x + item.width / 2;
  const cy = y + item.length / 2;
  const minCx = aabb.w / 2;
  const maxCx = roomW - aabb.w / 2;
  const minCy = aabb.h / 2;
  const maxCy = roomL - aabb.h / 2;
  const ncx = aabb.w > roomW ? roomW / 2 : Math.max(minCx, Math.min(maxCx, cx));
  const ncy = aabb.h > roomL ? roomL / 2 : Math.max(minCy, Math.min(maxCy, cy));
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

export function collidesWithOthers(
  candidate: Item,
  others: Item[],
  ignoreIds?: Set<string>,
  collisionEnabled = true,
): boolean {
  if (!collisionEnabled) return false;
  return others.some(
    (o) => o.id !== candidate.id && !(ignoreIds && ignoreIds.has(o.id)) && obbOverlap(candidate, o),
  );
}

export function findFreeSpot(
  item: Item,
  others: Item[],
  roomW: number,
  roomL: number,
  collisionEnabled = true,
): { x: number; y: number } | null {
  const step = 10;
  // Try to find a non-overlapping spot first (always nice to avoid stacking)
  for (let y = 0; y <= roomL; y += step) {
    for (let x = 0; x <= roomW; x += step) {
      const c = clampPos(item, roomW, roomL, x, y);
      const candidate = { ...item, x: c.x, y: c.y };
      if (!collidesWithOthers(candidate, others, undefined, true)) return c;
    }
  }
  // If collision is disabled and we couldn't find a free spot, just return a clamped default position (e.g. center)
  if (!collisionEnabled) {
    return clampPos(item, roomW, roomL, roomW / 2, roomL / 2);
  }
  return null;
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
