import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeAutoOpenIntervals,
  resolveEffectiveOpenIntervals,
  closedSubIntervals,
} from "@/lib/room-adjacency";
import { buildLHallwayCorners } from "@/lib/hallway-shapes";
import type { RoomLayout } from "@/types/planner";

function room(overrides: Partial<RoomLayout> & { id: string }): RoomLayout {
  return {
    name: "Room",
    width: 300,
    length: 200,
    x: 0,
    y: 0,
    rotation: 0,
    color: "#ffffff",
    items: [],
    openings: [],
    ...overrides,
  };
}

describe("computeAutoOpenIntervals", () => {
  test("two rectangular rooms placed exactly flush open the full shared wall on both sides", () => {
    const a = room({ id: "a", x: 0, y: 0, width: 300, length: 200 });
    const b = room({ id: "b", x: 300, y: 0, width: 250, length: 200 });
    const result = computeAutoOpenIntervals([a, b]);
    // a's right wall (index 1) touches b's left wall (index 3), full length.
    assert.deepEqual(result.get("a")?.get("right"), [{ start: 0, end: 200 }]);
    assert.deepEqual(result.get("b")?.get("left"), [{ start: 0, end: 200 }]);
    assert.equal(result.get("a")?.size, 1);
    assert.equal(result.get("b")?.size, 1);
  });

  test("rooms with a real gap between them are not touching", () => {
    const a = room({ id: "a", x: 0, y: 0, width: 300, length: 200 });
    const b = room({ id: "b", x: 310, y: 0, width: 250, length: 200 }); // 10cm gap
    const result = computeAutoOpenIntervals([a, b]);
    assert.equal(result.get("a")?.size, 0);
    assert.equal(result.get("b")?.size, 0);
  });

  test("a near-zero (sub-epsilon) gap still counts as touching", () => {
    const a = room({ id: "a", x: 0, y: 0, width: 300, length: 200 });
    const b = room({ id: "b", x: 301.5, y: 0, width: 250, length: 200 }); // 1.5cm gap
    const result = computeAutoOpenIntervals([a, b]);
    assert.ok(result.get("a")?.has("right"));
    assert.ok(result.get("b")?.has("left"));
  });

  test("a corner-only touch below the minimum overlap does not open a wall", () => {
    const a = room({ id: "a", x: 0, y: 0, width: 300, length: 200 });
    // Only ~10cm of overlap between a's right wall and b's left wall --
    // below the 20cm minimum.
    const b = room({ id: "b", x: 300, y: 190, width: 250, length: 200 });
    const result = computeAutoOpenIntervals([a, b]);
    assert.equal(result.get("a")?.size, 0);
    assert.equal(result.get("b")?.size, 0);
  });

  test("rooms far apart never touch", () => {
    const a = room({ id: "a", x: 0, y: 0, width: 300, length: 200 });
    const b = room({ id: "b", x: 1000, y: 1000, width: 250, length: 200 });
    const result = computeAutoOpenIntervals([a, b]);
    assert.equal(result.get("a")?.size, 0);
    assert.equal(result.get("b")?.size, 0);
  });

  test("a short room touching only part of a long neighbor's wall opens just that span", () => {
    // a's right wall runs the full 300cm of its length. b is a short room
    // (length 100) flush against only the top 100cm of that wall.
    const a = room({ id: "a", x: 0, y: 0, width: 200, length: 300 });
    const b = room({ id: "b", x: 200, y: 0, width: 150, length: 100 });
    const result = computeAutoOpenIntervals([a, b]);
    // a's right wall (length 300) only opens over [0,100] -- the part that
    // actually touches b -- not the whole wall.
    assert.deepEqual(result.get("a")?.get("right"), [{ start: 0, end: 100 }]);
    // b's left wall (length 100) is entirely covered by a's much longer
    // wall, so it opens along its own full length.
    assert.deepEqual(result.get("b")?.get("left"), [{ start: 0, end: 100 }]);
  });

  test("two short rooms touching different spans of one long wall produce two separate intervals", () => {
    const a = room({ id: "a", x: 0, y: 0, width: 200, length: 400 });
    const b = room({ id: "b", x: 200, y: 0, width: 150, length: 100 });
    const c = room({ id: "c", x: 200, y: 300, width: 150, length: 100 });
    const result = computeAutoOpenIntervals([a, b, c]);
    const aIntervals = result.get("a")?.get("right");
    assert.deepEqual(aIntervals, [
      { start: 0, end: 100 },
      { start: 300, end: 400 },
    ]);
  });

  test("a polygon (hallway) room touching a rectangular room resolves both key conventions", () => {
    const { corners } = buildLHallwayCorners(120, 300, 300, false);
    const hallway = room({ id: "h", x: 0, y: 0, width: 300, length: 300, corners });
    // The hallway's vertical arm's right wall (index 1: from (120,0) to
    // (120, 180)) sits at global x=120. Place a rect room flush against it.
    const rect = room({ id: "r", x: 120, y: 0, width: 200, length: 180 });
    const result = computeAutoOpenIntervals([hallway, rect]);
    assert.deepEqual(result.get("h")?.get("1"), [{ start: 0, end: 180 }]);
    assert.deepEqual(result.get("r")?.get("left"), [{ start: 0, end: 180 }]);
  });

  test("three rooms in a row each open only the walls they actually share", () => {
    const a = room({ id: "a", x: 0, y: 0, width: 200, length: 200 });
    const b = room({ id: "b", x: 200, y: 0, width: 200, length: 200 });
    const c = room({ id: "c", x: 400, y: 0, width: 200, length: 200 });
    const result = computeAutoOpenIntervals([a, b, c]);
    assert.deepEqual(result.get("a")?.get("right"), [{ start: 0, end: 200 }]);
    assert.deepEqual(result.get("b")?.get("left"), [{ start: 0, end: 200 }]);
    assert.deepEqual(result.get("b")?.get("right"), [{ start: 0, end: 200 }]);
    assert.deepEqual(result.get("c")?.get("left"), [{ start: 0, end: 200 }]);
  });
});

describe("computeAutoOpenIntervals: existing door clips the auto-open span", () => {
  // Shared geometry for all four tests below: two 200-tall rectangles
  // placed exactly flush (a's right wall touching b's left wall, full
  // 200cm), so with no doors involved the auto-open span would be the
  // full [0,200] on both sides (per the "two rectangular rooms placed
  // exactly flush" test above).
  function flushPair(aOpenings: RoomLayout["openings"], bOpenings: RoomLayout["openings"]) {
    const a = room({ id: "a", x: 0, y: 0, width: 300, length: 200, openings: aOpenings });
    const b = room({ id: "b", x: 300, y: 0, width: 250, length: 200, openings: bOpenings });
    return computeAutoOpenIntervals([a, b]);
  }

  test("a pre-existing door on only one side clips the open span to the door's own footprint on both walls", () => {
    const result = flushPair(
      [{ id: "d1", wall: "right", position: 50, width: 80, kind: "door" }],
      [],
    );
    // a's own frame: the door sits at its own [50,130].
    assert.deepEqual(result.get("a")?.get("right"), [{ start: 50, end: 130 }]);
    // b's left wall runs anti-parallel to a's right wall, so the same
    // physical span is expressed as [70,150] in b's own local frame.
    assert.deepEqual(result.get("b")?.get("left"), [{ start: 70, end: 150 }]);
  });

  test("a pre-existing door on only the other side still clips both walls (note: 'left' is measured in reverse of forward-winding order, so the numbers don't mirror test 1's -- see resolveWallSegment in hallway-shapes.ts)", () => {
    const result = flushPair(
      [],
      [{ id: "d1", wall: "left", position: 70, width: 80, kind: "door" }],
    );
    assert.deepEqual(result.get("a")?.get("right"), [{ start: 70, end: 150 }]);
    assert.deepEqual(result.get("b")?.get("left"), [{ start: 50, end: 130 }]);
  });

  test("doors on both sides at different (overlapping) positions union together instead of using the full overlap", () => {
    const result = flushPair(
      [{ id: "d1", wall: "right", position: 40, width: 50, kind: "door" }],
      [{ id: "d2", wall: "left", position: 70, width: 50, kind: "door" }],
    );
    assert.deepEqual(result.get("a")?.get("right"), [{ start: 40, end: 120 }]);
    assert.deepEqual(result.get("b")?.get("left"), [{ start: 80, end: 160 }]);
  });

  test("a window on the touching wall is ignored for clipping (falls back to the full overlap)", () => {
    const result = flushPair(
      [{ id: "w1", wall: "right", position: 50, width: 80, kind: "window" }],
      [],
    );
    assert.deepEqual(result.get("a")?.get("right"), [{ start: 0, end: 200 }]);
    assert.deepEqual(result.get("b")?.get("left"), [{ start: 0, end: 200 }]);
  });

  test("a door that exists but sits outside the actual touch region falls back to the full overlap", () => {
    // a is a longer room; b only touches the first 100cm of a's right wall
    // (mirrors the "short room touching only part of a long neighbor's
    // wall" test above), and a's door sits at [200,250] -- nowhere near
    // the touching span.
    const a = room({
      id: "a",
      x: 0,
      y: 0,
      width: 200,
      length: 300,
      openings: [{ id: "d1", wall: "right", position: 200, width: 50, kind: "door" }],
    });
    const b = room({ id: "b", x: 200, y: 0, width: 150, length: 100 });
    const result = computeAutoOpenIntervals([a, b]);
    assert.deepEqual(result.get("a")?.get("right"), [{ start: 0, end: 100 }]);
    assert.deepEqual(result.get("b")?.get("left"), [{ start: 0, end: 100 }]);
  });
});

describe("resolveEffectiveOpenIntervals", () => {
  const corners = [
    { x: 0, y: 0 },
    { x: 300, y: 0 },
    { x: 300, y: 200 },
    { x: 0, y: 200 },
  ];

  test("with no overrides, the effective intervals equal the auto-detected ones", () => {
    const r = room({ id: "a" });
    const auto = new Map([["right", [{ start: 0, end: 100 }]]]);
    const result = resolveEffectiveOpenIntervals(r, corners, auto);
    assert.deepEqual(result.get("right"), [{ start: 0, end: 100 }]);
    assert.deepEqual(result.get("top"), []);
  });

  test("an override of true forces a wall fully open regardless of any auto-detected partial span", () => {
    const r = room({ id: "a", wallOverrides: { right: true } });
    const auto = new Map([["right", [{ start: 0, end: 100 }]]]);
    const result = resolveEffectiveOpenIntervals(r, corners, auto);
    // Wall index 1 (right) has length 200 for this rectangle.
    assert.deepEqual(result.get("right"), [{ start: 0, end: 200 }]);
  });

  test("an override of false forces a wall fully closed even while auto-touching", () => {
    const r = room({ id: "a", wallOverrides: { right: false } });
    const auto = new Map([["right", [{ start: 0, end: 200 }]]]);
    const result = resolveEffectiveOpenIntervals(r, corners, auto);
    assert.deepEqual(result.get("right"), []);
  });
});

describe("closedSubIntervals", () => {
  test("no open intervals leaves the wall fully closed", () => {
    assert.deepEqual(closedSubIntervals(300, []), [{ start: 0, end: 300 }]);
  });

  test("a centered open interval leaves two closed sub-spans", () => {
    assert.deepEqual(closedSubIntervals(300, [{ start: 100, end: 200 }]), [
      { start: 0, end: 100 },
      { start: 200, end: 300 },
    ]);
  });

  test("an open interval flush with one end leaves a single closed sub-span", () => {
    assert.deepEqual(closedSubIntervals(300, [{ start: 0, end: 100 }]), [{ start: 100, end: 300 }]);
    assert.deepEqual(closedSubIntervals(300, [{ start: 200, end: 300 }]), [{ start: 0, end: 200 }]);
  });

  test("an open interval covering the whole wall leaves nothing closed", () => {
    assert.deepEqual(closedSubIntervals(300, [{ start: 0, end: 300 }]), []);
  });

  test("multiple non-adjacent open intervals leave multiple closed gaps", () => {
    assert.deepEqual(
      closedSubIntervals(400, [
        { start: 100, end: 150 },
        { start: 300, end: 350 },
      ]),
      [
        { start: 0, end: 100 },
        { start: 150, end: 300 },
        { start: 350, end: 400 },
      ],
    );
  });

  test("overlapping or out-of-order open intervals are merged before complementing", () => {
    assert.deepEqual(
      closedSubIntervals(300, [
        { start: 200, end: 250 },
        { start: 50, end: 120 },
        { start: 100, end: 210 },
      ]),
      [
        { start: 0, end: 50 },
        { start: 250, end: 300 },
      ],
    );
  });
});
