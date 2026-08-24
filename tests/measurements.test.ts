import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { measureItems, measureRoom, measureHome } from "@/lib/measurements";
import { getDefaultHeight } from "@/lib/planner-presets";
import type { Home, Item, RoomLayout } from "@/types/planner";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: crypto.randomUUID(),
    name: "Desk",
    kind: "furniture",
    color: "#3b82f6",
    x: 0,
    y: 0,
    width: 100,
    length: 60,
    rotation: 0,
    ...overrides,
  };
}

function makeRoom(overrides: Partial<RoomLayout> = {}): RoomLayout {
  return {
    id: crypto.randomUUID(),
    name: "Living Room",
    width: 400,
    length: 350,
    x: 0,
    y: 0,
    rotation: 0,
    color: "#fff",
    items: [],
    openings: [],
    ...overrides,
  };
}

describe("measureItems", () => {
  test("groups items with identical name and size into one row with a count", () => {
    const rows = measureItems([
      makeItem({ name: "Chair", width: 45, length: 45, height: 80 }),
      makeItem({ name: "Chair", width: 45, length: 45, height: 80 }),
      makeItem({ name: "Chair", width: 45, length: 45, height: 80 }),
    ]);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], { name: "Chair", width: 45, length: 45, height: 80, count: 3 });
  });

  test("keeps items with the same name but a different size as separate rows", () => {
    const rows = measureItems([
      makeItem({ name: "Chair", width: 45, length: 45, height: 80 }),
      makeItem({ name: "Chair", width: 50, length: 45, height: 80 }),
    ]);
    assert.equal(rows.length, 2);
  });

  test("rounds dimensions to whole cm before grouping, matching the Elements list's display precision", () => {
    const rows = measureItems([
      makeItem({ name: "Table", width: 100.2, length: 60.4, height: 74.6 }),
      makeItem({ name: "Table", width: 99.6, length: 60.3, height: 75.4 }),
    ]);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], { name: "Table", width: 100, length: 60, height: 75, count: 2 });
  });

  test("falls back to getDefaultHeight exactly like the canvas/Elements list/3D view/slope check do", () => {
    const item = makeItem({ name: "Sofa", icon: "sofa", height: undefined });
    const rows = measureItems([item]);
    assert.equal(rows[0].height, Math.round(getDefaultHeight("sofa", "furniture")));
  });

  test("an explicit height overrides the default, same as everywhere else", () => {
    const item = makeItem({ name: "Sofa", icon: "sofa", height: 55 });
    const rows = measureItems([item]);
    assert.equal(rows[0].height, 55);
  });

  test("an empty room produces no rows", () => {
    assert.deepEqual(measureItems([]), []);
  });

  test("sorts rows by name, then length, then width, then height for a stable readable order", () => {
    const rows = measureItems([
      makeItem({ name: "Bed", width: 160, length: 200, height: 45 }),
      makeItem({ name: "Armchair", width: 80, length: 80, height: 80 }),
      makeItem({ name: "Armchair", width: 70, length: 70, height: 80 }),
    ]);
    assert.deepEqual(
      rows.map((r) => `${r.name} ${r.width}x${r.length}`),
      ["Armchair 70x70", "Armchair 80x80", "Bed 160x200"],
    );
  });
});

describe("measureRoom", () => {
  test("carries the room's own id and name alongside its grouped rows", () => {
    const room = makeRoom({
      id: "room-1",
      name: "Bedroom",
      items: [makeItem({ name: "Bed", width: 160, length: 200, height: 45 })],
    });
    const result = measureRoom(room);
    assert.equal(result.roomId, "room-1");
    assert.equal(result.roomName, "Bedroom");
    assert.equal(result.rows.length, 1);
  });
});

describe("measureHome", () => {
  test("omits rooms with no items rather than listing an empty section", () => {
    const home: Home = {
      id: "home-1",
      name: "My Home",
      floors: [
        {
          id: "floor-1",
          name: null,
          rooms: [
            makeRoom({ name: "Empty Room", items: [] }),
            makeRoom({ name: "Bedroom", items: [makeItem({ name: "Bed" })] }),
          ],
        },
      ],
    };
    const result = measureHome(home, "en");
    assert.equal(result.length, 1);
    assert.equal(result[0].roomName, "Bedroom");
  });

  test("a single-floor home leaves room names unqualified", () => {
    const home: Home = {
      id: "home-1",
      name: "My Home",
      floors: [
        {
          id: "floor-1",
          name: null,
          rooms: [makeRoom({ name: "Bedroom", items: [makeItem({ name: "Bed" })] })],
        },
      ],
    };
    const result = measureHome(home, "en");
    assert.equal(result[0].roomName, "Bedroom");
  });

  test("a multi-floor home qualifies same-named rooms on different floors so they aren't merged", () => {
    const home: Home = {
      id: "home-1",
      name: "My Home",
      floors: [
        {
          id: "floor-0",
          name: null,
          rooms: [makeRoom({ id: "r0", name: "Bedroom", items: [makeItem({ name: "Bed" })] })],
        },
        {
          id: "floor-1",
          name: null,
          rooms: [makeRoom({ id: "r1", name: "Bedroom", items: [makeItem({ name: "Bed" })] })],
        },
      ],
    };
    const result = measureHome(home, "en");
    assert.equal(result.length, 2);
    assert.notEqual(result[0].roomName, result[1].roomName);
    assert.ok(result[0].roomName.includes("Bedroom"));
    assert.ok(result[1].roomName.includes("Bedroom"));
  });
});
