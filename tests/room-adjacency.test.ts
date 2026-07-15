import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeAutoOpenWalls, resolveEffectiveOpenWalls } from "@/lib/room-adjacency";
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

describe("computeAutoOpenWalls", () => {
  test("two rectangular rooms placed exactly flush open their shared wall on both sides", () => {
    const a = room({ id: "a", x: 0, y: 0, width: 300, length: 200 });
    const b = room({ id: "b", x: 300, y: 0, width: 250, length: 200 });
    const result = computeAutoOpenWalls([a, b]);
    // a's right wall (index 1) touches b's left wall (index 3).
    assert.ok(result.get("a")?.has("right"));
    assert.ok(result.get("b")?.has("left"));
    // No other walls should be marked open.
    assert.equal(result.get("a")?.size, 1);
    assert.equal(result.get("b")?.size, 1);
  });

  test("rooms with a real gap between them are not touching", () => {
    const a = room({ id: "a", x: 0, y: 0, width: 300, length: 200 });
    const b = room({ id: "b", x: 310, y: 0, width: 250, length: 200 }); // 10cm gap
    const result = computeAutoOpenWalls([a, b]);
    assert.equal(result.get("a")?.size, 0);
    assert.equal(result.get("b")?.size, 0);
  });

  test("a near-zero (sub-epsilon) gap still counts as touching", () => {
    const a = room({ id: "a", x: 0, y: 0, width: 300, length: 200 });
    const b = room({ id: "b", x: 301.5, y: 0, width: 250, length: 200 }); // 1.5cm gap
    const result = computeAutoOpenWalls([a, b]);
    assert.ok(result.get("a")?.has("right"));
    assert.ok(result.get("b")?.has("left"));
  });

  test("a corner-only touch with insufficient overlap does not open a wall", () => {
    const a = room({ id: "a", x: 0, y: 0, width: 300, length: 200 });
    // b is shifted far enough down that only a sliver of its left wall
    // lines up with a's right wall.
    const b = room({ id: "b", x: 300, y: 190, width: 250, length: 200 });
    const result = computeAutoOpenWalls([a, b]);
    assert.equal(result.get("a")?.size, 0);
    assert.equal(result.get("b")?.size, 0);
  });

  test("rooms far apart never touch", () => {
    const a = room({ id: "a", x: 0, y: 0, width: 300, length: 200 });
    const b = room({ id: "b", x: 1000, y: 1000, width: 250, length: 200 });
    const result = computeAutoOpenWalls([a, b]);
    assert.equal(result.get("a")?.size, 0);
    assert.equal(result.get("b")?.size, 0);
  });

  test("a polygon (hallway) room touching a rectangular room resolves both key conventions", () => {
    const { corners } = buildLHallwayCorners(120, 300, 300, false);
    const hallway = room({ id: "h", x: 0, y: 0, width: 300, length: 300, corners });
    // The hallway's vertical arm's right wall (index 1: from (120,0) to
    // (120, 180)) sits at global x=120. Place a rect room flush against it.
    const rect = room({ id: "r", x: 120, y: 0, width: 200, length: 180 });
    const result = computeAutoOpenWalls([hallway, rect]);
    assert.ok(result.get("h")?.has("1"));
    assert.ok(result.get("r")?.has("left"));
  });

  test("three rooms in a row each open only the walls they actually share", () => {
    const a = room({ id: "a", x: 0, y: 0, width: 200, length: 200 });
    const b = room({ id: "b", x: 200, y: 0, width: 200, length: 200 });
    const c = room({ id: "c", x: 400, y: 0, width: 200, length: 200 });
    const result = computeAutoOpenWalls([a, b, c]);
    assert.deepEqual(result.get("a"), new Set(["right"]));
    assert.deepEqual(result.get("b"), new Set(["left", "right"]));
    assert.deepEqual(result.get("c"), new Set(["left"]));
  });
});

describe("resolveEffectiveOpenWalls", () => {
  test("with no overrides, the effective set equals the auto-detected set", () => {
    const r = room({ id: "a" });
    const auto = new Set(["right"]);
    assert.deepEqual(resolveEffectiveOpenWalls(r, auto), new Set(["right"]));
  });

  test("an override of true forces a wall open even with no touching neighbor", () => {
    const r = room({ id: "a", wallOverrides: { top: true } });
    const auto = new Set<string>();
    assert.deepEqual(resolveEffectiveOpenWalls(r, auto), new Set(["top"]));
  });

  test("an override of false forces a wall closed even while auto-touching", () => {
    const r = room({ id: "a", wallOverrides: { right: false } });
    const auto = new Set(["right"]);
    assert.deepEqual(resolveEffectiveOpenWalls(r, auto), new Set());
  });

  test("a room can end up with anywhere from 0 to all of its walls open", () => {
    const closed = room({ id: "a" });
    assert.deepEqual(resolveEffectiveOpenWalls(closed, new Set()), new Set());

    const allOpen = room({
      id: "a",
      wallOverrides: { top: true, right: true, bottom: true, left: true },
    });
    assert.deepEqual(
      resolveEffectiveOpenWalls(allOpen, new Set()),
      new Set(["top", "right", "bottom", "left"]),
    );
  });
});
