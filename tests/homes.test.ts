import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  HOMES_KEY,
  ACTIVE_HOME_ID_KEY,
  isHomeArray,
  loadHomes,
  saveHomes,
  createHome,
  findHome,
  addHome,
  updateHome,
  removeHome,
  findHomeIdForRoom,
  defaultHomeName,
  homeDisplayName,
  countRooms,
  countItems,
  loadActiveHomeId,
  saveActiveHomeId,
  loadActiveFloorId,
  saveActiveFloorId,
  parseImportedHome,
  withFreshIds,
} from "@/lib/homes";
import { MULTI_FLOORS_KEY, createFloor } from "@/lib/floors";
import type { Floor, Home, RoomLayout } from "@/types/planner";

const LEGACY_ROOMS_KEY = "planner-multi-rooms";

// Same in-memory localStorage shim as floors.test.ts / single-rooms.test.ts
// -- these run under plain Node, and homes.ts guards every access behind a
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

function makeFloor(id: string, rooms: RoomLayout[] = []): Floor {
  return { id, name: null, rooms };
}

describe("isHomeArray", () => {
  test("accepts an empty array -- an empty store is a real saved state", () => {
    // The single most important assertion in this file. Requiring length > 0
    // is what made deleted floors resurrect on every load, twice.
    assert.equal(isHomeArray([]), true);
  });

  test("accepts well-formed homes, with or without a custom name", () => {
    assert.equal(isHomeArray([{ id: "a", name: null, floors: [] }]), true);
    assert.equal(isHomeArray([{ id: "a", name: "Flat", floors: [] }]), true);
  });

  test("rejects shapes that aren't ours", () => {
    assert.equal(isHomeArray(null), false);
    assert.equal(isHomeArray({}), false);
    assert.equal(isHomeArray([{ id: "a", name: null }]), false, "no floors array");
    assert.equal(isHomeArray([{ name: null, floors: [] }]), false, "no id");
    assert.equal(isHomeArray([{ id: 1, name: null, floors: [] }]), false, "non-string id");
  });
});

describe("loadHomes -- migration", () => {
  test("returns null when no generation has anything saved", () => {
    assert.equal(loadHomes(), null);
  });

  test("reads the current key back verbatim", () => {
    const homes = [createHome([makeFloor("f1")])];
    saveHomes(homes);
    assert.deepEqual(loadHomes(), homes);
  });

  test("a deliberately-emptied store stays empty and is NOT null", () => {
    saveHomes([]);
    assert.deepEqual(loadHomes(), [], "an empty store is a real answer, not 'nothing saved'");
  });

  test("**the resurrection test**: empty homes alongside populated legacy floors stays empty", () => {
    // This is the bug that shipped twice. A user who deletes everything must
    // not have their old building come back on the next page load -- and it
    // is invisible on a cleared profile, because clearing wipes the legacy
    // key that triggers it.
    ls().setItem(MULTI_FLOORS_KEY, JSON.stringify([makeFloor("ghost", [makeRoom()])]));
    ls().setItem(LEGACY_ROOMS_KEY, JSON.stringify([makeRoom({ id: "older-ghost" })]));
    saveHomes([]);

    assert.deepEqual(loadHomes(), [], "the ghost must stay dead");
    // ...and repeatedly, since the original bug re-saved on every load.
    assert.deepEqual(loadHomes(), []);
    assert.deepEqual(loadHomes(), []);
  });

  test("migrates a Floor[] building into exactly ONE home", () => {
    const floors = [makeFloor("f1", [makeRoom({ id: "r1" })]), makeFloor("f2")];
    ls().setItem(MULTI_FLOORS_KEY, JSON.stringify(floors));

    const homes = loadHomes();
    assert.equal(homes?.length, 1, "two floors are two storeys of ONE home, not two homes");
    assert.equal(homes![0].floors.length, 2);
    assert.deepEqual(
      homes![0].floors.map((f) => f.id),
      ["f1", "f2"],
      "floor order and ids are preserved",
    );
  });

  test("the floors migration persists, so it only happens once", () => {
    ls().setItem(MULTI_FLOORS_KEY, JSON.stringify([makeFloor("f1")]));
    const first = loadHomes();
    assert.ok(ls().getItem(HOMES_KEY), "migrated shape was written");
    assert.deepEqual(loadHomes(), first, "second read is stable, not re-migrated");
  });

  test("migration is non-destructive -- the old keys are left alone", () => {
    // Rolling this change back must not lose anyone's data, and nothing in
    // this app ever deletes a user's saved rooms.
    const floors = [makeFloor("f1", [makeRoom()])];
    ls().setItem(MULTI_FLOORS_KEY, JSON.stringify(floors));
    loadHomes();
    assert.deepEqual(JSON.parse(ls().getItem(MULTI_FLOORS_KEY)!), floors);
  });

  test("an EMPTY legacy building migrates to zero homes, not one empty home", () => {
    // "I deleted every floor" has to survive the migration intact.
    ls().setItem(MULTI_FLOORS_KEY, JSON.stringify([]));
    assert.deepEqual(loadHomes(), []);
  });

  test("migrates the pre-floors RoomLayout[] key into one home with one floor", () => {
    ls().setItem(
      LEGACY_ROOMS_KEY,
      JSON.stringify([makeRoom({ id: "r1" }), makeRoom({ id: "r2" })]),
    );
    const homes = loadHomes();
    assert.equal(homes?.length, 1);
    assert.equal(homes![0].floors.length, 1);
    assert.deepEqual(
      homes![0].floors[0].rooms.map((r) => r.id),
      ["r1", "r2"],
    );
  });

  test("prefers the newer generation when several are present", () => {
    ls().setItem(LEGACY_ROOMS_KEY, JSON.stringify([makeRoom({ id: "oldest" })]));
    ls().setItem(MULTI_FLOORS_KEY, JSON.stringify([makeFloor("f1", [makeRoom({ id: "newer" })])]));
    saveHomes([createHome([makeFloor("current", [makeRoom({ id: "newest" })])])]);

    const homes = loadHomes();
    assert.equal(homes![0].floors[0].rooms[0].id, "newest");
  });

  test("falls through an unparseable current key to the legacy one", () => {
    ls().setItem(HOMES_KEY, "{ not json");
    ls().setItem(MULTI_FLOORS_KEY, JSON.stringify([makeFloor("f1")]));
    assert.equal(loadHomes()?.length, 1);
  });

  test("unparseable everywhere is 'nothing saved', not a crash", () => {
    ls().setItem(HOMES_KEY, "{{{");
    ls().setItem(MULTI_FLOORS_KEY, "]]]");
    ls().setItem(LEGACY_ROOMS_KEY, "???");
    assert.equal(loadHomes(), null);
  });
});

describe("createHome", () => {
  test("starts with one empty ground floor, per the 2026-08-03 decision", () => {
    const home = createHome();
    assert.equal(home.floors.length, 1);
    assert.deepEqual(home.floors[0].rooms, []);
    assert.equal(home.name, null, "unnamed homes display a position-based default");
  });

  test("generates unique ids", () => {
    assert.notEqual(createHome().id, createHome().id);
  });
});

describe("CRUD", () => {
  test("add, find, update and remove round-trip", () => {
    const a = createHome([makeFloor("f1")]);
    const b = createHome([makeFloor("f2")]);
    addHome(a);
    addHome(b);
    assert.equal(loadHomes()?.length, 2);
    assert.equal(findHome(a.id)?.id, a.id);

    updateHome(a.id, { name: "Flat" });
    assert.equal(findHome(a.id)?.name, "Flat");

    removeHome(a.id);
    assert.equal(loadHomes()?.length, 1);
    assert.equal(findHome(a.id), null);
  });

  test("two homes are genuinely independent -- adding a floor to one never touches the other", () => {
    // The whole point of the feature.
    const a = createHome([makeFloor("a1")]);
    const b = createHome([makeFloor("b1")]);
    addHome(a);
    addHome(b);

    updateHome(a.id, { floors: [makeFloor("a1"), makeFloor("a2")] });

    assert.equal(findHome(a.id)?.floors.length, 2);
    assert.equal(findHome(b.id)?.floors.length, 1, "the other home is untouched");
  });

  test("updateHome no-ops on an unknown id rather than resurrecting it", () => {
    addHome(createHome([makeFloor("f1")]));
    updateHome("ghost", { name: "nope" });
    assert.equal(loadHomes()?.length, 1);
    assert.equal(findHome("ghost"), null);
  });

  test("removing the last home leaves an empty array, not null", () => {
    const a = createHome();
    addHome(a);
    removeHome(a.id);
    assert.deepEqual(loadHomes(), [], "and loadHomes must keep reporting it as empty");
  });
});

describe("findHomeIdForRoom", () => {
  const homes: Home[] = [
    { id: "h1", name: null, floors: [makeFloor("f1", [makeRoom({ id: "r1" })])] },
    {
      id: "h2",
      name: null,
      floors: [makeFloor("f2"), makeFloor("f3", [makeRoom({ id: "r2" })])],
    },
  ];

  test("finds the owner across floors and homes", () => {
    assert.equal(findHomeIdForRoom(homes, "r1"), "h1");
    assert.equal(findHomeIdForRoom(homes, "r2"), "h2");
  });

  test("returns null for a room that isn't in any home", () => {
    assert.equal(findHomeIdForRoom(homes, "nope"), null);
  });
});

describe("naming", () => {
  test("the first home is 'My Home' / 'Mein Zuhause', later ones are numbered", () => {
    assert.equal(defaultHomeName(0, "en"), "My Home");
    assert.equal(defaultHomeName(0, "de"), "Mein Zuhause");
    assert.equal(defaultHomeName(1, "en"), "Home 2");
    assert.equal(defaultHomeName(1, "de"), "Zuhause 2");
  });

  test("a custom name wins over the positional default", () => {
    assert.equal(
      homeDisplayName({ id: "a", name: "Beach Flat", floors: [] }, 0, "en"),
      "Beach Flat",
    );
    assert.equal(homeDisplayName({ id: "a", name: null, floors: [] }, 0, "en"), "My Home");
  });

  // What the dashboard's rename field relies on when you clear it: storing
  // null is the only way back to a translated, auto-renumbering name once
  // one has been typed over.
  test("renaming to null restores the positional default, in both languages", () => {
    const home = createHome([makeFloor("f1")]);
    addHome(home);

    updateHome(home.id, { name: "Ferienhaus" });
    assert.equal(homeDisplayName(findHome(home.id)!, 1, "en"), "Ferienhaus");

    updateHome(home.id, { name: null });
    assert.equal(homeDisplayName(findHome(home.id)!, 1, "en"), "Home 2");
    assert.equal(homeDisplayName(findHome(home.id)!, 1, "de"), "Zuhause 2");
  });

  test("renaming one home leaves every other home's name alone", () => {
    const a = createHome([makeFloor("a1")]);
    const b = createHome([makeFloor("b1")]);
    addHome(a);
    addHome(b);

    updateHome(b.id, { name: "Beach Flat" });
    assert.equal(findHome(a.id)?.name, null);
    assert.equal(findHome(b.id)?.name, "Beach Flat");
    // And nothing else about the renamed home moved.
    assert.deepEqual(findHome(b.id)?.floors, b.floors);
  });
});

// Phase 2: a whole home in a file. The point of the exercise is that
// nothing anyone ever exported from this app stops working, so each
// generation gets its own case.
describe("parseImportedHome", () => {
  const roomsOf = (h: { floors: Floor[] }) => h.floors.flatMap((f) => f.rooms.map((r) => r.id));

  test("a home export round-trips, name included", () => {
    const file = { name: "Beach Flat", floors: [makeFloor("f1", [makeRoom({ id: "r1" })])] };
    const parsed = parseImportedHome(file);
    assert.equal(parsed?.name, "Beach Flat");
    assert.deepEqual(roomsOf(parsed!), ["r1"]);
  });

  test("a home exported without a custom name comes back un-named", () => {
    const parsed = parseImportedHome({ name: null, floors: [makeFloor("f1")] });
    assert.equal(parsed?.name, null);
  });

  test("a bare floors export still imports -- as an un-named home", () => {
    const parsed = parseImportedHome([makeFloor("f1", [makeRoom({ id: "r1" })])]);
    assert.equal(parsed?.name, null, "floors carry no home name");
    assert.deepEqual(roomsOf(parsed!), ["r1"]);
  });

  test("the { floors, customCatalog } bundle shape still imports", () => {
    const parsed = parseImportedHome({
      floors: [makeFloor("f1", [makeRoom({ id: "r1" })])],
      customCatalog: [],
    });
    assert.deepEqual(roomsOf(parsed!), ["r1"]);
  });

  test("a pre-floors RoomLayout[] export becomes one floor in one home", () => {
    const parsed = parseImportedHome([makeRoom({ id: "old" })]);
    assert.equal(parsed?.floors.length, 1);
    assert.deepEqual(roomsOf(parsed!), ["old"]);
  });

  test("garbage is rejected rather than half-imported", () => {
    assert.equal(parseImportedHome({ nope: true }), null);
    assert.equal(parseImportedHome(null), null);
    assert.equal(parseImportedHome({ name: "x", floors: "not floors" }), null);
  });

  // The id is deliberately not in the file: an imported home either
  // replaces one (which keeps its own id) or becomes a new one.
  test("an id in the file is ignored, not adopted", () => {
    const parsed = parseImportedHome({
      id: "some-other-home",
      name: "X",
      floors: [makeFloor("f")],
    });
    assert.equal((parsed as unknown as { id?: string }).id, undefined);
  });
});

describe("withFreshIds", () => {
  // Without this, importing the same file twice leaves two homes sharing
  // room ids, and anything resolving a room id across homes lands on
  // whichever it finds first.
  test("re-mints every floor and room id", () => {
    const floors = [makeFloor("f1", [makeRoom({ id: "r1" }), makeRoom({ id: "r2" })])];
    const fresh = withFreshIds(floors);
    assert.notEqual(fresh[0].id, "f1");
    assert.deepEqual(
      fresh[0].rooms.map((r) => r.id === "r1" || r.id === "r2"),
      [false, false],
    );
  });

  test("changes nothing else", () => {
    const floors = [makeFloor("f1", [makeRoom({ id: "r1", name: "Kitchen" })])];
    const fresh = withFreshIds(floors);
    assert.equal(fresh[0].name, floors[0].name);
    assert.equal(fresh[0].rooms[0].name, "Kitchen");
    assert.equal(fresh[0].rooms[0].width, floors[0].rooms[0].width);
  });

  test("two imports of the same file never collide", () => {
    const floors = [makeFloor("f1", [makeRoom({ id: "r1" })])];
    const a = withFreshIds(floors);
    const b = withFreshIds(floors);
    assert.notEqual(a[0].rooms[0].id, b[0].rooms[0].id);
    assert.notEqual(a[0].id, b[0].id);
  });
});

describe("summaries", () => {
  const home: Home = {
    id: "h",
    name: null,
    floors: [
      makeFloor("f1", [
        makeRoom({ id: "r1", items: [{ id: "i1" }, { id: "i2" }] as RoomLayout["items"] }),
        makeRoom({ id: "r2" }),
      ]),
      makeFloor("f2", [makeRoom({ id: "r3", items: [{ id: "i3" }] as RoomLayout["items"] })]),
    ],
  };

  test("counts rooms across every floor", () => {
    assert.equal(countRooms(home), 3);
  });

  test("counts items across every room of every floor", () => {
    assert.equal(countItems(home), 3);
  });

  test("an empty home counts zero of both", () => {
    const empty = createHome();
    assert.equal(countRooms(empty), 0);
    assert.equal(countItems(empty), 0);
  });
});

describe("active pointers", () => {
  test("active home falls back to the first when nothing or something stale is saved", () => {
    const homes = [createHome(), createHome()];
    assert.equal(loadActiveHomeId(homes), homes[0].id);

    saveActiveHomeId(homes[1].id);
    assert.equal(loadActiveHomeId(homes), homes[1].id);

    ls().setItem(ACTIVE_HOME_ID_KEY, "deleted-in-another-tab");
    assert.equal(loadActiveHomeId(homes), homes[0].id);
  });

  test("no homes means no active home", () => {
    assert.equal(loadActiveHomeId([]), "");
  });

  test("the active floor is tracked PER home, not globally", () => {
    // The old single global pointer only worked because there was exactly
    // one building; two homes must be able to sit on different floors.
    const a: Home = { id: "ha", name: null, floors: [makeFloor("a1"), makeFloor("a2")] };
    const b: Home = { id: "hb", name: null, floors: [makeFloor("b1"), makeFloor("b2")] };

    saveActiveFloorId(a.id, "a2");
    saveActiveFloorId(b.id, "b1");

    assert.equal(loadActiveFloorId(a), "a2");
    assert.equal(loadActiveFloorId(b), "b1");
  });

  test("a stale floor id falls back to the home's first floor", () => {
    const home: Home = { id: "h", name: null, floors: [makeFloor("f1"), makeFloor("f2")] };
    saveActiveFloorId(home.id, "deleted");
    assert.equal(loadActiveFloorId(home), "f1");
  });

  test("a home with no floors has no active floor", () => {
    assert.equal(loadActiveFloorId({ id: "h", name: null, floors: [] }), "");
  });

  test("an unparseable active-floor map degrades to the first floor", () => {
    const home: Home = { id: "h", name: null, floors: [makeFloor("f1")] };
    ls().setItem("planner-active-floor-by-home-v1", "not json");
    assert.equal(loadActiveFloorId(home), "f1");
  });
});
