import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  FLOOR_MATERIALS,
  FLOOR_MATERIAL_BY_KEY,
  DEFAULT_FLOORING,
  resolveFlooring,
  shadeColor,
  mulberry32,
} from "@/lib/floor-materials";

// The whole flooring feature had zero test coverage before this (AUDIT.md
// section 4) despite being a real, shipped feature with its own fallback
// logic (resolveFlooring), a color-math helper every pattern renderer
// depends on (shadeColor), and a deliberately-seeded PRNG whose entire
// purpose is to NOT be random across renders (mulberry32) -- exactly the
// kind of thing that's invisible until someone breaks it by accident.

describe("FLOOR_MATERIALS / FLOOR_MATERIAL_BY_KEY", () => {
  test("every catalog entry is indexed by its own key", () => {
    for (const option of FLOOR_MATERIALS) {
      assert.equal(FLOOR_MATERIAL_BY_KEY[option.key], option);
    }
  });

  test("every key is unique", () => {
    const keys = FLOOR_MATERIALS.map((m) => m.key);
    assert.equal(new Set(keys).size, keys.length);
  });

  test("every entry has a valid default hex color", () => {
    for (const option of FLOOR_MATERIALS) {
      assert.match(option.defaultColor, /^#[0-9a-fA-F]{6}$/);
    }
  });

  test("the plain-flat fallback option exists in the catalog", () => {
    assert.ok(FLOOR_MATERIAL_BY_KEY["plain-flat"]);
  });
});

describe("resolveFlooring", () => {
  test("returns the matching option and the room's own color when given a valid key", () => {
    const { option, color } = resolveFlooring({ key: "wood-hardwood", color: "#123456" });
    assert.equal(option.key, "wood-hardwood");
    assert.equal(color, "#123456");
  });

  test("falls back to DEFAULT_FLOORING when given undefined (a room saved before this feature existed)", () => {
    const { option, color } = resolveFlooring(undefined);
    assert.equal(option.key, DEFAULT_FLOORING.key);
    assert.equal(color, DEFAULT_FLOORING.color);
  });

  test("falls back to plain-flat when given an unknown/stale material key", () => {
    const { option } = resolveFlooring({ key: "does-not-exist", color: "#ffffff" });
    assert.equal(option.key, "plain-flat");
  });

  test("falls back to the option's own default color when color is an empty string", () => {
    const { option, color } = resolveFlooring({ key: "wood-laminate", color: "" });
    assert.equal(color, option.defaultColor);
  });
});

describe("shadeColor", () => {
  test("a positive percent lightens toward white", () => {
    const lightened = shadeColor("#808080", 0.5);
    // #808080 = (128,128,128); lightening 50% of the way to 255 -> ~192.
    assert.equal(lightened, "#c0c0c0");
  });

  test("a negative percent darkens toward black", () => {
    const darkened = shadeColor("#808080", -0.5);
    // Darkening 50% of the way to 0 -> ~64.
    assert.equal(darkened, "#404040");
  });

  test("percent 0 returns the same color", () => {
    assert.equal(shadeColor("#336699", 0), "#336699");
  });

  test("clamps at white/black instead of overflowing", () => {
    assert.equal(shadeColor("#ffffff", 0.9), "#ffffff");
    assert.equal(shadeColor("#000000", -0.9), "#000000");
  });

  test("expands a 3-digit hex shorthand before shading", () => {
    // #abc -> #aabbcc; shading by 0 should just expand it.
    assert.equal(shadeColor("#abc", 0), "#aabbcc");
  });

  test("returns the input unchanged for an unparseable color", () => {
    assert.equal(shadeColor("not-a-color", 0.5), "not-a-color");
  });
});

describe("mulberry32", () => {
  test("is deterministic -- the same seed always produces the same sequence", () => {
    // mulberry32(seed) returns a fresh generator function; two independently
    // built generators from the same seed, stepped the same number of
    // times, must agree at every step -- this is the entire point of
    // seeding it (stable grain/fleck patterns across re-renders instead of
    // jittering, see the doc comment in floor-materials.ts).
    const genA = mulberry32(42);
    const genB = mulberry32(42);
    for (let i = 0; i < 10; i++) {
      assert.equal(genA(), genB());
    }
  });

  test("different seeds produce different sequences", () => {
    const genA = mulberry32(1);
    const genB = mulberry32(2);
    const a = [genA(), genA(), genA()];
    const b = [genB(), genB(), genB()];
    assert.notDeepEqual(a, b);
  });

  test("every output stays within [0, 1)", () => {
    const gen = mulberry32(12345);
    for (let i = 0; i < 200; i++) {
      const v = gen();
      assert.ok(v >= 0 && v < 1, `value ${v} out of range at step ${i}`);
    }
  });
});
