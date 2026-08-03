import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createFloor, defaultFloorName, floorDisplayName, parseImportedFloors } from "@/lib/floors";
import type { RoomLayout } from "@/types/planner";

// Floors have no store of their own any more -- they belong to a Home, and
// loading/saving/migrating them is tests/homes.test.ts's subject (including
// every regression around an empty collection being a real saved state).
// What's left here is what floors.ts still owns: naming, construction, and
// parsing an imported file.
//
// Minimal in-memory localStorage + window shim -- this test suite runs
// under plain Node (no jsdom, see tests/support/register.mjs), and modules
// under test guard every read/write behind `typeof window === "undefined"`
// for SSR-safety, so they need a real (if fake) `window.localStorage`.
function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = { localStorage: makeLocalStorage() };
});

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
    openings: [],
    ...overrides,
  };
}

describe("defaultFloorName", () => {
  test("index 0 is Ground Floor / Erdgeschoss", () => {
    assert.equal(defaultFloorName(0, "en"), "Ground Floor");
    assert.equal(defaultFloorName(0, "de"), "Erdgeschoss");
  });

  test("English counts ordinal floors above ground", () => {
    assert.equal(defaultFloorName(1, "en"), "1st Floor");
    assert.equal(defaultFloorName(2, "en"), "2nd Floor");
    assert.equal(defaultFloorName(3, "en"), "3rd Floor");
    assert.equal(defaultFloorName(4, "en"), "4th Floor");
  });

  test("English ordinal suffix handles 11th-13th correctly", () => {
    assert.equal(defaultFloorName(11, "en"), "11th Floor");
    assert.equal(defaultFloorName(12, "en"), "12th Floor");
    assert.equal(defaultFloorName(13, "en"), "13th Floor");
    assert.equal(defaultFloorName(21, "en"), "21st Floor");
  });

  test("German uses Obergeschoss, the floor-above-ground convention", () => {
    assert.equal(defaultFloorName(1, "de"), "1. Obergeschoss");
    assert.equal(defaultFloorName(2, "de"), "2. Obergeschoss");
    assert.equal(defaultFloorName(10, "de"), "10. Obergeschoss");
  });
});

describe("floorDisplayName", () => {
  test("an un-renamed floor (name: null) shows the position-based default", () => {
    const floor = createFloor();
    assert.equal(floorDisplayName(floor, 0, "en"), "Ground Floor");
    assert.equal(floorDisplayName(floor, 0, "de"), "Erdgeschoss");
    assert.equal(floorDisplayName(floor, 2, "en"), "2nd Floor");
    assert.equal(floorDisplayName(floor, 2, "de"), "2. Obergeschoss");
  });

  test("a renamed floor always shows its custom name, regardless of language", () => {
    const floor = { ...createFloor(), name: "Kids' Room Floor" };
    assert.equal(floorDisplayName(floor, 0, "en"), "Kids' Room Floor");
    assert.equal(floorDisplayName(floor, 0, "de"), "Kids' Room Floor");
  });
});

describe("createFloor", () => {
  test("builds an un-named floor (name: null) with a fresh id and the given rooms", () => {
    const rooms = [makeRoom()];
    const floor = createFloor(rooms);
    assert.equal(floor.name, null);
    assert.equal(floor.rooms, rooms);
    assert.equal(typeof floor.id, "string");
    assert.ok(floor.id.length > 0);
  });

  test("defaults to an empty rooms array", () => {
    const floor = createFloor();
    assert.deepEqual(floor.rooms, []);
  });

  test("two floors never collide on id", () => {
    const a = createFloor();
    const b = createFloor();
    assert.notEqual(a.id, b.id);
  });
});

describe("parseImportedFloors", () => {
  test("accepts the current multi-floor export shape as-is", () => {
    const floors = [createFloor([makeRoom()])];
    const result = parseImportedFloors(floors);
    assert.deepEqual(result, floors);
  });

  test("wraps a legacy flat RoomLayout[] export into one un-named floor", () => {
    const legacyRooms = [makeRoom({ id: "a" }), makeRoom({ id: "b" })];
    const result = parseImportedFloors(legacyRooms);
    assert.ok(result);
    assert.equal(result!.length, 1);
    assert.equal(result![0].name, null);
    assert.deepEqual(result![0].rooms, legacyRooms);
  });

  test("rejects garbage input", () => {
    assert.equal(parseImportedFloors({ not: "valid" }), null);
    assert.equal(parseImportedFloors(null), null);
    assert.equal(parseImportedFloors("not even an array"), null);
  });

  test("an empty array is treated as one empty legacy floor, not rejected", () => {
    const result = parseImportedFloors([]);
    assert.ok(result);
    assert.equal(result!.length, 1);
    assert.deepEqual(result![0].rooms, []);
  });

  describe("the { floors, customCatalog } bundled-export wrapper", () => {
    test("unwraps floors from the wrapped shape (current multi-floor format inside)", () => {
      const floors = [createFloor([makeRoom()])];
      const result = parseImportedFloors({
        floors,
        customCatalog: [{ id: "x", nameEn: "X", nameDe: "X", w: 10, l: 10, color: "#fff" }],
      });
      assert.deepEqual(result, floors);
    });

    test("unwraps floors from the wrapped shape when the inner value is the legacy flat RoomLayout[] format", () => {
      const legacyRooms = [makeRoom({ id: "a" })];
      const result = parseImportedFloors({ floors: legacyRooms, customCatalog: [] });
      assert.ok(result);
      assert.equal(result!.length, 1);
      assert.deepEqual(result![0].rooms, legacyRooms);
    });

    test("works with no customCatalog key at all (just a { floors } wrapper)", () => {
      const floors = [createFloor([makeRoom()])];
      const result = parseImportedFloors({ floors });
      assert.deepEqual(result, floors);
    });

    test("an invalid inner floors value still rejects, same as an invalid bare array would", () => {
      assert.equal(parseImportedFloors({ floors: { not: "an array" } }), null);
      assert.equal(parseImportedFloors({ floors: "nope" }), null);
    });

    test("a plain object with no 'floors' key at all is NOT treated as the wrapper -- falls through to the existing rejection path unchanged", () => {
      assert.equal(parseImportedFloors({ not: "valid" }), null);
    });
  });
});
