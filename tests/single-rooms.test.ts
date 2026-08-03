import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  SINGLE_ROOMS_KEY,
  loadSingleRooms,
  saveSingleRooms,
  findSingleRoom,
  addSingleRoom,
  updateSingleRoom,
  removeSingleRoom,
} from "@/lib/single-rooms";
import { createFloor } from "@/lib/floors";
import { HOMES_KEY, createHome, loadHomes, saveHomes } from "@/lib/homes";
import type { RoomLayout } from "@/types/planner";

// Same in-memory localStorage shim as floors.test.ts -- these tests run
// under plain Node (no jsdom, see tests/support/register.mjs) and
// single-rooms.ts guards every read/write behind `typeof window ===
// "undefined"` for SSR-safety, so it needs a real (if fake)
// `window.localStorage` to exercise at all.
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
  return (
    globalThis as unknown as { window: { localStorage: ReturnType<typeof makeLocalStorage> } }
  ).window.localStorage;
}

beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = { localStorage: makeLocalStorage() };
});

function makeRoom(overrides: Partial<RoomLayout> = {}): RoomLayout {
  return {
    id: overrides.id ?? "room-1",
    name: "Room",
    width: 300,
    length: 200,
    x: 0,
    y: 0,
    rotation: 0,
    color: "#3b82f6",
    items: [],
    openings: [],
    ...overrides,
  };
}

describe("loadSingleRooms", () => {
  test("returns an empty array when nothing is saved", () => {
    assert.deepEqual(loadSingleRooms(), []);
  });

  test("round-trips saved rooms", () => {
    const rooms = [makeRoom({ id: "a" }), makeRoom({ id: "b" })];
    saveSingleRooms(rooms);
    assert.deepEqual(
      loadSingleRooms().map((r) => r.id),
      ["a", "b"],
    );
  });

  test("falls back to empty on unparseable or wrong-shaped data", () => {
    currentLocalStorage().setItem(SINGLE_ROOMS_KEY, "{ not json");
    assert.deepEqual(loadSingleRooms(), []);
    currentLocalStorage().setItem(SINGLE_ROOMS_KEY, JSON.stringify([{ nope: true }]));
    assert.deepEqual(loadSingleRooms(), []);
  });
});

describe("addSingleRoom", () => {
  test("appends to the existing list", () => {
    addSingleRoom(makeRoom({ id: "a" }));
    addSingleRoom(makeRoom({ id: "b" }));
    assert.deepEqual(
      loadSingleRooms().map((r) => r.id),
      ["a", "b"],
    );
  });

  test("pins the overview-grid position/rotation a standalone room has no use for", () => {
    addSingleRoom(makeRoom({ id: "a", x: 420, y: 690, rotation: 90 }));
    const saved = loadSingleRooms()[0];
    assert.equal(saved.x, 0);
    assert.equal(saved.y, 0);
    assert.equal(saved.rotation, 0);
  });
});

describe("findSingleRoom", () => {
  test("finds a saved room by id, null for anything else", () => {
    addSingleRoom(makeRoom({ id: "a", name: "Studio" }));
    assert.equal(findSingleRoom("a")?.name, "Studio");
    assert.equal(findSingleRoom("nope"), null);
  });
});

describe("updateSingleRoom", () => {
  test("patches only the named room", () => {
    addSingleRoom(makeRoom({ id: "a" }));
    addSingleRoom(makeRoom({ id: "b" }));
    updateSingleRoom("a", { width: 555 });
    assert.equal(findSingleRoom("a")?.width, 555);
    assert.equal(findSingleRoom("b")?.width, 300);
  });

  // The editor's save-back effect (use-room-planner.ts) fires on every
  // state change, so a room deleted in another tab must not be resurrected
  // by the next keystroke in this one.
  test("is a no-op for a room that is not in the store", () => {
    addSingleRoom(makeRoom({ id: "a" }));
    updateSingleRoom("ghost", { width: 555 });
    assert.equal(loadSingleRooms().length, 1);
    assert.equal(findSingleRoom("ghost"), null);
  });
});

describe("removeSingleRoom", () => {
  test("removes only the named room", () => {
    addSingleRoom(makeRoom({ id: "a" }));
    addSingleRoom(makeRoom({ id: "b" }));
    removeSingleRoom("a");
    assert.deepEqual(
      loadSingleRooms().map((r) => r.id),
      ["b"],
    );
  });
});

// The whole point of this module: a standalone room is not a one-room
// floor of a home. Neither store may ever see the other's content -- that
// conflation is exactly what made "create a single room" litter the floor
// switcher with a new floor every time.
describe("isolation from the homes store", () => {
  test("saving single rooms leaves the homes store untouched", () => {
    saveHomes([createHome([createFloor([makeRoom({ id: "floor-room" })])])]);
    addSingleRoom(makeRoom({ id: "standalone" }));

    const homes = loadHomes();
    assert.equal(homes?.length, 1);
    assert.deepEqual(
      homes?.[0].floors[0].rooms.map((r) => r.id),
      ["floor-room"],
    );
    assert.deepEqual(
      loadSingleRooms().map((r) => r.id),
      ["standalone"],
    );
  });

  test("homes and single rooms use different storage keys", () => {
    assert.notEqual(SINGLE_ROOMS_KEY, HOMES_KEY);
    addSingleRoom(makeRoom({ id: "standalone" }));
    assert.equal(currentLocalStorage().getItem(HOMES_KEY), null);
    assert.ok(currentLocalStorage().getItem(SINGLE_ROOMS_KEY));
  });

  test("a room inside a home is invisible to the single-room store", () => {
    saveHomes([createHome([createFloor([makeRoom({ id: "floor-room" })])])]);
    assert.deepEqual(loadSingleRooms(), []);
    assert.equal(findSingleRoom("floor-room"), null);
  });
});
