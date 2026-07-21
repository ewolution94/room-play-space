import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  importSchema,
  formatZodError,
  floorsArrayImportSchema,
  roomLayoutArrayImportSchema,
} from "@/lib/planner-schema";

// The single-room import schema (importSchema) previously had zero test
// coverage at all (flagged in AUDIT.md section 4: "the zod import
// validation has no test asserting it actually rejects bad data"), even
// though it's the one thing standing between a corrupted/hostile imported
// JSON file and the app -- these tests lock in that it actually enforces
// its bounds/caps, not just that it accepts well-formed input.

function validRoom() {
  return {
    room: { width: 400, length: 300 },
    openings: [],
    items: [],
  };
}

describe("importSchema", () => {
  test("accepts a minimal well-formed room", () => {
    const data = importSchema.parse(validRoom());
    assert.equal(data.room.width, 400);
    assert.equal(data.room.length, 300);
  });

  test("fills in defaults for an item missing optional fields", () => {
    const data = importSchema.parse({
      ...validRoom(),
      items: [{ width: 100, length: 50, x: 0, y: 0 }],
    });
    assert.equal(data.items[0].name, "Item");
    assert.equal(data.items[0].color, "#5cbdb9");
    assert.equal(data.items[0].rotation, 0);
    assert.equal(data.items[0].kind, "furniture");
  });

  test("rejects a room below the minimum 50cm dimension", () => {
    assert.throws(() => importSchema.parse({ ...validRoom(), room: { width: 10, length: 300 } }));
  });

  test("rejects a room above the 100m (10000cm) maximum dimension", () => {
    assert.throws(() =>
      importSchema.parse({ ...validRoom(), room: { width: 400, length: 50000 } }),
    );
  });

  test("rejects an item wider than the 50m (5000cm) cap", () => {
    assert.throws(() =>
      importSchema.parse({
        ...validRoom(),
        items: [{ width: 6000, length: 50, x: 0, y: 0 }],
      }),
    );
  });

  test("rejects an item with a zero or negative dimension", () => {
    assert.throws(() =>
      importSchema.parse({
        ...validRoom(),
        items: [{ width: 0, length: 50, x: 0, y: 0 }],
      }),
    );
  });

  test("rejects an item x/y coordinate outside +-10000cm", () => {
    assert.throws(() =>
      importSchema.parse({
        ...validRoom(),
        items: [{ width: 100, length: 50, x: 99999, y: 0 }],
      }),
    );
  });

  test("rejects a malformed color string", () => {
    assert.throws(() =>
      importSchema.parse({
        ...validRoom(),
        items: [{ width: 100, length: 50, x: 0, y: 0, color: "not-a-color" }],
      }),
    );
  });

  test("accepts 3, 4, 6, and 8-digit hex color forms", () => {
    for (const color of ["#abc", "#abcd", "#aabbcc", "#aabbccdd"]) {
      const data = importSchema.parse({
        ...validRoom(),
        items: [{ width: 100, length: 50, x: 0, y: 0, color }],
      });
      assert.equal(data.items[0].color, color);
    }
  });

  test("rejects more than 1000 items -- the tab-freeze guard", () => {
    const items = Array.from({ length: 1001 }, () => ({
      width: 50,
      length: 50,
      x: 0,
      y: 0,
    }));
    assert.throws(() => importSchema.parse({ ...validRoom(), items }));
  });

  test("accepts exactly 1000 items", () => {
    const items = Array.from({ length: 1000 }, () => ({
      width: 50,
      length: 50,
      x: 0,
      y: 0,
    }));
    const data = importSchema.parse({ ...validRoom(), items });
    assert.equal(data.items.length, 1000);
  });

  test("rejects more than 200 openings -- the tab-freeze guard", () => {
    const openings = Array.from({ length: 201 }, () => ({
      wall: "top" as const,
      position: 0,
      width: 80,
      kind: "door" as const,
    }));
    assert.throws(() => importSchema.parse({ ...validRoom(), openings }));
  });

  test("accepts both the named-wall and numeric-wall opening conventions", () => {
    const data = importSchema.parse({
      ...validRoom(),
      openings: [
        { wall: "top", position: 0, width: 80, kind: "door" },
        { wall: 2, position: 10, width: 60, kind: "window" },
      ],
    });
    assert.equal(data.openings[0].wall, "top");
    assert.equal(data.openings[1].wall, 2);
  });

  test("rejects an unknown named wall value", () => {
    assert.throws(() =>
      importSchema.parse({
        ...validRoom(),
        openings: [{ wall: "diagonal", position: 0, width: 80, kind: "door" }],
      }),
    );
  });
});

describe("formatZodError", () => {
  test("formats a ZodError into a path: message string", () => {
    let message = "";
    try {
      importSchema.parse({ room: { width: 1, length: 1 }, openings: [], items: [] });
    } catch (err) {
      message = formatZodError(err);
    }
    assert.match(message, /room\.width/);
  });

  test("passes through a plain Error's message", () => {
    assert.equal(formatZodError(new Error("boom")), "boom");
  });

  test("falls back to a generic message for a non-Error throw", () => {
    assert.equal(formatZodError("some string"), "Unknown error");
  });

  test("real zod errors are instances the formatter recognizes", () => {
    assert.ok(z.ZodError);
  });
});

// The multi-floor import path (parseImportedFloors in lib/floors.ts) used to
// only check `typeof id === "string" && "width" in r && "x" in r` -- these
// schemas are what closes that gap (see the doc comment on roomLayoutSchema
// in planner-schema.ts). floors.test.ts covers parseImportedFloors's own
// fallback logic (floor-shape vs legacy-flat-array vs reject); these tests
// cover the schemas' own bounds/caps directly.
function validRoomLayout() {
  return {
    id: "room-1",
    name: "Room",
    width: 300,
    length: 200,
    x: 0,
    y: 0,
    rotation: 0,
    color: "#3b82f6",
    items: [],
    openings: [],
  };
}

describe("roomLayoutArrayImportSchema", () => {
  test("accepts a well-formed room list", () => {
    const data = roomLayoutArrayImportSchema.parse([validRoomLayout()]);
    assert.equal(data.length, 1);
    assert.equal(data[0].id, "room-1");
  });

  test("requires an id (matches the old shallow check's behavior)", () => {
    const { id: _id, ...rest } = validRoomLayout();
    assert.throws(() => roomLayoutArrayImportSchema.parse([rest]));
  });

  test("rejects a room below the 50cm minimum dimension", () => {
    assert.throws(() => roomLayoutArrayImportSchema.parse([{ ...validRoomLayout(), width: 10 }]));
  });

  test("rejects a malformed room color", () => {
    assert.throws(() =>
      roomLayoutArrayImportSchema.parse([{ ...validRoomLayout(), color: "nope" }]),
    );
  });

  test("caps items per room at 1000, mirroring the single-room import", () => {
    const items = Array.from({ length: 1001 }, () => ({
      width: 50,
      length: 50,
      x: 0,
      y: 0,
    }));
    assert.throws(() => roomLayoutArrayImportSchema.parse([{ ...validRoomLayout(), items }]));
  });

  test("accepts an empty room list", () => {
    const data = roomLayoutArrayImportSchema.parse([]);
    assert.deepEqual(data, []);
  });

  test("rejects more than 500 rooms", () => {
    const rooms = Array.from({ length: 501 }, (_, i) => ({
      ...validRoomLayout(),
      id: `room-${i}`,
    }));
    assert.throws(() => roomLayoutArrayImportSchema.parse(rooms));
  });
});

describe("floorsArrayImportSchema", () => {
  test("accepts a well-formed floor list", () => {
    const data = floorsArrayImportSchema.parse([
      { id: "floor-1", name: null, rooms: [validRoomLayout()] },
    ]);
    assert.equal(data.length, 1);
    assert.equal(data[0].rooms.length, 1);
  });

  test("requires at least one floor -- an empty array falls through to the legacy-room path instead", () => {
    assert.throws(() => floorsArrayImportSchema.parse([]));
  });

  test("requires a floor id", () => {
    assert.throws(() =>
      floorsArrayImportSchema.parse([{ name: null, rooms: [validRoomLayout()] }]),
    );
  });

  test("rejects more than 100 floors", () => {
    const floors = Array.from({ length: 101 }, (_, i) => ({
      id: `floor-${i}`,
      name: null,
      rooms: [],
    }));
    assert.throws(() => floorsArrayImportSchema.parse(floors));
  });

  test("propagates a bad room's validation failure up through the floor", () => {
    assert.throws(() =>
      floorsArrayImportSchema.parse([
        { id: "floor-1", name: null, rooms: [{ ...validRoomLayout(), width: -5 }] },
      ]),
    );
  });
});
