import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { IKEA_CATALOG, IKEA_CATEGORY_ORDER } from "@/lib/ikea-catalog";
import { customCatalogItemSchema, customCatalogItemToPreset } from "@/lib/custom-catalog";
import { PRESET_BY_KEY } from "@/lib/planner-presets";

// Guards the IKEA catalog's data integrity -- mirrors
// tests/planner-presets.test.ts's "PRESETS catalog integrity" suite, since
// IKEA_CATALOG is meant to be held to the same bar (unique ids, sane
// dimensions, valid colors) plus its own extra invariant: every entry must
// actually be a valid CustomCatalogItem (the same type "My Own Catalog"
// saves), since that's what makes the two features "completely consistent."

describe("IKEA_CATALOG data integrity", () => {
  test("every entry has a unique id", () => {
    const ids = IKEA_CATALOG.map((e) => e.id);
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const id of ids) {
      if (seen.has(id)) dupes.push(id);
      seen.add(id);
    }
    assert.deepEqual(dupes, []);
  });

  test("every entry has positive width and length", () => {
    for (const e of IKEA_CATALOG) {
      assert.ok(e.w > 0, `${e.id} has non-positive width`);
      assert.ok(e.l > 0, `${e.id} has non-positive length`);
    }
  });

  test("every entry has a positive height", () => {
    for (const e of IKEA_CATALOG) {
      assert.ok(typeof e.h === "number" && e.h > 0, `${e.id} is missing a positive h`);
    }
  });

  test("every entry has a valid #rrggbb color", () => {
    for (const e of IKEA_CATALOG) {
      assert.match(e.color, /^#[0-9a-fA-F]{6}$/, `${e.id} has an invalid color "${e.color}"`);
    }
  });

  test("every entry has non-empty English and German names", () => {
    for (const e of IKEA_CATALOG) {
      assert.ok(e.nameEn.trim().length > 0, `${e.id} missing nameEn`);
      assert.ok(e.nameDe.trim().length > 0, `${e.id} missing nameDe`);
    }
  });

  test("every entry has a non-empty product line", () => {
    for (const e of IKEA_CATALOG) {
      assert.ok(e.productLine.trim().length > 0, `${e.id} missing productLine`);
    }
  });

  test("every entry's sourceKey (when set) resolves to a real preset", () => {
    for (const e of IKEA_CATALOG) {
      if (e.sourceKey !== undefined) {
        assert.ok(PRESET_BY_KEY[e.sourceKey], `${e.id} references unknown sourceKey "${e.sourceKey}"`);
      }
    }
  });

  test("every entry's category is one of the declared IKEA_CATEGORY_ORDER values", () => {
    const valid = new Set(IKEA_CATEGORY_ORDER);
    for (const e of IKEA_CATALOG) {
      assert.ok(valid.has(e.category), `${e.id} has unrecognized category "${e.category}"`);
    }
  });

  test("IKEA_CATEGORY_ORDER has no duplicate entries", () => {
    assert.equal(new Set(IKEA_CATEGORY_ORDER).size, IKEA_CATEGORY_ORDER.length);
  });

  test("every category in IKEA_CATEGORY_ORDER has at least one product", () => {
    const used = new Set(IKEA_CATALOG.map((e) => e.category));
    for (const cat of IKEA_CATEGORY_ORDER) {
      assert.ok(used.has(cat), `category "${cat}" has no products in IKEA_CATALOG`);
    }
  });

  test("covers a meaningful spread of common IKEA furniture (at least 15 products)", () => {
    assert.ok(IKEA_CATALOG.length >= 15, `expected at least 15 IKEA products, got ${IKEA_CATALOG.length}`);
  });

  test("every entry validates against the shared CustomCatalogItem schema (My Catalog / IKEA consistency)", () => {
    for (const e of IKEA_CATALOG) {
      assert.doesNotThrow(
        () => customCatalogItemSchema.parse(e),
        `${e.id} does not validate as a CustomCatalogItem`,
      );
    }
  });

  test("every entry round-trips through customCatalogItemToPreset into a usable Preset", () => {
    for (const e of IKEA_CATALOG) {
      const preset = customCatalogItemToPreset(e);
      assert.ok(preset.key.length > 0, `${e.id} produced an empty preset key`);
      assert.equal(preset.w, e.w);
      assert.equal(preset.l, e.l);
      assert.equal(preset.color, e.color);
      assert.equal(preset.h, e.h, `${e.id}'s own h should win over its sourceKey's default`);
    }
  });

  test("every entry with a sourceKey borrows that preset's material (so it doesn't render with a flat generic material)", () => {
    for (const e of IKEA_CATALOG) {
      if (!e.sourceKey) continue;
      const preset = customCatalogItemToPreset(e);
      assert.equal(preset.material, PRESET_BY_KEY[e.sourceKey].material);
    }
  });

  test("no two entries share a productLine + descriptor pair (nameEn) that would be indistinguishable in the grid", () => {
    const names = IKEA_CATALOG.map((e) => e.nameEn);
    assert.equal(new Set(names).size, names.length);
  });
});
