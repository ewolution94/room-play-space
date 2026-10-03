import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { blueprintNumbers, floorAreaM2 } from "@/lib/blueprint";
import type { Item } from "@/types/planner";

const item = (id: string, x: number, y: number, size = 40): Item => ({
  id,
  name: id,
  kind: "furniture",
  color: "#888888",
  x,
  y,
  width: size,
  length: size,
  rotation: 0,
});

describe("blueprintNumbers", () => {
  test("numbers top to bottom, then left to right", () => {
    const numbers = blueprintNumbers([
      item("bottom", 0, 300),
      item("top-right", 300, 0),
      item("top-left", 0, 0),
    ]);
    assert.deepEqual(
      ["top-left", "top-right", "bottom"].map((id) => numbers.get(id)),
      [1, 2, 3],
    );
  });

  test("a row at nearly the same height reads left to right, not by a few cm of y", () => {
    const numbers = blueprintNumbers([item("c", 200, 105), item("a", 0, 110), item("b", 100, 100)]);
    assert.deepEqual(
      ["a", "b", "c"].map((id) => numbers.get(id)),
      [1, 2, 3],
    );
  });

  test("every item gets a number, once", () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      item(`i${i}`, (i * 37) % 300, (i * 53) % 300),
    );
    const numbers = blueprintNumbers(items);
    assert.deepEqual(
      [...numbers.values()].sort((a, b) => a - b),
      items.map((_, i) => i + 1),
    );
  });
});

describe("floorAreaM2", () => {
  test("a 5 x 4 m rectangle is 20 m², whichever way it's wound", () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 400 },
      { x: 0, y: 400 },
    ];
    assert.equal(floorAreaM2(rect), 20);
    assert.equal(floorAreaM2([...rect].reverse()), 20);
  });

  test("an L-shaped room doesn't count its notch", () => {
    const l = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 150 },
      { x: 150, y: 150 },
      { x: 150, y: 300 },
      { x: 0, y: 300 },
    ];
    assert.equal(floorAreaM2(l), 6.75); // 9 m² minus the 1.5 x 1.5 m notch
  });
});
