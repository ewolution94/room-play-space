import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RoomPlanSvg } from "@/components/planner/RoomPlanSvg";
import type { Item, Opening } from "@/types/planner";

const corners = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 300 },
  { x: 0, y: 300 },
];
const door: Opening = { id: "d", wall: "top", position: 100, width: 90, kind: "door" };
const sofa: Item = {
  id: "sofa",
  name: "Sofa",
  kind: "furniture",
  color: "#336699",
  x: 0,
  y: 0,
  width: 200,
  length: 90,
  rotation: 0,
};

const render = (extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(RoomPlanSvg, {
      corners,
      openings: [door],
      items: [sofa],
      title: "Plan",
      ...extra,
    }),
  );

/** The <line>s in the markup, as attribute maps. */
const lines = (markup: string) =>
  [...markup.matchAll(/<line ([^>]*?)\/?>/g)].map((m) =>
    Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])),
  );

describe("RoomPlanSvg", () => {
  test("plain: walls 6 cm on the wall line, the door's gap cut on that line", () => {
    const markup = render();
    assert.match(markup, /<polygon [^>]*stroke="currentColor" stroke-width="6"/);
    const gap = lines(markup).find((l) => l["stroke-width"] === "7");
    assert.ok(gap, "the gap is a line one cm wider than the wall");
    assert.equal(gap.y1, "0");
    assert.equal(gap.y2, "0");
  });

  test("painted: every wall in its own colour, unset walls in the default, rims first", () => {
    const markup = render({ wallColors: { top: "#b6c3ad", left: "#c07a5c" } });
    // Four rims, then the four walls' paint in wall order: top, right, bottom, left.
    assert.deepEqual(
      lines(markup)
        .slice(0, 8)
        .map((l) => l.stroke),
      [...Array(4).fill("#334155"), "#b6c3ad", "#f1f5f9", "#f1f5f9", "#c07a5c"],
    );
  });

  test("painted: the walls are a band outside the room, so the door's gap is cut beyond the wall line", () => {
    const markup = render({ wallColors: {} });
    // 400 cm across: a 25 cm band (400 / 16) plus a 3.125 cm rim, centred half of that outside
    // the top wall, at y = -14.0625.
    const gap = lines(markup).find((l) => l.x1 === "100" && l.x2 === "190");
    assert.ok(gap, "the door's gap spans its 90 cm on the top wall");
    assert.equal(Number(gap.y1), -14.0625);
    assert.equal(gap.y1, gap.y2);
    assert.equal(Number(gap["stroke-width"]), 25 + 25 / 8 + 1);
    // Room for the band in the viewBox: it isn't cropped.
    const [minX, minY] = markup
      .match(/viewBox="([^"]+)"/)![1]
      .split(" ")
      .map(Number);
    assert.ok(minX <= -(25 + 25 / 8) && minY <= -(25 + 25 / 8));
  });

  test("the floor is the room's material, from a pattern of its own", () => {
    const markup = render({ flooring: { key: "tile-square", color: "#e8e6e1" } });
    const id = markup.match(/<pattern id="([^"]+)"/)?.[1];
    assert.ok(id);
    assert.match(markup, new RegExp(`<polygon [^>]*fill="url\\(#${id}\\)"`));
  });

  test("the furniture is drawn, with a label when one is given", () => {
    const markup = render({ labels: new Map([["sofa", "1"]]) });
    assert.match(markup, /<rect x="0" y="0" width="200" height="90"/);
    assert.match(markup, />1<\/text>/);
  });
});
