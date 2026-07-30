import type { LastActiveTarget, Lang, PlannerSettings, PlannerView } from "@/types/planner";

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

function isLastActive(v: unknown): v is LastActiveTarget | null {
  if (v === null) return true;
  if (typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  if (obj.type === "floor") return true;
  // A "room" written by a build that predates the single-room split still
  // means what it said then -- a room inside a floor -- so it keeps
  // resolving against /rooms/$roomId. Nothing needs migrating: rooms
  // created as one-room floors back then really are floor rooms.
  if (obj.type === "room" || obj.type === "single-room") return typeof obj.roomId === "string";
  return false;
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
    lastActive: isLastActive(obj.lastActive) ? obj.lastActive : DEFAULT_SETTINGS.lastActive,
  };
}

export function loadSettings(): PlannerSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  const raw = window.localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    // Pre-dashboard builds stored language alone under "planner-lang" (in
    // two independent places -- see use-room-planner.ts/rooms.index.tsx) --
    // carry that one value forward so a returning user's language doesn't
    // silently reset to English just because the storage format changed.
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
