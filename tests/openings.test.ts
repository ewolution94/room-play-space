import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  OPENING_GEOMETRY,
  openingTopHeight,
  isSwingingOpening,
  isGlazedOpening,
  openingLeaves,
  defaultOpeningWidth,
  openingWidthPresets,
  openingKindLabel,
} from "@/lib/openings";
import { STRINGS } from "@/lib/planner-translations";
import type { OpeningKind } from "@/types/planner";

const KINDS: OpeningKind[] = ["door", "window", "terrace-door"];

describe("what makes a terrace door a terrace door", () => {
  // The whole point of the kind: bodentief. A window sits on a sill, a
  // terrace door starts at the floor -- that difference IS the feature, and
  // the 3D view reads these exact numbers.
  test("it starts at the floor, unlike a window", () => {
    assert.equal(OPENING_GEOMETRY["terrace-door"].sill, 0);
    assert.ok(OPENING_GEOMETRY.window.sill > 0, "a window is not floor-length");
    assert.equal(OPENING_GEOMETRY.door.sill, 0);
  });

  test("it is taller than a normal door and reaches higher than a window", () => {
    assert.ok(openingTopHeight("terrace-door") > openingTopHeight("door"));
    assert.equal(openingTopHeight("terrace-door"), 210);
    assert.equal(openingTopHeight("window"), 210);
  });

  test("it swings like a door AND is glazed like a window", () => {
    assert.equal(isSwingingOpening("terrace-door"), true);
    assert.equal(isGlazedOpening("terrace-door"), true);
    // ...which neither of the other two is.
    assert.equal(isGlazedOpening("door"), false);
    assert.equal(isSwingingOpening("window"), false);
  });

  test("every kind has geometry, so a new one can't be added without it", () => {
    for (const kind of KINDS) {
      const g = OPENING_GEOMETRY[kind];
      assert.ok(g, `${kind} has no geometry`);
      assert.ok(g.height > 0, `${kind} has no height`);
      assert.ok(g.sill >= 0);
    }
  });
});

describe("leaves", () => {
  test("only a terrace door can have two", () => {
    assert.equal(openingLeaves({ kind: "terrace-door", leaves: 2 }), 2);
    assert.equal(openingLeaves({ kind: "terrace-door", leaves: 1 }), 1);
    // A stray value on another kind is ignored rather than honoured -- a
    // two-leaf window isn't a thing this app models.
    assert.equal(openingLeaves({ kind: "window", leaves: 2 }), 1);
    assert.equal(openingLeaves({ kind: "door", leaves: 2 }), 1);
  });

  // Every opening saved before terrace doors existed has no `leaves` field.
  test("a missing value means one leaf", () => {
    assert.equal(openingLeaves({ kind: "terrace-door" }), 1);
    assert.equal(openingLeaves({ kind: "door" }), 1);
  });
});

describe("real-world widths", () => {
  test("a two-leaf terrace door defaults to twice a single one", () => {
    assert.equal(defaultOpeningWidth("terrace-door", 1), 90);
    assert.equal(defaultOpeningWidth("terrace-door", 2), 180);
  });

  test("every kind has a sane default and offers it as a preset", () => {
    for (const kind of KINDS) {
      const w = defaultOpeningWidth(kind);
      assert.ok(w >= 60 && w <= 200, `${kind} default ${w} is not a real-world width`);
      assert.ok(
        openingWidthPresets(kind).includes(w),
        `${kind}'s default is missing from its own presets`,
      );
    }
    assert.ok(
      openingWidthPresets("terrace-door", 2).includes(defaultOpeningWidth("terrace-door", 2)),
    );
  });

  test("two-leaf presets are all wide enough to actually be a pair", () => {
    // A 90cm "two-leaf" door would be two 45cm leaves, which nobody sells.
    for (const w of openingWidthPresets("terrace-door", 2)) {
      assert.ok(w >= 160, `${w}cm is too narrow for two leaves`);
    }
  });
});

describe("openingKindLabel", () => {
  test("names the leaf count, since that's what the drawing shows", () => {
    assert.equal(
      openingKindLabel({ kind: "terrace-door", leaves: 2 }, STRINGS.en),
      "Terrace door (2 leaves)",
    );
    assert.equal(
      openingKindLabel({ kind: "terrace-door", leaves: 1 }, STRINGS.de),
      "Terrassentür (1-flügelig)",
    );
  });

  test("plain doors and windows keep their plain names", () => {
    assert.equal(openingKindLabel({ kind: "door" }, STRINGS.en), "Door");
    assert.equal(openingKindLabel({ kind: "window" }, STRINGS.de), "Fenster");
  });
});
