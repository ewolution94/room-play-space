import type { Floor, Lang, RoomLayout } from "@/types/planner";
import { floorsArrayImportSchema, roomLayoutArrayImportSchema } from "@/lib/planner-schema";

/**
 * Floor persistence + migration.
 *
 * Before the multi-floor feature, /rooms stored a single flat
 * `RoomLayout[]` under `planner-multi-rooms`. That's now nested one level
 * deeper as `Floor[]` (each floor owning its own `rooms` array) under
 * `planner-multi-floors`, with the currently-active floor tracked
 * separately under `planner-active-floor-id` -- kept as its own key rather
 * than folded into the floors blob so switching floors doesn't require
 * re-serializing the (potentially large) rooms data on every tab click.
 *
 * Every read goes through loadFloors() below, which transparently migrates
 * a legacy flat array (wrapping it in a single "Ground Floor") the first
 * time it's encountered and immediately persists the migrated shape, so
 * every other code path (use-room-planner.ts's roomId-scoped read/write
 * included) only ever has to deal with the current Floor[] shape.
 */

export const MULTI_FLOORS_KEY = "planner-multi-floors";
export const ACTIVE_FLOOR_ID_KEY = "planner-active-floor-id";
// Legacy pre-floors key -- read-only here, only ever consulted as a
// migration source when MULTI_FLOORS_KEY has nothing saved yet.
const LEGACY_ROOMS_KEY = "planner-multi-rooms";

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

function isFloorArray(v: unknown): v is Floor[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((f: Record<string, unknown>) => {
      return (
        f &&
        typeof f === "object" &&
        typeof f.id === "string" &&
        (f.name === null || typeof f.name === "string") &&
        Array.isArray(f.rooms)
      );
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
 * Reads the saved building from localStorage, migrating the legacy flat
 * layout in place if that's all that's there. Returns null when there is
 * genuinely nothing saved yet (first-ever visit) -- callers decide what to
 * do with a blank slate (e.g. rooms.index.tsx generates the showcase
 * apartment on true first load this session).
 */
export function loadFloors(): Floor[] | null {
  if (typeof window === "undefined") return null;

  const saved = window.localStorage.getItem(MULTI_FLOORS_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (isFloorArray(parsed)) return parsed;
    } catch (e) {
      console.error("Failed to parse saved floors", e);
    }
  }

  // Nothing valid under the new key -- fall back to the legacy flat array
  // and migrate it in place so this only ever happens once.
  const legacy = window.localStorage.getItem(LEGACY_ROOMS_KEY);
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy);
      if (isRoomLayoutArray(parsed)) {
        const migrated = [createFloor(parsed)];
        saveFloors(migrated);
        return migrated;
      }
    } catch (e) {
      console.error("Failed to migrate legacy rooms layout", e);
    }
  }

  return null;
}

export function saveFloors(floors: Floor[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MULTI_FLOORS_KEY, JSON.stringify(floors));
}

/** Falls back to the first floor if nothing saved, or the saved id no
 * longer exists (e.g. that floor was deleted in another tab). */
export function loadActiveFloorId(floors: Floor[]): string {
  if (floors.length === 0) return "";
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(ACTIVE_FLOOR_ID_KEY);
    if (saved && floors.some((f) => f.id === saved)) return saved;
  }
  return floors[0].id;
}

export function saveActiveFloorId(id: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_FLOOR_ID_KEY, id);
}

/**
 * Best-effort parse of an imported JSON file into a Floor[] -- accepts
 * either the current multi-floor export shape or a legacy flat
 * RoomLayout[] export (wrapped into a single, auto-named floor),
 * mirroring loadFloors()'s own migration so an old exported file still
 * imports cleanly.
 *
 * Unlike loadFloors() above (which only ever reads back this app's own
 * previously-saved localStorage data, so a shallow shape check is enough),
 * this is the entry point for a user-supplied file -- it needs the same
 * bounds/count-cap/color-format rigor the single-room import already has
 * via planner-schema.ts's importSchema, or a corrupted/hostile file could
 * carry e.g. tens of thousands of items on one room and freeze the tab.
 * See roomLayoutSchema's doc comment in planner-schema.ts for the full
 * reasoning.
 *
 * Also accepts a THIRD shape: `{ floors: Floor[] | RoomLayout[], customCatalog?:
 * unknown }` -- the "Include My Catalog items" checkbox on the floor/
 * building ExportImportDialog (see routes/rooms.index.tsx) bundles the
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
