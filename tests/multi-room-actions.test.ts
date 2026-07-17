import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  FLOOR_W,
  FLOOR_L,
  rotateRoomLayout,
  duplicateRoomLayout,
  createRoomLayout,
  createHallwayLayout,
  removeRoomLayout,
  clampRoomResize,
  generateRandomRoomLayout,
} from "@/lib/multi-room-actions";
import { obbOverlap } from "@/lib/planner-math";
import { wallSegments, buildLHallwayCorners } from "@/lib/hallway-shapes";
import type { RoomLayout } from "@/types/planner";

function makeRoom(overrides: Partial<RoomLayout> = {}): RoomLayout {
  const width = overrides.width ?? 300;
  const length = overrides.length ?? 200;
  return {
    id: overrides.id ?? "room-1",
    name: "Room",
    width,
    length,
    x: 0,
    y: 0,
    rotation: 0,
    color: "#3b82f6",
    items: [],
    openings: [{ id: "op-1", wall: "bottom", position: 10, width: 90, kind: "door" }],
    corners: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: length },
      { x: 0, y: length },
    ],
    wallColors: { top: "#eee", right: "#eee", bottom: "#eee", left: "#eee" },
    ...overrides,
  };
}

describe("rotateRoomLayout", () => {
  test("rotating swaps width and length and advances rotation by 90", () => {
    const room = makeRoom({ id: "r1", width: 300, length: 200, rotation: 0 });
    const result = rotateRoomLayout([room], "r1", true);
    const rotated = result.find((r) => r.id === "r1")!;
    assert.equal(rotated.rotation, 90);
    assert.equal(rotated.width, 200);
    assert.equal(rotated.length, 300);
  });

  test("rotation wraps around at 360", () => {
    const room = makeRoom({ id: "r1", rotation: 270 });
    const result = rotateRoomLayout([room], "r1", true);
    assert.equal(result[0].rotation, 0);
  });

  test("rotating a door on the top wall moves it to the right wall", () => {
    const room = makeRoom({
      id: "r1",
      width: 300,
      length: 200,
      openings: [{ id: "op-1", wall: "top", position: 20, width: 90, kind: "door" }],
    });
    const result = rotateRoomLayout([room], "r1", true);
    assert.equal(result[0].openings[0].wall, "right");
  });

  test("rotating an item repositions and swaps its width/length", () => {
    const room = makeRoom({
      id: "r1",
      width: 300,
      length: 200,
      items: [
        {
          id: "item-1",
          name: "Chair",
          kind: "chair",
          color: "#000",
          x: 10,
          y: 20,
          width: 40,
          length: 50,
          rotation: 0,
        },
      ],
    });
    const result = rotateRoomLayout([room], "r1", true);
    const item = result[0].items[0];
    assert.equal(item.width, 50);
    assert.equal(item.length, 40);
    assert.equal(item.rotation, 90);
  });

  test("blocks the rotation if the rotated footprint would collide with another room", () => {
    // A tall narrow room (60x300) rotates to a wide short room (300x60) --
    // place a neighbor immediately to the right so the rotated footprint
    // collides, while the original orientation does not.
    const room = makeRoom({ id: "r1", x: 0, y: 0, width: 60, length: 300, rotation: 0 });
    const neighbor = makeRoom({ id: "r2", x: 60, y: 0, width: 300, length: 300 });
    const result = rotateRoomLayout([room, neighbor], "r1", true);
    const unchanged = result.find((r) => r.id === "r1")!;
    assert.equal(unchanged.rotation, 0);
    assert.equal(unchanged.width, 60);
    assert.equal(unchanged.length, 300);
  });

  test("allows the rotation when collision detection is disabled, even if it would overlap", () => {
    const room = makeRoom({ id: "r1", x: 0, y: 0, width: 60, length: 300, rotation: 0 });
    const neighbor = makeRoom({ id: "r2", x: 60, y: 0, width: 300, length: 300 });
    const result = rotateRoomLayout([room, neighbor], "r1", false);
    const rotated = result.find((r) => r.id === "r1")!;
    assert.equal(rotated.rotation, 90);
  });

  test("leaves other rooms untouched", () => {
    const room = makeRoom({ id: "r1" });
    const other = makeRoom({ id: "r2", x: 500, y: 500 });
    const result = rotateRoomLayout([room, other], "r1", true);
    const untouched = result.find((r) => r.id === "r2")!;
    assert.deepEqual(untouched, other);
  });

  test("rebuilds corners fresh from the new width/length for a rectangular room (no stale pre-rotation shape)", () => {
    const room = makeRoom({ id: "r1", width: 300, length: 200 });
    const result = rotateRoomLayout([room], "r1", true);
    const rotated = result.find((r) => r.id === "r1")!;
    assert.deepEqual(rotated.corners, [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 300 },
      { x: 0, y: 300 },
    ]);
  });

  test("a polygon (L-shaped) room rotates its corners instead of swapping width/length by name", () => {
    const { corners } = buildLHallwayCorners(120, 300, 260, false);
    const room = makeRoom({
      id: "r1",
      width: 300,
      length: 260,
      corners,
      openings: [{ id: "op-1", wall: 3, position: 10, width: 90, kind: "door" }],
    });
    const result = rotateRoomLayout([room], "r1", true);
    const rotated = result.find((r) => r.id === "r1")!;

    // Bounding box swaps (rotating an L that's 300 wide / 260 tall by 90
    // degrees yields a shape that's 260 wide / 300 tall).
    assert.equal(rotated.width, 260);
    assert.equal(rotated.length, 300);
    assert.equal(rotated.corners!.length, 6);

    // The polygon path leaves openings completely untouched -- wall index
    // and position stay valid across rotation by construction.
    assert.deepEqual(rotated.openings, room.openings);

    // Every wall's own length is preserved under rotation (rigid transform).
    const beforeLens = wallSegments(corners).map((s) => Math.round(s.length));
    const afterLens = wallSegments(rotated.corners!).map((s) => Math.round(s.length));
    assert.deepEqual(afterLens, beforeLens);
  });

  test("a room's real rotated footprint (not a double-rotated stale box) is used in later collision checks", () => {
    // Regression test for a real bug: room-vs-room OBBs used to feed the
    // room's `rotation` field into obbCorners, but a room's rendered
    // footprint is never actually angularly rotated -- rotateRoomLayout
    // already bakes a 90 degree turn into width/length directly. Applying
    // *another* rotation on top of that already-swapped box, for collision
    // purposes only, produced a bogus box that didn't match what was
    // actually on screen -- in practice this showed up as "collision
    // worked, then I rotated a room and it stopped working, like it was
    // still using the pre-rotation box."
    //
    // A starts tall & narrow (60x300) and gets rotated once, becoming wide
    // & short (300x60) at the same top-left anchor -- its real footprint
    // is now x:[0,300], y:[0,60].
    const roomA = makeRoom({ id: "a", x: 0, y: 0, width: 60, length: 300, rotation: 0 });
    const afterFirstRotation = rotateRoomLayout([roomA], "a", true);
    const a = afterFirstRotation.find((r) => r.id === "a")!;
    assert.equal(a.rotation, 90);
    assert.equal(a.width, 300);
    assert.equal(a.length, 60);

    // C sits at x:[20,70], y:[0,50] -- squarely inside A's real footprint,
    // but outside the bogus box the old buggy math would have computed
    // (re-rotating A's already-swapped 300x60 box by 90 degrees around its
    // center gives a box spanning roughly x:[120,180], y:[-120,180], which
    // C deliberately sits nowhere near).
    const roomC = makeRoom({ id: "c", x: 20, y: 0, width: 50, length: 50, rotation: 0 });
    const result = rotateRoomLayout([a, roomC], "c", true);
    const c = result.find((r) => r.id === "c")!;
    assert.equal(c.rotation, 0);
  });

  test("a colliding rotation is blocked the same way for polygon rooms as for rectangles", () => {
    // Bounding box is 300 wide x 260 tall before rotating, 260 wide x 300
    // tall after. A neighbor placed just below the pre-rotation bbox (with
    // a 10cm gap) doesn't collide before rotating, but the taller
    // post-rotation bbox reaches down into it.
    const { corners } = buildLHallwayCorners(120, 300, 260, false);
    const room = makeRoom({ id: "r1", x: 0, y: 0, width: 300, length: 260, corners });
    const neighbor = makeRoom({ id: "r2", x: 0, y: 270, width: 300, length: 100 });
    const result = rotateRoomLayout([room, neighbor], "r1", true);
    const unchanged = result.find((r) => r.id === "r1")!;
    assert.equal(unchanged.rotation, 0);
    assert.equal(unchanged.width, 300);
    assert.equal(unchanged.length, 260);
  });
});

describe("createHallwayLayout", () => {
  test("a straight hallway is a plain rectangle with doors on both short ends", () => {
    const hallway = createHallwayLayout([], {
      name: "Hallway",
      shape: "straight",
      armWidth: 120,
      legX: 400,
      legY: 0,
      color: "#a8a29e",
    });
    assert.equal(hallway.width, 400);
    assert.equal(hallway.length, 120);
    assert.equal(hallway.corners!.length, 4);
    assert.equal(hallway.roomKind, "hallway");
    assert.equal(hallway.openings.length, 2);
    assert.ok(hallway.openings.every((o) => o.kind === "door"));
    assert.deepEqual(
      hallway.openings.map((o) => o.wall).sort(),
      ["left", "right"],
    );
  });

  test("an L-shaped hallway has 6 corners and a door on each of the two end walls", () => {
    const hallway = createHallwayLayout([], {
      name: "Hallway",
      shape: "l",
      armWidth: 120,
      legX: 300,
      legY: 300,
      color: "#a8a29e",
    });
    assert.equal(hallway.corners!.length, 6);
    assert.equal(hallway.openings.length, 2);
    assert.deepEqual(
      hallway.openings.map((o) => o.wall).sort(),
      [0, 3],
    );
    // Each door should actually fit within its (armWidth-long) wall.
    for (const o of hallway.openings) {
      assert.ok(o.width <= 120);
      assert.ok(o.position >= 0);
      assert.ok(o.position + o.width <= 120);
    }
  });

  test("a T-shaped hallway has 8 corners and a door on each of the three end walls", () => {
    const hallway = createHallwayLayout([], {
      name: "Hallway",
      shape: "t",
      armWidth: 120,
      legX: 360,
      legY: 200,
      color: "#a8a29e",
    });
    assert.equal(hallway.corners!.length, 8);
    assert.equal(hallway.openings.length, 3);
    assert.deepEqual(
      hallway.openings.map((o) => o.wall).sort(),
      [1, 4, 7],
    );
  });

  test("l-mirrored produces a different (but same-size) shape than l", () => {
    const a = createHallwayLayout([], {
      name: "A",
      shape: "l",
      armWidth: 120,
      legX: 300,
      legY: 300,
      color: "#000",
    });
    const b = createHallwayLayout([], {
      name: "B",
      shape: "l-mirrored",
      armWidth: 120,
      legX: 300,
      legY: 300,
      color: "#000",
    });
    assert.equal(a.width, b.width);
    assert.equal(a.length, b.length);
    assert.notDeepEqual(a.corners, b.corners);
  });

  test("auto-placed hallway does not collide with an existing room", () => {
    const existing = createRoomLayout([], { name: "A", width: 500, length: 500, color: "#000" });
    const hallway = createHallwayLayout([existing], {
      name: "Hallway",
      shape: "straight",
      armWidth: 120,
      legX: 400,
      legY: 0,
      color: "#a8a29e",
    });
    assert.equal(
      obbOverlap(
        { x: existing.x, y: existing.y, width: existing.width, length: existing.length, rotation: 0 },
        { x: hallway.x, y: hallway.y, width: hallway.width, length: hallway.length, rotation: 0 },
      ),
      false,
    );
  });
});

describe("createRoomLayout", () => {
  test("creates a room with the requested name/width/length/color", () => {
    const room = createRoomLayout([], {
      name: "Kitchen",
      width: 250,
      length: 200,
      color: "#f59e0b",
    });
    assert.equal(room.name, "Kitchen");
    assert.equal(room.width, 250);
    assert.equal(room.length, 200);
    assert.equal(room.color, "#f59e0b");
    assert.equal(room.rotation, 0);
    assert.equal(room.items.length, 0);
    assert.equal(room.openings.length, 1);
  });

  test("places the room at explicit x/y when given", () => {
    const room = createRoomLayout([], {
      name: "R",
      width: 100,
      length: 100,
      color: "#000",
      x: 42,
      y: 77,
    });
    assert.equal(room.x, 42);
    assert.equal(room.y, 77);
  });

  test("auto-placed room does not collide with existing rooms", () => {
    const existing = createRoomLayout([], { name: "A", width: 500, length: 500, color: "#000" });
    const next = createRoomLayout([existing], {
      name: "B",
      width: 200,
      length: 200,
      color: "#111",
    });
    assert.equal(
      obbOverlap(
        {
          x: existing.x,
          y: existing.y,
          width: existing.width,
          length: existing.length,
          rotation: 0,
        },
        { x: next.x, y: next.y, width: next.width, length: next.length, rotation: 0 },
      ),
      false,
    );
  });

  test("generates unique ids across successive calls", () => {
    const a = createRoomLayout([], { name: "A", width: 100, length: 100, color: "#000" });
    const b = createRoomLayout([a], { name: "B", width: 100, length: 100, color: "#000" });
    assert.notEqual(a.id, b.id);
  });
});

describe("duplicateRoomLayout", () => {
  test("returns null for a non-existent room id", () => {
    const result = duplicateRoomLayout([], "nope", "en");
    assert.equal(result, null);
  });

  test("duplicate has a different id but the same size", () => {
    const room = createRoomLayout([], {
      name: "Living Room",
      width: 300,
      length: 250,
      color: "#3b82f6",
    });
    const dup = duplicateRoomLayout([room], room.id, "en")!;
    assert.notEqual(dup.id, room.id);
    assert.equal(dup.width, room.width);
    assert.equal(dup.length, room.length);
  });

  test("duplicate name is suffixed appropriately per language", () => {
    const room = createRoomLayout([], {
      name: "Bedroom",
      width: 300,
      length: 250,
      color: "#3b82f6",
    });
    const dupEn = duplicateRoomLayout([room], room.id, "en")!;
    const dupDe = duplicateRoomLayout([room], room.id, "de")!;
    assert.equal(dupEn.name, "Bedroom (Copy)");
    assert.equal(dupDe.name, "Bedroom (Kopie)");
  });

  test("duplicate is placed in a spot that does not collide with the source", () => {
    const room = createRoomLayout([], {
      name: "R",
      width: 300,
      length: 200,
      color: "#000",
      x: 100,
      y: 100,
    });
    const dup = duplicateRoomLayout([room], room.id, "en")!;
    assert.equal(
      obbOverlap(
        { x: room.x, y: room.y, width: room.width, length: room.length, rotation: 0 },
        { x: dup.x, y: dup.y, width: dup.width, length: dup.length, rotation: 0 },
      ),
      false,
    );
  });

  test("duplicating deep-copies items/openings rather than sharing references", () => {
    const room = createRoomLayout([], { name: "R", width: 300, length: 200, color: "#000" });
    const dup = duplicateRoomLayout([room], room.id, "en")!;
    assert.notEqual(dup.openings, room.openings);
    assert.deepEqual(
      dup.openings.map((o) => ({ ...o, id: undefined })),
      room.openings.map((o) => ({ ...o, id: undefined })),
    );
  });
});

describe("removeRoomLayout", () => {
  test("removes the room with the matching id", () => {
    const a = makeRoom({ id: "a" });
    const b = makeRoom({ id: "b" });
    const result = removeRoomLayout([a, b], "a");
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "b");
  });

  test("is a no-op if the id doesn't exist", () => {
    const a = makeRoom({ id: "a" });
    const result = removeRoomLayout([a], "missing");
    assert.equal(result.length, 1);
  });
});

describe("clampRoomResize", () => {
  test("allows the requested size when there is no collision", () => {
    const room = makeRoom({ id: "r1", x: 0, y: 0, width: 100, length: 100 });
    const result = clampRoomResize(room, 200, 200, [], true);
    assert.deepEqual(result, { width: 200, length: 200 });
  });

  test("allows any size when collision detection is disabled", () => {
    const room = makeRoom({ id: "r1", x: 0, y: 0, width: 100, length: 100 });
    const neighbor = makeRoom({ id: "r2", x: 100, y: 0, width: 100, length: 100 });
    const result = clampRoomResize(room, 500, 500, [neighbor], false);
    assert.deepEqual(result, { width: 500, length: 500 });
  });

  test("clamps growth that would collide with a neighboring room", () => {
    const room = makeRoom({ id: "r1", x: 0, y: 0, width: 100, length: 100 });
    const neighbor = makeRoom({ id: "r2", x: 150, y: 0, width: 100, length: 100 });
    // Requesting growth to 300 wide would smash into the neighbor at x=150.
    const result = clampRoomResize(room, 300, 100, [neighbor], true);
    assert.ok(result.width < 300);
    assert.ok(result.width >= 100);
    // The clamped size should not actually collide.
    assert.equal(
      obbOverlap(
        {
          x: room.x,
          y: room.y,
          width: result.width,
          length: result.length,
          rotation: room.rotation,
        },
        {
          x: neighbor.x,
          y: neighbor.y,
          width: neighbor.width,
          length: neighbor.length,
          rotation: neighbor.rotation,
        },
      ),
      false,
    );
  });

  test("refuses growth entirely if the room's current size already collides", () => {
    const room = makeRoom({ id: "r1", x: 0, y: 0, width: 100, length: 100 });
    // Neighbor already overlapping the room's *current* size.
    const neighbor = makeRoom({ id: "r2", x: 50, y: 0, width: 100, length: 100 });
    const result = clampRoomResize(room, 300, 300, [neighbor], true);
    assert.deepEqual(result, { width: room.width, length: room.length });
  });

  test("shrinking never gets clamped since it can't introduce a new collision", () => {
    const room = makeRoom({ id: "r1", x: 0, y: 0, width: 200, length: 200 });
    const neighbor = makeRoom({ id: "r2", x: 500, y: 500, width: 100, length: 100 });
    const result = clampRoomResize(room, 50, 50, [neighbor], true);
    assert.deepEqual(result, { width: 50, length: 50 });
  });
});

describe("generateRandomRoomLayout", () => {
  test("generates 2-3 rooms", () => {
    const rooms = generateRandomRoomLayout("en");
    assert.ok(rooms.length >= 2 && rooms.length <= 3);
  });

  test("all generated rooms are within the floor bounds", () => {
    const rooms = generateRandomRoomLayout("en");
    for (const r of rooms) {
      assert.ok(r.x >= 0);
      assert.ok(r.y >= 0);
      assert.ok(r.x + r.width <= FLOOR_W);
      assert.ok(r.y + r.length <= FLOOR_L);
    }
  });

  test("no two generated rooms overlap", () => {
    const rooms = generateRandomRoomLayout("en");
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i];
        const b = rooms[j];
        assert.equal(
          obbOverlap(
            { x: a.x, y: a.y, width: a.width, length: a.length, rotation: 0 },
            { x: b.x, y: b.y, width: b.width, length: b.length, rotation: 0 },
          ),
          false,
          `rooms ${a.name} and ${b.name} overlap`,
        );
      }
    }
  });

  test("room names are localized for German", () => {
    const rooms = generateRandomRoomLayout("de");
    const germanNames = [
      "Wohnzimmer",
      "Home-Office",
      "Schlafzimmer",
      "Küche",
      "Badezimmer",
      "Esszimmer",
    ];
    for (const r of rooms) {
      assert.ok(germanNames.includes(r.name), `unexpected name: ${r.name}`);
    }
  });

  test("every generated room has a unique id", () => {
    const rooms = generateRandomRoomLayout("en");
    const ids = new Set(rooms.map((r) => r.id));
    assert.equal(ids.size, rooms.length);
  });
});
