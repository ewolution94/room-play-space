import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildRectangleCorners,
  buildLShapeCorners,
  buildCutCornerCorners,
  buildTShapeCorners,
  buildUShapeCorners,
  dragWallEdge,
  resizeRoomShape,
  MIN_WALL_LENGTH,
  setWallLength,
  ROOM_SHAPE_TEMPLATES,
} from "@/lib/room-shapes";
import { wallSegments, polygonSelfIntersects } from "@/lib/hallway-shapes";
import type { Point } from "@/types/planner";

function shoelaceArea(corners: Point[]): number {
  let sum = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

describe("buildRectangleCorners", () => {
  test("produces the standard 4-corner clockwise rectangle", () => {
    const c = buildRectangleCorners(400, 300);
    assert.deepEqual(c, [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 300 },
      { x: 0, y: 300 },
    ]);
  });
});

describe("buildLShapeCorners", () => {
  test("has 6 corners", () => {
    assert.equal(buildLShapeCorners(400, 300, 150, 120).length, 6);
  });

  test("area equals the full rectangle minus the notch", () => {
    const corners = buildLShapeCorners(400, 300, 150, 120);
    const area = Math.abs(shoelaceArea(corners));
    assert.ok(Math.abs(area - (400 * 300 - 150 * 120)) < 1e-6);
  });

  test("winds the same clockwise direction as a plain rectangle", () => {
    const rectSign = Math.sign(shoelaceArea(buildRectangleCorners(400, 300)));
    const lSign = Math.sign(shoelaceArea(buildLShapeCorners(400, 300, 150, 120)));
    assert.equal(lSign, rectSign);
  });
});

describe("buildCutCornerCorners", () => {
  test("has 5 corners", () => {
    assert.equal(buildCutCornerCorners(400, 300, 100, 90).length, 5);
  });

  test("area equals the full rectangle minus the chamfer triangle", () => {
    const corners = buildCutCornerCorners(400, 300, 100, 90);
    const area = Math.abs(shoelaceArea(corners));
    assert.ok(Math.abs(area - (400 * 300 - (100 * 90) / 2)) < 1e-6);
  });
});

describe("buildTShapeCorners", () => {
  test("has 8 corners", () => {
    assert.equal(buildTShapeCorners(600, 450, 200, 250).length, 8);
  });

  test("area equals the bar plus the stem", () => {
    const area = Math.abs(shoelaceArea(buildTShapeCorners(600, 450, 200, 250)));
    // 600x250 bar + a 200-wide stem hanging the remaining 200 deep.
    assert.ok(Math.abs(area - (600 * 250 + 200 * 200)) < 1e-6);
  });

  test("winds the same clockwise direction as a plain rectangle", () => {
    const rectSign = Math.sign(shoelaceArea(buildRectangleCorners(600, 450)));
    assert.equal(Math.sign(shoelaceArea(buildTShapeCorners(600, 450, 200, 250))), rectSign);
  });

  test("centres the stem and spans the full width and length", () => {
    const c = buildTShapeCorners(600, 450, 200, 250);
    const xs = c.map((p) => p.x);
    const ys = c.map((p) => p.y);
    assert.equal(Math.min(...xs), 0);
    assert.equal(Math.max(...xs), 600);
    assert.equal(Math.min(...ys), 0);
    assert.equal(Math.max(...ys), 450);
    // The two shoulders are equal, which is what makes it read as a T.
    const stemLeft = c.find((p) => p.y === 450)!.x;
    assert.equal(Math.min(...c.filter((p) => p.y === 450).map((p) => p.x)), 200);
    assert.equal(Math.max(...c.filter((p) => p.y === 450).map((p) => p.x)), 400);
    assert.ok(stemLeft === 200 || stemLeft === 400);
  });

  test("every corner is axis-aligned to its neighbour", () => {
    // The 90/270-only property is what dragWallEdge's degeneracy guard and
    // insetRectilinearPolygon both rely on.
    const c = buildTShapeCorners(600, 450, 200, 250);
    for (const seg of wallSegments(c)) {
      const dx = Math.abs(seg.b.x - seg.a.x);
      const dy = Math.abs(seg.b.y - seg.a.y);
      assert.ok(dx < 1e-9 || dy < 1e-9, "every T-shape wall runs along an axis");
    }
  });
});

describe("buildUShapeCorners", () => {
  test("has 8 corners", () => {
    assert.equal(buildUShapeCorners(600, 450, 200, 150).length, 8);
  });

  test("area equals the full rectangle minus the notch", () => {
    const area = Math.abs(shoelaceArea(buildUShapeCorners(600, 450, 200, 150)));
    assert.ok(Math.abs(area - (600 * 450 - 200 * 150)) < 1e-6);
  });

  test("winds the same clockwise direction as a plain rectangle", () => {
    const rectSign = Math.sign(shoelaceArea(buildRectangleCorners(600, 450)));
    assert.equal(Math.sign(shoelaceArea(buildUShapeCorners(600, 450, 200, 150))), rectSign);
  });

  test("cuts the notch out of the bottom wall, centred", () => {
    const c = buildUShapeCorners(600, 450, 200, 150);
    const notchTop = c.filter((p) => p.y === 300).map((p) => p.x);
    assert.deepEqual(
      notchTop.sort((a, b) => a - b),
      [200, 400],
    );
    // Still spans the full declared footprint despite the bite.
    assert.equal(Math.max(...c.map((p) => p.x)), 600);
    assert.equal(Math.max(...c.map((p) => p.y)), 450);
  });

  test("every corner is axis-aligned to its neighbour", () => {
    const c = buildUShapeCorners(600, 450, 200, 150);
    for (const seg of wallSegments(c)) {
      const dx = Math.abs(seg.b.x - seg.a.x);
      const dy = Math.abs(seg.b.y - seg.a.y);
      assert.ok(dx < 1e-9 || dy < 1e-9, "every U-shape wall runs along an axis");
    }
  });
});

describe("dragWallEdge", () => {
  test("dragging a rectangle's top wall outward moves both top corners and leaves the bottom untouched", () => {
    const corners = buildRectangleCorners(400, 300);
    const next = dragWallEdge(corners, 0, { x: 0, y: -20 });
    assert.deepEqual(next[0], { x: 0, y: -20 });
    assert.deepEqual(next[1], { x: 400, y: -20 });
    assert.deepEqual(next[2], corners[2]);
    assert.deepEqual(next[3], corners[3]);
  });

  test("dragging the right wall only moves the width, not the length", () => {
    const corners = buildRectangleCorners(400, 300);
    const next = dragWallEdge(corners, 1, { x: 50, y: 0 });
    assert.deepEqual(next[1], { x: 450, y: 0 });
    assert.deepEqual(next[2], { x: 450, y: 300 });
    assert.deepEqual(next[0], corners[0]);
    assert.deepEqual(next[3], corners[3]);
  });

  test("an along-wall (non-perpendicular) drag component is ignored", () => {
    const corners = buildRectangleCorners(400, 300);
    // Dragging the top wall (normal is (0,-1)) purely sideways (x-only)
    // should be a no-op: the projected distance along the normal is 0.
    const next = dragWallEdge(corners, 0, { x: 80, y: 0 });
    assert.deepEqual(next, corners);
  });

  test("dragging inward past the minimum wall length is rejected (returns unchanged corners)", () => {
    const corners = buildRectangleCorners(200, 200);
    const next = dragWallEdge(corners, 0, { x: 0, y: 199 }); // would leave ~1cm
    assert.deepEqual(next, corners);
  });

  test("a small legal inward drag is accepted and stays above the minimum", () => {
    const corners = buildRectangleCorners(200, 200);
    const next = dragWallEdge(corners, 0, { x: 0, y: 100 });
    const newLength = next[3].y - next[0].y;
    assert.ok(newLength >= MIN_WALL_LENGTH);
  });

  test("dragging one of the L-shape's notch walls only moves that wall's two corners", () => {
    const corners = buildLShapeCorners(400, 300, 150, 120);
    // Wall 2 is the notch's horizontal floor (corners[2] -> corners[3]),
    // running from (250,120) to (400,120) -- perpendicular drag is in y.
    const next = dragWallEdge(corners, 2, { x: 0, y: 20 });
    assert.notDeepEqual(next[2], corners[2]);
    assert.notDeepEqual(next[3], corners[3]);
    for (const idx of [0, 1, 4, 5]) {
      assert.deepEqual(next[idx], corners[idx], `corner ${idx} should be untouched`);
    }
  });

  test("dragging the cut-corner's diagonal wall works without assuming axis alignment", () => {
    const corners = buildCutCornerCorners(400, 300, 100, 90);
    // Wall 1 is the diagonal chamfer (corners[1] -> corners[2]).
    const next = dragWallEdge(corners, 1, { x: 15, y: -15 });
    assert.notDeepEqual(next[1], corners[1]);
    assert.notDeepEqual(next[2], corners[2]);
    for (const idx of [0, 3, 4]) {
      assert.deepEqual(next[idx], corners[idx], `corner ${idx} should be untouched`);
    }
  });

  test("results are rounded to 2 decimal places, not raw floating-point noise", () => {
    const corners = buildCutCornerCorners(400, 300, 100, 90);
    // A diagonal drag is exactly the kind of line-intersection math that
    // used to leave 10+ digits after the decimal point (e.g.
    // 501.60711669921875) in the resulting corners.
    const next = dragWallEdge(corners, 1, { x: 13, y: -7 });
    for (const idx of [1, 2]) {
      const decimals = (v: number) => (String(v).split(".")[1] ?? "").length;
      assert.ok(decimals(next[idx].x) <= 2, `x has too many decimals: ${next[idx].x}`);
      assert.ok(decimals(next[idx].y) <= 2, `y has too many decimals: ${next[idx].y}`);
    }
  });

  test("dragging a notch wall far enough to invert its neighbor is rejected", () => {
    const corners = buildLShapeCorners(400, 300, 150, 120);
    // Push wall 1 (top-right stub, corners[1]->corners[2], a vertical wall)
    // way past where it would cross behind corners[0]/corners[5]'s line.
    const next = dragWallEdge(corners, 1, { x: 500, y: 0 });
    assert.deepEqual(next, corners);
  });

  test("widening the T-shape's stem moves only that wall's two corners", () => {
    const corners = buildTShapeCorners(600, 450, 200, 250);
    // Wall 3 is the stem's right side, (400,250) -> (400,450); its normal
    // points out to the right, so a +x drag widens the stem.
    const next = dragWallEdge(corners, 3, { x: 60, y: 0 });
    assert.deepEqual(next[3], { x: 460, y: 250 });
    assert.deepEqual(next[4], { x: 460, y: 450 });
    for (const idx of [0, 1, 2, 5, 6, 7]) {
      assert.deepEqual(next[idx], corners[idx], `corner ${idx} should be untouched`);
    }
  });

  test("deepening the U-shape's notch moves only the notch's top wall", () => {
    const corners = buildUShapeCorners(600, 450, 200, 150);
    // Wall 4 is the notch's ceiling, (400,300) -> (200,300). It's a reflex
    // pair, so this is the case where winding direction matters.
    const next = dragWallEdge(corners, 4, { x: 0, y: -40 });
    assert.deepEqual(next[4], { x: 400, y: 260 });
    assert.deepEqual(next[5], { x: 200, y: 260 });
    for (const idx of [0, 1, 2, 3, 6, 7]) {
      assert.deepEqual(next[idx], corners[idx], `corner ${idx} should be untouched`);
    }
  });

  test("a U-shape notch deep enough to break through the far wall is rejected", () => {
    const corners = buildUShapeCorners(600, 450, 200, 150);
    const next = dragWallEdge(corners, 4, { x: 0, y: -1000 });
    assert.deepEqual(next, corners);
  });
});

describe("resizeRoomShape", () => {
  test("scales a rectangle to the exact requested width/length", () => {
    const corners = buildRectangleCorners(400, 300);
    const next = resizeRoomShape(corners, 800, 150);
    const xs = next.map((c) => c.x);
    const ys = next.map((c) => c.y);
    assert.ok(Math.abs(Math.max(...xs) - 800) < 1e-6);
    assert.ok(Math.abs(Math.max(...ys) - 150) < 1e-6);
  });

  test("preserves the L-shape's notch proportions when scaled up", () => {
    const corners = buildLShapeCorners(400, 300, 150, 120); // notch is 37.5% / 40%
    const scaled = resizeRoomShape(corners, 800, 600); // 2x both dims
    // corners[1].x is (width - notchWidth); notchWidth should have scaled too.
    const notchWidth = 800 - scaled[1].x;
    assert.ok(Math.abs(notchWidth - 300) < 1e-6); // 150 * 2
    const notchDepth = scaled[2].y;
    assert.ok(Math.abs(notchDepth - 240) < 1e-6); // 120 * 2
  });
});

describe("setWallLength", () => {
  const RECT: Point[] = [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 300 },
    { x: 0, y: 300 },
  ];
  // Cut-corner: the shape whose diagonal makes the length relationship
  // non-linear, which is why setWallLength iterates rather than solving once.
  const L: Point[] = [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 200 },
    { x: 200, y: 200 },
    { x: 200, y: 300 },
    { x: 0, y: 300 },
  ];

  const lengthOf = (corners: Point[], i: number) => wallSegments(corners)[i].length;

  test("sets a rectangle's top wall exactly", () => {
    const out = setWallLength(RECT, 0, 250);
    assert.ok(Math.abs(lengthOf(out, 0) - 250) < 0.05, `got ${lengthOf(out, 0)}`);
  });

  test("sets a rectangle's side wall exactly, leaving the other axis alone", () => {
    const out = setWallLength(RECT, 1, 450);
    assert.ok(Math.abs(lengthOf(out, 1) - 450) < 0.05, `got ${lengthOf(out, 1)}`);
    assert.ok(Math.abs(lengthOf(out, 0) - 400) < 0.05, "width should be untouched");
  });

  test("grows as well as shrinks", () => {
    const grown = setWallLength(RECT, 0, 900);
    assert.ok(Math.abs(lengthOf(grown, 0) - 900) < 0.05, `got ${lengthOf(grown, 0)}`);
  });

  // The whole point of generalising past rectangles.
  test("works on a polygon (L-shaped) room", () => {
    const out = setWallLength(L, 0, 300);
    assert.ok(Math.abs(lengthOf(out, 0) - 300) < 0.5, `got ${lengthOf(out, 0)}`);
    assert.equal(out.length, L.length, "corner count must be preserved");
  });

  test("refuses a length the shape's own guards reject, rather than corrupting it", () => {
    const out = setWallLength(RECT, 0, 1);
    // dragWallEdge's minimum-size guard wins; the shape stays valid either
    // way -- what must never happen is a degenerate or inverted polygon.
    assert.equal(out.length, 4);
    assert.ok(lengthOf(out, 0) > 0);
  });

  test("ignores nonsense input", () => {
    assert.equal(setWallLength(RECT, 0, NaN), RECT);
    assert.equal(setWallLength(RECT, 0, -50), RECT);
  });

  test("sets a T-shape's stem width by typing its bottom wall's length", () => {
    const t = buildTShapeCorners(600, 450, 200, 250);
    const out = setWallLength(t, 4, 300); // wall 4 is the stem's bottom edge
    assert.ok(Math.abs(lengthOf(out, 4) - 300) < 0.5, `got ${lengthOf(out, 4)}`);
    assert.equal(out.length, 8, "corner count must be preserved");
  });

  test("sets a U-shape's notch width by typing its top wall's length", () => {
    const u = buildUShapeCorners(600, 450, 200, 150);
    const out = setWallLength(u, 4, 260); // wall 4 is the notch's ceiling
    assert.ok(Math.abs(lengthOf(out, 4) - 260) < 0.5, `got ${lengthOf(out, 4)}`);
    assert.equal(out.length, 8, "corner count must be preserved");
  });
});

describe("ROOM_SHAPE_TEMPLATES", () => {
  test("every template's corners are whole centimetres", () => {
    // Only dragged corners get rounded (dragWallEdge), so a template built
    // from e.g. width/3 would carry 266.6666666666667 into the saved room
    // for any wall the user never touched.
    for (const tpl of ROOM_SHAPE_TEMPLATES) {
      for (const c of tpl.defaultCorners) {
        assert.equal(c.x, Math.round(c.x), `${tpl.key} has a fractional x: ${c.x}`);
        assert.equal(c.y, Math.round(c.y), `${tpl.key} has a fractional y: ${c.y}`);
      }
    }
  });

  test("every template is a simple, non-self-intersecting polygon", () => {
    for (const tpl of ROOM_SHAPE_TEMPLATES) {
      assert.equal(polygonSelfIntersects(tpl.defaultCorners), false, tpl.key);
    }
  });

  test("every template's walls clear the minimum wall length", () => {
    for (const tpl of ROOM_SHAPE_TEMPLATES) {
      for (const seg of wallSegments(tpl.defaultCorners)) {
        assert.ok(
          seg.length >= MIN_WALL_LENGTH,
          `${tpl.key} wall ${seg.index} is only ${seg.length}cm`,
        );
      }
    }
  });

  test("keys are unique", () => {
    const keys = ROOM_SHAPE_TEMPLATES.map((t) => t.key);
    assert.equal(new Set(keys).size, keys.length);
  });
});
