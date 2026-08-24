import type { Home, Item, Lang, RoomLayout } from "@/types/planner";
import { getDefaultHeight } from "@/lib/planner-presets";
import { floorDisplayName } from "@/lib/floors";

/**
 * One line of a shopping/measurement list: a name and a size, with a count
 * of how many identical items share it. "Identical" is rounded to whole
 * centimetres -- the same precision the canvas label, the Elements list and
 * every other on-screen reading of an item's size already round to (see
 * ElementsListSection.tsx), so two items that read the same on screen are
 * never split into two rows here.
 */
export interface MeasurementRow {
  name: string;
  width: number;
  length: number;
  height: number;
  count: number;
}

/** Same height fallback used everywhere else an item's height is read --
 * the canvas label, the Elements list, the 3D view and the slope fit-check
 * (see getDefaultHeight's callers). Reusing it here is the whole point of
 * this module: a fifth reading of "how tall is this" that could disagree
 * with the other four would be worse than not having one. */
function itemHeight(item: Item): number {
  return item.height ?? getDefaultHeight(item.icon, item.kind);
}

/**
 * Groups a room's items into measurement rows, sorted by name then size so
 * the output is stable and readable rather than following placement order.
 * Pure and DOM-free by design -- this is the one place the grouping logic
 * lives; both the room-level and home-level views below call it.
 */
export function measureItems(items: Item[]): MeasurementRow[] {
  const groups = new Map<string, MeasurementRow>();
  for (const item of items) {
    const width = Math.round(item.width);
    const length = Math.round(item.length);
    const height = Math.round(itemHeight(item));
    const key = `${item.name}|${width}|${length}|${height}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { name: item.name, width, length, height, count: 1 });
    }
  }
  return Array.from(groups.values()).sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      a.length - b.length ||
      a.width - b.width ||
      a.height - b.height,
  );
}

/** One room's worth of grouped rows, labeled for display in a list that
 * may span several rooms (see measureHome below). */
export interface RoomMeasurements {
  roomId: string;
  roomName: string;
  rows: MeasurementRow[];
}

export function measureRoom(room: Pick<RoomLayout, "id" | "name" | "items">): RoomMeasurements {
  return { roomId: room.id, roomName: room.name, rows: measureItems(room.items) };
}

/**
 * Every room across every floor of a home, each with its own grouped rows
 * -- the useful shape for actually buying furniture, since that's a
 * home-level errand even though editing happens one room at a time. Rooms
 * with no items are omitted rather than shown as an empty section: an
 * empty room contributes nothing to a shopping list.
 *
 * Room names are qualified with their floor's display name whenever a home
 * has more than one floor, since two floors are free to reuse the same room
 * name (two "Bedroom"s is common) and an unqualified list would silently
 * merge them under one heading.
 */
export function measureHome(home: Home, lang: Lang): RoomMeasurements[] {
  const result: RoomMeasurements[] = [];
  const multiFloor = home.floors.length > 1;
  home.floors.forEach((floor, floorIndex) => {
    const floorName = multiFloor ? floorDisplayName(floor, floorIndex, lang) : null;
    for (const room of floor.rooms) {
      const rows = measureItems(room.items);
      if (rows.length === 0) continue;
      result.push({
        roomId: room.id,
        roomName: floorName ? `${room.name} — ${floorName}` : room.name,
        rows,
      });
    }
  });
  return result;
}
