import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RoomShapeCanvas } from "@/components/room-creation/RoomShapeCanvas";

const corners = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 300 },
  { x: 0, y: 300 },
];
const render = (mode: "slopes" | "openings" | "drag") =>
  renderToStaticMarkup(
    createElement(RoomShapeCanvas, {
      corners,
      viewBox: "-50 -50 500 400",
      mode,
      wallSlopes: { left: { kneeHeight: 110, run: 150 } },
    }),
  );

describe("RoomShapeCanvas: the wizard's slopes step", () => {
  test("draws the slope's band, clipped to the room, and a draggable full-height line", () => {
    const markup = render("slopes");
    assert.match(
      markup,
      /<clipPath id="wizard-slope-clip-[^"]+"><polygon points="0,0 400,0 400,300 0,300"/,
    );
    assert.equal((markup.match(/fill-amber-500\/25/g) ?? []).length, 1);
    // The left wall is index 3, running from the bottom corner up; its
    // full-height line sits 150 cm in, along x = 150.
    assert.match(markup, /<line x1="150" y1="300" x2="150" y2="0"[^>]*data-slope-edge="3"/);
  });

  test("the openings step shows the band but nothing to drag", () => {
    const markup = render("openings");
    assert.equal((markup.match(/fill-amber-500\/25/g) ?? []).length, 1);
    assert.doesNotMatch(markup, /data-slope-edge/);
  });

  test("the walls step doesn't draw slopes at all", () => {
    assert.doesNotMatch(render("drag"), /fill-amber-500\/25/);
  });
});
