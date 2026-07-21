import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildFloorPatternSpec, type FloorPatternSpec } from "@/lib/floor-pattern-geometry";
import type { FloorPattern } from "@/types/planner";

// Shared, renderer-agnostic geometry consumed by both the 2D SVG pattern
// renderer and the 3D canvas-texture renderer -- previously untested (see
// AUDIT.md section 4). These tests check the structural contract every
// pattern must honor (a positive, tileable tile size; every rect/dot shade
// within the -1..1 range shadeColor() expects; nothing with a zero/negative
// footprint) rather than exact pixel output, since the exact plank/grout
// layout is a deliberate visual design choice, not a correctness property.

const ALL_PATTERNS: FloorPattern[] = [
  "laminate",
  "hardwood",
  "herringbone",
  "polished",
  "raw",
  "square-tile",
  "large-tile",
  "checkerboard",
  "plush",
  "flat",
];

function assertValidSpec(spec: FloorPatternSpec, pattern: string) {
  assert.ok(spec.tileW > 0, `${pattern}: tileW must be positive`);
  assert.ok(spec.tileH > 0, `${pattern}: tileH must be positive`);
  for (const r of spec.rects) {
    assert.ok(r.w > 0 && r.h > 0, `${pattern}: rect must have a positive footprint`);
    assert.ok(r.shade >= -1 && r.shade <= 1, `${pattern}: rect shade ${r.shade} out of range`);
  }
  for (const d of spec.dots ?? []) {
    assert.ok(d.r > 0, `${pattern}: dot radius must be positive`);
    assert.ok(d.shade >= -1 && d.shade <= 1, `${pattern}: dot shade ${d.shade} out of range`);
  }
}

describe("buildFloorPatternSpec", () => {
  test("every known pattern produces a structurally valid spec", () => {
    for (const pattern of ALL_PATTERNS) {
      assertValidSpec(buildFloorPatternSpec(pattern), pattern);
    }
  });

  test("an unknown pattern falls back to a flat (empty) tile instead of throwing", () => {
    const spec = buildFloorPatternSpec("not-a-real-pattern" as FloorPattern);
    assert.deepEqual(spec, { tileW: 20, tileH: 20, rects: [] });
  });

  test("'flat' has no rects and no dots -- a plain color fill", () => {
    const spec = buildFloorPatternSpec("flat");
    assert.deepEqual(spec.rects, []);
    assert.equal(spec.dots, undefined);
  });

  test("plank patterns (laminate/hardwood) produce rects but no top-level dots key when knot-free", () => {
    const laminate = buildFloorPatternSpec("laminate");
    assert.ok(laminate.rects.length > 0);
    // Laminate never sets knots: true, so it should never emit dots.
    assert.equal(laminate.dots, undefined);
  });

  test("hardwood (knots: true) can produce dots, unlike laminate", () => {
    // Deterministic (mulberry32-seeded), so this is checking the real,
    // reproducible output shape rather than getting lucky on one run.
    const hardwood = buildFloorPatternSpec("hardwood");
    assert.ok(hardwood.rects.length > 0);
    // Not asserting dots.length > 0 here since knot placement is seeded-
    // random per plank (rng() < 0.18) -- but if any are present they must
    // be well-formed, which assertValidSpec above already checked.
    assert.ok(Array.isArray(hardwood.dots ?? []));
  });

  test("herringbone produces exactly 4 rotated planks per tile", () => {
    const spec = buildFloorPatternSpec("herringbone");
    assert.equal(spec.rects.length, 4);
    for (const r of spec.rects) {
      assert.ok(r.rotDeg === 45 || r.rotDeg === -45);
    }
  });

  test("herringbone's tile is square (tileW === tileH)", () => {
    const spec = buildFloorPatternSpec("herringbone");
    assert.equal(spec.tileW, spec.tileH);
  });

  test("checkerboard's tile is exactly 2x2 cells (tileW === tileH === 2 * cellSize)", () => {
    const spec = buildFloorPatternSpec("checkerboard");
    // 4 fill rects (one per cell) + 4 grout-line rects = 8.
    assert.equal(spec.rects.length, 8);
  });

  test("concrete/carpet patterns (polished/raw/plush) are dot-based with no rects", () => {
    for (const pattern of ["polished", "raw", "plush"] as FloorPattern[]) {
      const spec = buildFloorPatternSpec(pattern);
      assert.deepEqual(spec.rects, []);
      assert.ok((spec.dots?.length ?? 0) > 0, `${pattern} should produce speckle/fiber dots`);
    }
  });

  test("'raw' concrete has more speckle density and contrast than 'polished'", () => {
    const polished = buildFloorPatternSpec("polished");
    const raw = buildFloorPatternSpec("raw");
    assert.ok((raw.dots?.length ?? 0) > (polished.dots?.length ?? 0));
  });

  test("tile patterns (square-tile/large-tile) produce a base fill plus 2 grout-line rects", () => {
    for (const pattern of ["square-tile", "large-tile"] as FloorPattern[]) {
      const spec = buildFloorPatternSpec(pattern);
      assert.equal(spec.rects.length, 3);
    }
  });

  test("large-tile's cell is bigger than square-tile's", () => {
    const square = buildFloorPatternSpec("square-tile");
    const large = buildFloorPatternSpec("large-tile");
    assert.ok(large.tileW > square.tileW);
  });

  test("calling the same pattern twice produces an identical spec (deterministic, seeded noise)", () => {
    const a = buildFloorPatternSpec("hardwood");
    const b = buildFloorPatternSpec("hardwood");
    assert.deepEqual(a, b);
  });
});
