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
  rectilinearPolygonSpanRects,
  rectilinearPolygonsOverlap,
} from "@/lib/planner-math";
import {
  buildLHallwayCorners,
  buildTHallwayCorners,
  insetRectilinearPolygon,
} from "@/lib/hallway-shapes";
import { ROOM_SHAPE_TEMPLATES, buildTShapeCorners } from "@/lib/room-shapes";
import type { Item, Point } from "@/types/planner";

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

  describe("Item.placedOnId exemption (a declared host/child pair never collides with each other)", () => {
    test("a 'main' layer item fully overlapping its declared host (placedOnId) does not collide", () => {
      const candidate = makeItem({ id: "box", x: 0, y: 0, layer: "main", placedOnId: "table" });
      const others = [makeItem({ id: "table", x: 0, y: 0, layer: "main" })];
      assert.equal(collidesWithOthers(candidate, others, undefined, true), false);
    });

    test("still collides with an unrelated main item even while exempt from its own host", () => {
      const candidate = makeItem({ id: "box", x: 0, y: 0, layer: "main", placedOnId: "table" });
      const others = [
        makeItem({ id: "table", x: 0, y: 0, layer: "main" }),
        makeItem({ id: "cabinet", x: 0, y: 0, layer: "main" }),
      ];
      assert.equal(collidesWithOthers(candidate, others, undefined, true), true);
    });

    test("the exemption also holds in the other direction -- checking the host's own candidate against its already-placed child", () => {
      const hostCandidate = makeItem({ id: "table", x: 0, y: 0, layer: "main" });
      const others = [
        makeItem({ id: "box", x: 0, y: 0, layer: "main", placedOnId: "table" }),
      ];
      assert.equal(collidesWithOthers(hostCandidate, others, undefined, true), false);
    });

    test("placedOnId pointing at an id that isn't actually in `others` changes nothing -- still collides normally with real overlaps", () => {
      const candidate = makeItem({
        id: "box",
        x: 0,
        y: 0,
        layer: "main",
        placedOnId: "not-a-real-item",
      });
      const others = [makeItem({ id: "table", x: 0, y: 0, layer: "main" })];
      assert.equal(collidesWithOthers(candidate, others, undefined, true), true);
    });
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

  // --- polygon (shaped / hallway) rooms ------------------------------
  //
  // The bounding box of an L/T/U is bigger than its floor: the notch is
  // inside the box without being floor. These assert an item can no longer
  // be parked there. `onFloor` is the same question the app asks -- are all
  // four corners of the item's rotated AABB inside the polygon inset by
  // half a wall.
  function onFloor(item: Item, corners: Point[], pos: { x: number; y: number }): boolean {
    const inset = insetRectilinearPolygon(corners, 3);
    const aabb = rotatedAABB(item.width, item.length, item.rotation);
    const cx = pos.x + item.width / 2;
    const cy = pos.y + item.length / 2;
    const hw = aabb.w / 2 - 0.01;
    const hh = aabb.h / 2 - 0.01;
    return [
      { x: cx - hw, y: cy - hh },
      { x: cx + hw, y: cy - hh },
      { x: cx + hw, y: cy + hh },
      { x: cx - hw, y: cy + hh },
    ].every((p) => pointInPolygon(p, inset));
  }

  function templateCorners(key: string): Point[] {
    const tpl = ROOM_SHAPE_TEMPLATES.find((t) => t.key === key);
    assert.ok(tpl, `missing template ${key}`);
    return tpl!.defaultCorners;
  }

  test("a rectangle room is unchanged by the polygon path -- every position, every rotation", () => {
    // The fast path must stay byte-identical to the formula this function
    // has always used, so nothing about the common case can regress.
    const corners = roomCorners(300, 200);
    for (const rotation of [0, 30, 45, 90, 217]) {
      const item = makeItem({ width: 90, length: 50, rotation });
      const aabb = rotatedAABB(item.width, item.length, item.rotation);
      for (let x = -200; x <= 400; x += 37) {
        for (let y = -200; y <= 300; y += 29) {
          const c = clampPos(item, corners, x, y);
          const cx = Math.max(3 + aabb.w / 2, Math.min(297 - aabb.w / 2, x + item.width / 2));
          const cy = Math.max(3 + aabb.h / 2, Math.min(197 - aabb.h / 2, y + item.length / 2));
          assert.equal(c.x, cx - item.width / 2);
          assert.equal(c.y, cy - item.length / 2);
        }
      }
    }
  });

  test("an L-shaped room pushes an item out of the notch, sliding it along the notch wall", () => {
    // The template L is 400x350 with the notch cut from the top-right --
    // x:[240,400], y:[0,140] is inside the bounding box but is not floor.
    const corners = templateCorners("l");
    const item = makeItem({ width: 40, length: 40 });
    const c = clampPos(item, corners, 300, 20);
    assert.ok(onFloor(item, corners, c));
    // Nearest floor is the left arm's inner wall (240 - 3 wall - 40 item),
    // at the y the drag asked for -- it slides rather than jumping.
    assert.equal(c.x, 197);
    assert.equal(c.y, 20);
  });

  test("a U-shaped room pushes an item out of its notch", () => {
    // Template U: 400x350 with a 134x105 bite out of the middle of the
    // bottom wall (a chimney breast). The item is dropped inside the bite.
    const corners = templateCorners("u");
    const item = makeItem({ width: 40, length: 40 });
    const c = clampPos(item, corners, 150, 300);
    assert.ok(onFloor(item, corners, c));
    // Nearest floor is the left leg beside the notch, at the requested y.
    assert.equal(c.x, 90);
    assert.equal(c.y, 300);
  });

  test("an item wider than any single grid cell still clamps into the arm it fits in", () => {
    // A T-room's bar is sliced into three ~133cm cells by the stem's walls,
    // so a 150cm sofa fits in no *cell* of a bar it plainly fits in. Without
    // rectilinearPolygonSpanRects this fell back to the bounding box and the
    // sofa stayed in the dead corner beside the stem.
    const corners = templateCorners("t");
    const item = makeItem({ width: 150, length: 60 });
    assert.ok(rectilinearPolygonRects(corners).every((r) => r.width < 150));
    const c = clampPos(item, corners, 10, 250);
    assert.ok(onFloor(item, corners, c));
    assert.equal(c.x, 10); // x was already fine
    assert.equal(c.y, 129); // lifted up into the bar (189 - 60)
  });

  test("an item that fits nowhere falls back to the old bounding-box result rather than refusing to move", () => {
    const corners = templateCorners("l");
    const item = makeItem({ width: 500, length: 500 });
    const c = clampPos(item, corners, 0, 0);
    // Exactly what the pre-polygon function returned for an oversized item:
    // centred in the bounding box's usable area.
    assert.equal(c.x, 3 + (397 - 3) / 2 - 250);
    assert.equal(c.y, 3 + (347 - 3) / 2 - 250);
  });

  test("an item already on floor passes through untouched, including one spanning two arms", () => {
    const corners = templateCorners("l");
    // 300cm long, lying across the full width of the L's bottom leg -- it
    // fits in no single arm of the shape above it, but every corner is on
    // floor, so the position is accepted as asked for.
    const item = makeItem({ width: 300, length: 40 });
    const c = clampPos(item, corners, 50, 250);
    assert.equal(c.x, 50);
    assert.equal(c.y, 250);
    assert.ok(onFloor(item, corners, c));
  });

  test("documented permissiveness: an item large enough to bridge a notch corner-to-corner is accepted", () => {
    // The containment rule is "all four corners on floor", not "fits inside
    // one rectangle", which is what lets the spanning case above work. The
    // price is this: something wide enough to reach floor on both sides of
    // the U's notch is accepted with its middle over the gap. Nothing in the
    // catalog is that shape relative to a real notch -- asserted so the
    // trade-off stays deliberate rather than becoming a surprise.
    const corners = templateCorners("u");
    const item = makeItem({ width: 380, length: 120 });
    const c = clampPos(item, corners, 10, 200);
    assert.equal(c.x, 10);
    assert.equal(c.y, 200);
  });
});

describe("rectilinearPolygonSpanRects", () => {
  test("a plain rectangle is a single rectangle -- itself", () => {
    const rects = rectilinearPolygonSpanRects(roomCorners(300, 200));
    assert.equal(rects.length, 1);
    assert.deepEqual(rects[0], { x: 0, y: 0, width: 300, height: 200 });
  });

  test("a T-shape yields the whole bar and the whole stem, not the cells they are cut into", () => {
    const rects = rectilinearPolygonSpanRects(buildTShapeCorners(400, 350, 134, 192));
    // The bar: full width, down to where the shoulders cut in.
    assert.ok(rects.some((r) => r.x === 0 && r.y === 0 && r.width === 400 && r.height === 192));
    // The stem: full height of the room, at the stem's own width.
    assert.ok(rects.some((r) => r.x === 133 && r.y === 0 && r.width === 134 && r.height === 350));
    // Only maximal ones -- no rectangle is contained in another.
    for (const a of rects) {
      for (const b of rects) {
        if (a === b) continue;
        const contained =
          b.x <= a.x &&
          b.y <= a.y &&
          b.x + b.width >= a.x + a.width &&
          b.y + b.height >= a.y + a.height;
        assert.ok(!contained);
      }
    }
  });

  test("every returned rectangle is genuinely inside the polygon", () => {
    const corners = buildLHallwayCorners(120, 300, 300, false).corners;
    for (const r of rectilinearPolygonSpanRects(corners)) {
      const eps = 0.001;
      for (const p of [
        { x: r.x + eps, y: r.y + eps },
        { x: r.x + r.width - eps, y: r.y + eps },
        { x: r.x + r.width - eps, y: r.y + r.height - eps },
        { x: r.x + eps, y: r.y + r.height - eps },
        { x: r.x + r.width / 2, y: r.y + r.height / 2 },
      ]) {
        assert.ok(pointInPolygon(p, corners), `${JSON.stringify(p)} outside`);
      }
    }
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
