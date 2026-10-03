import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FloorPatternDef, FloorSwatchPreview } from "@/lib/floor-pattern-svg";
import { getFloorTexture } from "@/lib/floor-textures";
import { DEFAULT_FLOORING, FLOOR_MATERIALS } from "@/lib/floor-materials";
import { buildFloorPatternSpec } from "@/lib/floor-pattern-geometry";
import type { RoomFlooring } from "@/types/planner";

// The 3D texture draws on an offscreen canvas. Under Node there is none, so a stand-in records
// what gets drawn, in order, with the fill it was drawn in.
interface Draw {
  op: "rect" | "arc" | "rotate";
  fill: string;
  args: number[];
}
interface FakeCanvas {
  width: number;
  height: number;
  draws: Draw[];
  getContext: () => unknown;
}
const canvases: FakeCanvas[] = [];
function fakeCanvas(): FakeCanvas {
  const draws: Draw[] = [];
  const ctx = {
    fillStyle: "",
    fillRect(...args: number[]) {
      draws.push({ op: "rect", fill: this.fillStyle, args });
    },
    arc(...args: number[]) {
      draws.push({ op: "arc", fill: this.fillStyle, args });
    },
    rotate(angle: number) {
      draws.push({ op: "rotate", fill: this.fillStyle, args: [angle] });
    },
    save() {},
    restore() {},
    translate() {},
    beginPath() {},
    fill() {},
  };
  const canvas = { width: 0, height: 0, draws, getContext: () => ctx };
  canvases.push(canvas);
  return canvas;
}
Object.assign(globalThis, { document: { createElement: fakeCanvas } });

/** Every fill in a piece of SVG markup, in document order. */
const svgFills = (markup: string) => [...markup.matchAll(/ fill="([^"]+)"/g)].map((m) => m[1]);

const pattern2d = (flooring: RoomFlooring | undefined, cm = (v: number) => v) =>
  renderToStaticMarkup(
    createElement("svg", null, createElement(FloorPatternDef, { flooring, cm, patternId: "p" })),
  );

/** The canvas getFloorTexture drew on: a texture's image is the canvas it was made from. */
const canvasOf = (flooring: RoomFlooring | undefined) =>
  getFloorTexture(flooring).texture.image as FakeCanvas;

describe("floor renderers: the 2D pattern and the 3D texture", () => {
  for (const mat of FLOOR_MATERIALS) {
    test(`${mat.key}: both draw the same shapes, in the same shades, in the same order`, () => {
      const flooring = { key: mat.key, color: mat.defaultColor };
      const fills3d = canvasOf(flooring)
        .draws.filter((d) => d.op !== "rotate")
        .map((d) => d.fill);
      assert.deepEqual(svgFills(pattern2d(flooring)), fills3d);
      assert.equal(fills3d[0], mat.defaultColor, "the base is the room's own colour");
    });
  }

  test("rotated planks (herringbone) are rotated by the same angles in both", () => {
    const flooring = { key: "wood-herringbone", color: "#a9744f" };
    const rotated = buildFloorPatternSpec("herringbone").rects.filter((r) => r.rotDeg);
    assert.ok(rotated.length > 0);
    const markup = pattern2d(flooring);
    assert.equal((markup.match(/<polygon /g) ?? []).length, rotated.length);
    const angles = canvasOf(flooring)
      .draws.filter((d) => d.op === "rotate")
      .map((d) => d.args[0]);
    assert.deepEqual(
      angles,
      rotated.map((r) => ((r.rotDeg ?? 0) * Math.PI) / 180),
    );
  });

  test("the 2D pattern tiles at the canvas's own scale", () => {
    const spec = buildFloorPatternSpec("square-tile");
    const markup = pattern2d({ key: "tile-square", color: "#e8e6e1" }, (v) => v * 2);
    assert.match(
      markup,
      new RegExp(`<pattern id="p" width="${spec.tileW * 2}" height="${spec.tileH * 2}"`),
    );
  });

  test("the texture keeps the tile's proportions, at most 1024 px a side", () => {
    let fullResolution = 0;
    for (const mat of FLOOR_MATERIALS) {
      const spec = buildFloorPatternSpec(mat.pattern);
      const canvas = canvasOf({ key: mat.key, color: "#123456" });
      assert.ok(Math.max(canvas.width, canvas.height) <= 1024, mat.key);
      // Rounding to whole pixels moves either side by at most half a pixel.
      const scale = canvas.width / spec.tileW;
      assert.ok(Math.abs(canvas.height - spec.tileH * scale) <= 1, mat.key);
      if (canvas.width === spec.tileW * 6) fullResolution++;
    }
    assert.ok(fullResolution > 0, "small tiles get the full 6 px per cm");
  });

  test("a texture is made once per material and colour, then reused", () => {
    const flooring = { key: "carpet-plush", color: "#665544" };
    const before = canvases.length;
    const first = getFloorTexture(flooring);
    assert.equal(getFloorTexture({ ...flooring }), first);
    assert.equal(canvases.length, before + 1);
    assert.notEqual(getFloorTexture({ ...flooring, color: "#665545" }), first);
  });

  test("a room without flooring, or with an unknown material, gets the plain default in both", () => {
    assert.deepEqual(svgFills(pattern2d(undefined)), [DEFAULT_FLOORING.color]);
    assert.equal(getFloorTexture(undefined), getFloorTexture(DEFAULT_FLOORING));
    const unknown = { key: "marble-from-the-future", color: "#abcdef" };
    assert.deepEqual(svgFills(pattern2d(unknown)), ["#abcdef"]);
    assert.deepEqual(
      canvasOf(unknown).draws.map((d) => d.fill),
      ["#abcdef"],
    );
  });
});

describe("FloorSwatchPreview", () => {
  test("each swatch fills from its own pattern, so swatches on one page never share one", () => {
    const markup = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(FloorSwatchPreview, { materialKey: "wood-laminate", color: "#c9a06b" }),
        createElement(FloorSwatchPreview, { materialKey: "wood-laminate", color: "#8b5a2b" }),
        createElement(FloorSwatchPreview, { materialKey: "tile-large", color: "#c9a06b" }),
      ),
    );
    const ids = [...markup.matchAll(/<pattern id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, 3);
    const uses = [...markup.matchAll(/fill="url\(#([^)]+)\)"/g)].map((m) => m[1]);
    assert.deepEqual(uses, ids);
  });
});
