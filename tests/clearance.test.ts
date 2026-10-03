import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  convexOverlap,
  findPlacementIssues,
  itemIssueText,
  DOORWAY_DEPTH_CM,
  WINDOW_DEPTH_CM,
} from "@/lib/clearance";
import type { Item, Opening } from "@/types/planner";

// A 400x300 room. Its top wall runs (0,0)->(400,0) with the room below it; the bottom wall is
// walked left to right as well (resolveWallSegment), so a door there has to swing *up* to swing in.
const room = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 300 },
  { x: 0, y: 300 },
];

let n = 0;
function item(overrides: Partial<Item> = {}): Item {
  return {
    id: `item-${++n}`,
    name: "Box",
    kind: "furniture",
    color: "#888888",
    x: 0,
    y: 0,
    width: 30,
    length: 30,
    rotation: 0,
    ...overrides,
  };
}

function opening(overrides: Partial<Opening> = {}): Opening {
  return { id: "o1", wall: "top", position: 100, width: 80, kind: "door", ...overrides };
}

// Floor to top, as the hook works it out (elevation + height); 100 cm unless stated.
const extentOf = (it: Item) => ({
  bottom: it.elevation ?? 0,
  top: (it.elevation ?? 0) + (it.height ?? 100),
});

const blockedBy = (o: Opening, it: Item) =>
  findPlacementIssues([it], [o], room, extentOf).blockedOpenings.get(o.id)?.includes(it.id) ??
  false;

describe("convexOverlap", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  const shifted = (dx: number) => square.map((p) => ({ x: p.x + dx, y: p.y }));

  test("overlapping squares overlap; flush and apart ones don't", () => {
    assert.equal(convexOverlap(square, shifted(5)), true);
    assert.equal(convexOverlap(square, shifted(10)), false);
    assert.equal(convexOverlap(square, shifted(20)), false);
  });

  test("uses obbOverlap's half-centimetre touch tolerance", () => {
    assert.equal(convexOverlap(square, shifted(9.6)), false);
    assert.equal(convexOverlap(square, shifted(9.4)), true);
  });
});

describe("a door swinging into the room", () => {
  const door = opening(); // hinged at (100,0), an 80 cm leaf swinging down into the room

  test("an item inside the swing blocks it", () => {
    assert.equal(blockedBy(door, item({ x: 110, y: 10 })), true);
  });

  test("an item past the leaf's reach doesn't", () => {
    assert.equal(blockedBy(door, item({ x: 100, y: 90 })), false);
  });

  test("the swing is a quarter circle, not its bounding square", () => {
    // Inside the 80x80 square in front of the door, but 92 cm from the hinge.
    assert.equal(blockedBy(door, item({ x: 165, y: 65, width: 10, length: 10 })), false);
  });

  test("the hinge side decides which quarter circle", () => {
    const corner = item({ x: 102, y: 60, width: 10, length: 10 });
    assert.equal(blockedBy(opening({ hinge: "start" }), corner), true);
    assert.equal(blockedBy(opening({ hinge: "end" }), corner), false);
  });

  test("a two-leaf terrace door swings two half-width leaves", () => {
    // 102 cm from both hinges: inside one 160 cm leaf's reach, outside two 80 cm leaves'.
    const middle = item({ x: 175, y: 70, width: 10, length: 10 });
    const terrace = opening({ kind: "terrace-door", width: 160 });
    assert.equal(blockedBy({ ...terrace, leaves: 1 }, middle), true);
    assert.equal(blockedBy({ ...terrace, leaves: 2 }, middle), false);
  });

  test("on the bottom wall it swings up, into the room", () => {
    const door = opening({ wall: "bottom" });
    assert.equal(blockedBy(door, item({ x: 110, y: 260 })), true);
    assert.equal(blockedBy(door, item({ x: 110, y: 150 })), false);
  });

  test("a rug never blocks a door", () => {
    assert.equal(blockedBy(door, item({ x: 110, y: 10, layer: "under" })), false);
  });

  test("something mounted above the door's top doesn't block it", () => {
    assert.equal(blockedBy(door, item({ x: 110, y: 10, elevation: 205, height: 20 })), false);
  });
});

describe("a door opening outward keeps only its doorway clear", () => {
  const door = opening({ swing: "out" });

  test(`an item within ${DOORWAY_DEPTH_CM} cm of the doorway blocks it`, () => {
    assert.equal(blockedBy(door, item({ x: 110, y: 30, width: 20, length: 20 })), true);
  });

  test("one further in doesn't", () => {
    assert.equal(blockedBy(door, item({ x: 110, y: 70, width: 20, length: 20 })), false);
  });
});

describe("a window", () => {
  const win = opening({ kind: "window", width: 100 }); // sill 90, top 210

  test(`something reaching above the sill within ${WINDOW_DEPTH_CM} cm of it blocks it`, () => {
    assert.equal(blockedBy(win, item({ x: 120, y: 5, width: 40, height: 180 })), true);
  });

  test("a desk below the sill doesn't", () => {
    assert.equal(blockedBy(win, item({ x: 120, y: 5, width: 40, height: 75 })), false);
  });

  test("a shelf above the window's top doesn't", () => {
    assert.equal(blockedBy(win, item({ x: 120, y: 5, elevation: 215, height: 30 })), false);
  });

  test("a tall item further into the room doesn't", () => {
    assert.equal(blockedBy(win, item({ x: 120, y: 5, height: 180 })), true);
    assert.equal(blockedBy(win, item({ x: 120, y: 50, height: 180 })), false);
  });

  test("a monitor on the desk under it doesn't: it rides on the desk, which is below the sill", () => {
    // The shipped home-office example: monitor, desk lamp and books on a 75 cm desk.
    const desk = item({ x: 110, y: 5, width: 120, length: 60, height: 75 });
    const monitor = item({
      x: 130,
      y: 10,
      width: 55,
      length: 20,
      elevation: 75,
      height: 40,
      layer: "on-top",
      placedOnId: desk.id,
    });
    const issues = findPlacementIssues([desk, monitor], [win], room, extentOf);
    assert.equal(issues.blocks.size, 0);
  });

  test("a mirror hung across it does", () => {
    const mirror = item({
      x: 130,
      y: 0,
      width: 60,
      length: 4,
      elevation: 120,
      height: 60,
      layer: "wall",
    });
    assert.equal(blockedBy(win, mirror), true);
  });
});

describe("overlaps", () => {
  test("two overlapping main items list each other", () => {
    const a = item({ x: 0, y: 0, width: 50, length: 50 });
    const b = item({ x: 25, y: 25, width: 50, length: 50 });
    const { overlaps } = findPlacementIssues([a, b], [], room, extentOf);
    assert.deepEqual(overlaps.get(a.id), [b.id]);
    assert.deepEqual(overlaps.get(b.id), [a.id]);
  });

  test("follows the collision rules: a rug, or an item sitting on its host, isn't an overlap", () => {
    const table = item({ x: 0, y: 0, width: 80, length: 80 });
    const rug = item({ x: 0, y: 0, width: 200, length: 200, layer: "under" });
    const box = item({ x: 10, y: 10, placedOnId: table.id });
    const { overlaps } = findPlacementIssues([table, rug, box], [], room, extentOf);
    assert.equal(overlaps.size, 0);
  });

  test("flush neighbours and far-apart items aren't overlaps", () => {
    const a = item({ x: 0, y: 0, width: 50, length: 50 });
    const flush = item({ x: 50, y: 0, width: 50, length: 50 });
    const far = item({ x: 300, y: 200 });
    assert.equal(findPlacementIssues([a, flush, far], [], room, extentOf).overlaps.size, 0);
  });
});

test("blocks and blockedOpenings are two views of the same pairs", () => {
  const door = opening({ id: "door" });
  const win = opening({ id: "win", kind: "window", wall: "bottom", width: 100 });
  const chair = item({ x: 110, y: 10 });
  const shelf = item({ x: 120, y: 260, width: 40, length: 30, height: 180 });
  const { blocks, blockedOpenings } = findPlacementIssues(
    [chair, shelf],
    [door, win],
    room,
    extentOf,
  );
  assert.deepEqual(blocks.get(chair.id), ["door"]);
  assert.deepEqual(blocks.get(shelf.id), ["win"]);
  assert.deepEqual(blockedOpenings.get("door"), [chair.id]);
  assert.deepEqual(blockedOpenings.get("win"), [shelf.id]);
});

test("itemIssueText joins an item's warnings into one line", () => {
  const issues = {
    overlaps: new Map([["a", ["b"]]]),
    blocks: new Map([
      ["a", ["door", "win"]],
      ["c", ["terrace"]],
    ]),
    blockedOpenings: new Map(),
  };
  const openings = [
    { id: "door", kind: "door" as const },
    { id: "win", kind: "window" as const },
    { id: "terrace", kind: "terrace-door" as const },
  ];
  const text = itemIssueText(issues, openings, { overlaps: "O", door: "D", window: "W" });
  assert.equal(text.get("a"), "O · D · W");
  assert.equal(text.get("c"), "D");
  assert.equal(text.has("b"), false);
});
