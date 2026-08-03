import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  STAGE_BOTTOM_SAFE_ZONE,
  INSPECTOR_MIN_HEIGHT,
  clampInspectorPos,
  inspectorMaxHeight,
} from "@/lib/canvas-layout";

const STAGE = { width: 1000, height: 700 };
const PANEL = { width: 288, height: 300 };

describe("clampInspectorPos", () => {
  test("leaves a position that's already inside alone", () => {
    assert.deepEqual(clampInspectorPos(16, 80, STAGE, PANEL), { x: 16, y: 80 });
  });

  test("never lets the panel's bottom reach the safe zone", () => {
    const { y } = clampInspectorPos(16, 9999, STAGE, PANEL);
    assert.equal(y + PANEL.height, STAGE.height - STAGE_BOTTOM_SAFE_ZONE);
  });

  test("clamps to the stage on the other three edges", () => {
    assert.deepEqual(clampInspectorPos(-50, -50, STAGE, PANEL), { x: 0, y: 0 });
    assert.equal(clampInspectorPos(9999, 0, STAGE, PANEL).x, STAGE.width - PANEL.width);
  });

  test("a panel taller than the usable stage is pinned to the top rather than pushed off it", () => {
    // Without the Math.max(0,...) this would return a negative y and the
    // panel's header -- the only way to drag it back -- would be unreachable.
    const tall = { width: 288, height: 5000 };
    assert.deepEqual(clampInspectorPos(10, 200, STAGE, tall), { x: 10, y: 0 });
  });
});

describe("inspectorMaxHeight", () => {
  test("reserves the safe zone plus the panel's own offset", () => {
    assert.equal(
      inspectorMaxHeight(80),
      `max(${INSPECTOR_MIN_HEIGHT}px, calc(100% - 80px - ${STAGE_BOTTOM_SAFE_ZONE}px))`,
    );
  });

  test("rounds the offset, so a sub-pixel drag can't emit a 15-decimal calc()", () => {
    assert.ok(inspectorMaxHeight(80.42731).includes("- 80px -"));
  });

  test("always keeps a usable floor, however far down the panel sits", () => {
    assert.ok(inspectorMaxHeight(9999).startsWith(`max(${INSPECTOR_MIN_HEIGHT}px,`));
  });
});
