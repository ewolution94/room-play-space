import type { Item, Opening, Point } from "@/types/planner";
import { resolveWallSegment } from "@/lib/hallway-shapes";
import { inwardNormal } from "@/lib/wall-slopes";
import { collidesWithOthers, obbCorners, rotatedAABB } from "@/lib/planner-math";
import { OPENING_GEOMETRY, isSwingingOpening, openingLeaves } from "@/lib/openings";

/**
 * Placement problems worth flagging on the plan: items overlapping each other (possible with
 * collision switched off, or after an import), and items standing where a door swings or in
 * front of a window. Nothing here blocks a move; it only tells the canvas and the Elements list
 * what to mark.
 */
export interface PlacementIssues {
  /** Item id -> the items it overlaps, by the same rules as collision (main layer only). */
  overlaps: Map<string, string[]>;
  /** Item id -> the doors and windows it's in the way of. */
  blocks: Map<string, string[]>;
  /** Door or window id -> the items in its way. */
  blockedOpenings: Map<string, string[]>;
}

/** An item's vertical extent in cm, floor to top (elevation included). */
export type VerticalExtent = (item: Item) => { bottom: number; top: number };

/** How far into the room an outward-opening door's doorway is kept clear: enough to step through. */
export const DOORWAY_DEPTH_CM = 60;
/** How far in front of a window an item reaching above the sill gets in the way of opening it. */
export const WINDOW_DEPTH_CM = 40;
/** Same tolerance as obbOverlap: less than this is touching, not overlapping. */
const TOUCH_CM = 0.5;
/** Arc resolution for a door's swing; the sector stays convex at any count. */
const ARC_STEPS = 8;

function project(poly: Point[], ax: number, ay: number): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const d = p.x * ax + p.y * ay;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

/** Separating-axis test for two convex polygons, with obbOverlap's touch tolerance. */
export function convexOverlap(a: Point[], b: Point[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      if (len === 0) continue;
      const ax = -(q.y - p.y) / len;
      const ay = (q.x - p.x) / len;
      const [aMin, aMax] = project(a, ax, ay);
      const [bMin, bMax] = project(b, ax, ay);
      if (aMax - TOUCH_CM <= bMin || bMax - TOUCH_CM <= aMin) return false;
    }
  }
  return true;
}

/** A quarter-circle door leaf: hinged at `hinge`, closed along `along`, swinging into `into`. */
function leafSector(hinge: Point, along: Point, into: Point, radius: number): Point[] {
  const pts: Point[] = [hinge];
  for (let s = 0; s <= ARC_STEPS; s++) {
    const t = ((s / ARC_STEPS) * Math.PI) / 2;
    const c = Math.cos(t);
    const n = Math.sin(t);
    pts.push({
      x: hinge.x + radius * (c * along.x + n * into.x),
      y: hinge.y + radius * (c * along.y + n * into.y),
    });
  }
  return pts;
}

/** A strip `depth` cm deep in front of an opening, from `p0` to `p1` along the wall. */
function strip(p0: Point, p1: Point, into: Point, depth: number): Point[] {
  return [
    p0,
    p1,
    { x: p1.x + into.x * depth, y: p1.y + into.y * depth },
    { x: p0.x + into.x * depth, y: p0.y + into.y * depth },
  ];
}

/**
 * The floor area an opening needs kept clear, and the height band it needs it in:
 * - a door or terrace door swinging into the room: each leaf's quarter circle (two half-width
 *   leaves for a two-leaf terrace door, hinged at both ends, as the canvas draws them);
 * - one opening outward: the doorway, DOORWAY_DEPTH_CM deep;
 * - a window: WINDOW_DEPTH_CM in front of it, between its sill and its top.
 */
export function openingClearance(
  o: Opening,
  corners: Point[],
): { zones: Point[][]; bottom: number; top: number } | null {
  const seg = resolveWallSegment(corners, o.wall);
  if (!seg) return null;
  const len = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
  if (len === 0) return null;
  const u = { x: (seg.b.x - seg.a.x) / len, y: (seg.b.y - seg.a.y) / len };
  const into = inwardNormal(corners, seg.a, seg.b);
  const at = (d: number) => ({ x: seg.a.x + u.x * d, y: seg.a.y + u.y * d });
  const start = at(o.position);
  const end = at(o.position + o.width);
  const { sill, height } = OPENING_GEOMETRY[o.kind];
  const band = { bottom: sill, top: sill + height };

  if (!isSwingingOpening(o.kind)) {
    return { zones: [strip(start, end, into, WINDOW_DEPTH_CM)], ...band };
  }
  if ((o.swing ?? "in") === "out") {
    return { zones: [strip(start, end, into, DOORWAY_DEPTH_CM)], ...band };
  }
  const back = { x: -u.x, y: -u.y };
  if (openingLeaves(o) === 2) {
    const r = o.width / 2;
    return { zones: [leafSector(start, u, into, r), leafSector(end, back, into, r)], ...band };
  }
  const zone =
    (o.hinge ?? "start") === "start"
      ? leafSector(start, u, into, o.width)
      : leafSector(end, back, into, o.width);
  return { zones: [zone], ...band };
}

/** Whether two items' bounding boxes overlap at all: a cheap first pass before the real test. */
function boxesMeet(a: Item, b: Item): boolean {
  const ab = rotatedAABB(a.width, a.length, a.rotation);
  const bb = rotatedAABB(b.width, b.length, b.rotation);
  const dx = Math.abs(a.x + a.width / 2 - (b.x + b.width / 2));
  const dy = Math.abs(a.y + a.length / 2 - (b.y + b.length / 2));
  return dx < (ab.w + bb.w) / 2 && dy < (ab.h + bb.h) / 2;
}

const push = (map: Map<string, string[]>, key: string, value: string) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

export function findPlacementIssues(
  items: Item[],
  openings: Opening[],
  corners: Point[],
  extentOf: VerticalExtent,
): PlacementIssues {
  const overlaps = new Map<string, string[]>();
  const blocks = new Map<string, string[]>();
  const blockedOpenings = new Map<string, string[]>();

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (!boxesMeet(a, b) || !collidesWithOthers(a, [b], undefined, true)) continue;
      push(overlaps, a.id, b.id);
      push(overlaps, b.id, a.id);
    }
  }

  for (const o of openings) {
    const clearance = openingClearance(o, corners);
    if (!clearance) continue;
    for (const it of items) {
      // A rug lies flat: a door sweeps over it, and it covers no window. Whatever sits on top of
      // another item (a monitor on the desk under a window) rides on its host, and the host is
      // what's in the way, if anything is -- flagging it too would put warnings on a plain desk.
      const layer = it.layer ?? "main";
      if (layer === "under" || layer === "on-top") continue;
      const { bottom, top } = extentOf(it);
      if (top <= clearance.bottom || bottom >= clearance.top) continue;
      const footprint = obbCorners(it);
      if (!clearance.zones.some((zone) => convexOverlap(zone, footprint))) continue;
      push(blocks, it.id, o.id);
      push(blockedOpenings, o.id, it.id);
    }
  }

  return { overlaps, blocks, blockedOpenings };
}

/**
 * One line per flagged item, the same on the canvas (tooltip) and in the Elements list:
 * its warnings joined with " · ". A terrace door counts as a door.
 */
export function itemIssueText(
  issues: PlacementIssues,
  openings: Pick<Opening, "id" | "kind">[],
  labels: { overlaps: string; door: string; window: string },
): Map<string, string> {
  const kindOf = new Map(openings.map((o) => [o.id, o.kind]));
  const text = new Map<string, string>();
  for (const id of new Set([...issues.overlaps.keys(), ...issues.blocks.keys()])) {
    const blocked = issues.blocks.get(id) ?? [];
    const parts: string[] = [];
    if (issues.overlaps.has(id)) parts.push(labels.overlaps);
    if (blocked.some((o) => kindOf.get(o) !== "window")) parts.push(labels.door);
    if (blocked.some((o) => kindOf.get(o) === "window")) parts.push(labels.window);
    text.set(id, parts.join(" · "));
  }
  return text;
}
