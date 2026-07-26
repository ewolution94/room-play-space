import { z } from "zod";
import type { CustomCatalogItem, ItemLayer, Preset } from "@/types/planner";
import { COLOR_REGEX } from "@/lib/planner-schema";
import { PRESETS, PRESET_BY_KEY } from "@/lib/planner-presets";
import { IKEA_CATALOG } from "@/lib/ikea-catalog";

/**
 * Persistence + the Preset adapter for "My Own Catalog" (user-saved custom
 * items) -- see CustomCatalogItem's own doc comment in types/planner.ts for
 * the overall shape/reasoning. The built-in IKEA catalog (ikea-catalog.ts) is
 * the exact same type but ships as a static in-code array, never touching
 * localStorage, so only the user-editable "My Catalog" list lives here.
 */

const CUSTOM_CATALOG_KEY = "planner-custom-catalog-v1";

export const customCatalogItemSchema = z.object({
  id: z.string(),
  nameEn: z.string().max(100),
  nameDe: z.string().max(100),
  w: z.number().min(1).max(5000),
  l: z.number().min(1).max(5000),
  h: z.number().min(0.1).max(500).optional(),
  color: z.string().regex(COLOR_REGEX, "Invalid color format"),
  layer: z.enum(["under", "main", "on-top", "wall"]).optional(),
  shape: z.enum(["rect", "circle"]).optional(),
  sourceKey: z.string().optional(),
  createdAt: z.number(),
});

// Capped generously above any realistic hand-built collection -- a hard
// ceiling against a corrupted/hostile import forcing thousands of grid tiles
// to render at once (same reasoning as importSchema's item cap in
// planner-schema.ts).
export const customCatalogArraySchema = customCatalogItemSchema.array().max(500);

/** Reads the user's saved catalog from localStorage. Never throws -- a
 * missing, corrupted, or invalid-shape value is treated as "no catalog yet"
 * rather than surfacing an error, since losing this is recoverable (the user
 * just re-saves items) and this is read on every render of the My Catalog
 * tab. */
export function loadCustomCatalog(): CustomCatalogItem[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(CUSTOM_CATALOG_KEY);
  if (!raw) return [];
  try {
    const parsed = customCatalogArraySchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as CustomCatalogItem[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomCatalog(items: CustomCatalogItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CUSTOM_CATALOG_KEY, JSON.stringify(items));
}

export function createCustomCatalogItem(
  draft: Omit<CustomCatalogItem, "id" | "createdAt">,
): CustomCatalogItem {
  return { ...draft, id: crypto.randomUUID(), createdAt: Date.now() };
}

/**
 * Turns a saved/IKEA catalog entry into a Preset-shaped object so it can be
 * handed straight to the existing addPreset() (use-room-planner.ts) with no
 * changes to that function's own logic -- every catalog-item code path (2D
 * icon, 3D kitModel/proceduralModel, material, collision layer, shape, and
 * even the chair-office "kind: chair" special case) already keys entirely off
 * a Preset, so reusing that machinery beats re-implementing any sliver of it
 * a second time for custom items.
 *
 * `key` is set to `sourceKey` itself (not some new synthetic id) whenever
 * it's present -- this is what makes a customized item's placed instance
 * resolve the exact same kitModel/proceduralModel/material as the preset it's
 * based on (see kit-models.ts's resolveRenderMode, which compares the
 * placed item's current w/h/l against ITS PRESET's default dims: a "based on
 * bed-double" catalog entry needs `icon` to actually equal "bed-double" for
 * that comparison to find the right default). A boxless entry (no
 * sourceKey -- mirrors the existing "Custom Item" box creator) falls back to
 * a synthetic `custom:<id>` key instead, which deliberately matches nothing
 * in PRESET_BY_KEY so every downstream lookup (icon, kitModel, height
 * fallback) takes the same "no catalog match" path a plain custom box
 * already does.
 */
export function customCatalogItemToPreset(item: CustomCatalogItem): Preset {
  const base = item.sourceKey ? PRESET_BY_KEY[item.sourceKey] : undefined;
  return {
    key: item.sourceKey ?? `custom:${item.id}`,
    category: base?.category ?? "custom",
    nameEn: item.nameEn,
    nameDe: item.nameDe,
    w: item.w,
    l: item.l,
    h: item.h ?? base?.h,
    color: item.color,
    iconUrl: base?.iconUrl,
    layer: base?.layer ?? item.layer,
    shape: base?.shape ?? item.shape,
    material: base?.material,
    elevation: base?.elevation,
    kitModel: base?.kitModel,
    proceduralModel: base?.proceduralModel,
    isLightSource: base?.isLightSource,
  };
}

/**
 * Builds the Main/Under/On Top/Wall -> category -> Preset[] grouping the
 * sidebar's main catalog grid (CatalogSection.tsx) renders, folding the
 * built-in IKEA catalog in as one more "ikea" category alongside the
 * regular ones (per user feedback: IKEA lives in the regular catalog as its
 * own section now, not a separate tab). Every IKEA entry lands under the
 * Main layer tab -- none of the curated products are under/on-top/wall
 * items -- via the same customCatalogItemToPreset() adapter used everywhere
 * else, so it's genuinely indistinguishable from a hand-authored Preset by
 * the time CatalogGrid renders it (icon, 3D model, search, category
 * grouping all just work unmodified). The "ikea" bucket is inserted AFTER
 * every regular category so it renders as a distinct trailing section
 * rather than being interleaved alphabetically or scattered across the
 * existing categories.
 *
 * Pure and side-effect-free -- CatalogSection.tsx just memoizes a single
 * call to this once, since neither PRESETS nor IKEA_CATALOG ever change at
 * runtime.
 */
export function buildCatalogByLayer(): Record<ItemLayer, Record<string, Preset[]>> {
  const layers: Record<ItemLayer, Record<string, Preset[]>> = {
    main: {},
    under: {},
    "on-top": {},
    wall: {},
  };
  for (const p of PRESETS) {
    const layer = p.layer ?? "main";
    const bucket = layers[layer];
    (bucket[p.category] ||= []).push(p);
  }
  const ikeaPresets = IKEA_CATALOG.map(customCatalogItemToPreset);
  if (ikeaPresets.length > 0) {
    layers.main.ikea = ikeaPresets;
  }
  return layers;
}

/**
 * Best-effort extraction of a bundled `customCatalog` array from an
 * imported room/floor JSON's raw (still-unknown) shape -- see the
 * `includeOption` checkbox on ExportImportDialog.tsx, which is what lets a
 * room/floor export optionally carry the current My Catalog list alongside
 * the room/floor data itself, as a plain sibling key. Deliberately checked
 * independently of `importSchema`/`floorsArrayImportSchema` (which have no
 * idea this key exists, and would silently strip it since zod objects drop
 * unknown keys by default) rather than teaching either of those room/floor-
 * specific schemas about catalog items. Never throws: absent, malformed, or
 * invalid-shape data all just resolve to an empty array, same as a file that
 * never had catalog items bundled at all.
 */
export function extractBundledCustomCatalog(raw: unknown): CustomCatalogItem[] {
  if (!raw || typeof raw !== "object" || !("customCatalog" in raw)) return [];
  const parsed = customCatalogArraySchema.safeParse(
    (raw as { customCatalog?: unknown }).customCatalog,
  );
  return parsed.success ? (parsed.data as CustomCatalogItem[]) : [];
}

/**
 * Merges freshly-imported catalog items into the existing saved list,
 * skipping any whose `id` already exists locally. `id` (not name/dimensions/
 * color) is the correct notion of "the same item" here: it's what makes
 * re-importing the same exported file -- or the same room/floor twice --
 * never pile up duplicates, while two genuinely different items that happen
 * to share a name/size/color (e.g. two catalog entries both named "Sofa")
 * are correctly kept as separate entries. Returns `existing` itself
 * (referentially unchanged) when there's nothing new to add, so a caller
 * comparing before/after can cheaply tell whether anything actually merged.
 */
export function mergeCustomCatalog(
  existing: CustomCatalogItem[],
  incoming: CustomCatalogItem[],
): CustomCatalogItem[] {
  const existingIds = new Set(existing.map((item) => item.id));
  const additions = incoming.filter((item) => !existingIds.has(item.id));
  return additions.length > 0 ? [...existing, ...additions] : existing;
}
