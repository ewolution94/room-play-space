import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  customCatalogItemSchema,
  customCatalogArraySchema,
  loadCustomCatalog,
  saveCustomCatalog,
  createCustomCatalogItem,
  customCatalogItemToPreset,
  buildCatalogByLayer,
  extractBundledCustomCatalog,
  mergeCustomCatalog,
} from "@/lib/custom-catalog";
import { PRESETS, PRESET_BY_KEY } from "@/lib/planner-presets";
import { IKEA_CATALOG } from "@/lib/ikea-catalog";
import type { CustomCatalogItem } from "@/types/planner";

// Minimal in-memory localStorage + window shim -- mirrors tests/floors.test.ts
// exactly, since custom-catalog.ts follows the same SSR-safe
// `typeof window === "undefined"` guard convention.
function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = { localStorage: makeLocalStorage() };
});

function makeItem(overrides: Partial<CustomCatalogItem> = {}): CustomCatalogItem {
  return {
    id: "custom-1",
    nameEn: "My Sofa",
    nameDe: "Mein Sofa",
    w: 200,
    l: 90,
    color: "#336699",
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("customCatalogItemSchema", () => {
  test("accepts a minimal well-formed item with no sourceKey/layer/shape/h", () => {
    const data = customCatalogItemSchema.parse(makeItem());
    assert.equal(data.nameEn, "My Sofa");
    assert.equal(data.sourceKey, undefined);
  });

  test("accepts an item based on a real preset", () => {
    const data = customCatalogItemSchema.parse(makeItem({ sourceKey: "sofa", h: 82 }));
    assert.equal(data.sourceKey, "sofa");
    assert.equal(data.h, 82);
  });

  test("rejects an invalid color", () => {
    assert.throws(() => customCatalogItemSchema.parse(makeItem({ color: "blue" })));
  });

  test("rejects a non-positive width", () => {
    assert.throws(() => customCatalogItemSchema.parse(makeItem({ w: 0 })));
  });

  test("rejects a width over the 5000cm cap", () => {
    assert.throws(() => customCatalogItemSchema.parse(makeItem({ w: 6000 })));
  });

  test("rejects an invalid layer value", () => {
    assert.throws(() =>
      customCatalogItemSchema.parse({ ...makeItem(), layer: "not-a-real-layer" }),
    );
  });
});

describe("customCatalogArraySchema", () => {
  test("accepts an array of well-formed items", () => {
    const data = customCatalogArraySchema.parse([makeItem({ id: "a" }), makeItem({ id: "b" })]);
    assert.equal(data.length, 2);
  });

  test("accepts an empty array", () => {
    assert.deepEqual(customCatalogArraySchema.parse([]), []);
  });
});

describe("loadCustomCatalog / saveCustomCatalog", () => {
  test("returns an empty array when nothing has ever been saved", () => {
    assert.deepEqual(loadCustomCatalog(), []);
  });

  test("round-trips through saveCustomCatalog", () => {
    const items = [makeItem({ id: "a" }), makeItem({ id: "b", sourceKey: "sofa" })];
    saveCustomCatalog(items);
    assert.deepEqual(loadCustomCatalog(), items);
  });

  test("returns an empty array (not a throw) for corrupted JSON", () => {
    (
      globalThis as unknown as { window: { localStorage: ReturnType<typeof makeLocalStorage> } }
    ).window.localStorage.setItem("planner-custom-catalog-v1", "{not valid json");
    assert.deepEqual(loadCustomCatalog(), []);
  });

  test("returns an empty array (not a throw) for validly-parsed JSON with the wrong shape", () => {
    (
      globalThis as unknown as { window: { localStorage: ReturnType<typeof makeLocalStorage> } }
    ).window.localStorage.setItem(
      "planner-custom-catalog-v1",
      JSON.stringify([{ nope: "wrong shape entirely" }]),
    );
    assert.deepEqual(loadCustomCatalog(), []);
  });
});

describe("createCustomCatalogItem", () => {
  test("stamps a fresh id and createdAt onto the draft", () => {
    const item = createCustomCatalogItem({ nameEn: "X", nameDe: "X", w: 10, l: 10, color: "#fff" });
    assert.equal(typeof item.id, "string");
    assert.ok(item.id.length > 0);
    assert.equal(typeof item.createdAt, "number");
  });

  test("two items never collide on id", () => {
    const a = createCustomCatalogItem({ nameEn: "A", nameDe: "A", w: 10, l: 10, color: "#fff" });
    const b = createCustomCatalogItem({ nameEn: "B", nameDe: "B", w: 10, l: 10, color: "#fff" });
    assert.notEqual(a.id, b.id);
  });
});

describe("customCatalogItemToPreset", () => {
  test("with a sourceKey: borrows kitModel/material/layer/shape/elevation/iconUrl from the base preset", () => {
    const base = PRESET_BY_KEY["sofa"];
    const item = makeItem({ sourceKey: "sofa", color: "#112233", w: 180, l: 85 });
    const preset = customCatalogItemToPreset(item);

    assert.equal(preset.key, "sofa");
    assert.equal(preset.kitModel, base.kitModel);
    assert.equal(preset.material, base.material);
    assert.equal(preset.shape, base.shape);
    // The customized name/dimensions/color win over the base preset's own.
    assert.equal(preset.nameEn, "My Sofa");
    assert.equal(preset.w, 180);
    assert.equal(preset.l, 85);
    assert.equal(preset.color, "#112233");
  });

  test("without a sourceKey: synthesizes a custom: key that matches no real preset, keeps the item's own layer/shape", () => {
    const item = makeItem({ layer: "wall", shape: "circle" });
    const preset = customCatalogItemToPreset(item);

    assert.equal(preset.key, `custom:${item.id}`);
    assert.equal(PRESET_BY_KEY[preset.key], undefined);
    assert.equal(preset.kitModel, undefined);
    assert.equal(preset.material, undefined);
    assert.equal(preset.layer, "wall");
    assert.equal(preset.shape, "circle");
  });

  test("a wall-layer preset's elevation carries through so the item still mounts at the right height", () => {
    const item = makeItem({ sourceKey: "wall-sconce" });
    const preset = customCatalogItemToPreset(item);
    assert.equal(preset.elevation, PRESET_BY_KEY["wall-sconce"].elevation);
    assert.equal(preset.layer, "wall");
  });

  test("h precedence: the item's own h wins over the base preset's h when both are set", () => {
    const item = makeItem({ sourceKey: "bed-double", h: 52 });
    const preset = customCatalogItemToPreset(item);
    assert.equal(preset.h, 52);
    assert.notEqual(preset.h, PRESET_BY_KEY["bed-double"].h);
  });

  test("h falls back to the base preset's h when the item doesn't specify its own", () => {
    const item = makeItem({ sourceKey: "bed-double" });
    const preset = customCatalogItemToPreset(item);
    assert.equal(preset.h, PRESET_BY_KEY["bed-double"].h);
  });

  test("preserves the chair-office 'kind: chair' special case (use-room-planner.ts's addPreset keys off preset.key + preset.iconUrl)", () => {
    const item = makeItem({ sourceKey: "chair-office", nameEn: "My Office Chair" });
    const preset = customCatalogItemToPreset(item);
    assert.equal(preset.key, "chair-office");
    assert.ok(preset.iconUrl, "expected chair-office's iconUrl to carry through");
  });

  test("an unknown/stale sourceKey (e.g. a since-removed preset) degrades to the boxless custom path instead of crashing", () => {
    const item = makeItem({ sourceKey: "some-removed-preset-key" });
    const preset = customCatalogItemToPreset(item);
    assert.equal(preset.key, "some-removed-preset-key");
    assert.equal(preset.kitModel, undefined);
    assert.equal(preset.material, undefined);
  });
});

describe("buildCatalogByLayer", () => {
  test("every regular preset lands in its own layer/category bucket", () => {
    const layers = buildCatalogByLayer();
    const sofa = PRESET_BY_KEY["sofa"];
    assert.ok(layers.main[sofa.category]?.some((p) => p.key === "sofa"));
    const rug = PRESET_BY_KEY["rug"];
    assert.ok(layers.under[rug.category]?.some((p) => p.key === "rug"));
  });

  test("every IKEA entry lands under main.ikea, and nowhere else", () => {
    const layers = buildCatalogByLayer();
    assert.equal(layers.main.ikea.length, IKEA_CATALOG.length);
    for (const p of layers.main.ikea) {
      assert.ok(
        IKEA_CATALOG.some((e) => e.id === p.key || e.sourceKey === p.key),
        `unexpected preset "${p.key}" in the ikea bucket`,
      );
    }
    // Not leaked into a different layer tab (none of the curated IKEA
    // products are under/on-top/wall items).
    for (const layer of ["under", "on-top", "wall"] as const) {
      assert.equal(layers[layer].ikea, undefined);
    }
    // Not duplicated into any regular category -- every preset object
    // sitting in a non-"ikea" bucket must be one of the actual PRESETS
    // entries (reference equality), never a freshly-built IKEA-derived
    // Preset that merely happens to share its sourceKey's `key` string.
    for (const [cat, list] of Object.entries(layers.main)) {
      if (cat === "ikea") continue;
      for (const p of list) {
        assert.ok(PRESETS.includes(p), `a non-PRESETS object sits in the "${cat}" category`);
      }
    }
  });

  test("the ikea section is appended after the regular categories (renders as a trailing section)", () => {
    const layers = buildCatalogByLayer();
    const mainCategoryKeys = Object.keys(layers.main);
    assert.equal(mainCategoryKeys[mainCategoryKeys.length - 1], "ikea");
  });

  test("IKEA presets in the merged catalog keep their real dimensions and a resolvable icon key", () => {
    const layers = buildCatalogByLayer();
    for (const entry of IKEA_CATALOG) {
      const preset = layers.main.ikea.find(
        (p) => p.nameEn === entry.nameEn && p.w === entry.w && p.l === entry.l,
      );
      assert.ok(preset, `expected a merged preset for "${entry.nameEn}"`);
      assert.equal(preset!.color, entry.color);
    }
  });

  test("every regular PRESETS entry is accounted for exactly once across all layer/category buckets", () => {
    const layers = buildCatalogByLayer();
    let total = 0;
    for (const layer of Object.values(layers)) {
      for (const [cat, list] of Object.entries(layer)) {
        if (cat === "ikea") continue;
        total += list.length;
      }
    }
    assert.equal(total, PRESETS.length);
  });
});

describe("extractBundledCustomCatalog", () => {
  test("extracts a valid customCatalog array bundled alongside room/floor data", () => {
    const raw = { room: { width: 400, length: 300 }, customCatalog: [makeItem({ id: "a" })] };
    const result = extractBundledCustomCatalog(raw);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "a");
  });

  test("returns [] when there's no customCatalog key at all (a plain, unbundled export)", () => {
    assert.deepEqual(extractBundledCustomCatalog({ room: { width: 400, length: 300 } }), []);
  });

  test("returns [] for non-object raw input instead of throwing", () => {
    assert.deepEqual(extractBundledCustomCatalog(null), []);
    assert.deepEqual(extractBundledCustomCatalog(undefined), []);
    assert.deepEqual(extractBundledCustomCatalog("just a string"), []);
    assert.deepEqual(extractBundledCustomCatalog(42), []);
    assert.deepEqual(extractBundledCustomCatalog([1, 2, 3]), []);
  });

  test("returns [] when customCatalog is present but malformed, instead of throwing", () => {
    assert.deepEqual(extractBundledCustomCatalog({ customCatalog: "not an array" }), []);
    assert.deepEqual(extractBundledCustomCatalog({ customCatalog: [{ nope: "wrong shape" }] }), []);
    assert.deepEqual(extractBundledCustomCatalog({ customCatalog: null }), []);
  });

  test("drops individually-invalid entries the same way customCatalogArraySchema would reject them", () => {
    // The array schema rejects the whole array if ANY entry is invalid --
    // confirms this helper doesn't try to salvage a partially-bad array.
    const raw = {
      customCatalog: [makeItem({ id: "a" }), { ...makeItem({ id: "b" }), color: "bad" }],
    };
    assert.deepEqual(extractBundledCustomCatalog(raw), []);
  });
});

describe("mergeCustomCatalog", () => {
  test("appends items whose id doesn't already exist locally", () => {
    const existing = [makeItem({ id: "a" })];
    const incoming = [makeItem({ id: "b" }), makeItem({ id: "c" })];
    const merged = mergeCustomCatalog(existing, incoming);
    assert.equal(merged.length, 3);
    assert.deepEqual(
      merged.map((i) => i.id),
      ["a", "b", "c"],
    );
  });

  test("skips items whose id already exists -- no duplicates on a re-import", () => {
    const existing = [makeItem({ id: "a" }), makeItem({ id: "b" })];
    // Same ids as already-saved items, even with different field values --
    // id is the only thing that determines "already have this one".
    const incoming = [makeItem({ id: "a", nameEn: "Different name now" }), makeItem({ id: "c" })];
    const merged = mergeCustomCatalog(existing, incoming);
    assert.equal(merged.length, 3);
    assert.deepEqual(
      merged.map((i) => i.id),
      ["a", "b", "c"],
    );
    // The pre-existing "a" is untouched, not overwritten by the incoming
    // one's different name.
    assert.equal(merged.find((i) => i.id === "a")!.nameEn, existing[0].nameEn);
  });

  test("importing the exact same file twice in a row is a true no-op the second time", () => {
    const existing = [makeItem({ id: "a" }), makeItem({ id: "b" })];
    const firstImport = mergeCustomCatalog(existing, [makeItem({ id: "c" })]);
    const secondImport = mergeCustomCatalog(firstImport, [makeItem({ id: "c" })]);
    assert.deepEqual(
      secondImport.map((i) => i.id),
      ["a", "b", "c"],
    );
  });

  test("returns the existing array reference unchanged when nothing new to add (no wasted re-render/re-save)", () => {
    const existing = [makeItem({ id: "a" })];
    const merged = mergeCustomCatalog(existing, [makeItem({ id: "a" })]);
    assert.equal(merged, existing);
  });

  test("an empty incoming list is a no-op", () => {
    const existing = [makeItem({ id: "a" })];
    assert.equal(mergeCustomCatalog(existing, []), existing);
  });

  test("merging into an empty local catalog keeps every incoming item", () => {
    const incoming = [makeItem({ id: "a" }), makeItem({ id: "b" })];
    assert.deepEqual(mergeCustomCatalog([], incoming), incoming);
  });
});
