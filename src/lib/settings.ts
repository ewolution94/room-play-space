import type { LastActiveTarget, Lang, PlannerSettings, PlannerView } from "@/types/planner";
import { findHomeIdForRoom, loadActiveHomeId, loadHomes } from "@/lib/homes";

const SETTINGS_KEY = "planner-settings-v1";
const LEGACY_LANG_KEY = "planner-lang";

export const DEFAULT_SETTINGS: PlannerSettings = {
  lang: "en",
  quickEntry: false,
  defaultView: "2d",
  defaultZoom: 1,
  collisionDefault: true,
  lastActive: null,
};

function isLang(v: unknown): v is Lang {
  return v === "en" || v === "de";
}

function isPlannerView(v: unknown): v is PlannerView {
  return v === "2d" || v === "3d";
}

/**
 * Reads a stored lastActive, upgrading the two pre-Home shapes on the way
 * through so nothing downstream ever has to know they existed:
 *
 * - `{ type: "floor" }` (no id -- there was only ever one building to go
 *   back to) becomes the active Home, i.e. the one the old floors migrated
 *   into. Without this a returning user's resume card and quick-entry gate
 *   would both point at a route that no longer exists.
 * - `{ type: "room", roomId }` without a homeId is resolved by searching
 *   the homes for that room. This is the one place searching is right: the
 *   stored value genuinely predates homes, so there is no route to ask.
 *
 * Returns null when a target can't be resolved (every home deleted, or the
 * room is gone) -- the same answer as "nothing saved", which the resume
 * card and the entry gate already handle.
 */
function readLastActive(v: unknown): LastActiveTarget | null {
  if (v === null || typeof v !== "object") return null;
  const obj = v as Record<string, unknown>;

  if (obj.type === "single-room") {
    return typeof obj.roomId === "string" ? { type: "single-room", roomId: obj.roomId } : null;
  }

  if (obj.type === "home") {
    return typeof obj.homeId === "string" ? { type: "home", homeId: obj.homeId } : null;
  }

  if (obj.type === "floor") {
    const homes = loadHomes() ?? [];
    if (homes.length === 0) return null;
    return { type: "home", homeId: loadActiveHomeId(homes) };
  }

  if (obj.type === "room" && typeof obj.roomId === "string") {
    if (typeof obj.homeId === "string")
      return { type: "room", roomId: obj.roomId, homeId: obj.homeId };
    const homeId = findHomeIdForRoom(loadHomes() ?? [], obj.roomId);
    return homeId ? { type: "room", roomId: obj.roomId, homeId } : null;
  }

  return null;
}

// Merges field-by-field onto DEFAULT_SETTINGS rather than trusting the whole
// parsed blob -- a corrupted value, or one written by a future build with
// extra/renamed fields, degrades one field to its default instead of
// discarding every setting at once.
function normalize(raw: unknown): PlannerSettings {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_SETTINGS };
  const obj = raw as Record<string, unknown>;
  return {
    lang: isLang(obj.lang) ? obj.lang : DEFAULT_SETTINGS.lang,
    quickEntry: typeof obj.quickEntry === "boolean" ? obj.quickEntry : DEFAULT_SETTINGS.quickEntry,
    defaultView: isPlannerView(obj.defaultView) ? obj.defaultView : DEFAULT_SETTINGS.defaultView,
    defaultZoom:
      typeof obj.defaultZoom === "number" && Number.isFinite(obj.defaultZoom)
        ? obj.defaultZoom
        : DEFAULT_SETTINGS.defaultZoom,
    collisionDefault:
      typeof obj.collisionDefault === "boolean"
        ? obj.collisionDefault
        : DEFAULT_SETTINGS.collisionDefault,
    lastActive: readLastActive(obj.lastActive),
  };
}

export function loadSettings(): PlannerSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  const raw = window.localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    // Pre-dashboard builds stored language alone under "planner-lang" (in
    // two independent places -- the room planner and the floor plan route)
    // -- carry that one value forward so a returning user's language
    // doesn't silently reset to English just because the format changed.
    const legacyLang = window.localStorage.getItem(LEGACY_LANG_KEY);
    return { ...DEFAULT_SETTINGS, lang: isLang(legacyLang) ? legacyLang : DEFAULT_SETTINGS.lang };
  }
  try {
    return normalize(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: PlannerSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
