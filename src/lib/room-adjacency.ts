import type { Point, RoomLayout } from "@/types/planner";
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
// exactly), and overlap along their shared line by at least half of the
// shorter wall's length -- a generous but not trivial threshold, so two
// rooms that merely brush corners don't spuriously open a wall.
const TOUCH_GAP_EPS = 3; // cm
const TOUCH_PARALLEL_EPS = 0.05; // |cross product of unit direction vectors|
const MIN_OVERLAP_FRACTION = 0.5;

function unitDir(seg: WallSegment): Point {
  const dx = seg.b.x - seg.a.x;
  const dy = seg.b.y - seg.a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function segmentsTouch(a: WallSegment, b: WallSegment): boolean {
  if (a.length < 1 || b.length < 1) return false;

  const da = unitDir(a);
  const db = unitDir(b);
  // Parallel (or anti-parallel -- two facing walls run in opposite
  // directions along their own winding) test via the cross product of the
  // two unit direction vectors, which is sin(angle between them).
  const cross = da.x * db.y - da.y * db.x;
  if (Math.abs(cross) > TOUCH_PARALLEL_EPS) return false;

  // Perpendicular distance from b's line to a's line.
  const nx = -da.y;
  const ny = da.x;
  const distB = Math.abs((b.a.x - a.a.x) * nx + (b.a.y - a.a.y) * ny);
  if (distB > TOUCH_GAP_EPS) return false;

  // Overlap along a's own direction.
  const tB1 = (b.a.x - a.a.x) * da.x + (b.a.y - a.a.y) * da.y;
  const tB2 = (b.b.x - a.a.x) * da.x + (b.b.y - a.a.y) * da.y;
  const bLo = Math.min(tB1, tB2);
  const bHi = Math.max(tB1, tB2);
  const overlap = Math.min(a.length, bHi) - Math.max(0, bLo);
  const minLen = Math.min(a.length, b.length);
  return overlap >= minLen * MIN_OVERLAP_FRACTION;
}

/**
 * For every room, which of its walls (by wallColorKey) are auto-detected as
 * touching some other room's wall. O(rooms^2 * walls^2), which is fine at
 * the scale a floor-plan tool ever deals with (tens of rooms, not
 * thousands).
 */
export function computeAutoOpenWalls(rooms: RoomLayout[]): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const room of rooms) result.set(room.id, new Set());

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
          if (segmentsTouch(segA, segB)) {
            result.get(roomA.id)?.add(wallColorKey(segA.index, cornersA.length));
            result.get(roomB.id)?.add(wallColorKey(segB.index, cornersB.length));
          }
        }
      }
    }
  }
  return result;
}

/**
 * Merges a room's explicit `wallOverrides` on top of its auto-detected open
 * walls: an override always wins (`true` forces open even with no touching
 * neighbor, `false` forces closed even while touching one), and an absent
 * key falls through to the auto-detected value.
 */
export function resolveEffectiveOpenWalls(room: RoomLayout, autoOpen: Set<string>): Set<string> {
  const overrides = room.wallOverrides ?? {};
  const cornersLen = room.corners && room.corners.length >= 3 ? room.corners.length : 4;
  const result = new Set<string>();
  for (let i = 0; i < cornersLen; i++) {
    const key = wallColorKey(i, cornersLen);
    const override = overrides[key];
    const effective = override !== undefined ? override : autoOpen.has(key);
    if (effective) result.add(key);
  }
  return result;
}
