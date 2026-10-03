import type { Item, Point } from "@/types/planner";

/**
 * The printed blueprint's legend numbers, 1..n, in reading order: top to bottom in bands of
 * `bandCm`, then left to right, by each item's centre. Bands rather than an exact y sort, so a
 * row of chairs at nearly the same height reads left to right instead of zig-zagging.
 */
export function blueprintNumbers(items: Item[], bandCm = 40): Map<string, number> {
  const byCentre = items.map((it) => ({
    id: it.id,
    band: Math.floor((it.y + it.length / 2) / bandCm),
    x: it.x + it.width / 2,
  }));
  byCentre.sort((a, b) => a.band - b.band || a.x - b.x);
  return new Map(byCentre.map((it, i) => [it.id, i + 1]));
}

/** The floor area of a room polygon in m² (shoelace formula; L/T/U shapes included). */
export function floorAreaM2(corners: Point[]): number {
  let twice = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2 / 10_000;
}
