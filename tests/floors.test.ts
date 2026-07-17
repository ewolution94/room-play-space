import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  loadFloors,
  saveFloors,
  loadActiveFloorId,
  saveActiveFloorId,
  createFloor,
  defaultFloorName,
  floorDisplayName,
  parseImportedFloors,
} from "@/lib/floors";
import type { RoomLayout } from "@/types/planner";

// Minimal in-memory localStorage + window shim -- this test suite runs
// under plain Node (no jsdom, see tests/support/register.mjs), and
// floors.ts deliberately guards every read/write behind
// `typeof window === "undefined"` for SSR-safety, so it needs a real
// (if fake) `window.localStorage` to exercise at all.
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

function currentLocalStorage() {
  return (globalThis as unknown as { window: { localStorage: ReturnType<typeof makeLocalStorage> } })
    .window.localStorage;
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

describe("loadFloors", () => {
  test("returns null when nothing has ever been saved", () => {
    assert.equal(loadFloors(), null);
  });

  test("round-trips through saveFloors", () => {
    const floors = [createFloor([makeRoom()])];
    saveFloors(floors);
    const loaded = loadFloors();
    assert.deepEqual(loaded, floors);
  });

  test("migrates a legacy flat RoomLayout[] into a single un-named (auto Ground Floor) floor", () => {
    const legacyRooms = [makeRoom({ id: "a" }), makeRoom({ id: "b" })];
    currentLocalStorage().setItem("planner-multi-rooms", JSON.stringify(legacyRooms));

    const migrated = loadFloors();
    assert.ok(migrated);
    assert.equal(migrated!.length, 1);
    assert.equal(migrated![0].name, null);
    assert.equal(floorDisplayName(migrated![0], 0, "en"), "Ground Floor");
    assert.deepEqual(migrated![0].rooms, legacyRooms);
  });

  test("migration persists under the new key so a second load doesn't need the legacy key again", () => {
    const legacyRooms = [makeRoom({ id: "a" })];
    currentLocalStorage().setItem("planner-multi-rooms", JSON.stringify(legacyRooms));

    const first = loadFloors();
    currentLocalStorage().removeItem("planner-multi-rooms");
    const second = loadFloors();
    assert.deepEqual(second, first);
  });

  test("prefers the new-format key over a stale legacy key if both exist", () => {
    const current = [createFloor([makeRoom({ id: "current" })])];
    saveFloors(current);
    currentLocalStorage().setItem(
      "planner-multi-rooms",
      JSON.stringify([makeRoom({ id: "stale-legacy" })]),
    );

    const loaded = loadFloors();
    assert.deepEqual(loaded, current);
  });
});

describe("loadActiveFloorId / saveActiveFloorId", () => {
  test("falls back to the first floor when nothing saved", () => {
    const floors = [createFloor(), createFloor()];
    assert.equal(loadActiveFloorId(floors), floors[0].id);
  });

  test("falls back to the first floor when the saved id no longer exists", () => {
    const floors = [createFloor(), createFloor()];
    saveActiveFloorId("some-deleted-floor-id");
    assert.equal(loadActiveFloorId(floors), floors[0].id);
  });

  test("round-trips a valid saved id", () => {
    const floors = [createFloor(), createFloor()];
    saveActiveFloorId(floors[1].id);
    assert.equal(loadActiveFloorId(floors), floors[1].id);
  });

  test("returns empty string for an empty floor list", () => {
    assert.equal(loadActiveFloorId([]), "");
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
});
