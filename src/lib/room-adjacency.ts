import type { Opening, Point, RoomLayout } from "@/types/planner";
import { wallSegments, wallColorKey, type WallSegment } from "@/lib/hallway-shapes";

// Cross-room wall-touching detection for the "0-4 walls" feature: two rooms
// placed flush against each other in the multi-room overview auto-suggest
// opening the shared wall on both sides, so a user can compose complex
// layouts out of several simple rooms instead of needing one big polygon.
// This is purely a rendering/opening-eligibility concern -- see
// RoomLayout.wallOverrides in types/planner.ts for how a manual choice
// overrides the auto-detected suggestion, and planner-math.ts for why
// collision/furniture-clamping deliberately stay untouched (each room keeps
// its own independent footprint no matter how many walls are open).
//
// A wall's openness is a list of intervals along its own length (same
// 0..wallLength coordinate space `Opening.position` already uses), not a
// single boolean -- a short room touching one end of a much longer
// neighbor's wall should only open the matching span, not the whole wall.
// Rendering (CanvasArea.tsx, ThreeDView.tsx, MultiRoomCanvas.tsx) turns
// this into the complementary *closed* sub-segments via
// closedSubIntervals() and draws/extrudes those instead of the full wall.

export interface WallOpenInterval {
  start: number; // cm, 0 = the wall's `a` endpoint
  end: number;
}

/**
 * A room's wall corners translated into the shared multi-room-overview
 * coordinate space. Rotation is not applied here: rotateRoomLayout() (see
 * multi-room-actions.ts) already rebuilds `corners` in local space to
 * reflect the rotated shape, so a room's local corners always already match
 * its current width/length/orientation -- only a translation by the room's
 * own (x, y) is needed to place them on the shared floor plan. Falls back
 * to a synthesized rectangle for any room saved before `corners` existed.
 */
function globalCorners(room: RoomLayout): Point[] {
  const local =
    room.corners && room.corners.length >= 3
      ? room.corners
      : [
          { x: 0, y: 0 },
          { x: room.width, y: 0 },
          { x: room.width, y: room.length },
          { x: 0, y: room.length },
        ];
  return local.map((c) => ({ x: c.x + room.x, y: c.y + room.y }));
}

// Two walls "touch" when they run (anti-)parallel, sit within a few cm of
// each other (rooms dragged flush end up at ~0cm apart, but the swept-move
// binary search in planner-math.ts only converges to *near* zero, not
// exactly), and overlap along their shared line by at least this much --
// a small fixed distance rather than a fraction of either wall's length,
// since a tiny sliver of overlap is now rendered as a correspondingly tiny
// (still sensible) gap instead of forcing an entire long wall open.
const TOUCH_GAP_EPS = 3; // cm
const TOUCH_PARALLEL_EPS = 0.05; // |cross product of unit direction vectors|
const MIN_OVERLAP_CM = 20;

function unitDir(seg: WallSegment): Point {
  const dx = seg.b.x - seg.a.x;
  const dy = seg.b.y - seg.a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/**
 * If `a` and `b` touch, returns the overlapping span in *a's own* local
 * 0..a.length coordinate space (0 = a.a, positive toward a.b) -- i.e. the
 * portion of wall `a` that should open because wall `b` is right up
 * against it there. Returns null if they don't touch at all, or touch by
 * less than MIN_OVERLAP_CM (a sliver too small to be worth a visible gap).
 */
function segmentOverlap(a: WallSegment, b: WallSegment): WallOpenInterval | null {
  if (a.length < 1 || b.length < 1) return null;

  const da = unitDir(a);
  const db = unitDir(b);
  // Parallel (or anti-parallel -- two facing walls run in opposite
  // directions along their own winding) test via the cross product of the
  // two unit direction vectors, which is sin(angle between them).
  const cross = da.x * db.y - da.y * db.x;
  if (Math.abs(cross) > TOUCH_PARALLEL_EPS) return null;

  // Perpendicular distance from b's line to a's line.
  const nx = -da.y;
  const ny = da.x;
  const distB = Math.abs((b.a.x - a.a.x) * nx + (b.a.y - a.a.y) * ny);
  if (distB > TOUCH_GAP_EPS) return null;

  // Overlap along a's own direction, clamped to a's own extent.
  const tB1 = (b.a.x - a.a.x) * da.x + (b.a.y - a.a.y) * da.y;
  const tB2 = (b.b.x - a.a.x) * da.x + (b.b.y - a.a.y) * da.y;
  const start = Math.max(0, Math.min(tB1, tB2));
  const end = Math.min(a.length, Math.max(tB1, tB2));
  if (end - start < MIN_OVERLAP_CM) return null;
  return { start, end };
}

/** Sorts and merges overlapping/touching intervals -- needed when several
 * different neighbors each touch a different (possibly overlapping) span
 * of the same long wall. */
function mergeIntervals(intervals: WallOpenInterval[]): WallOpenInterval[] {
  if (intervals.length <= 1) return intervals.map((i) => ({ ...i }));
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: WallOpenInterval[] = [{ ...sorted[0] }];
  for (const cur of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (cur.start <= last.end + 0.01) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/**
 * Existing door spans on a given wall, expressed in that wall's own local
 * 0..seg.length forward-winding coordinate space. Only `kind === "door"`
 * openings count -- a window isn't a walkway, so it shouldn't clip an
 * auto-open span down to its footprint the way a door does (see the
 * door-clipping block in computeAutoOpenIntervals below). Mirrors the
 * "bottom"/"left" reversed-measurement quirk already handled in
 * ThreeDView.tsx's buildWallSegments: those two named walls are measured in
 * the *reverse* of forward-winding order (see resolveWallSegment in
 * hallway-shapes.ts), so a door's raw `position` needs flipping before it
 * lines up with `seg`'s own a-to-b direction.
 */
function doorSpansOnWall(
  room: RoomLayout,
  seg: WallSegment,
  cornersLen: number,
): WallOpenInterval[] {
  const key = wallColorKey(seg.index, cornersLen);
  const isReversedNamedWall = key === "bottom" || key === "left";
  const spans: WallOpenInterval[] = [];
  for (const o of room.openings as Opening[]) {
    if (o.kind !== "door") continue;
    const wallKey = typeof o.wall === "string" ? o.wall : String(o.wall);
    if (wallKey !== key) continue;
    const start = isReversedNamedWall ? seg.length - o.position - o.width : o.position;
    spans.push({ start, end: start + o.width });
  }
  return spans;
}

/** Clamps `a` to the portion of it that also lies within `b`; null if they
 * don't overlap at all. */
function intersectInterval(a: WallOpenInterval, b: WallOpenInterval): WallOpenInterval | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  if (end <= start) return null;
  return { start, end };
}

/** Projects an arbitrary point onto `seg`'s own local 0..seg.length scalar
 * coordinate (not clamped -- the caller is responsible for that, since a
 * projected point from a touching-but-not-identical-length wall can
 * legitimately fall slightly outside 0..length). */
function projectPointToFrame(p: Point, seg: WallSegment): number {
  const dir = unitDir(seg);
  return (p.x - seg.a.x) * dir.x + (p.y - seg.a.y) * dir.y;
}

/**
 * Re-expresses a span measured in `fromSeg`'s local frame as the equivalent
 * physical span in `toSeg`'s local frame. Two touching walls run
 * anti-parallel (they face each other), so directly reusing the same
 * start/end scalars would put the span backwards -- instead this turns the
 * span's endpoints into actual (x,y) points along fromSeg, then re-projects
 * those points onto toSeg, taking min/max of the two results since which
 * endpoint maps to which end flips between the two frames.
 */
function convertSpan(
  span: WallOpenInterval,
  fromSeg: WallSegment,
  toSeg: WallSegment,
): WallOpenInterval {
  const dir = unitDir(fromSeg);
  const p1 = { x: fromSeg.a.x + dir.x * span.start, y: fromSeg.a.y + dir.y * span.start };
  const p2 = { x: fromSeg.a.x + dir.x * span.end, y: fromSeg.a.y + dir.y * span.end };
  const t1 = projectPointToFrame(p1, toSeg);
  const t2 = projectPointToFrame(p2, toSeg);
  return { start: Math.min(t1, t2), end: Math.max(t1, t2) };
}

/**
 * For every room, which spans of its walls (by wallColorKey) are
 * auto-detected as touching some other room's wall. O(rooms^2 * walls^2),
 * which is fine at the scale a floor-plan tool ever deals with (tens of
 * rooms, not thousands).
 */
export function computeAutoOpenIntervals(
  rooms: RoomLayout[],
): Map<string, Map<string, WallOpenInterval[]>> {
  const result = new Map<string, Map<string, WallOpenInterval[]>>();
  for (const room of rooms) result.set(room.id, new Map());

  const addInterval = (roomId: string, key: string, interval: WallOpenInterval) => {
    const wallMap = result.get(roomId);
    if (!wallMap) return;
    const list = wallMap.get(key) ?? [];
    list.push(interval);
    wallMap.set(key, list);
  };

  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const roomA = rooms[i];
      const roomB = rooms[j];
      const cornersA = globalCorners(roomA);
      const cornersB = globalCorners(roomB);
      const segsA = wallSegments(cornersA);
      const segsB = wallSegments(cornersB);
      for (const segA of segsA) {
        for (const segB of segsB) {
          // Computed independently in each wall's own local frame -- the
          // physical touch condition is symmetric, but the resulting
          // interval's coordinates are specific to whichever wall they're
          // being applied to.
          const overlapA = segmentOverlap(segA, segB);
          if (!overlapA) continue;
          const overlapB = segmentOverlap(segB, segA);
          if (!overlapB) continue;

          const keyA = wallColorKey(segA.index, cornersA.length);
          const keyB = wallColorKey(segB.index, cornersB.length);

          // If either wall already has a real door somewhere within the
          // touching span, dragging a room flush against a neighbor is
          // (per explicit request) treated as "moving that door onto the
          // new wall": only the door's own footprint opens, not the whole
          // geometric overlap, so the rest of the touch region stays a
          // solid wall. Windows don't count -- a window isn't a walkway.
          // Falls back to the previous full-overlap behavior when neither
          // side has a door anywhere in the touch region.
          const doorsAInOverlap = doorSpansOnWall(roomA, segA, cornersA.length)
            .map((s) => intersectInterval(s, overlapA))
            .filter((s): s is WallOpenInterval => s !== null);
          const doorsBInOverlap = doorSpansOnWall(roomB, segB, cornersB.length)
            .map((s) => intersectInterval(s, overlapB))
            .filter((s): s is WallOpenInterval => s !== null);
          const doorsBAsA = doorsBInOverlap.map((s) => convertSpan(s, segB, segA));
          const allDoorSpansA = [...doorsAInOverlap, ...doorsBAsA];

          if (allDoorSpansA.length > 0) {
            for (const span of allDoorSpansA) {
              addInterval(roomA.id, keyA, span);
              addInterval(roomB.id, keyB, convertSpan(span, segA, segB));
            }
          } else {
            addInterval(roomA.id, keyA, overlapA);
            addInterval(roomB.id, keyB, overlapB);
          }
        }
      }
    }
  }

  for (const wallMap of result.values()) {
    for (const [key, intervals] of wallMap) {
      wallMap.set(key, mergeIntervals(intervals));
    }
  }
  return result;
}

/**
 * Merges a room's explicit `wallOverrides` on top of its auto-detected open
 * intervals: an override always wins for that whole wall -- `true` forces
 * it fully open (0..wallLength) even with no touching neighbor, `false`
 * forces it fully closed (no intervals) even while touching one -- and an
 * absent key falls through to the auto-detected intervals for that wall.
 * (Manual overrides are deliberately all-or-nothing per wall; picking a
 * custom partial span by hand would need its own "archway" authoring UI,
 * which is a separate feature from this auto-suggestion mechanism.)
 */
export function resolveEffectiveOpenIntervals(
  room: RoomLayout,
  corners: Point[],
  autoOpen: Map<string, WallOpenInterval[]>,
): Map<string, WallOpenInterval[]> {
  const overrides = room.wallOverrides ?? {};
  const result = new Map<string, WallOpenInterval[]>();
  for (const seg of wallSegments(corners)) {
    const key = wallColorKey(seg.index, corners.length);
    const override = overrides[key];
    if (override === true) {
      result.set(key, [{ start: 0, end: seg.length }]);
    } else if (override === false) {
      result.set(key, []);
    } else {
      result.set(key, autoOpen.get(key) ?? []);
    }
  }
  return result;
}

/**
 * The complement of a wall's open intervals: the closed span(s) that
 * should actually be drawn/extruded as a real wall. Clamps and merges the
 * input first so out-of-order or overlapping intervals (or ones that
 * slightly overshoot the wall's own ends) can't produce a bogus negative-
 * length or duplicated segment.
 */
export function closedSubIntervals(
  length: number,
  openIntervals: WallOpenInterval[],
): WallOpenInterval[] {
  if (openIntervals.length === 0) return [{ start: 0, end: length }];
  const merged = mergeIntervals(openIntervals)
    .map((i) => ({
      start: Math.max(0, Math.min(length, i.start)),
      end: Math.max(0, Math.min(length, i.end)),
    }))
    .sort((a, b) => a.start - b.start);

  const closed: WallOpenInterval[] = [];
  let cursor = 0;
  for (const o of merged) {
    if (o.start > cursor) closed.push({ start: cursor, end: o.start });
    cursor = Math.max(cursor, o.end);
  }
  if (cursor < length) closed.push({ start: cursor, end: length });
  return closed;
}
