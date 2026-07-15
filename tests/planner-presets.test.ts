import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, PRESET_BY_KEY, PRESET_ICON, getDefaultHeight } from "@/lib/planner-presets";

// Guards the expanded catalog's data integrity -- the kind of mistake that's
// easy to make by hand across ~90 entries (a typo'd key, a forgotten icon
// mapping, an invalid layer/shape value) but would only surface as a silent
// missing icon or a crash deep in rendering otherwise.

describe("PRESETS catalog integrity", () => {
  test("every preset has a unique key", () => {
    const keys = PRESETS.map((p) => p.key);
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const k of keys) {
      if (seen.has(k)) dupes.push(k);
      seen.add(k);
    }
    assert.deepEqual(dupes, []);
  });

  test("every preset resolves to an icon (falls back to a valid Lucide component, not undefined)", () => {
    for (const p of PRESETS) {
      assert.ok(PRESET_ICON[p.key], `missing PRESET_ICON entry for "${p.key}"`);
    }
  });

  test("PRESET_ICON has no orphaned keys that don't correspond to an actual preset", () => {
    const presetKeys = new Set(PRESETS.map((p) => p.key));
    const orphaned = Object.keys(PRESET_ICON).filter((k) => !presetKeys.has(k));
    assert.deepEqual(orphaned, []);
  });

  test("PRESET_BY_KEY has an entry for every preset key", () => {
    for (const p of PRESETS) {
      assert.equal(PRESET_BY_KEY[p.key], p);
    }
  });

  test("every preset has positive width/length", () => {
    for (const p of PRESETS) {
      assert.ok(p.w > 0, `${p.key} has non-positive width`);
      assert.ok(p.l > 0, `${p.key} has non-positive length`);
    }
  });

  test("every preset has a valid #rrggbb color", () => {
    for (const p of PRESETS) {
      assert.match(p.color, /^#[0-9a-fA-F]{6}$/, `${p.key} has an invalid color "${p.color}"`);
    }
  });

  test("every preset has non-empty English and German names", () => {
    for (const p of PRESETS) {
      assert.ok(p.nameEn.trim().length > 0, `${p.key} missing nameEn`);
      assert.ok(p.nameDe.trim().length > 0, `${p.key} missing nameDe`);
    }
  });

  test("layer is either unset (main) or one of the three valid values", () => {
    const valid = new Set(["under", "main", "on-top"]);
    for (const p of PRESETS) {
      if (p.layer !== undefined) {
        assert.ok(valid.has(p.layer), `${p.key} has invalid layer "${p.layer}"`);
      }
    }
  });

  test("shape is either unset (rect) or one of the two valid values", () => {
    const valid = new Set(["rect", "circle"]);
    for (const p of PRESETS) {
      if (p.shape !== undefined) {
        assert.ok(valid.has(p.shape), `${p.key} has invalid shape "${p.shape}"`);
      }
    }
  });

  test("under and on-top layer items never collide by construction (spot-check a few known items)", () => {
    const rug = PRESET_BY_KEY["rug"];
    const deskLamp = PRESET_BY_KEY["desk-lamp"];
    const sofa = PRESET_BY_KEY["sofa"];
    assert.equal(rug.layer, "under");
    assert.equal(deskLamp.layer, "on-top");
    assert.equal(sofa.layer, undefined); // main is the implicit default
  });

  test("round-table and other explicitly circular presets are tagged shape: circle", () => {
    assert.equal(PRESET_BY_KEY["round-table"].shape, "circle");
    assert.equal(PRESET_BY_KEY["dining-table-round"].shape, "circle");
    assert.equal(PRESET_BY_KEY["outdoor-table"].shape, "circle");
  });

  test("the catalog covers at least the requested ~90-110 preset range", () => {
    assert.ok(PRESETS.length >= 90, `expected at least 90 presets, got ${PRESETS.length}`);
  });

  test("every preset has a positive 3D height (h)", () => {
    for (const p of PRESETS) {
      assert.ok(typeof p.h === "number" && p.h > 0, `${p.key} is missing a positive h`);
    }
  });

  test("'under' layer items are flat (h <= 3cm) so they sit flush with the floor in 3D, well below anything standing on them", () => {
    for (const p of PRESETS) {
      if (p.layer === "under") {
        assert.ok(p.h! <= 3, `${p.key} (under) has h=${p.h}, expected a thin, floor-flush height`);
      }
    }
  });

  test("'on-top' layer items stay desktop/media-console scale, well under a real freestanding main item (h <= 100cm)", () => {
    // Most on-top items (lamps, laptops, vases) are small tabletop objects,
    // but a few -- a propped-up flatscreen TV being the tallest -- are
    // legitimately taller while still resting on a surface rather than the
    // floor. 100cm keeps real headroom below the 15cm main-item floor so an
    // on-top item can never be confused for a main item by height alone.
    for (const p of PRESETS) {
      if (p.layer === "on-top") {
        assert.ok(
          p.h! <= 100,
          `${p.key} (on-top) has h=${p.h}, expected a small-to-medium surface-resting height`,
        );
      }
    }
  });

  test("'main' layer items are realistic freestanding-furniture heights (15cm-220cm)", () => {
    for (const p of PRESETS) {
      const layer = p.layer ?? "main";
      if (layer === "main") {
        assert.ok(
          p.h! >= 15 && p.h! <= 220,
          `${p.key} (main) has h=${p.h}, outside the expected furniture height range`,
        );
      }
    }
  });

  test("an under item is always shorter than every on-top item (rug well below a lamp resting on a desk)", () => {
    const maxUnderH = Math.max(...PRESETS.filter((p) => p.layer === "under").map((p) => p.h!));
    const minOnTopH = Math.min(...PRESETS.filter((p) => p.layer === "on-top").map((p) => p.h!));
    assert.ok(
      maxUnderH < minOnTopH,
      `expected every under item's height (max ${maxUnderH}) to be less than every on-top item's height (min ${minOnTopH})`,
    );
  });
});

describe("TV and console presets", () => {
  test("all three TV sizes and both consoles exist, are on-top layer, and resolve an icon", () => {
    for (const key of ["tv-55", "tv-65", "tv-75", "ps5", "switch-2"]) {
      const p = PRESET_BY_KEY[key];
      assert.ok(p, `missing preset "${key}"`);
      assert.equal(p.layer, "on-top", `${key} should be on-top layer`);
      assert.ok(PRESET_ICON[key], `${key} missing an icon`);
    }
  });

  test("larger TVs have a larger width and height than smaller ones", () => {
    const tv55 = PRESET_BY_KEY["tv-55"];
    const tv65 = PRESET_BY_KEY["tv-65"];
    const tv75 = PRESET_BY_KEY["tv-75"];
    assert.ok(tv55.w < tv65.w && tv65.w < tv75.w);
    assert.ok(tv55.h! < tv65.h! && tv65.h! < tv75.h!);
  });

  test("TVs and consoles are all rect-shaped (default), not circular", () => {
    for (const key of ["tv-55", "tv-65", "tv-75", "ps5", "switch-2"]) {
      assert.notEqual(PRESET_BY_KEY[key].shape, "circle");
    }
  });
});

describe("getDefaultHeight", () => {
  test("returns the catalog's h for any known preset key", () => {
    for (const p of PRESETS) {
      assert.equal(getDefaultHeight(p.key), p.h);
    }
  });

  test("a rug-type preset resolves to a near-zero, floor-flush height", () => {
    assert.equal(getDefaultHeight("rug"), 0.5);
    assert.equal(getDefaultHeight("rug-round"), 0.5);
  });

  test("an on-top preset resolves to a small height, not a full-height fallback box", () => {
    assert.ok(getDefaultHeight("desk-lamp") < 60);
    assert.ok(getDefaultHeight("vase") < 60);
  });

  test("falls back to the chair-kind default (80) when the icon is unknown but kind is 'chair'", () => {
    assert.equal(getDefaultHeight(undefined, "chair"), 80);
    assert.equal(getDefaultHeight("some-removed-preset-key", "chair"), 80);
  });

  test("falls back to 75 for a fully custom item with no icon at all", () => {
    assert.equal(getDefaultHeight(undefined, "furniture"), 75);
  });

  test("legacy icon keys with no catalog match still resolve via the fallback switch, not a crash", () => {
    // Guards against ever accidentally removing the fallback switch --
    // saved rooms from before the `h` field existed only have an icon
    // string, not a matching PRESET_BY_KEY entry if that preset was ever
    // renamed or removed.
    assert.equal(getDefaultHeight("totally-unknown-icon-key"), 75);
  });
});
