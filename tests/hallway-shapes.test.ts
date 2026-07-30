import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  wallSegments,
  resolveWallSegment,
  wallColorKey,
  wallLabel,
  wallOutwardNormal,
  polygonBoundingBox,
  rotatePolygonCorners,
  insetRectilinearPolygon,
  buildStraightHallwayCorners,
  buildLHallwayCorners,
  buildTHallwayCorners,
  polygonClipPathPercent,
  lineIntersection,
} from "@/lib/hallway-shapes";
import type { Point } from "@/types/planner";

const rect = (w: number, l: number): Point[] => [
  { x: 0, y: 0 },
  { x: w, y: 0 },
  { x: w, y: l },
  { x: 0, y: l },
];

// Shoelace signed area -- used purely as a winding-direction fingerprint.
// Every shape template in this module is constructed "clockwise on screen"
// the same way the pre-existing rectangle convention is; this helper lets
// tests assert that invariant instead of eyeballing coordinates.
function shoelace(corners: Point[]): number {
  let sum = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

describe("wallSegments", () => {
  test("a rectangle produces 4 forward-winding segments", () => {
    const segs = wallSegments(rect(100, 60));
    assert.equal(segs.length, 4);
    assert.deepEqual(segs[0], { index: 0, a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, length: 100 });
    assert.deepEqual(segs[1], { index: 1, a: { x: 100, y: 0 }, b: { x: 100, y: 60 }, length: 60 });
    assert.deepEqual(segs[2], {
      index: 2,
      a: { x: 100, y: 60 },
      b: { x: 0, y: 60 },
      length: 100,
    });
    assert.deepEqual(segs[3], { index: 3, a: { x: 0, y: 60 }, b: { x: 0, y: 0 }, length: 60 });
  });

  test("wraps the last segment back to corner 0", () => {
    const segs = wallSegments(rect(50, 50));
    assert.deepEqual(segs[3].b, segs[0].a);
  });
});

describe("resolveWallSegment", () => {
  const corners = rect(100, 60);

  test("legacy named walls resolve to the historical ptA/ptB pairs", () => {
    assert.deepEqual(resolveWallSegment(corners, "top"), { a: corners[0], b: corners[1] });
    assert.deepEqual(resolveWallSegment(corners, "right"), { a: corners[1], b: corners[2] });
    assert.deepEqual(resolveWallSegment(corners, "bottom"), { a: corners[3], b: corners[2] });
    assert.deepEqual(resolveWallSegment(corners, "left"), { a: corners[0], b: corners[3] });
  });

  test("numeric wall index resolves via forward winding", () => {
    assert.deepEqual(resolveWallSegment(corners, 0), { a: corners[0], b: corners[1] });
    assert.deepEqual(resolveWallSegment(corners, 2), { a: corners[2], b: corners[3] });
  });

  test("numeric wall index wraps out-of-range values via modulo", () => {
    assert.deepEqual(resolveWallSegment(corners, 4), resolveWallSegment(corners, 0));
    assert.deepEqual(resolveWallSegment(corners, -1), resolveWallSegment(corners, 3));
  });

  test("returns null for a legacy name on a room with fewer than 4 corners", () => {
    assert.equal(resolveWallSegment([corners[0], corners[1], corners[2]], "top"), null);
  });
});

describe("wallColorKey", () => {
  test("uses friendly named keys for a 4-corner room", () => {
    assert.equal(wallColorKey(0, 4), "top");
    assert.equal(wallColorKey(1, 4), "right");
    assert.equal(wallColorKey(2, 4), "bottom");
    assert.equal(wallColorKey(3, 4), "left");
  });

  test("uses the stringified index for a polygon room", () => {
    assert.equal(wallColorKey(0, 6), "0");
    assert.equal(wallColorKey(5, 6), "5");
  });
});

describe("wallLabel", () => {
  // Regression coverage for the bug flagged in the audit: a naive `t[wall]`
  // lookup renders "undefined" for a hallway's numeric wall index, since
  // TranslationStrings only ever has "top"/"right"/"bottom"/"left" keys.
  // wallLabel() is the shared fix, now used by both InspectorSection.tsx
  // and ElementsListSection.tsx instead of each hand-rolling (or in
  // ElementsListSection's case, forgetting) the numeric-wall fallback.
  const t = { top: "Top", right: "Right", bottom: "Bottom", left: "Left" };

  test("looks up the friendly name for a named (rectangular-room) wall", () => {
    assert.equal(wallLabel("top", t, "en"), "Top");
    assert.equal(wallLabel("right", t, "en"), "Right");
    assert.equal(wallLabel("bottom", t, "en"), "Bottom");
    assert.equal(wallLabel("left", t, "en"), "Left");
  });

  test("falls back to 'Wall N' (1-indexed) for a numeric polygon wall, in English", () => {
    assert.equal(wallLabel(0, t, "en"), "Wall 1");
    assert.equal(wallLabel(5, t, "en"), "Wall 6");
  });

  test("falls back to 'Wand N' (1-indexed) for a numeric polygon wall, in German", () => {
    assert.equal(wallLabel(0, t, "de"), "Wand 1");
    assert.equal(wallLabel(5, t, "de"), "Wand 6");
  });

  test("a named wall missing from the translation table falls back to the raw key, not 'undefined'", () => {
    assert.equal(wallLabel("top", {}, "en"), "top");
  });
});

describe("wallOutwardNormal", () => {
  test("the top wall's outward normal points up, away from the room below it", () => {
    const n = wallOutwardNormal({ x: 0, y: 0 }, { x: 100, y: 0 });
    assert.ok(Math.abs(n.x) < 1e-9);
    assert.ok(n.y < 0);
  });

  test("the right wall's outward normal points right, away from the room to its left", () => {
    const n = wallOutwardNormal({ x: 100, y: 0 }, { x: 100, y: 60 });
    assert.ok(n.x > 0);
    assert.ok(Math.abs(n.y) < 1e-9);
  });

  test("the bottom wall's outward normal points down (forward-winding index order, not the legacy reversed name)", () => {
    const n = wallOutwardNormal({ x: 100, y: 60 }, { x: 0, y: 60 });
    assert.ok(Math.abs(n.x) < 1e-9);
    assert.ok(n.y > 0);
  });

  test("the left wall's outward normal points left", () => {
    const n = wallOutwardNormal({ x: 0, y: 60 }, { x: 0, y: 0 });
    assert.ok(n.x < 0);
    assert.ok(Math.abs(n.y) < 1e-9);
  });

  test("always returns a unit vector", () => {
    const n = wallOutwardNormal({ x: 0, y: 0 }, { x: 30, y: 40 });
    assert.ok(Math.abs(Math.hypot(n.x, n.y) - 1) < 1e-9);
  });
});

describe("polygonBoundingBox", () => {
  test("matches width/length for a plain rectangle", () => {
    const bb = polygonBoundingBox(rect(120, 80));
    assert.deepEqual(bb, { minX: 0, minY: 0, maxX: 120, maxY: 80, width: 120, height: 80 });
  });

  test("covers the full extent of an L-shape's notch", () => {
    const { corners } = buildLHallwayCorners(120, 300, 300, false);
    const bb = polygonBoundingBox(corners);
    assert.equal(bb.width, 300);
    assert.equal(bb.height, 300);
  });
});

describe("rotatePolygonCorners", () => {
  test("a rectangle's bounding box swaps width/height but stays centered at the same point", () => {
    const corners = rect(100, 60);
    const before = polygonBoundingBox(corners);
    const beforeCenter = { x: (before.minX + before.maxX) / 2, y: (before.minY + before.maxY) / 2 };

    const rotated = rotatePolygonCorners(corners);
    const after = polygonBoundingBox(rotated);
    const afterCenter = { x: (after.minX + after.maxX) / 2, y: (after.minY + after.maxY) / 2 };

    assert.equal(after.width, 60);
    assert.equal(after.height, 100);
    assert.ok(Math.abs(afterCenter.x - beforeCenter.x) < 1e-9);
    assert.ok(Math.abs(afterCenter.y - beforeCenter.y) < 1e-9);
  });

  test("four 90-degree rotations return a rectangle to its original corners", () => {
    let corners = rect(100, 60);
    for (let i = 0; i < 4; i++) corners = rotatePolygonCorners(corners);
    const original = rect(100, 60);
    corners.forEach((c, i) => {
      assert.ok(Math.abs(c.x - original[i].x) < 1e-6);
      assert.ok(Math.abs(c.y - original[i].y) < 1e-6);
    });
  });

  test("rotation is a rigid transform -- every wall's length is preserved for a non-rectangular (L) shape", () => {
    const { corners } = buildLHallwayCorners(120, 300, 260, false);
    const beforeLengths = wallSegments(corners).map((s) => s.length);
    const rotated = rotatePolygonCorners(corners);
    const afterLengths = wallSegments(rotated).map((s) => s.length);
    beforeLengths.forEach((len, i) => {
      assert.ok(Math.abs(len - afterLengths[i]) < 1e-6, `wall ${i} length changed under rotation`);
    });
  });
});

describe("insetRectilinearPolygon", () => {
  test("insets a plain rectangle symmetrically on every side (matches the old x+4/y+4 shortcut)", () => {
    const inset = insetRectilinearPolygon(rect(300, 200), 4);
    assert.deepEqual(inset, [
      { x: 4, y: 4 },
      { x: 296, y: 4 },
      { x: 296, y: 196 },
      { x: 4, y: 196 },
    ]);
  });

  test("insets an L-shape's convex corners inward and its reflex (notch) corner outward, both by the same amount", () => {
    const { corners } = buildLHallwayCorners(120, 300, 300, false);
    const inset = insetRectilinearPolygon(corners, 4);
    // corner0 (0,0) is convex -- moves diagonally into the solid (+4,+4).
    assert.deepEqual(inset[0], { x: 4, y: 4 });
    // corner2 (120,180) is the reflex notch corner -- moves diagonally
    // toward the void, i.e. away from the vertical arm's solid interior:
    // x decreases (out of the arm), y increases (further into the notch).
    assert.deepEqual(inset[2], { x: 116, y: 184 });
  });
});

describe("polygonClipPathPercent", () => {
  test("a plain rectangle traces its own 4 corners at 0%/100% -- a visual no-op clip", () => {
    const result = polygonClipPathPercent(rect(300, 200), 300, 200);
    assert.equal(
      result,
      "polygon(0.000% 0.000%, 100.000% 0.000%, 100.000% 100.000%, 0.000% 100.000%)",
    );
  });

  test("an L-shape's notch corner lands at the correct interior percentage, not 0/100", () => {
    const { corners } = buildLHallwayCorners(120, 300, 260, false);
    const result = polygonClipPathPercent(corners, 300, 260);
    // corners: (0,0) (120,0) (120,140) (300,140) (300,260) (0,260) against a
    // 300x260 box -- e.g. (120,140) should be 40%/~53.846%.
    assert.ok(result.startsWith("polygon("));
    assert.ok(result.includes("40.000% 0.000%")); // (120,0)
    assert.ok(result.includes("40.000% 53.846%")); // (120,140)
    assert.ok(result.includes("100.000% 53.846%")); // (300,140)
  });

  test("degenerate zero width/length doesn't divide by zero (falls back to treating it as 1)", () => {
    const result = polygonClipPathPercent(rect(0, 0), 0, 0);
    assert.ok(result.startsWith("polygon("));
    assert.ok(Number.isFinite(Number(result.match(/[\d.]+/)?.[0] ?? "NaN")));
  });
});

describe("buildStraightHallwayCorners", () => {
  test("produces a plain rectangle with width=armLength, length=armWidth", () => {
    const corners = buildStraightHallwayCorners(120, 400);
    assert.deepEqual(corners, rect(400, 120));
  });
});

describe("buildLHallwayCorners", () => {
  test("produces 6 corners with the two designated end walls exactly armWidth long", () => {
    const { corners, endWalls } = buildLHallwayCorners(120, 300, 300, false);
    assert.equal(corners.length, 6);
    const segs = wallSegments(corners);
    for (const idx of endWalls) {
      assert.equal(segs[idx].length, 120, `end wall ${idx} should be armWidth long`);
    }
  });

  test("area matches the L footprint (two overlapping arms) for both chiralities", () => {
    const expectedArea = 120 * 300 + 120 * (300 - 120); // vertical arm + horizontal arm minus overlap
    const a = buildLHallwayCorners(120, 300, 300, false);
    const b = buildLHallwayCorners(120, 300, 300, true);
    assert.ok(Math.abs(Math.abs(shoelace(a.corners)) - expectedArea) < 1e-6);
    assert.ok(Math.abs(Math.abs(shoelace(b.corners)) - expectedArea) < 1e-6);
  });

  test("both chiralities wind in the same direction as the plain rectangle convention", () => {
    const rectSign = Math.sign(shoelace(rect(100, 60)));
    const a = buildLHallwayCorners(120, 300, 300, false);
    const b = buildLHallwayCorners(120, 300, 300, true);
    assert.equal(Math.sign(shoelace(a.corners)), rectSign);
    assert.equal(Math.sign(shoelace(b.corners)), rectSign);
  });

  test("the mirrored chirality is a genuinely different shape (not identical corners)", () => {
    const a = buildLHallwayCorners(120, 300, 300, false);
    const b = buildLHallwayCorners(120, 300, 300, true);
    assert.notDeepEqual(a.corners, b.corners);
  });
});

describe("buildTHallwayCorners", () => {
  test("produces 8 corners with all three end walls exactly armWidth long", () => {
    const { corners, endWalls } = buildTHallwayCorners(120, 360, 200);
    assert.equal(corners.length, 8);
    assert.deepEqual(endWalls, [1, 4, 7]);
    const segs = wallSegments(corners);
    for (const idx of endWalls) {
      assert.equal(segs[idx].length, 120, `end wall ${idx} should be armWidth long`);
    }
  });

  test("area matches the T footprint (bar + stem, no double count)", () => {
    const { corners } = buildTHallwayCorners(120, 360, 200);
    const expectedArea = 120 * 360 + 120 * 200; // bar + stem (already disjoint rectangles)
    assert.ok(Math.abs(Math.abs(shoelace(corners)) - expectedArea) < 1e-6);
  });

  test("winds the same direction as the plain rectangle convention", () => {
    const rectSign = Math.sign(shoelace(rect(100, 60)));
    const { corners } = buildTHallwayCorners(120, 360, 200);
    assert.equal(Math.sign(shoelace(corners)), rectSign);
  });

  test("the stem is horizontally centered under the bar", () => {
    const { corners } = buildTHallwayCorners(120, 360, 200);
    // corners[3] and corners[6] are the stem's two inner (top) corners.
    const stemLeft = corners[6].x;
    const stemRight = corners[3].x;
    const barLeft = corners[0].x;
    const barRight = corners[1].x;
    const stemCenter = (stemLeft + stemRight) / 2;
    const barCenter = (barLeft + barRight) / 2;
    assert.ok(Math.abs(stemCenter - barCenter) < 1e-9);
  });
});

describe("lineIntersection", () => {
  test("two perpendicular lines intersect at the expected point", () => {
    const p = lineIntersection({ x: 0, y: 5 }, { x: 1, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 1 });
    assert.ok(p);
    assert.ok(Math.abs(p!.x - 3) < 1e-9);
    assert.ok(Math.abs(p!.y - 5) < 1e-9);
  });

  test("parallel lines return null", () => {
    const p = lineIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 5 }, { x: 2, y: 0 });
    assert.equal(p, null);
  });

  test("collinear lines return null (no unique intersection)", () => {
    const p = lineIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 0 }, { x: -1, y: 0 });
    assert.equal(p, null);
  });

  test("works for non-axis-aligned (diagonal) lines", () => {
    // y = x  and  y = -x + 4  meet at (2, 2)
    const p = lineIntersection({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 4, y: 0 }, { x: -1, y: 1 });
    assert.ok(p);
    assert.ok(Math.abs(p!.x - 2) < 1e-9);
    assert.ok(Math.abs(p!.y - 2) < 1e-9);
  });

  test("direction vector length doesn't affect the result", () => {
    const p1 = lineIntersection({ x: 0, y: 5 }, { x: 1, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 1 });
    const p2 = lineIntersection({ x: 0, y: 5 }, { x: 50, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 0.01 });
    assert.ok(p1 && p2);
    assert.ok(Math.abs(p1!.x - p2!.x) < 1e-9);
    assert.ok(Math.abs(p1!.y - p2!.y) < 1e-9);
  });
});
