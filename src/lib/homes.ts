import type { Floor, Home, Lang, RoomLayout } from "@/types/planner";
import { createFloor, isRoomLayoutArray, MULTI_FLOORS_KEY } from "@/lib/floors";

/**
 * Home persistence + migration.
 *
 * A Home owns 1..N floors (see the type's doc comment for why it exists).
 * This store is the exact parallel of lib/single-rooms.ts: a bare array of
 * independent documents, each with its own dashboard row and its own route.
 *
 * There are THREE storage generations to read, newest first:
 *
 *   planner-homes-v1      Home[]        current
 *   planner-multi-floors  Floor[]       the one implicit building -> one Home
 *   planner-multi-rooms   RoomLayout[]  pre-floors -> one floor in one Home
 *
 * Migration is **non-destructive**: it writes the new key and leaves the old
 * ones exactly where they are, so rolling this change back cannot lose
 * anyone's data. Nothing in this app ever deletes a user's saved rooms.
 *
 * The one rule that matters most here, learned the hard way twice (see
 * docs/LEARNINGS.md): **an empty collection is a legitimate saved state.**
 * `isHomeArray` deliberately accepts `[]`. The previous generation of this
 * code required a non-empty array, so a deliberately-emptied store was
 * judged invalid, fell through to the legacy branch, and re-saved the old
 * data on every single load -- which made deleting your last floor
 * impossible to make stick, and was invisible to anyone testing on a cleared
 * profile because clearing wipes the legacy key too.
 */

export const HOMES_KEY = "planner-homes-v1";
/** Which Home the dashboard/entry gate last opened. */
export const ACTIVE_HOME_ID_KEY = "planner-active-home-v1";
/**
 * Which floor is active *within* each Home, as `{ [homeId]: floorId }`.
 *
 * Per-home rather than the single global pointer floors.ts used, which only
 * worked because there was exactly one building. Kept out of the homes blob
 * itself for the same reason the old key was: switching floors shouldn't
 * re-serialize every room in every home.
 */
export const ACTIVE_FLOOR_BY_HOME_KEY = "planner-active-floor-by-home-v1";

/** Pre-Home key, read-only here -- consulted only as a migration source. */
const LEGACY_FLOORS_KEY = MULTI_FLOORS_KEY;
/** Pre-floors key, the legacy of the legacy. */
const LEGACY_ROOMS_KEY = "planner-multi-rooms";

/**
 * Shallow "is this our own previously-saved data" guard -- the same class of
 * check as isRoomLayoutArray in lib/floors.ts, and for the same reason: this
 * only ever reads back what this app wrote itself. User-supplied *files* go
 * through planner-schema.ts's far stricter zod schemas instead.
 *
 * No `length > 0` check, on purpose. See the module comment.
 */
export function isHomeArray(v: unknown): v is Home[] {
  return (
    Array.isArray(v) &&
    v.every((h: Record<string, unknown>) => {
      return (
        h &&
        typeof h === "object" &&
        typeof h.id === "string" &&
        (h.name === null || typeof h.name === "string") &&
        Array.isArray(h.floors)
      );
    })
  );
}

function isFloorArray(v: unknown): v is Floor[] {
  return (
    Array.isArray(v) &&
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

/**
 * Position-based default name, same convention as defaultFloorName. Unlike
 * floors -- which are physically ordered, so "Ground Floor"/"1st Floor" is
 * meaningful -- homes have no inherent order, so this is just a stable
 * numbering that re-numbers itself if one is deleted.
 */
export function defaultHomeName(index: number, lang: Lang): string {
  if (index === 0) return lang === "de" ? "Mein Zuhause" : "My Home";
  return lang === "de" ? `Zuhause ${index + 1}` : `Home ${index + 1}`;
}

export function homeDisplayName(home: Home, index: number, lang: Lang): string {
  return home.name ?? defaultHomeName(index, lang);
}

/**
 * A new Home always starts with one empty ground floor (decided 2026-08-03).
 * It opens straight into a usable floor with the add-room sidebar, and the
 * overview assumes an active floor exists.
 *
 * Note this does NOT contradict the "a route must never create data just by
 * being visited" rule -- creating on an explicit "create" click is exactly
 * where creation belongs.
 */
export function createHome(floors: Floor[] = [createFloor()], name: string | null = null): Home {
  return { id: crypto.randomUUID(), name, floors };
}

/** Total rooms across every floor -- for the dashboard row's summary. */
export function countRooms(home: Home): number {
  return home.floors.reduce((n, f) => n + f.rooms.length, 0);
}

/** Total placed furniture across every room of every floor. */
export function countItems(home: Home): number {
  return home.floors.reduce((n, f) => n + f.rooms.reduce((m, r) => m + r.items.length, 0), 0);
}

/**
 * Reads the saved homes, migrating an older generation in place the first
 * time it's encountered. Returns null only when there is genuinely nothing
 * saved under ANY generation -- a saved `[]` is a real answer and comes back
 * as `[]`, never as null.
 */
export function loadHomes(): Home[] | null {
  if (typeof window === "undefined") return null;

  const saved = window.localStorage.getItem(HOMES_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (isHomeArray(parsed)) return parsed;
    } catch (e) {
      console.error("Failed to parse saved homes", e);
    }
  }

  // Reaching here means the current key is absent or unparseable -- never
  // that it holds a deliberately-empty store. Migrating on an empty-but-
  // present store is precisely what used to resurrect deleted floors.
  const legacyFloors = window.localStorage.getItem(LEGACY_FLOORS_KEY);
  if (legacyFloors) {
    try {
      const parsed = JSON.parse(legacyFloors);
      if (isFloorArray(parsed)) {
        // An empty building migrates to zero homes, not to one empty home:
        // "I deleted everything" has to survive the migration intact.
        const migrated = parsed.length > 0 ? [createHome(parsed)] : [];
        saveHomes(migrated);
        return migrated;
      }
    } catch (e) {
      console.error("Failed to migrate floors into a home", e);
    }
  }

  const legacyRooms = window.localStorage.getItem(LEGACY_ROOMS_KEY);
  if (legacyRooms) {
    try {
      const parsed = JSON.parse(legacyRooms);
      if (isRoomLayoutArray(parsed)) {
        const migrated = [createHome([createFloor(parsed)])];
        saveHomes(migrated);
        return migrated;
      }
    } catch (e) {
      console.error("Failed to migrate legacy rooms layout into a home", e);
    }
  }

  return null;
}

export function saveHomes(homes: Home[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HOMES_KEY, JSON.stringify(homes));
}

export function findHome(homeId: string): Home | null {
  return (loadHomes() ?? []).find((h) => h.id === homeId) ?? null;
}

export function addHome(home: Home): void {
  saveHomes([...(loadHomes() ?? []), home]);
}

/** No-ops on an unknown id, for the same reason updateSingleRoom does: the
 * editor's save-back effect fires on every state change, and a home deleted
 * in another tab must not be resurrected by the next keystroke. */
export function updateHome(homeId: string, patch: Partial<Home>): void {
  const homes = loadHomes();
  if (!homes || !homes.some((h) => h.id === homeId)) return;
  saveHomes(homes.map((h) => (h.id === homeId ? { ...h, ...patch } : h)));
}

export function removeHome(homeId: string): void {
  const homes = loadHomes();
  if (!homes) return;
  saveHomes(homes.filter((h) => h.id !== homeId));
}

/** Finds which home owns a room, for resolving a room id to its home. */
export function findHomeIdForRoom(homes: Home[], roomId: string): string | null {
  for (const home of homes) {
    for (const floor of home.floors) {
      if (floor.rooms.some((r) => r.id === roomId)) return home.id;
    }
  }
  return null;
}

export function loadActiveHomeId(homes: Home[]): string {
  if (homes.length === 0) return "";
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(ACTIVE_HOME_ID_KEY);
    if (saved && homes.some((h) => h.id === saved)) return saved;
  }
  return homes[0].id;
}

export function saveActiveHomeId(id: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_HOME_ID_KEY, id);
}

function readActiveFloorMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ACTIVE_FLOOR_BY_HOME_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // Unparseable -- fall through to the first-floor default.
  }
  return {};
}

/** Falls back to the home's first floor when nothing is saved, or when the
 * saved floor no longer exists (deleted here or in another tab). */
export function loadActiveFloorId(home: Home): string {
  if (home.floors.length === 0) return "";
  const saved = readActiveFloorMap()[home.id];
  if (saved && home.floors.some((f) => f.id === saved)) return saved;
  return home.floors[0].id;
}

export function saveActiveFloorId(homeId: string, floorId: string): void {
  if (typeof window === "undefined") return;
  const map = readActiveFloorMap();
  map[homeId] = floorId;
  window.localStorage.setItem(ACTIVE_FLOOR_BY_HOME_KEY, JSON.stringify(map));
}
