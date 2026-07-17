import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { generateDefaultApartmentLayout } from "@/lib/default-apartment";
import { computeRoomConnectivity, globalCorners } from "@/lib/room-adjacency";
import { rectilinearPolygonsOverlap } from "@/lib/planner-math";
import { PRESET_BY_KEY } from "@/lib/planner-presets";
import type { Item, RoomLayout } from "@/types/planner";

// A simplified re-implementation of collidesWithOthers' obbOverlap check,
// specialized to axis-aligned (rotation 0) rectangles -- every "main" layer
// item in the default apartment is placed unrotated, so a plain AABB
// overlap test is exact here (not an approximation) and doesn't need to
// import planner-math's private obbOverlap.
function aabbOverlap(a: Item, b: Item, eps = 0.01): boolean {
  const aMinX = a.x,
    aMaxX = a.x + a.width;
  const aMinY = a.y,
    aMaxY = a.y + a.length;
  const bMinX = b.x,
    bMaxX = b.x + b.width;
  const bMinY = b.y,
    bMaxY = b.y + b.length;
  const noOverlapX = aMaxX - eps <= bMinX || bMaxX - eps <= aMinX;
  const noOverlapY = aMaxY - eps <= bMinY || bMaxY - eps <= aMinY;
  return !noOverlapX && !noOverlapY;
}

describe("generateDefaultApartmentLayout", () => {
  const rooms = generateDefaultApartmentLayout("en");

  test("produces exactly 6 furnished rooms plus 1 connecting hallway", () => {
    assert.equal(rooms.length, 7);
    const hallways = rooms.filter((r) => r.roomKind === "hallway");
    const plainRooms = rooms.filter((r) => r.roomKind !== "hallway");
    assert.equal(hallways.length, 1);
    assert.equal(plainRooms.length, 6);
  });

  test("no two rooms (including the hallway) overlap each other", () => {
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const overlap = rectilinearPolygonsOverlap(
          globalCorners(rooms[i]),
          globalCorners(rooms[j]),
        );
        assert.equal(
          overlap,
          false,
          `"${rooms[i].name}" and "${rooms[j].name}" overlap -- expected them to be flush-touching or apart, not overlapping`,
        );
      }
    }
  });

  test("every room is reachable from every other room through the hallway (whole apartment forms one connected structure)", () => {
    const result = computeRoomConnectivity(rooms);
    assert.equal(
      result.isFullyConnected,
      true,
      `expected 1 connected component, got ${result.componentCount}. Isolated rooms: ${result.isolatedRoomIds.join(", ")}`,
    );
  });

  test("every room's door actually sits within its touching span against the hallway (not just geometrically flush)", () => {
    // A stronger, room-by-room version of the connectivity test above: each
    // of the 6 furnished rooms specifically must connect to the hallway
    // itself (not just to some other room by coincidence).
    const hallway = rooms.find((r) => r.roomKind === "hallway")!;
    for (const room of rooms) {
      if (room.id === hallway.id) continue;
      const combined = [room, hallway];
      const result = computeRoomConnectivity(combined);
      assert.equal(result.isFullyConnected, true, `"${room.name}" doesn't connect to the hallway`);
    }
  });

  function checkRoom(room: RoomLayout) {
    describe(`room: ${room.name}`, () => {
      test("every item references a real catalog preset", () => {
        for (const it of room.items) {
          if (!it.icon) continue;
          assert.ok(
            PRESET_BY_KEY[it.icon],
            `"${room.name}" item ${it.id} references unknown preset "${it.icon}"`,
          );
        }
      });

      test("every item's footprint fits within the room's own bounds", () => {
        for (const it of room.items) {
          assert.ok(it.x >= 0, `${room.name}/${it.id}: x < 0`);
          assert.ok(it.y >= 0, `${room.name}/${it.id}: y < 0`);
          assert.ok(
            it.x + it.width <= room.width + 0.01,
            `${room.name}/${it.id}: right edge (${it.x + it.width}) exceeds room width (${room.width})`,
          );
          assert.ok(
            it.y + it.length <= room.length + 0.01,
            `${room.name}/${it.id}: bottom edge (${it.y + it.length}) exceeds room length (${room.length})`,
          );
        }
      });

      test("no two main-layer items collide with each other", () => {
        const mainItems = room.items.filter((it) => (it.layer ?? "main") === "main");
        for (let i = 0; i < mainItems.length; i++) {
          for (let j = i + 1; j < mainItems.length; j++) {
            assert.equal(
              aabbOverlap(mainItems[i], mainItems[j]),
              false,
              `${room.name}: "${mainItems[i].name}" (${mainItems[i].id}) and "${mainItems[j].name}" (${mainItems[j].id}) collide`,
            );
          }
        }
      });

      test("every door/window opening fits within its wall's length", () => {
        for (const o of room.openings) {
          const wallLength =
            o.wall === "top" || o.wall === "bottom"
              ? room.width
              : o.wall === "left" || o.wall === "right"
                ? room.length
                : null;
          if (wallLength === null) continue; // numeric (polygon) wall index -- not used by any room here
          assert.ok(o.position >= 0, `${room.name}: opening ${o.id} has negative position`);
          assert.ok(
            o.position + o.width <= wallLength + 0.01,
            `${room.name}: opening ${o.id} (${o.position}+${o.width}) exceeds wall "${o.wall}" length ${wallLength}`,
          );
        }
      });
    });
  }

  for (const room of rooms) checkRoom(room);

  test("a meaningful share of the placed items render as real Kenney models or procedural shapes, not plain boxes", () => {
    let total = 0;
    let enhanced = 0;
    for (const room of rooms) {
      for (const it of room.items) {
        if (!it.icon) continue;
        total++;
        const preset = PRESET_BY_KEY[it.icon];
        if (preset?.kitModel || preset?.proceduralModel) enhanced++;
      }
    }
    assert.ok(total >= 30, `expected a richly-furnished apartment, only placed ${total} items`);
    assert.ok(
      enhanced / total >= 0.7,
      `expected at least 70% of placed items to have a kitModel or proceduralModel, got ${enhanced}/${total}`,
    );
  });

  test("is deterministic -- calling it twice produces the same room names/positions (no randomness)", () => {
    const again = generateDefaultApartmentLayout("en");
    assert.deepEqual(
      rooms.map((r) => ({ name: r.name, x: r.x, y: r.y, width: r.width, length: r.length })),
      again.map((r) => ({ name: r.name, x: r.x, y: r.y, width: r.width, length: r.length })),
    );
  });

  test("German locale produces German room names", () => {
    const de = generateDefaultApartmentLayout("de");
    assert.ok(de.some((r) => r.name === "Wohnzimmer"));
    assert.ok(de.some((r) => r.name === "Küche"));
    assert.ok(de.some((r) => r.name === "Flur"));
  });
});
