import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { importSchema } from "@/lib/planner-schema";
import { importedRoomContents } from "@/lib/room-import";
import { DEFAULT_FLOORING } from "@/lib/floor-materials";
import { DEFAULT_CEILING_HEIGHT } from "@/lib/wall-slopes";

// Exactly what buildRoomExportPreview (use-room-planner.ts) writes, for a room that uses
// everything that used to get lost on the way back in.
const exported = {
  version: 3,
  room: { width: 500, length: 400 },
  corners: [
    { x: 0, y: 0 },
    { x: 500, y: 0 },
    { x: 500, y: 400 },
    { x: 0, y: 400 },
  ],
  wallColors: { top: "#ffffff", right: "#eeeeee", bottom: "#dddddd", left: "#cccccc" },
  flooring: { key: "oak-herringbone", color: "#a0522d" },
  ceilingHeight: 260,
  wallSlopes: { right: { kneeHeight: 120, run: 150 } },
  openings: [
    {
      id: "door",
      wall: "bottom",
      position: 300,
      width: 90,
      kind: "door",
      hinge: "end",
      swing: "out",
    },
    {
      id: "terrace",
      wall: "top",
      position: 100,
      width: 180,
      kind: "terrace-door",
      hinge: "end",
      swing: "out",
      leaves: 2,
      color: "#333333",
    },
    { id: "win", wall: "left", position: 50, width: 100, kind: "window" },
  ],
  items: [
    {
      id: "desk",
      name: "Desk",
      kind: "furniture",
      icon: "desk",
      color: "#8b5e34",
      x: 100,
      y: 20,
      width: 160,
      length: 75,
      rotation: 0,
      height: 75,
      catalogDims: { w: 160, h: 75, l: 75 },
    },
    {
      id: "lamp",
      name: "Desk lamp",
      kind: "furniture",
      icon: "desk-lamp",
      color: "#222222",
      x: 120,
      y: 30,
      width: 20,
      length: 20,
      rotation: 0,
      height: 45,
      elevation: 75,
      layer: "on-top",
      placedOnId: "desk",
    },
  ],
};

const fromFile = (raw: unknown) => importedRoomContents(importSchema.parse(raw));

describe("importedRoomContents", () => {
  test("an exported room comes back with everything it carried", () => {
    const room = fromFile(exported);
    assert.equal(room.width, 500);
    assert.equal(room.length, 400);
    assert.deepEqual(room.corners, exported.corners);
    assert.deepEqual(room.wallColors, exported.wallColors);
    assert.deepEqual(room.flooring, exported.flooring);
    assert.equal(room.ceilingHeight, 260);
    assert.deepEqual(room.wallSlopes, exported.wallSlopes);
    // Compared as stored (JSON): an absent colour comes back as `color: undefined`, which
    // saving drops again.
    assert.deepEqual(JSON.parse(JSON.stringify(room.openings)), exported.openings);
    for (const [i, item] of room.items.entries()) {
      for (const [key, value] of Object.entries(exported.items[i])) {
        assert.deepEqual(item[key as keyof typeof item], value, `${item.id}.${key}`);
      }
    }
  });

  test("a terrace door keeps its hinge, swing and second leaf (they used to be dropped)", () => {
    const terrace = fromFile(exported).openings.find((o) => o.id === "terrace")!;
    assert.deepEqual([terrace.hinge, terrace.swing, terrace.leaves], ["end", "out", 2]);
  });

  test("an item keeps what it sits on and its catalog size (they used to be dropped)", () => {
    const [desk, lamp] = fromFile(exported).items;
    assert.equal(lamp.placedOnId, "desk");
    assert.deepEqual(desk.catalogDims, { w: 160, h: 75, l: 75 });
  });

  test("a window gets no hinge or swing, a door without them gets the defaults", () => {
    const room = fromFile({
      room: { width: 300, length: 300 },
      openings: [
        { wall: "top", position: 0, width: 80, kind: "door" },
        { wall: "left", position: 0, width: 100, kind: "window", hinge: "end" },
      ],
      items: [],
    });
    const [door, win] = room.openings;
    assert.deepEqual([door.hinge, door.swing], ["start", "in"]);
    assert.equal("hinge" in win, false);
    assert.equal("swing" in win, false);
    assert.equal("leaves" in door, false);
  });

  test("a bare file gets every default, a rectangle and fresh ids", () => {
    let n = 0;
    const room = importedRoomContents(
      importSchema.parse({
        room: { width: 349.6, length: 280.2 },
        openings: [{ wall: "top", position: 10, width: 80, kind: "window" }],
        items: [{ x: 0, y: 0, width: 50, length: 50 }],
      }),
      () => `new-${++n}`,
    );
    assert.deepEqual([room.width, room.length], [350, 280]);
    assert.deepEqual(room.corners, [
      { x: 0, y: 0 },
      { x: 350, y: 0 },
      { x: 350, y: 280 },
      { x: 0, y: 280 },
    ]);
    assert.deepEqual(room.flooring, DEFAULT_FLOORING);
    assert.equal(room.ceilingHeight, DEFAULT_CEILING_HEIGHT);
    assert.deepEqual(room.wallSlopes, {});
    assert.deepEqual([room.openings[0].id, room.items[0].id], ["new-1", "new-2"]);
  });

  test("a hallway's polygon isn't flattened to its bounding rectangle", () => {
    const l = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 150 },
      { x: 150, y: 150 },
      { x: 150, y: 300 },
      { x: 0, y: 300 },
    ];
    assert.deepEqual(
      fromFile({ room: { width: 300, length: 300 }, corners: l, openings: [], items: [] }).corners,
      l,
    );
  });
});
