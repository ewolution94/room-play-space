import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { APP_STORAGE_PREFIX, collectAppStorageKeys, resetAppStorage } from "@/lib/app-reset";
import { HOMES_KEY, ACTIVE_HOME_ID_KEY, ACTIVE_FLOOR_BY_HOME_KEY } from "@/lib/homes";
import { MULTI_FLOORS_KEY, ACTIVE_FLOOR_ID_KEY } from "@/lib/floors";
import { SINGLE_ROOMS_KEY } from "@/lib/single-rooms";

/** Minimal Storage stand-in with the index API the sweep actually uses. */
function makeStorage(entries: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  } as unknown as Storage;
}

describe("every key this app owns is covered by the prefix sweep", () => {
  // If someone adds a key that isn't `planner-`-prefixed, this fails and
  // tells them why -- which is the whole reason the reset is a sweep rather
  // than a hand-maintained list that would just silently miss it.
  const knownKeys = [
    HOMES_KEY,
    ACTIVE_HOME_ID_KEY,
    ACTIVE_FLOOR_BY_HOME_KEY,
    MULTI_FLOORS_KEY,
    ACTIVE_FLOOR_ID_KEY,
    SINGLE_ROOMS_KEY,
    "planner-multi-rooms",
    "planner-custom-catalog-v1",
    "planner-settings-v1",
    "planner-theme",
    "planner-lang",
    "planner-tour-v1-done",
    "planner-sidebar-collapsed",
    "planner-inspector-groups-v1",
  ];

  for (const key of knownKeys) {
    test(`${key} is swept`, () => {
      assert.ok(
        key.startsWith(APP_STORAGE_PREFIX),
        `${key} would survive a "reset everything" -- either prefix it or extend the sweep`,
      );
    });
  }

  test("a full profile is wiped in one pass", () => {
    const storage = makeStorage(Object.fromEntries(knownKeys.map((k) => [k, "x"])));
    const removed = resetAppStorage(storage);
    assert.equal(removed, knownKeys.length);
    assert.equal(storage.length, 0);
  });
});

describe("resetAppStorage", () => {
  test("leaves other apps on the same origin completely alone", () => {
    // Why this never calls localStorage.clear(): on a dev machine every
    // other localhost app shares this origin.
    const storage = makeStorage({
      "planner-single-rooms": "[]",
      "some-other-app:token": "keep me",
      unrelated: "keep me too",
    });
    resetAppStorage(storage);
    assert.equal(storage.getItem("planner-single-rooms"), null);
    assert.equal(storage.getItem("some-other-app:token"), "keep me");
    assert.equal(storage.getItem("unrelated"), "keep me too");
  });

  test("removes every matching key, not every other one", () => {
    // Deleting while iterating by index shifts the indices underneath you
    // and skips half the keys -- hence collect-then-delete.
    const many = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`planner-key-${i}`, String(i)]),
    );
    const storage = makeStorage(many);
    assert.equal(resetAppStorage(storage), 10);
    assert.equal(storage.length, 0, "no key may survive the sweep");
  });

  test("is a no-op on an already-clean profile", () => {
    const storage = makeStorage({ unrelated: "x" });
    assert.equal(resetAppStorage(storage), 0);
    assert.equal(storage.length, 1);
  });

  test("collect reports what would go, without deleting anything", () => {
    const storage = makeStorage({ "planner-a": "1", "planner-b": "2", other: "3" });
    assert.deepEqual(collectAppStorageKeys(storage).sort(), ["planner-a", "planner-b"]);
    assert.equal(storage.length, 3, "collecting must not mutate");
  });
});
