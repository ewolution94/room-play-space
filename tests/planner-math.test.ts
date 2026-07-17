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
  findOnTopHost,
  computeOnTopElevation,
  rectCorners,
  pointInPolygon,
  rectilinearPolygonRects,
  rectilinearPolygonsOverlap,
} from "@/lib/planner-math";
import { buildLHallwayCorners, buildTHallwayCorners } from "@/lib/hallway-shapes";
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

describe("pointInPolygon", () => {
  test("points inside a plain rectangle are inside", () => {
    assert.equal(
      pointInPolygon({ x: 50, y: 50 }, rectCorners({ x: 0, y: 0, width: 100, length: 100 })),
      true,
    );
  });

  test("points outside a plain rectangle are outside", () => {
    assert.equal(
      pointInPolygon({ x: 150, y: 50 }, rectCorners({ x: 0, y: 0, width: 100, length: 100 })),
      false,
    );
  });

  test("a point in an L-shape's notch is outside, even though it's within the bounding box", () => {
    const { corners } = buildLHallwayCorners(120, 300, 260, false);
    // The notch is the top-right region excluded from the L, x:[120,300], y:[0,140].
    assert.equal(pointInPolygon({ x: 200, y: 50 }, corners), false);
    // A point on the actual L material (the vertical arm) is inside.
    assert.equal(pointInPolygon({ x: 60, y: 50 }, corners), true);
    // A point on the horizontal arm is also inside.
    assert.equal(pointInPolygon({ x: 200, y: 200 }, corners), true);
  });
});

describe("rectilinearPolygonRects", () => {
  test("a plain rectangle decomposes into exactly one rect matching its own bounds", () => {
    const rects = rectilinearPolygonRects(rectCorners({ x: 10, y: 20, width: 100, length: 50 }));
    assert.deepEqual(rects, [{ x: 10, y: 20, width: 100, height: 50 }]);
  });

  test("an L-shape decomposes into grid cells whose combined area equals the L's own area (notch excluded)", () => {
    // The grid technique partitions by every distinct x/y among the
    // corners, so the L's uniform vertical arm ends up split into two
    // stacked cells (inheriting the horizontal arm's y=140 grid line) --
    // 3 filled cells total (of the 2x2 grid), not the "obvious" 2-rectangle
    // arm decomposition. What matters for collision correctness is that
    // the union's area (and shape) is exactly right, not the cell count.
    const { corners } = buildLHallwayCorners(120, 300, 260, false);
    const rects = rectilinearPolygonRects(corners);
    assert.equal(rects.length, 3);
    const totalArea = rects.reduce((sum, r) => sum + r.width * r.height, 0);
    // L area = bounding box (300*260) minus the notch (180*140).
    assert.equal(totalArea, 300 * 260 - 180 * 140);
  });

  test("a T-shape decomposes into grid cells whose combined area equals the T's own area", () => {
    // Similarly, the stem's inner x-boundaries (120, 240) fall within the
    // bar's own y-range, splitting the bar into 3 cells; plus 1 stem cell
    // = 4 filled cells total (of the 3x2 grid), not a naive "bar + stem" 2.
    const tpl = buildTHallwayCorners(120, 360, 200);
    const rects = rectilinearPolygonRects(tpl.corners);
    assert.equal(rects.length, 4);
    const totalArea = rects.reduce((sum, r) => sum + r.width * r.height, 0);
    // Bar (360x120) + stem (120x200).
    assert.equal(totalArea, 360 * 120 + 120 * 200);
  });
});

describe("rectilinearPolygonsOverlap", () => {
  test("two far-apart rectangles do not overlap", () => {
    const a = rectCorners({ x: 0, y: 0, width: 100, length: 100 });
    const b = rectCorners({ x: 500, y: 500, width: 100, length: 100 });
    assert.equal(rectilinearPolygonsOverlap(a, b), false);
  });

  test("two coincident rectangles overlap", () => {
    const a = rectCorners({ x: 0, y: 0, width: 100, length: 100 });
    const b = rectCorners({ x: 0, y: 0, width: 100, length: 100 });
    assert.equal(rectilinearPolygonsOverlap(a, b), true);
  });

  test("two rectangles exactly edge-to-edge (flush, not overlapping) do not overlap -- matches obbOverlap's tolerance", () => {
    const a = rectCorners({ x: 0, y: 0, width: 100, length: 100 });
    const b = rectCorners({ x: 100, y: 0, width: 100, length: 100 });
    assert.equal(rectilinearPolygonsOverlap(a, b), false);
  });

  test("a small room placed in an L-shaped hallway's notch does not collide -- the whole point of exact collision", () => {
    const { corners: lCorners } = buildLHallwayCorners(120, 300, 260, false);
    // Notch is x:[120,300], y:[0,140] -- place a 100x100 room centered in it.
    const room = rectCorners({ x: 150, y: 20, width: 100, length: 100 });
    assert.equal(rectilinearPolygonsOverlap(lCorners, room), false);
  });

  test("a room overlapping the L-shape's actual material (not just its bounding box) does collide", () => {
    const { corners: lCorners } = buildLHallwayCorners(120, 300, 260, false);
    // This sits on the L's horizontal arm (x:[120,300], y:[140,260]).
    const room = rectCorners({ x: 150, y: 150, width: 100, length: 50 });
    assert.equal(rectilinearPolygonsOverlap(lCorners, room), true);
  });

  test("a room straddling the L-shape's inner corner (partly notch, partly material) still collides", () => {
    const { corners: lCorners } = buildLHallwayCorners(120, 300, 260, false);
    // Spans x:[100,200], y:[100,200] -- partly in the notch, partly on the
    // vertical arm's lower portion and the horizontal arm's upper portion.
    const room = rectCorners({ x: 100, y: 100, width: 100, length: 100 });
    assert.equal(rectilinearPolygonsOverlap(lCorners, room), true);
  });

  test("a room in a T-shape's excluded corner (outside the bar and the stem) does not collide", () => {
    const tpl = buildTHallwayCorners(120, 360, 200);
    // Bar occupies y:[0,120] across the full width; stem occupies
    // x:[120,240], y:[120,320] (armWidth=120, sx=(360-120)/2=120). A room at
    // the bottom-left corner (x:[0,100], y:[150,300]) is outside both.
    const room = rectCorners({ x: 0, y: 150, width: 100, length: 150 });
    assert.equal(rectilinearPolygonsOverlap(tpl.corners, room), false);
  });

  test("a room on the T-shape's stem does collide", () => {
    const tpl = buildTHallwayCorners(120, 360, 200);
    const room = rectCorners({ x: 150, y: 150, width: 50, length: 50 });
    assert.equal(rectilinearPolygonsOverlap(tpl.corners, room), true);
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

  test("a candidate missing the layer field defaults to main and collides normally (pre-existing saved rooms)", () => {
    const candidate = makeItem({ id: "a", x: 0, y: 0 });
    const others = [makeItem({ id: "b", x: 0, y: 0 })];
    assert.equal(candidate.layer, undefined);
    assert.equal(collidesWithOthers(candidate, others, undefined, true), true);
  });

  test("an 'under' layer candidate never collides, even when fully overlapping a main item", () => {
    const candidate = makeItem({ id: "rug", x: 0, y: 0, layer: "under" });
    const others = [makeItem({ id: "sofa", x: 0, y: 0, layer: "main" })];
    assert.equal(collidesWithOthers(candidate, others, undefined, true), false);
  });

  test("an 'on-top' layer candidate never collides, even when fully overlapping a main item", () => {
    const candidate = makeItem({ id: "lamp", x: 0, y: 0, layer: "on-top" });
    const others = [makeItem({ id: "desk", x: 0, y: 0, layer: "main" })];
    assert.equal(collidesWithOthers(candidate, others, undefined, true), false);
  });

  test("a 'main' layer candidate ignores 'under' and 'on-top' obstacles but still collides with other main items", () => {
    const candidate = makeItem({ id: "chair", x: 0, y: 0, layer: "main" });
    const others = [
      makeItem({ id: "rug", x: 0, y: 0, layer: "under" }),
      makeItem({ id: "lamp", x: 0, y: 0, layer: "on-top" }),
    ];
    assert.equal(collidesWithOthers(candidate, others, undefined, true), false);

    const withMainObstacle = [...others, makeItem({ id: "table", x: 0, y: 0, layer: "main" })];
    assert.equal(collidesWithOthers(candidate, withMainObstacle, undefined, true), true);
  });

  test("two 'under' items are allowed to fully overlap each other (e.g. a small rug on a large rug)", () => {
    const candidate = makeItem({ id: "rug-small", x: 0, y: 0, layer: "under" });
    const others = [makeItem({ id: "rug-large", x: 0, y: 0, layer: "under" })];
    assert.equal(collidesWithOthers(candidate, others, undefined, true), false);
  });

  test("two 'on-top' items are allowed to fully overlap each other (e.g. a lamp and a vase on the same desk)", () => {
    const candidate = makeItem({ id: "lamp", x: 0, y: 0, layer: "on-top" });
    const others = [makeItem({ id: "vase", x: 0, y: 0, layer: "on-top" })];
    assert.equal(collidesWithOthers(candidate, others, undefined, true), false);
  });
});

describe("clampPos", () => {
  test("keeps an item fully inside a rectangular room, inset by half the wall thickness", () => {
    const item = makeItem({ width: 50, length: 40 });
    const c = clampPos(item, roomCorners(300, 200), -100, -100);
    assert.equal(c.x, 3); // halfThick inset
    assert.equal(c.y, 3);
  });

  test("clamps against the far edge the same way", () => {
    const item = makeItem({ width: 50, length: 40 });
    const c = clampPos(item, roomCorners(300, 200), 10000, 10000);
    assert.equal(c.x, 300 - 3 - 50);
    assert.equal(c.y, 200 - 3 - 40);
  });

  test("an in-bounds position passes through unchanged", () => {
    const item = makeItem({ width: 50, length: 40 });
    const c = clampPos(item, roomCorners(300, 200), 100, 80);
    assert.equal(c.x, 100);
    assert.equal(c.y, 80);
  });

  test("for a polygon (L-shaped) room, clamps to the shape's bounding box (not the exact concave outline)", () => {
    // A 6-corner L occupying x:[0,300], y:[0,300] with a notch cut out of
    // the top-right region -- clampPos is documented to use the bounding
    // box as an approximation, so a position inside the notch is still
    // accepted rather than pushed out.
    const lCorners = [
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 180 },
      { x: 300, y: 180 },
      { x: 300, y: 300 },
      { x: 0, y: 300 },
    ];
    const item = makeItem({ width: 20, length: 20 });
    // Inside the notch (x:150-170, y:20-40) -- outside the physical L, but
    // within its bounding box.
    const c = clampPos(item, lCorners, 150, 20);
    assert.equal(c.x, 150);
    assert.equal(c.y, 20);

    // Still clamps against the bounding box's outer edges.
    const clampedFar = clampPos(item, lCorners, 10000, 10000);
    assert.equal(clampedFar.x, 300 - 3 - 20);
    assert.equal(clampedFar.y, 300 - 3 - 20);
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

describe("findOnTopHost / computeOnTopElevation", () => {
  const flatHeight = (it: Item) => it.height ?? 75; // simple stand-in getHeight for tests

  test("finds no host and elevation 0 when the on-top item isn't over anything", () => {
    const onTop = makeItem({ id: "lamp", x: 500, y: 500, layer: "on-top" });
    const others = [makeItem({ id: "desk", x: 0, y: 0, layer: "main", height: 75 })];
    assert.equal(findOnTopHost(onTop, others, flatHeight), null);
    assert.equal(computeOnTopElevation(onTop, others, flatHeight), 0);
  });

  test("resolves to the overlapping main item's top surface (elevation + height)", () => {
    const onTop = makeItem({ id: "lamp", x: 0, y: 0, layer: "on-top" });
    const desk = makeItem({ id: "desk", x: 0, y: 0, layer: "main", height: 75, elevation: 0 });
    assert.equal(findOnTopHost(onTop, [desk], flatHeight)?.id, "desk");
    assert.equal(computeOnTopElevation(onTop, [desk], flatHeight), 75);
  });

  test("adds the host's own elevation on top of its height (stacked surfaces)", () => {
    const onTop = makeItem({ id: "vase", x: 0, y: 0, layer: "on-top" });
    const shelf = makeItem({ id: "shelf", x: 0, y: 0, layer: "main", height: 20, elevation: 100 });
    assert.equal(computeOnTopElevation(onTop, [shelf], flatHeight), 120);
  });

  test("ignores 'under' and other 'on-top' items -- only 'main' layer items can be a host", () => {
    const onTop = makeItem({ id: "lamp", x: 0, y: 0, layer: "on-top" });
    const others = [
      makeItem({ id: "rug", x: 0, y: 0, layer: "under", height: 0.5 }),
      makeItem({ id: "vase", x: 0, y: 0, layer: "on-top", height: 25 }),
    ];
    assert.equal(findOnTopHost(onTop, others, flatHeight), null);
    assert.equal(computeOnTopElevation(onTop, others, flatHeight), 0);
  });

  test("when multiple main items overlap, picks the one with the highest top surface", () => {
    const onTop = makeItem({ id: "lamp", x: 0, y: 0, layer: "on-top" });
    const lowTable = makeItem({ id: "low", x: 0, y: 0, layer: "main", height: 45, elevation: 0 });
    const tallCabinet = makeItem({
      id: "tall",
      x: 0,
      y: 0,
      layer: "main",
      height: 120,
      elevation: 0,
    });
    const host = findOnTopHost(onTop, [lowTable, tallCabinet], flatHeight);
    assert.equal(host?.id, "tall");
    assert.equal(computeOnTopElevation(onTop, [lowTable, tallCabinet], flatHeight), 120);
  });

  test("never treats itself as its own host, even if present in the others array with a 'main' layer", () => {
    const self = makeItem({ id: "weird", x: 0, y: 0, layer: "main" });
    assert.equal(findOnTopHost(self, [self], flatHeight), null);
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
