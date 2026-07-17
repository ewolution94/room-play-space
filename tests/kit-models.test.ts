import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  nativeSize,
  resolveRenderMode,
  computeModelScale,
  KIT_ENVELOPE_MIN,
  KIT_ENVELOPE_MAX,
} from "@/lib/kit-models";
import { PRESETS } from "@/lib/planner-presets";
import type { KitModel } from "@/types/planner";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KIT_MODELS_DIR = path.join(__dirname, "..", "public", "models", "kenney");

// A stand-in model shaped like loungeDesignSofa.glb's real bounding box
// (see planner-presets.ts's "sofa" entry) -- native 112 x 40 x 41 cm,
// origin at the floor-front-left corner rather than centered.
const SOFA_MODEL: KitModel = {
  file: "loungeDesignSofa.glb",
  minX: 0,
  minY: 0,
  minZ: -41,
  maxX: 112,
  maxY: 40,
  maxZ: 0,
};

describe("nativeSize", () => {
  test("derives w/h/l from possibly-asymmetric min/max, not assuming a centered origin", () => {
    assert.deepEqual(nativeSize(SOFA_MODEL), { w: 112, h: 40, l: 41 });
  });

  test("handles a model whose bbox dips slightly negative on more than one axis (bedDouble-shaped)", () => {
    const bed: KitModel = {
      file: "bedDouble.glb",
      minX: -5.86,
      minY: -13,
      minZ: -189.2,
      maxX: 156.47,
      maxY: 37.5,
      maxZ: 2,
    };
    const size = nativeSize(bed);
    assert.ok(Math.abs(size.w - 162.33) < 0.01);
    assert.ok(Math.abs(size.h - 50.5) < 0.01);
    assert.ok(Math.abs(size.l - 191.2) < 0.01);
  });
});

describe("resolveRenderMode", () => {
  const sofaDefault = { w: 220, h: 80, l: 95 };

  test("renders as the model at exactly the preset default size", () => {
    assert.equal(resolveRenderMode(sofaDefault, sofaDefault), "model");
  });

  test("still renders as the model for a modest resize within the envelope", () => {
    assert.equal(resolveRenderMode({ w: 240, h: 85, l: 100 }, sofaDefault), "model");
    assert.equal(resolveRenderMode({ w: 160, h: 70, l: 80 }, sofaDefault), "model");
  });

  test("falls back to the box once any single axis drifts past the envelope", () => {
    // width blown out to 2x default, height/length unchanged
    assert.equal(resolveRenderMode({ w: 440, h: 80, l: 95 }, sofaDefault), "box");
    // squashed to a third of default height only
    assert.equal(resolveRenderMode({ w: 220, h: 25, l: 95 }, sofaDefault), "box");
  });

  test("the envelope bounds themselves are inclusive", () => {
    const atMin = {
      w: sofaDefault.w * KIT_ENVELOPE_MIN,
      h: sofaDefault.h * KIT_ENVELOPE_MIN,
      l: sofaDefault.l * KIT_ENVELOPE_MIN,
    };
    const atMax = {
      w: sofaDefault.w * KIT_ENVELOPE_MAX,
      h: sofaDefault.h * KIT_ENVELOPE_MAX,
      l: sofaDefault.l * KIT_ENVELOPE_MAX,
    };
    assert.equal(resolveRenderMode(atMin, sofaDefault), "model");
    assert.equal(resolveRenderMode(atMax, sofaDefault), "model");
  });

  test("just outside the envelope on either side falls back to the box", () => {
    const justBelow = { w: sofaDefault.w * (KIT_ENVELOPE_MIN - 0.01), h: 80, l: 95 };
    const justAbove = { w: sofaDefault.w * (KIT_ENVELOPE_MAX + 0.01), h: 80, l: 95 };
    assert.equal(resolveRenderMode(justBelow, sofaDefault), "box");
    assert.equal(resolveRenderMode(justAbove, sofaDefault), "box");
  });

  test("a malformed zero-size default (never expected in real data) safely falls back to box instead of dividing by zero", () => {
    assert.equal(resolveRenderMode({ w: 100, h: 100, l: 100 }, { w: 0, h: 80, l: 95 }), "box");
  });
});

describe("computeModelScale", () => {
  test("scales each axis independently to fill the target size", () => {
    const scale = computeModelScale({ w: 220, h: 80, l: 95 }, SOFA_MODEL);
    assert.ok(Math.abs(scale.x - 220 / 112) < 1e-9);
    assert.ok(Math.abs(scale.y - 80 / 40) < 1e-9);
    assert.ok(Math.abs(scale.z - 95 / 41) < 1e-9);
  });

  test("a target equal to the model's own native size yields scale 1 on every axis", () => {
    const scale = computeModelScale({ w: 112, h: 40, l: 41 }, SOFA_MODEL);
    assert.ok(Math.abs(scale.x - 1) < 1e-9);
    assert.ok(Math.abs(scale.y - 1) < 1e-9);
    assert.ok(Math.abs(scale.z - 1) < 1e-9);
  });
});

describe("kitModel catalog data (planner-presets.ts)", () => {
  const withKitModel = PRESETS.filter((p) => p.kitModel);

  test("a meaningful chunk of the catalog has a kitModel mapping", () => {
    assert.ok(
      withKitModel.length >= 50,
      `expected at least 50 presets with a kitModel, got ${withKitModel.length}`,
    );
  });

  test("every kitModel has a non-empty .glb filename", () => {
    for (const p of withKitModel) {
      assert.match(p.kitModel!.file, /\.glb$/, `${p.key} kitModel.file should end in .glb`);
    }
  });

  test("every kitModel's bounding box is non-degenerate (positive size on all three axes)", () => {
    for (const p of withKitModel) {
      const size = nativeSize(p.kitModel!);
      assert.ok(size.w > 0, `${p.key} kitModel has non-positive native width`);
      assert.ok(size.h > 0, `${p.key} kitModel has non-positive native height`);
      assert.ok(size.l > 0, `${p.key} kitModel has non-positive native length`);
    }
  });

  test("every mapped preset's own default size renders as 'model' against itself (sanity check on the mapping, not just the envelope math)", () => {
    for (const p of withKitModel) {
      const dims = { w: p.w, h: p.h ?? 1, l: p.l };
      assert.equal(
        resolveRenderMode(dims, dims),
        "model",
        `${p.key} should resolve to "model" at its own default size`,
      );
    }
  });

  test("every kitModel.file actually exists in public/models/kenney/ (the path ThreeDView.tsx fetches at runtime)", () => {
    for (const p of withKitModel) {
      const filePath = path.join(KIT_MODELS_DIR, p.kitModel!.file);
      assert.ok(
        fs.existsSync(filePath),
        `${p.key}'s kitModel.file "${p.kitModel!.file}" is missing from public/models/kenney/`,
      );
    }
  });

  test("no stray .glb sits in public/models/kenney/ that no preset references (keeps the shipped asset set in sync with the mapping)", () => {
    const referenced = new Set(withKitModel.map((p) => p.kitModel!.file));
    const onDisk = fs.readdirSync(KIT_MODELS_DIR).filter((f) => f.endsWith(".glb"));
    const orphaned = onDisk.filter((f) => !referenced.has(f));
    assert.deepEqual(orphaned, []);
  });
});
