import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CEILING_HEIGHT,
  STANDING_HEIGHT,
  availableHeightAt,
  distanceToClearHeight,
  runFromPitch,
  pitchFromRun,
  minHeightOverFootprint,
  checkItemFitsUnderSlopes,
  inwardNormal,
  type WallSlopeMap,
} from "@/lib/wall-slopes";
import { resolveWallSegment } from "@/lib/hallway-shapes";
import { pointInPolygon } from "@/lib/planner-math";
import type { Point } from "@/types/planner";

// A plain 400x300 room. Named walls follow the app's 4-corner convention:
// top = y0 edge, right = x=400, bottom = y=300, left = x=0.
const ROOM: Point[] = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 300 },
  { x: 0, y: 300 },
];

// Classic attic: 110cm knee wall on the left, rising to the full 240cm
// ceiling over 150cm of floor.
const LEFT_SLOPE: WallSlopeMap = { left: { kneeHeight: 110, run: 150 } };

describe("availableHeightAt", () => {
  test("an unsloped room is full height everywhere", () => {
    assert.equal(availableHeightAt({ x: 5, y: 5 }, ROOM, undefined), DEFAULT_CEILING_HEIGHT);
    assert.equal(availableHeightAt({ x: 200, y: 150 }, ROOM, {}), DEFAULT_CEILING_HEIGHT);
  });

  test("at the sloped wall itself, height is the knee height", () => {
    assert.equal(availableHeightAt({ x: 0, y: 150 }, ROOM, LEFT_SLOPE), 110);
  });

  test("rises linearly across the run", () => {
    // Halfway along a 150cm run: 110 + (240-110)/2 = 175
    assert.equal(availableHeightAt({ x: 75, y: 150 }, ROOM, LEFT_SLOPE), 175);
  });

  test("is full height at and beyond the end of the run", () => {
    assert.equal(availableHeightAt({ x: 150, y: 150 }, ROOM, LEFT_SLOPE), 240);
    assert.equal(availableHeightAt({ x: 399, y: 150 }, ROOM, LEFT_SLOPE), 240);
  });

  test("runs the full length of the wall, not just beside the segment", () => {
    // Same distance from the left wall, sampled at both ends of the room.
    assert.equal(availableHeightAt({ x: 75, y: 1 }, ROOM, LEFT_SLOPE), 175);
    assert.equal(availableHeightAt({ x: 75, y: 299 }, ROOM, LEFT_SLOPE), 175);
  });

  test("respects a non-default ceiling height", () => {
    // Knee 110, ceiling 300, halfway along the run -> 110 + (300-110)/2 = 205
    assert.equal(availableHeightAt({ x: 75, y: 150 }, ROOM, LEFT_SLOPE, 300), 205);
  });
});

describe("composing multiple slopes", () => {
  // The gabled attic: both long walls slope up to a ridge in the middle.
  const GABLE: WallSlopeMap = {
    left: { kneeHeight: 100, run: 200 },
    right: { kneeHeight: 100, run: 200 },
  };

  test("the lower of two overlapping slopes wins", () => {
    // x=200 is 200 from both walls -> both are exactly at full height.
    assert.equal(availableHeightAt({ x: 200, y: 150 }, ROOM, GABLE), 240);
    // x=50 is 50 from the left (low) and 350 from the right (unconstrained).
    const at50 = availableHeightAt({ x: 50, y: 150 }, ROOM, GABLE);
    assert.equal(at50, 100 + ((240 - 100) * 50) / 200);
    // Symmetric on the far side.
    assert.equal(availableHeightAt({ x: 350, y: 150 }, ROOM, GABLE), at50);
  });

  test("both knee walls are equally low at their own edges", () => {
    assert.equal(availableHeightAt({ x: 0, y: 150 }, ROOM, GABLE), 100);
    assert.equal(availableHeightAt({ x: 400, y: 150 }, ROOM, GABLE), 100);
  });
});

describe("degenerate slopes constrain nothing", () => {
  test("a zero run is ignored rather than dividing by zero", () => {
    const h = availableHeightAt({ x: 0, y: 150 }, ROOM, { left: { kneeHeight: 90, run: 0 } });
    assert.equal(h, DEFAULT_CEILING_HEIGHT);
    assert.ok(Number.isFinite(h));
  });

  test("a knee wall at or above the ceiling is ignored", () => {
    assert.equal(
      availableHeightAt({ x: 0, y: 150 }, ROOM, { left: { kneeHeight: 240, run: 150 } }),
      240,
    );
  });

  test("an unresolvable wall key is skipped", () => {
    assert.equal(
      availableHeightAt({ x: 0, y: 150 }, ROOM, { nonsense: { kneeHeight: 50, run: 150 } }),
      240,
    );
  });
});

describe("numeric wall keys (polygon rooms)", () => {
  test("a numeric key resolves to that wall index", () => {
    // Wall 3 of ROOM is the left edge (corner 3 -> corner 0).
    const h = availableHeightAt({ x: 0, y: 150 }, ROOM, { "3": { kneeHeight: 110, run: 150 } });
    assert.equal(h, 110);
  });
});

// Regression: the drawing layer originally derived "into the room" by
// negating wallOutwardNormal, which is only correct for walls walked in
// forward winding order. resolveWallSegment deliberately walks "bottom" and
// "left" backwards (kept that way so existing rectangular rooms render
// identically), so those two came out inverted and the slope band was drawn
// entirely outside the room.
describe("inwardNormal points into the room for every wall", () => {
  const centre = { x: 200, y: 150 };

  for (const wall of ["top", "right", "bottom", "left"] as const) {
    test(`${wall} wall`, () => {
      const seg = resolveWallSegment(ROOM, wall)!;
      const n = inwardNormal(ROOM, seg.a, seg.b);
      const mid = { x: (seg.a.x + seg.b.x) / 2, y: (seg.a.y + seg.b.y) / 2 };
      const stepped = { x: mid.x + n.x * 20, y: mid.y + n.y * 20 };

      assert.ok(pointInPolygon(stepped, ROOM), `${wall}: stepping along the normal left the room`);
      // And it genuinely moves toward the middle, not just barely inside.
      const before = Math.hypot(mid.x - centre.x, mid.y - centre.y);
      const after = Math.hypot(stepped.x - centre.x, stepped.y - centre.y);
      assert.ok(after < before, `${wall}: normal points away from the room centre`);
    });
  }

  test("also holds for a polygon (L-shaped) room's numeric walls", () => {
    const L: Point[] = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 200 },
      { x: 200, y: 200 },
      { x: 200, y: 300 },
      { x: 0, y: 300 },
    ];
    for (let i = 0; i < L.length; i++) {
      const seg = resolveWallSegment(L, i)!;
      const n = inwardNormal(L, seg.a, seg.b);
      const mid = { x: (seg.a.x + seg.b.x) / 2, y: (seg.a.y + seg.b.y) / 2 };
      const stepped = { x: mid.x + n.x * 10, y: mid.y + n.y * 10 };
      assert.ok(pointInPolygon(stepped, L), `wall ${i}: normal points out of the room`);
    }
  });
});

describe("distanceToClearHeight", () => {
  test("gives the point where you can stand upright", () => {
    // 110 knee -> 240 over 150cm. Standing height 190 is reached at
    // 150 * (190-110)/(240-110) = ~92.3cm from the wall.
    const d = distanceToClearHeight({ kneeHeight: 110, run: 150 }, STANDING_HEIGHT);
    assert.ok(Math.abs(d - 92.3076) < 0.001, `got ${d}`);
    assert.equal(availableHeightAt({ x: d, y: 150 }, ROOM, LEFT_SLOPE) >= 189.999, true);
  });

  test("is zero when the knee wall already clears the target", () => {
    assert.equal(distanceToClearHeight({ kneeHeight: 200, run: 150 }, STANDING_HEIGHT), 0);
  });

  test("is the whole run when the target is the ceiling itself", () => {
    assert.equal(distanceToClearHeight({ kneeHeight: 110, run: 150 }, 240), 150);
  });
});

describe("pitch <-> run conversion", () => {
  test("45 degrees means the run equals the rise", () => {
    assert.ok(Math.abs(runFromPitch(140, 45) - 100) < 1e-9);
  });

  test("round-trips", () => {
    const run = runFromPitch(110, 38);
    assert.ok(Math.abs(pitchFromRun(110, run) - 38) < 1e-9);
  });

  test("a knee wall already at the ceiling has no run", () => {
    assert.equal(runFromPitch(240, 45), 0);
  });
});

describe("minHeightOverFootprint", () => {
  test("finds the lowest corner of a footprint straddling the slope", () => {
    // A 100x60 footprint hard against the sloped wall.
    const fp: Point[] = [
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 160 },
      { x: 0, y: 160 },
    ];
    // Lowest corners sit at x=0 -> knee height.
    assert.equal(minHeightOverFootprint(fp, ROOM, LEFT_SLOPE), 110);
  });

  test("is full height for a footprint clear of the slope", () => {
    const fp: Point[] = [
      { x: 200, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 160 },
      { x: 200, y: 160 },
    ];
    assert.equal(minHeightOverFootprint(fp, ROOM, LEFT_SLOPE), 240);
  });
});

describe("checkItemFitsUnderSlopes", () => {
  // A 200cm-tall wardrobe -- the canonical thing that does not fit under a
  // Dachschräge, and the reason this whole module exists.
  const wardrobe = { x: 0, y: 100, width: 100, length: 60, rotation: 0 };

  test("rejects a tall item pushed against the knee wall, and says by how much", () => {
    const r = checkItemFitsUnderSlopes(wardrobe, 200, ROOM, LEFT_SLOPE);
    assert.equal(r.fits, false);
    assert.equal(r.availableHeight, 110);
    assert.equal(r.shortfallCm, 90);
  });

  test("accepts the same item moved clear of the slope", () => {
    const moved = { ...wardrobe, x: 200 };
    const r = checkItemFitsUnderSlopes(moved, 200, ROOM, LEFT_SLOPE);
    assert.equal(r.fits, true);
    assert.equal(r.availableHeight, 240);
    assert.equal(r.shortfallCm, 0);
  });

  test("accepts a low item right under the eaves", () => {
    const r = checkItemFitsUnderSlopes(wardrobe, 80, ROOM, LEFT_SLOPE);
    assert.equal(r.fits, true);
  });

  test("accounts for rotation via the real rotated footprint", () => {
    // Rotated 90deg about its centre, the wardrobe's footprint reaches
    // further from the wall than its unrotated one, so more of it clears.
    const rotated = { x: 0, y: 100, width: 100, length: 60, rotation: 90 };
    const r = checkItemFitsUnderSlopes(rotated, 200, ROOM, LEFT_SLOPE);
    assert.ok(r.availableHeight > 110, `expected > 110, got ${r.availableHeight}`);
  });

  test("an unsloped room fits anything the ceiling allows", () => {
    const r = checkItemFitsUnderSlopes(wardrobe, 200, ROOM, undefined);
    assert.equal(r.fits, true);
    assert.equal(r.availableHeight, DEFAULT_CEILING_HEIGHT);
  });
});
