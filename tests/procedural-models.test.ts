import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  PROCEDURAL_GENERATORS,
  PROCEDURAL_FAMILIES,
  generateProceduralParts,
  type ProceduralPart,
} from "@/lib/procedural-models";
import { PRESETS } from "@/lib/planner-presets";

// A handful of representative dims to sanity-check every generator against,
// not just one preset's own default -- catches a generator that only
// happens to work for "nice" proportions (e.g. w === l) but breaks (negative
// size, NaN) once a user drags an item to something lopsided.
const SAMPLE_DIMS = [
  { w: 100, h: 80, l: 100 },
  { w: 200, h: 45, l: 60 },
  { w: 30, h: 200, l: 30 },
  { w: 15, h: 12, l: 15 },
];

function assertPartsSane(parts: ProceduralPart[], label: string) {
  assert.ok(parts.length > 0, `${label} produced zero parts`);
  for (const p of parts) {
    assert.ok(
      ["box", "cylinder", "cone", "sphere"].includes(p.shape),
      `${label} bad shape ${p.shape}`,
    );
    for (const key of ["sx", "sy", "sz"] as const) {
      assert.ok(
        Number.isFinite(p[key]) && p[key] > 0,
        `${label} part has non-positive/${key}=${p[key]}`,
      );
    }
    for (const key of ["x", "y", "z"] as const) {
      assert.ok(Number.isFinite(p[key]), `${label} part has non-finite ${key}`);
    }
    if (p.colorOffset !== undefined) {
      assert.ok(p.colorOffset >= -1 && p.colorOffset <= 1, `${label} colorOffset out of range`);
    }
  }
}

describe("PROCEDURAL_GENERATORS", () => {
  for (const [name, gen] of Object.entries(PROCEDURAL_GENERATORS)) {
    test(`${name} produces sane, non-degenerate parts across a range of dimensions`, () => {
      for (const dims of SAMPLE_DIMS) {
        // Exercise every family with a representative param combination --
        // booleans/strings that appear anywhere in planner-presets.ts for
        // this family, so branches like hasTank/round/mount aren't only
        // ever tested at their default.
        const variants: Record<string, number | boolean | string>[] = [
          {},
          { hasTank: true },
          { hasTank: false },
          { round: true },
          { roundTop: true },
          { topOverhang: true },
          { shelfFrac: 0.3 },
          { doorLines: 3 },
          { legs: true },
          { legs: true, doorLines: 4, topOverhang: true },
          { cellSize: 20 },
          { shelfGap: 15 },
          { doorWidth: 30 },
          { flame: true },
          { mount: "wall", shade: "cone" },
          { mount: "ceiling", shade: "disc" },
          { mount: "ceiling", shade: "sphereCluster" },
          { mount: "floor", shade: "cone" },
        ];
        for (const params of variants) {
          const parts = gen(dims, params);
          assertPartsSane(parts, `${name}(${JSON.stringify(dims)}, ${JSON.stringify(params)})`);
        }
      }
    });
  }
});

describe("generateProceduralParts", () => {
  test("returns an empty array for an unknown family instead of throwing", () => {
    const parts = generateProceduralParts({ family: "not-a-real-family" }, { w: 50, h: 50, l: 50 });
    assert.deepEqual(parts, []);
  });

  test("forwards params through to the resolved generator", () => {
    const withTank = generateProceduralParts(
      { family: "pedestalFixture", params: { hasTank: true } },
      { w: 40, h: 75, l: 70 },
    );
    const withoutTank = generateProceduralParts(
      { family: "pedestalFixture", params: { hasTank: false } },
      { w: 40, h: 75, l: 70 },
    );
    assert.ok(withTank.length > withoutTank.length);
  });
});

describe("proceduralModel catalog integrity (planner-presets.ts)", () => {
  const withProcedural = PRESETS.filter((p) => p.proceduralModel);

  test("a meaningful chunk of the non-kitModel catalog has a proceduralModel", () => {
    assert.ok(
      withProcedural.length >= 30,
      `expected at least 30 presets with a proceduralModel, got ${withProcedural.length}`,
    );
  });

  test("no preset sets both kitModel and proceduralModel -- kitModel always wins, so a proceduralModel there would be silently dead", () => {
    const both = PRESETS.filter((p) => p.kitModel && p.proceduralModel);
    assert.deepEqual(
      both.map((p) => p.key),
      [],
    );
  });

  test("every proceduralModel.family names a real generator", () => {
    for (const p of withProcedural) {
      assert.ok(
        PROCEDURAL_FAMILIES.includes(p.proceduralModel!.family),
        `${p.key}'s proceduralModel.family "${p.proceduralModel!.family}" isn't a real generator`,
      );
    }
  });

  test("every mapped preset's own default size produces sane, non-degenerate parts", () => {
    for (const p of withProcedural) {
      const dims = { w: p.w, h: p.h ?? 1, l: p.l };
      const parts = generateProceduralParts(p.proceduralModel!, dims);
      assertPartsSane(parts, p.key);
    }
  });
});
