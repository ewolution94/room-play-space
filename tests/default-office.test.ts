import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildDefaultOfficeItems,
  buildDefaultOfficeOpenings,
  DEFAULT_ROOM_W,
  DEFAULT_ROOM_L,
} from "@/hooks/use-room-planner";
import { PRESET_BY_KEY } from "@/lib/planner-presets";
import { rotatedAABB, obbOverlap } from "@/lib/planner-math";

describe("default single-room office layout", () => {
  const items = buildDefaultOfficeItems();
  const openings = buildDefaultOfficeOpenings();

  test("every item references a real catalog preset", () => {
    for (const it of items) {
      assert.ok(it.icon, `item ${it.id} has no icon/preset key`);
      assert.ok(PRESET_BY_KEY[it.icon!], `item ${it.id} references unknown preset "${it.icon}"`);
    }
  });

  test("every item's footprint fits within the default room bounds", () => {
    // Uses the same rotatedAABB the real app's clampPos (planner-math.ts)
    // constrains a drag to -- a rotated item's true occupied rectangle is
    // NOT it.x/it.y/it.width/it.length taken at face value (that's the
    // *unrotated* box; for a 90/270-degree item the true footprint has
    // width and length swapped). Checking the raw unrotated box here would
    // reject items that are actually fine on screen -- e.g. the office
    // credenza sits at rotation:90, so its true footprint is only 45cm
    // wide (not its unrotated 120cm), comfortably inside the room.
    for (const it of items) {
      const aabb = rotatedAABB(it.width, it.length, it.rotation);
      const cx = it.x + it.width / 2;
      const cy = it.y + it.length / 2;
      const left = cx - aabb.w / 2;
      const right = cx + aabb.w / 2;
      const top = cy - aabb.h / 2;
      const bottom = cy + aabb.h / 2;
      assert.ok(left >= -0.01, `${it.id}: left edge (${left}) is outside the room (x < 0)`);
      assert.ok(top >= -0.01, `${it.id}: top edge (${top}) is outside the room (y < 0)`);
      assert.ok(
        right <= DEFAULT_ROOM_W + 0.01,
        `${it.id}: right edge (${right}) exceeds room width (${DEFAULT_ROOM_W})`,
      );
      assert.ok(
        bottom <= DEFAULT_ROOM_L + 0.01,
        `${it.id}: bottom edge (${bottom}) exceeds room length (${DEFAULT_ROOM_L})`,
      );
    }
  });

  test("no two main-layer items collide with each other", () => {
    // obbOverlap is the exact function collidesWithOthers (planner-math.ts)
    // uses at runtime -- a true rotated-rectangle overlap test via
    // separating-axis theorem, not an axis-aligned approximation. Matching
    // it here means this test agrees with what the app itself would
    // consider a collision, including for items rotated 90/270 degrees.
    const mainItems = items.filter((it) => (it.layer ?? "main") === "main");
    for (let i = 0; i < mainItems.length; i++) {
      for (let j = i + 1; j < mainItems.length; j++) {
        assert.equal(
          obbOverlap(mainItems[i], mainItems[j]),
          false,
          `"${mainItems[i].name}" (${mainItems[i].id}) and "${mainItems[j].name}" (${mainItems[j].id}) collide`,
        );
      }
    }
  });

  test("every on-top/wall item has an explicit elevation set (static data has no runtime auto-elevate pass)", () => {
    for (const it of items) {
      if (it.layer === "on-top" || it.layer === "wall") {
        assert.ok(
          it.elevation !== undefined,
          `${it.id} (layer=${it.layer}) has no explicit elevation -- would render at floor level`,
        );
      }
    }
  });

  test("every item's current size exactly matches its preset default (guarantees kitModel resolves to 'model', not the envelope fallback)", () => {
    for (const it of items) {
      const preset = PRESET_BY_KEY[it.icon!];
      if (!preset?.kitModel) continue;
      assert.equal(it.width, preset.w, `${it.id}: width doesn't match preset default`);
      assert.equal(it.length, preset.l, `${it.id}: length doesn't match preset default`);
    }
  });

  test("every door/window opening fits within its wall's length", () => {
    for (const o of openings) {
      const wallLength = o.wall === "top" || o.wall === "bottom" ? DEFAULT_ROOM_W : DEFAULT_ROOM_L;
      assert.ok(o.position >= 0, `opening ${o.id} has negative position`);
      assert.ok(
        o.position + o.width <= wallLength + 0.01,
        `opening ${o.id} (${o.position}+${o.width}) exceeds wall "${o.wall}" length ${wallLength}`,
      );
    }
  });

  test("covers every furniture layer (main, under, on-top, wall)", () => {
    const layers = new Set(items.map((it) => it.layer ?? "main"));
    assert.ok(layers.has("main"));
    assert.ok(layers.has("under"));
    assert.ok(layers.has("on-top"));
    assert.ok(layers.has("wall"));
  });

  test("a meaningful share of items render as real Kenney models or procedural shapes, not plain boxes", () => {
    let enhanced = 0;
    for (const it of items) {
      const preset = PRESET_BY_KEY[it.icon!];
      if (preset?.kitModel || preset?.proceduralModel) enhanced++;
    }
    assert.ok(
      enhanced / items.length >= 0.7,
      `expected at least 70% of items to have a kitModel or proceduralModel, got ${enhanced}/${items.length}`,
    );
  });

  test("is deterministic across calls (no randomness, no id collisions within a single call)", () => {
    const again = buildDefaultOfficeItems();
    assert.deepEqual(
      items.map((it) => ({ icon: it.icon, x: it.x, y: it.y })),
      again.map((it) => ({ icon: it.icon, x: it.x, y: it.y })),
    );
    const ids = new Set(items.map((it) => it.id));
    assert.equal(
      ids.size,
      items.length,
      "duplicate item ids within a single buildDefaultOfficeItems() call",
    );
  });
});
