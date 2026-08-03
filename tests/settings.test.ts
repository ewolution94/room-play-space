import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/lib/settings";
import { HOMES_KEY, createHome, saveHomes, saveActiveHomeId } from "@/lib/homes";
import { MULTI_FLOORS_KEY, createFloor } from "@/lib/floors";
import type { PlannerSettings, RoomLayout } from "@/types/planner";

const SETTINGS_KEY = "planner-settings-v1";

// Same in-memory localStorage shim as the other store suites -- these run
// under plain Node and settings.ts guards every access behind a
// `typeof window === "undefined"` SSR check.
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

function ls() {
  return (
    globalThis as unknown as { window: { localStorage: ReturnType<typeof makeLocalStorage> } }
  ).window.localStorage;
}

beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = { localStorage: makeLocalStorage() };
});

function makeRoom(id: string): RoomLayout {
  return {
    id,
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

/** Writes a raw settings blob the way a previous build would have. */
function writeRawSettings(patch: Record<string, unknown>) {
  ls().setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...patch }));
}

describe("lastActive: the current shapes pass straight through", () => {
  test("a home target keeps its id", () => {
    writeRawSettings({ lastActive: { type: "home", homeId: "h1" } });
    assert.deepEqual(loadSettings().lastActive, { type: "home", homeId: "h1" });
  });

  test("a room target keeps both ids", () => {
    writeRawSettings({ lastActive: { type: "room", roomId: "r1", homeId: "h1" } });
    assert.deepEqual(loadSettings().lastActive, { type: "room", roomId: "r1", homeId: "h1" });
  });

  test("a single-room target never consults the homes store at all", () => {
    // No homes saved whatsoever -- a standalone room lives in its own
    // store and must resolve regardless.
    writeRawSettings({ lastActive: { type: "single-room", roomId: "r1" } });
    assert.deepEqual(loadSettings().lastActive, { type: "single-room", roomId: "r1" });
  });

  test("an unrecognisable target degrades to null, not to a broken link", () => {
    writeRawSettings({ lastActive: { type: "wat" } });
    assert.equal(loadSettings().lastActive, null);
    writeRawSettings({ lastActive: { type: "home" } }); // no id
    assert.equal(loadSettings().lastActive, null);
    writeRawSettings({ lastActive: { type: "room", roomId: 42 } });
    assert.equal(loadSettings().lastActive, null);
  });
});

// The pre-Home shapes. `{type:"floor"}` carried no id because there was
// only ever one implicit building to go back to; a `{type:"room"}` carried
// only a roomId for the same reason. Both have to keep resolving, or a
// returning user's resume card and quick-entry gate point at a route that
// no longer exists.
describe("lastActive: upgrading a pre-Home target", () => {
  test('{type:"floor"} resolves to the active home', () => {
    const a = createHome([createFloor()]);
    const b = createHome([createFloor()]);
    saveHomes([a, b]);
    saveActiveHomeId(b.id);
    writeRawSettings({ lastActive: { type: "floor" } });

    assert.deepEqual(loadSettings().lastActive, { type: "home", homeId: b.id });
  });

  test('{type:"floor"} resolves to the home the old floors migrated INTO', () => {
    // The realistic case: a returning user whose floors were never read
    // through lib/homes.ts before. Reading settings triggers the migration
    // and lands on the resulting home.
    ls().setItem(MULTI_FLOORS_KEY, JSON.stringify([createFloor([makeRoom("kitchen")])]));
    writeRawSettings({ lastActive: { type: "floor" } });

    const resolved = loadSettings().lastActive;
    assert.equal(resolved?.type, "home");
    const homes = JSON.parse(ls().getItem(HOMES_KEY)!);
    assert.equal(homes.length, 1);
    assert.equal(resolved && "homeId" in resolved && resolved.homeId, homes[0].id);
  });

  test('{type:"floor"} with no homes at all resolves to null rather than a dead link', () => {
    writeRawSettings({ lastActive: { type: "floor" } });
    assert.equal(loadSettings().lastActive, null);
  });

  // The resurrection bug, reached through this path: an empty homes store
  // is a real saved state ("I deleted everything"), so reading settings
  // must not migrate the still-present legacy key back to life.
  test('{type:"floor"} does not resurrect deleted homes from the legacy key', () => {
    ls().setItem(MULTI_FLOORS_KEY, JSON.stringify([createFloor([makeRoom("ghost")])]));
    saveHomes([]);
    writeRawSettings({ lastActive: { type: "floor" } });

    assert.equal(loadSettings().lastActive, null);
    assert.equal(ls().getItem(HOMES_KEY), "[]");
  });

  test('{type:"room"} without a homeId is resolved by finding the room', () => {
    const other = createHome([createFloor([makeRoom("elsewhere")])]);
    const owner = createHome([createFloor(), createFloor([makeRoom("target")])]);
    saveHomes([other, owner]);
    writeRawSettings({ lastActive: { type: "room", roomId: "target" } });

    assert.deepEqual(loadSettings().lastActive, {
      type: "room",
      roomId: "target",
      homeId: owner.id,
    });
  });

  test('{type:"room"} for a room that no longer exists resolves to null', () => {
    saveHomes([createHome([createFloor([makeRoom("still-here")])])]);
    writeRawSettings({ lastActive: { type: "room", roomId: "deleted" } });

    assert.equal(loadSettings().lastActive, null);
  });
});

describe("loadSettings / saveSettings", () => {
  test("nothing saved yet gives the defaults", () => {
    assert.deepEqual(loadSettings(), DEFAULT_SETTINGS);
  });

  test("carries a pre-dashboard standalone language value forward", () => {
    ls().setItem("planner-lang", "de");
    assert.equal(loadSettings().lang, "de");
  });

  test("round-trips every field", () => {
    const settings: PlannerSettings = {
      lang: "de",
      quickEntry: true,
      defaultView: "3d",
      defaultZoom: 1.5,
      collisionDefault: false,
      lastActive: { type: "home", homeId: "h1" },
    };
    saveSettings(settings);
    assert.deepEqual(loadSettings(), settings);
  });

  test("one corrupted field degrades alone, taking nothing else with it", () => {
    ls().setItem(
      SETTINGS_KEY,
      JSON.stringify({ lang: "klingon", quickEntry: true, defaultZoom: "big" }),
    );
    const loaded = loadSettings();
    assert.equal(loaded.lang, DEFAULT_SETTINGS.lang);
    assert.equal(loaded.defaultZoom, DEFAULT_SETTINGS.defaultZoom);
    assert.equal(loaded.quickEntry, true);
  });

  test("unparseable JSON falls back to the defaults", () => {
    ls().setItem(SETTINGS_KEY, "{{{");
    assert.deepEqual(loadSettings(), DEFAULT_SETTINGS);
  });
});
