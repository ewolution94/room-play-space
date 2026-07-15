import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  rotatedAABB,
  clampPos,
  obbCorners,
  obbOverlap,
  obbOverlapDepth,
  collidesWithOthers,
  findFreeSpot,
  readableText,
  resolveSweptMove,
} from "@/lib/planner-math";
import type { Item } from "@/types/planner";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "item-1",
    name: "Desk",
    kind: "furniture",
    color: "#3b82f6",
    x: 0,
    y: 0,
    width: 100,
    length: 60,
    rotation: 0,
    ...overrides,
  };
}

// Room-sized corner box helper (unrotated axis-aligned rectangle).
function roomCorners(w: number, l: number) {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: l },
    { x: 0, y: l },
  ];
}

describe("rotatedAABB", () => {
  test("0 degrees returns the original width/length", () => {
    const r = rotatedAABB(100, 60, 0);
    assert.ok(Math.abs(r.w - 100) < 1e-6);
    assert.ok(Math.abs(r.h - 60) < 1e-6);
  });

  test("90 degrees swaps width/height", () => {
    const r = rotatedAABB(100, 60, 90);
    assert.ok(Math.abs(r.w - 60) < 1e-6);
    assert.ok(Math.abs(r.h - 100) < 1e-6);
  });

  test("45 degrees produces a larger bounding box than either axis alone", () => {
    const r = rotatedAABB(100, 60, 45);
    assert.ok(r.w > 100);
    assert.ok(r.h > 60);
  });
});

describe("obbCorners", () => {
  test("unrotated box corners match a simple axis-aligned rectangle", () => {
    const corners = obbCorners({ x: 0, y: 0, width: 100, length: 50, rotation: 0 });
    assert.equal(corners.length, 4);
    const xs = corners.map((c) => c.x).sort((a, b) => a - b);
    const ys = corners.map((c) => c.y).sort((a, b) => a - b);
    assert.ok(Math.abs(xs[0] - 0) < 1e-6);
    assert.ok(Math.abs(xs[3] - 100) < 1e-6);
    assert.ok(Math.abs(ys[0] - 0) < 1e-6);
    assert.ok(Math.abs(ys[3] - 50) < 1e-6);
  });
});

describe("obbOverlap", () => {
  test("two far-apart boxes do not overlap", () => {
    const a = { x: 0, y: 0, width: 100, length: 100, rotation: 0 };
    const b = { x: 500, y: 500, width: 100, length: 100, rotation: 0 };
    assert.equal(obbOverlap(a, b), false);
  });

  test("two identical, coincident boxes overlap", () => {
    const a = { x: 0, y: 0, width: 100, length: 100, rotation: 0 };
    const b = { x: 0, y: 0, width: 100, length: 100, rotation: 0 };
    assert.equal(obbOverlap(a, b), true);
  });

  test("two boxes exactly edge-to-edge (touching, not overlapping) do not overlap", () => {
    const a = { x: 0, y: 0, width: 100, length: 100, rotation: 0 };
    const b = { x: 100, y: 0, width: 100, length: 100, rotation: 0 };
    assert.equal(obbOverlap(a, b), false);
  });

  test("boxes overlapping by less than the epsilon tolerance are treated as non-overlapping", () => {
    const a = { x: 0, y: 0, width: 100, length: 100, rotation: 0 };
    // 0.3cm of penetration, under the 0.5cm eps tolerance in obbOverlap.
    const b = { x: 99.7, y: 0, width: 100, length: 100, rotation: 0 };
    assert.equal(obbOverlap(a, b), false);
  });

  test("boxes overlapping by more than the epsilon tolerance do overlap", () => {
    const a = { x: 0, y: 0, width: 100, length: 100, rotation: 0 };
    const b = { x: 98, y: 0, width: 100, length: 100, rotation: 0 };
    assert.equal(obbOverlap(a, b), true);
  });

  test("rotated boxes correctly detect a diagonal overlap SAT would miss with AABB alone", () => {
    // A 45-degree-rotated box's AABB is much bigger than the box itself; two
    // such boxes placed so their AABBs touch but the actual rotated shapes
    // don't should NOT register as overlapping if OBB/SAT is working.
    const a = { x: 0, y: 0, width: 100, length: 20, rotation: 45 };
    const b = { x: 200, y: 0, width: 100, length: 20, rotation: 45 };
    assert.equal(obbOverlap(a, b), false);
  });
});

describe("obbOverlapDepth", () => {
  test("non-overlapping boxes have zero depth", () => {
    const a = { x: 0, y: 0, width: 100, length: 100, rotation: 0 };
    const b = { x: 500, y: 500, width: 100, length: 100, rotation: 0 };
    assert.equal(obbOverlapDepth(a, b), 0);
  });

  test("fully coincident boxes report depth equal to their shared extent", () => {
    const a = { x: 0, y: 0, width: 100, length: 100, rotation: 0 };
    const b = { x: 0, y: 0, width: 100, length: 100, rotation: 0 };
    assert.equal(obbOverlapDepth(a, b), 100);
  });

  test("partial overlap reports a depth smaller than the box size", () => {
    const a = { x: 0, y: 0, width: 100, length: 100, rotation: 0 };
    const b = { x: 80, y: 0, width: 100, length: 100, rotation: 0 };
    const depth = obbOverlapDepth(a, b);
    assert.ok(depth > 0 && depth < 100);
    assert.ok(Math.abs(depth - 20) < 1e-6);
  });
});

describe("collidesWithOthers", () => {
  test("returns false when collision detection is disabled, even if actually overlapping", () => {
    const candidate = makeItem({ id: "a", x: 0, y: 0 });
    const others = [makeItem({ id: "b", x: 0, y: 0 })];
    assert.equal(collidesWithOthers(candidate, others, undefined, false), false);
  });

  test("returns true when overlapping another item", () => {
    const candidate = makeItem({ id: "a", x: 0, y: 0 });
    const others = [makeItem({ id: "b", x: 0, y: 0 })];
    assert.equal(collidesWithOthers(candidate, others, undefined, true), true);
  });

  test("ignores itself by id (an item never collides with its own entry in the list)", () => {
    const candidate = makeItem({ id: "a", x: 0, y: 0 });
    const others = [candidate];
    assert.equal(collidesWithOthers(candidate, others, undefined, true), false);
  });

  test("respects ignoreIds, excluding specific others from the check", () => {
    const candidate = makeItem({ id: "a", x: 0, y: 0 });
    const others = [makeItem({ id: "b", x: 0, y: 0 })];
    assert.equal(collidesWithOthers(candidate, others, new Set(["b"]), true), false);
  });

  test("returns false when not overlapping anything", () => {
    const candidate = makeItem({ id: "a", x: 0, y: 0 });
    const others = [makeItem({ id: "b", x: 1000, y: 1000 })];
    assert.equal(collidesWithOthers(candidate, others, undefined, true), false);
  });
});

describe("findFreeSpot", () => {
  test("returns the item's own area when the room is empty", () => {
    const item = makeItem({ width: 50, length: 50 });
    const spot = findFreeSpot(item, [], roomCorners(300, 300));
    assert.ok(spot);
    assert.ok(spot!.x >= 0 && spot!.y >= 0);
  });

  test("finds a spot that does not collide with existing items", () => {
    const existing = makeItem({ id: "existing", x: 0, y: 0, width: 300, length: 300 });
    const item = makeItem({ id: "new", width: 50, length: 50 });
    const spot = findFreeSpot(item, [existing], roomCorners(400, 400));
    assert.ok(spot);
    const candidate = { ...item, x: spot!.x, y: spot!.y };
    assert.equal(obbOverlap(candidate, existing), false);
  });

  test("returns null when the room is entirely full and collision is enabled", () => {
    // Room barely bigger than the item, fully covered by one existing item.
    const existing = makeItem({ id: "existing", x: 0, y: 0, width: 100, length: 100 });
    const item = makeItem({ id: "new", width: 100, length: 100 });
    const spot = findFreeSpot(item, [existing], roomCorners(100, 100), true);
    assert.equal(spot, null);
  });

  test("falls back to a clamped default position when collision is disabled and nothing is free", () => {
    const existing = makeItem({ id: "existing", x: 0, y: 0, width: 100, length: 100 });
    const item = makeItem({ id: "new", width: 100, length: 100 });
    const spot = findFreeSpot(item, [existing], roomCorners(100, 100), false);
    assert.ok(spot);
  });
});

describe("readableText", () => {
  test("returns dark text for a light background", () => {
    assert.equal(readableText("#ffffff"), "#111");
  });

  test("returns light text for a dark background", () => {
    assert.equal(readableText("#000000"), "#fff");
  });

  test("handles malformed hex gracefully", () => {
    assert.equal(readableText("nope"), "#000");
  });
});

describe("resolveSweptMove", () => {
  const noClamp = (x: number, y: number) => ({ x, y });

  test("normal unobstructed move resolves directly to the target", () => {
    const result = resolveSweptMove({ x: 0, y: 0 }, { x: 50, y: 50 }, () => false, noClamp);
    assert.deepEqual(result, { x: 50, y: 50 });
  });

  test("fully blocked target (collides everywhere on the path) returns null", () => {
    const result = resolveSweptMove({ x: 0, y: 0 }, { x: 50, y: 50 }, () => true, noClamp);
    assert.equal(result, null);
  });

  test("already-overlapping start position bails out safely on every attempt (diagonal + both axis slides)", () => {
    // `from` collides, and so do all three candidate targets the function
    // tries (the direct diagonal move, the X-axis slide, and the Y-axis
    // slide) -- each attempt independently checks its own target first, but
    // since `from` itself is invalid, every attempt must bail out to null
    // rather than resolving to some other point.
    const blocked = new Set(["0,0", "50,50", "50,0", "0,50"]);
    const collidesAt = (x: number, y: number) => blocked.has(`${x},${y}`);
    const result = resolveSweptMove({ x: 0, y: 0 }, { x: 50, y: 50 }, collidesAt, noClamp);
    assert.equal(result, null);
  });

  test("binary search finds a contact point close to an obstacle boundary (prevents tunneling)", () => {
    // Obstacle occupies x >= 30. A large jump straight from x=0 to x=100
    // would "tunnel" through it if only the endpoint were checked.
    const collidesAt = (x: number, _y: number) => x >= 30;
    const result = resolveSweptMove({ x: 0, y: 0 }, { x: 100, y: 0 }, collidesAt, noClamp);
    assert.ok(result);
    assert.ok(result!.x < 30);
    assert.ok(result!.x > 29); // binary search over 24 iterations converges very close to the boundary
  });

  test("diagonal move blocked on the direct path slides along the X axis instead", () => {
    // Direct diagonal path is blocked, but sliding along X only (keeping Y at
    // the starting value) is free.
    const collidesAt = (x: number, y: number) => y !== 0; // anything off the y=0 line collides
    const result = resolveSweptMove({ x: 0, y: 0 }, { x: 50, y: 50 }, collidesAt, noClamp);
    assert.deepEqual(result, { x: 50, y: 0 });
  });

  test("diagonal move blocked on X-axis slide falls back to sliding along Y axis", () => {
    const collidesAt = (x: number, y: number) => x !== 0; // anything off the x=0 line collides
    const result = resolveSweptMove({ x: 0, y: 0 }, { x: 50, y: 50 }, collidesAt, noClamp);
    assert.deepEqual(result, { x: 0, y: 50 });
  });

  test("clamp function is applied to both the target and every intermediate binary-search step", () => {
    const clampTo200 = (x: number, y: number) => ({ x: Math.min(200, x), y: Math.min(200, y) });
    // No obstacles at all -- target is out of bounds and should be clamped.
    const result = resolveSweptMove({ x: 0, y: 0 }, { x: 500, y: 500 }, () => false, clampTo200);
    assert.deepEqual(result, { x: 200, y: 200 });
  });

  test("zero-distance move (target equals from) that collides returns null instead of a false resolution", () => {
    const collidesAt = () => true;
    const result = resolveSweptMove({ x: 10, y: 10 }, { x: 10, y: 10 }, collidesAt, noClamp);
    assert.equal(result, null);
  });
});
