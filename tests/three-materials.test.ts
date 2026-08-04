import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { setMaterialTransparency, isTranslucent, settleOpacity } from "@/lib/three-materials";

describe("setMaterialTransparency", () => {
  // The regression this exists for: the wall-fade loop used to set
  // `transparent = true` on every wall material every frame regardless of
  // opacity. three.js renders a transmissive material's refraction from a
  // pass containing only the opaque list, so no wall was ever visible
  // through any window -- you saw the ground grid through the glass.
  test("a solid surface stays out of the transparent queue", () => {
    const solidWall = { transparent: false, needsUpdate: false };
    setMaterialTransparency(solidWall, isTranslucent(1));
    assert.equal(
      solidWall.transparent,
      false,
      "a fully opaque wall must not be marked transparent",
    );
  });

  test("a fading surface joins it, and comes back out again", () => {
    const wall = { transparent: false, needsUpdate: false };
    setMaterialTransparency(wall, isTranslucent(0.25));
    assert.equal(wall.transparent, true);
    setMaterialTransparency(wall, isTranslucent(1));
    assert.equal(wall.transparent, false);
  });

  test("a real change flags the material for update", () => {
    const mat = { transparent: false, needsUpdate: false };
    assert.equal(setMaterialTransparency(mat, true), true);
    assert.equal(mat.needsUpdate, true);
  });

  // The fade loop runs at 60fps over every material in the scene.
  test("no-op when unchanged -- no needless invalidation every frame", () => {
    const mat = { transparent: true, needsUpdate: false };
    assert.equal(setMaterialTransparency(mat, true), false);
    assert.equal(mat.needsUpdate, false, "re-asserting the same value must not invalidate");
  });
});

describe("isTranslucent", () => {
  test("fully opaque is not translucent", () => {
    assert.equal(isTranslucent(1), false);
  });

  test("an actually-faded wall is translucent", () => {
    assert.equal(isTranslucent(0.25), true);
    assert.equal(isTranslucent(0.99), true);
  });
});

describe("settleOpacity", () => {
  // Why it exists: lerp closes 12% of the remaining gap per frame, so it
  // approaches its target without reaching it. A wall coming back to solid
  // would sit fractionally under 1 for about a second -- counted
  // translucent the whole time, and so missing from every window's glass.
  test("a fade that has effectively arrived is snapped to its target", () => {
    assert.equal(settleOpacity(0.998, 1), 1);
    assert.equal(isTranslucent(settleOpacity(0.998, 1)), false);
  });

  test("a fade still in progress is left alone", () => {
    assert.equal(settleOpacity(0.6, 1), 0.6);
    assert.equal(settleOpacity(0.4, 0.25), 0.4);
  });

  test("it settles in both directions", () => {
    assert.equal(settleOpacity(0.252, 0.25), 0.25);
  });

  // The actual loop, run to completion: it must reach exactly solid, not
  // merely get close, or the transparency switch never flips back.
  test("the real lerp reaches exactly 1 within a reasonable number of frames", () => {
    let opacity = 0.25;
    let frames = 0;
    while (opacity !== 1 && frames < 200) {
      opacity = settleOpacity(opacity + (1 - opacity) * 0.12, 1);
      frames++;
    }
    assert.equal(opacity, 1, "fade never settled");
    assert.ok(frames < 60, `took ${frames} frames to settle`);
  });
});
