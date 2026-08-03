import type { Floor, Lang, RoomLayout } from "@/types/planner";
import { floorsArrayImportSchema, roomLayoutArrayImportSchema } from "@/lib/planner-schema";

/**
 * Floor helpers -- naming, construction, and file import.
 *
 * A floor has no store of its own any more: floors belong to a Home, and
 * `lib/homes.ts` is the store (see that module's doc comment for the three
 * storage generations and why the migration is non-destructive). This file
 * kept everything that is genuinely *about a floor* rather than about
 * persisting one -- the position-based naming scheme, createFloor, and the
 * import parser -- so a Home's floors are still built and named exactly as
 * they always were.
 *
 * The two keys below are what floors used to be saved under. They are now
 * read-only history: homes.ts consults MULTI_FLOORS_KEY as a migration
 * source, and both are still swept by "Reset everything" (lib/app-reset.ts)
 * so a returning user's profile can't keep a stale copy alive.
 */

export const MULTI_FLOORS_KEY = "planner-multi-floors";
export const ACTIVE_FLOOR_ID_KEY = "planner-active-floor-id";

/**
 * Shallow "is this our own previously-saved room data" guard, shared with
 * lib/single-rooms.ts -- both stores read back `RoomLayout[]` they wrote
 * themselves, so they want the same cheap check (user-supplied *files* go
 * through planner-schema.ts's far stricter zod schemas instead). Sharing
 * one guard doesn't blur the two stores: what keeps them separate is
 * distinct keys and distinct routes, not distinct copies of a type
 * predicate.
 */
export function isRoomLayoutArray(v: unknown): v is RoomLayout[] {
  return (
    Array.isArray(v) &&
    v.every((r: Record<string, unknown>) => {
      return r && typeof r === "object" && typeof r.id === "string" && "width" in r && "x" in r;
    })
  );
}

function ordinalSuffixEn(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/**
 * Position-based default floor name -- index 0 is always ground level,
 * every index above it is one physical story up. English and German name
 * floors differently (an English "1st Floor" is the German "1.
 * Obergeschoss", i.e. the first floor ABOVE the ground floor -- German
 * doesn't fold the ground level into the count the way US English
 * sometimes does), so these are two genuinely different naming schemes,
 * not just a translated string. Never persisted -- see Floor.name's doc
 * comment in types/planner.ts for why this is recomputed on the fly
 * instead.
 */
export function defaultFloorName(index: number, lang: Lang): string {
  if (index === 0) return lang === "de" ? "Erdgeschoss" : "Ground Floor";
  if (lang === "de") return `${index}. Obergeschoss`;
  return `${index}${ordinalSuffixEn(index)} Floor`;
}

/** Resolves what a floor should actually display as -- its own custom
 * name if it has one, otherwise the position/language-derived default
 * (see defaultFloorName above). `index` must be this floor's real
 * position in the building's floors[] array (not a display-list
 * position -- see FloorSwitcher.tsx's reversed manage list for why that
 * distinction matters). */
export function floorDisplayName(floor: Floor, index: number, lang: Lang): string {
  return floor.name ?? defaultFloorName(index, lang);
}

export function createFloor(rooms: RoomLayout[] = []): Floor {
  return { id: crypto.randomUUID(), name: null, rooms };
}

/**
 * Best-effort parse of an imported JSON file into a Floor[] -- accepts
 * either the current multi-floor export shape or a legacy flat
 * RoomLayout[] export (wrapped into a single, auto-named floor), so an old
 * exported file still imports cleanly. The caller decides which Home the
 * result lands in (see routes/home.$homeId.index.tsx).
 *
 * Unlike the localStorage reads in lib/homes.ts (which only ever read back
 * this app's own previously-saved data, so a shallow shape check is
 * enough), this is the entry point for a user-supplied file -- it needs the
 * same bounds/count-cap/color-format rigor the single-room import already
 * has via planner-schema.ts's importSchema, or a corrupted/hostile file
 * could carry e.g. tens of thousands of items on one room and freeze the
 * tab. See roomLayoutSchema's doc comment in planner-schema.ts for the full
 * reasoning.
 *
 * Also accepts a THIRD shape: `{ floors: Floor[] | RoomLayout[], customCatalog?:
 * unknown }` -- the "Include My Catalog items" checkbox on the floor
 * ExportImportDialog (see routes/home.$homeId.index.tsx) bundles the
 * current My Catalog list alongside the floors as a sibling key, which
 * turns the top-level export from a bare array into a wrapped object. That
 * wrapping is handled here (unwrap `.floors` and recurse into this same
 * function) rather than in the two schemas above, which stay exactly as
 * array-shaped as before -- and export omits the wrapper entirely when
 * there's nothing to bundle, so a plain floors-only export is still the
 * exact same bare-array format it always was. `customCatalog` itself is
 * extracted independently by the caller (see lib/custom-catalog.ts's
 * extractBundledCustomCatalog), not parsed here.
 */
export function parseImportedFloors(parsed: unknown): Floor[] | null {
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "floors" in parsed) {
    return parseImportedFloors((parsed as { floors: unknown }).floors);
  }
  const asFloors = floorsArrayImportSchema.safeParse(parsed);
  if (asFloors.success) return asFloors.data as Floor[];
  const asRooms = roomLayoutArrayImportSchema.safeParse(parsed);
  if (asRooms.success) return [createFloor(asRooms.data as RoomLayout[])];
  return null;
}
