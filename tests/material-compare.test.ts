import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  comparedFloor,
  DEFAULT_WALL_COLOR,
  paintAllWalls,
  sameWalls,
} from "@/lib/material-compare";
import { FLOOR_MATERIAL_BY_KEY } from "@/lib/floor-materials";
import { WALL_SWATCHES } from "@/lib/swatches";

const keys = ["top", "right", "bottom", "left"];

describe("material comparison", () => {
  test("painting every wall keeps keys that aren't walls of this shape", () => {
    const painted = paintAllWalls({ top: "#ff0000", stale: "#123456" }, keys, "#b6c3ad");
    assert.deepEqual(painted, {
      top: "#b6c3ad",
      right: "#b6c3ad",
      bottom: "#b6c3ad",
      left: "#b6c3ad",
      stale: "#123456",
    });
  });

  test("an unset wall is the default colour, and case doesn't matter", () => {
    const fromPicker = { top: "#F1F5F9", right: "#B6C3AD", bottom: "", left: DEFAULT_WALL_COLOR };
    assert.ok(sameWalls(fromPicker, { right: "#b6c3ad" }, keys));
    assert.ok(!sameWalls(fromPicker, {}, keys));
    // Only the walls asked about count.
    assert.ok(sameWalls({ top: "#000000" }, {}, ["left"]));
  });

  test("the room's own floor comes back in its own colour; others in their starting colour", () => {
    const before = { key: "wood-laminate", color: "#5a3d22" };
    assert.deepEqual(comparedFloor(FLOOR_MATERIAL_BY_KEY["wood-laminate"], before), before);
    assert.deepEqual(comparedFloor(FLOOR_MATERIAL_BY_KEY["tile-square"], before), {
      key: "tile-square",
      color: FLOOR_MATERIAL_BY_KEY["tile-square"].defaultColor,
    });
  });

  test("the wall paints are distinct, valid colours, none the unpainted default", () => {
    const values = WALL_SWATCHES.map((s) => s.value);
    for (const v of values) assert.match(v, /^#[0-9a-f]{6}$/);
    assert.equal(new Set(values).size, values.length);
    assert.ok(!values.includes(DEFAULT_WALL_COLOR));
  });
});
