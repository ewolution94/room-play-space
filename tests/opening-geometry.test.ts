import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { wallFrameIsMirrored, effectiveSwing } from "@/lib/opening-geometry";
import { resolveWallSegment, wallSegments, NAMED_WALLS } from "@/lib/hallway-shapes";
import { inwardNormal } from "@/lib/wall-slopes";
import { buildUShapeCorners, buildTShapeCorners } from "@/lib/room-shapes";
import type { Point } from "@/types/planner";

const RECT: Point[] = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 400 },
  { x: 0, y: 400 },
];

describe("wallFrameIsMirrored", () => {
  test("is true for exactly the two walls resolveWallSegment walks backwards", () => {
    // "bottom" and "left" are the reversed pair -- but note the mirroring
    // lands on the OTHER two, because reversing the segment is what makes
    // the local frame come out right for them.
    const mirrored: Record<string, boolean> = {};
    for (const name of NAMED_WALLS) {
      const seg = resolveWallSegment(RECT, name)!;
      mirrored[name] = wallFrameIsMirrored(RECT, seg.a, seg.b);
    }
    assert.deepEqual(mirrored, { top: true, right: true, bottom: false, left: false });
  });

  test("agrees with inwardNormal on every wall of a rectangle", () => {
    for (const name of NAMED_WALLS) {
      const { a, b } = resolveWallSegment(RECT, name)!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const drawn = { x: (b.y - a.y) / len, y: -(b.x - a.x) / len };
      const trueIn = inwardNormal(RECT, a, b);
      const pointsInward = drawn.x * trueIn.x + drawn.y * trueIn.y > 0;
      assert.equal(wallFrameIsMirrored(RECT, a, b), !pointsInward, name);
    }
  });

  test("a degenerate zero-length wall is not reported as mirrored", () => {
    const p = { x: 10, y: 10 };
    assert.equal(wallFrameIsMirrored(RECT, p, p), false);
  });
});

describe("effectiveSwing", () => {
  test("defaults to inward when swing is absent", () => {
    const { a, b } = resolveWallSegment(RECT, "top")!;
    assert.equal(effectiveSwing(undefined, RECT, a, b), effectiveSwing("in", RECT, a, b));
  });

  test("out stays out -- the correction is a mirror, not a force-inward", () => {
    for (const name of NAMED_WALLS) {
      const { a, b } = resolveWallSegment(RECT, name)!;
      assert.notEqual(effectiveSwing("in", RECT, a, b), effectiveSwing("out", RECT, a, b), name);
    }
  });
});

/**
 * The contract that actually matters, asserted the way the renderer sees
 * it: take what effectiveSwing returns, work out which way the 2D canvas
 * will therefore draw the leaf, and check that direction against the
 * polygon. Asserting the returned *string* instead would be asserting an
 * implementation detail -- and would have hidden that every forward-wound
 * wall (which is all of them on a polygon room) legitimately reports
 * mirrored, since it's the reversed named walls that come out unmirrored.
 */
function drawnLeafDirection(swing: "in" | "out", a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // "in" draws toward local -y, which is (Uy, -Ux) once rotated.
  const minusY = { x: dy / len, y: -(dx / len) };
  return swing === "in" ? minusY : { x: -minusY.x, y: -minusY.y };
}

function assertDrawsInward(corners: Point[], a: Point, b: Point, label: string) {
  const drawn = drawnLeafDirection(effectiveSwing("in", corners, a, b), a, b);
  const trueIn = inwardNormal(corners, a, b);
  assert.ok(drawn.x * trueIn.x + drawn.y * trueIn.y > 0, `${label} drew an "in" door outward`);
}

describe("an inward door draws into the room -- every wall, every shape", () => {
  const shapes: [string, Point[]][] = [
    ["rectangle", RECT],
    ["u-shape", buildUShapeCorners(600, 450, 200, 150)],
    ["t-shape", buildTShapeCorners(600, 450, 200, 250)],
  ];

  test("rectangle, via the legacy named walls (where the bug lived)", () => {
    for (const name of NAMED_WALLS) {
      const { a, b } = resolveWallSegment(RECT, name)!;
      assertDrawsInward(RECT, a, b, `rect ${name}`);
    }
  });

  for (const [name, corners] of shapes) {
    test(`${name}: numeric walls, reflex corners included`, () => {
      // A U's notch sides are the interesting case: "inward" there points
      // away from the notch void, which a winding-derived normal gets
      // backwards and inwardNormal's polygon probe gets right.
      for (const seg of wallSegments(corners)) {
        assertDrawsInward(corners, seg.a, seg.b, `${name} wall ${seg.index}`);
      }
    });

    test(`${name}: an outward door draws out of the room on every wall`, () => {
      for (const seg of wallSegments(corners)) {
        const drawn = drawnLeafDirection(
          effectiveSwing("out", corners, seg.a, seg.b),
          seg.a,
          seg.b,
        );
        const trueIn = inwardNormal(corners, seg.a, seg.b);
        assert.ok(
          drawn.x * trueIn.x + drawn.y * trueIn.y < 0,
          `${name} wall ${seg.index} drew an "out" door inward`,
        );
      }
    });
  }
});
