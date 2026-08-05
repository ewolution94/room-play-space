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
  openingFitsWall,
  openingHeightShortfall,
  requiredWallHeight,
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

// An opening is a hole in a wall: one taller than the wall it sits in
// can't be built, and renders as glazing floating above the wall with no
// lintel. This is what the editor blocks on -- unlike too-tall furniture,
// which only warns, because furniture merely stands in the room.
describe("fitting an opening into its wall", () => {
  test("the default 240cm room takes every kind", () => {
    for (const kind of KINDS) {
      assert.equal(openingFitsWall(kind, 240), true, `${kind} should fit a 240cm wall`);
    }
  });

  // The case that prompted this: terrace doors are 210, and wall height is
  // user-editable well below that.
  test("a 200cm room cannot take a terrace door, but still takes a door", () => {
    assert.equal(openingFitsWall("terrace-door", 200), false);
    assert.equal(openingHeightShortfall("terrace-door", 200), 10);
    assert.equal(openingFitsWall("door", 200), true);
  });

  test("the shortfall is what the message needs: how much taller the wall must be", () => {
    assert.equal(openingHeightShortfall("window", 150), 60); // 90 sill + 120 pane
    assert.equal(openingHeightShortfall("window", 210), 0);
    assert.equal(openingHeightShortfall("door", 260), 0, "a fitting opening has no shortfall");
  });

  test("exactly tall enough counts as fitting", () => {
    assert.equal(openingFitsWall("terrace-door", 210), true);
    assert.equal(openingFitsWall("terrace-door", 209.9), false);
  });
});

describe("requiredWallHeight", () => {
  test("is the tallest opening's top edge", () => {
    assert.equal(
      requiredWallHeight([{ kind: "door" }, { kind: "terrace-door" }, { kind: "window" }]),
      210,
    );
    assert.equal(requiredWallHeight([{ kind: "door" }]), 200);
  });

  // A room with nothing in its walls can have any ceiling height at all.
  test("a room with no openings constrains nothing", () => {
    assert.equal(requiredWallHeight([]), 0);
  });

  test("it agrees with openingFitsWall -- a wall at exactly this height fits them all", () => {
    const openings = [{ kind: "door" as const }, { kind: "terrace-door" as const }];
    const needed = requiredWallHeight(openings);
    for (const o of openings) {
      assert.equal(openingFitsWall(o.kind, needed), true, `${o.kind} should fit at ${needed}`);
    }
    // And it is the *binding* constraint: one cm lower and the tallest
    // stops fitting, while the shorter one is still fine.
    assert.equal(openingFitsWall("terrace-door", needed - 1), false);
    assert.equal(openingFitsWall("door", needed - 1), true);
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
