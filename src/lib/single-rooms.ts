import type { RoomLayout } from "@/types/planner";
import { isRoomLayoutArray } from "@/lib/floors";

/**
 * Standalone single-room persistence -- the storage half of keeping
 * "one room on its own" genuinely separate from "a room inside a floor."
 *
 * Until this module existed there was no data-model concept of a bare
 * room at all: every room the dashboard created was wrapped in a one-room
 * `Floor` and appended to lib/floors.ts's `planner-multi-floors` array, so
 * a "single room" was indistinguishable from a real multi-room floor plan
 * -- it showed up in the floor switcher, it got a "Back to Overview" button
 * pointing into the multi-room UI, and every single room ever created added
 * another floor to that list. This key holds `RoomLayout[]` directly, with
 * no Floor wrapper and no active-floor pointer, and is read/written
 * exclusively by the `/room/$roomId` (singular) route. The Home routes
 * (`/home/$homeId` and `/home/$homeId/room/$roomId`) never touch it, and
 * nothing here ever touches the homes store -- the two systems share the
 * RoomLayout *type* and nothing else.
 *
 * A RoomLayout's `x`/`y`/`rotation` (its position in the multi-room overview
 * grid) are meaningless for a standalone room -- addSingleRoom() below pins
 * them to 0 on the way in rather than trusting each call site to remember.
 *
 * No migration: rooms created as one-room floors before this split stay
 * ordinary floors inside a home. They're harmless there, and detecting
 * "which of these floors was secretly meant to be a single room" is
 * guesswork -- a floor of one is a legitimate thing to have built on
 * purpose.
 */

export const SINGLE_ROOMS_KEY = "planner-single-rooms";

/**
 * Returns [] rather than null when nothing is saved -- unlike loadFloors(),
 * "no single rooms yet" needs no special-casing by callers (there's no
 * showcase content to generate on an empty store, the dashboard just shows
 * an empty state), so a plain array keeps every call site simpler.
 */
export function loadSingleRooms(): RoomLayout[] {
  if (typeof window === "undefined") return [];
  const saved = window.localStorage.getItem(SINGLE_ROOMS_KEY);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    if (isRoomLayoutArray(parsed)) return parsed;
  } catch (e) {
    console.error("Failed to parse saved single rooms", e);
  }
  return [];
}

export function saveSingleRooms(rooms: RoomLayout[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SINGLE_ROOMS_KEY, JSON.stringify(rooms));
}

export function findSingleRoom(roomId: string): RoomLayout | null {
  return loadSingleRooms().find((r) => r.id === roomId) ?? null;
}

/**
 * Pins the overview-grid position/rotation rather than trusting the caller:
 * both room builders (createRoomLayout/createRoomLayoutWithCorners in
 * multi-room-actions.ts) default to searching for a free spot among sibling
 * rooms, which is meaningless here and would leave a standalone room
 * carrying an arbitrary grid coordinate into any later export.
 */
export function addSingleRoom(room: RoomLayout): void {
  saveSingleRooms([...loadSingleRooms(), { ...room, x: 0, y: 0, rotation: 0 }]);
}

/**
 * No-op when the room isn't in this store. That matters for the editor's
 * save-back effect (use-room-planner.ts), which fires on every state
 * change: a room that has since been deleted in another tab must not be
 * silently resurrected by the next keystroke.
 */
export function updateSingleRoom(roomId: string, patch: Partial<RoomLayout>): void {
  const rooms = loadSingleRooms();
  if (!rooms.some((r) => r.id === roomId)) return;
  saveSingleRooms(rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r)));
}

export function removeSingleRoom(roomId: string): void {
  saveSingleRooms(loadSingleRooms().filter((r) => r.id !== roomId));
}
