import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  availableHeightAt,
  buildCeilingSurface,
  cutOutConvex,
  distanceToClearHeight,
  dormerFootprints,
  dormerShell,
  type WallSlopeMap,
} from "@/lib/wall-slopes";
import {
  defaultRoofWindowSill,
  dormerProblem,
  dormerWindowSpan,
  freeDormerPosition,
  newRoomProblem,
  openingProblem,
  roofWindowGeometry,
  roomProblems,
  type RoomShell,
} from "@/lib/roof-windows";
import { pointInPolygon } from "@/lib/planner-math";
import type { Opening, Point } from "@/types/planner";

// 400 x 300, the same room as wall-slopes.test.ts: a 110 cm knee wall on the
// left, rising to the 240 cm ceiling over 150 cm. The left wall runs from
// corners[0] down to corners[3] (resolveWallSegment's reversed "left"), so a
// position along it is a y coordinate.
const ROOM: Point[] = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 300 },
  { x: 0, y: 300 },
];
const KNEE = 110;
const RUN = 150;
const slope = (dormers?: { id: string; position: number; width: number; height?: number }[]) =>
  ({ left: { kneeHeight: KNEE, run: RUN, ...(dormers ? { dormers } : {}) } }) as WallSlopeMap;

const rectTriangulate = (c: Point[]): [Point, Point, Point][] => [
  [c[0], c[1], c[2]],
  [c[0], c[2], c[3]],
];

const shell = (wallSlopes: WallSlopeMap, openings: Opening[] = []): RoomShell => ({
  corners: ROOM,
  wallSlopes,
  ceilingHeight: 240,
  openings,
});

const roofWindow = (patch: Partial<Opening> = {}): Opening => ({
  id: "rw",
  kind: "roof-window",
  wall: "left",
  position: 100,
  width: 78,
  sill: 120,
  slopeLength: 118,
  ...patch,
});

describe("dormers in the height map", () => {
  const withDormer = slope([{ id: "d", position: 100, width: 120 }]);

  test("inside the dormer's stretch the ceiling is the full height, right up to the wall", () => {
    assert.equal(availableHeightAt({ x: 1, y: 160 }, ROOM, withDormer), 240);
    assert.equal(availableHeightAt({ x: 75, y: 160 }, ROOM, withDormer), 240);
  });

  test("beside the dormer the slope is untouched", () => {
    assert.equal(availableHeightAt({ x: 0, y: 50 }, ROOM, withDormer), KNEE);
    assert.equal(availableHeightAt({ x: 75, y: 250 }, ROOM, withDormer), 175);
  });

  test("its edges count as inside", () => {
    assert.equal(availableHeightAt({ x: 0, y: 100 }, ROOM, withDormer), 240);
    assert.equal(availableHeightAt({ x: 0, y: 220 }, ROOM, withDormer), 240);
  });

  test("a lower dormer is flat at its height out to where the slope overtakes it", () => {
    const low = slope([{ id: "d", position: 100, width: 120, height: 200 }]);
    assert.equal(availableHeightAt({ x: 0, y: 160 }, ROOM, low), 200);
    // The slope reaches 200 at 150 * 90 / 130 = 103.8 cm; past that it's the slope.
    assert.equal(availableHeightAt({ x: 120, y: 160 }, ROOM, low), KNEE + (130 * 120) / RUN);
  });

  test("a dormer can't raise the ceiling above the room's own", () => {
    const tall = slope([{ id: "d", position: 100, width: 120, height: 400 }]);
    assert.equal(availableHeightAt({ x: 0, y: 160 }, ROOM, tall), 240);
  });

  test("dormers: false gives the bare roof plane", () => {
    assert.equal(
      availableHeightAt({ x: 0, y: 160 }, ROOM, withDormer, 240, { dormers: false }),
      KNEE,
    );
  });

  test("another wall's slope still wins where it's lower", () => {
    const gable: WallSlopeMap = {
      ...withDormer,
      top: { kneeHeight: 100, run: 100 },
    };
    // Inside the dormer, but 10 cm from the top wall: 100 + 140 * 10 / 100 = 114.
    assert.equal(
      availableHeightAt({ x: 50, y: 10 }, ROOM, {
        ...gable,
        left: { ...gable.left, dormers: [{ id: "d", position: 0, width: 120 }] },
      }),
      114,
    );
  });
});

describe("dormerFootprints", () => {
  test("sits on the wall line and reaches as deep as the slope takes to reach its height", () => {
    const [fp] = dormerFootprints(
      ROOM,
      slope([{ id: "d", position: 100, width: 120, height: 200 }]),
    );
    const depth = distanceToClearHeight({ kneeHeight: KNEE, run: RUN }, 200);
    assert.ok(Math.abs(fp.depth - depth) < 1e-9);
    assert.deepEqual(fp.outline[0], { x: 0, y: 100 });
    assert.deepEqual(fp.outline[1], { x: 0, y: 220 });
    assert.ok(Math.abs(fp.outline[2].x - depth) < 1e-9 && fp.outline[2].y === 220);
    assert.equal(fp.height, 200);
    assert.equal(fp.kneeHeight, KNEE);
  });

  test("a full-height dormer reaches the whole run", () => {
    const [fp] = dormerFootprints(ROOM, slope([{ id: "d", position: 0, width: 60 }]));
    assert.equal(fp.depth, RUN);
  });
});

describe("cutOutConvex", () => {
  const area = (tris: [Point, Point, Point][]) =>
    tris.reduce(
      (sum, [a, b, c]) => sum + Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2,
      0,
    );
  const centroid = ([a, b, c]: [Point, Point, Point]) => ({
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3,
  });
  const hole = [
    { x: 100, y: 50 },
    { x: 200, y: 50 },
    { x: 200, y: 150 },
    { x: 100, y: 150 },
  ];

  test("removes exactly the hole's area, and nothing inside it is left", () => {
    const out = cutOutConvex(rectTriangulate(ROOM), [hole]);
    assert.ok(Math.abs(area(out) - (400 * 300 - 100 * 100)) < 1e-6);
    for (const tri of out) assert.ok(!pointInPolygon(centroid(tri), hole));
  });

  test("works whichever way the hole is wound, and for a hole on the room's edge", () => {
    const edge = [
      { x: 0, y: 100 },
      { x: 0, y: 220 },
      { x: 150, y: 220 },
      { x: 150, y: 100 },
    ];
    // Clear of the edge hole, and wound the other way.
    const across = hole.map((p) => ({ x: p.x + 150, y: p.y })).reverse();
    const out = cutOutConvex(rectTriangulate(ROOM), [edge, across]);
    assert.ok(Math.abs(area(out) - (400 * 300 - 150 * 120 - 100 * 100)) < 1e-6);
  });

  test("a tilted hole (a wall at 45 degrees) is cut along its own edges", () => {
    const diamond = [
      { x: 200, y: 100 },
      { x: 250, y: 150 },
      { x: 200, y: 200 },
      { x: 150, y: 150 },
    ];
    const out = cutOutConvex(rectTriangulate(ROOM), [diamond]);
    assert.ok(Math.abs(area(out) - (400 * 300 - 5000)) < 1e-6);
  });

  test("a hole with no area changes nothing", () => {
    const flat = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    assert.deepEqual(cutOutConvex(rectTriangulate(ROOM), [flat]), rectTriangulate(ROOM));
  });
});

describe("the 3D ceiling with dormers and roof windows", () => {
  const withDormer = slope([{ id: "d", position: 100, width: 120 }]);

  test("leaves the dormer out of the roof plane and keeps the plane's own heights", () => {
    const verts = buildCeilingSurface(ROOM, withDormer, 240, rectTriangulate);
    const [fp] = dormerFootprints(ROOM, withDormer);
    for (let i = 0; i < verts.length; i += 9) {
      const c = {
        x: (verts[i] + verts[i + 3] + verts[i + 6]) / 3,
        y: (verts[i + 2] + verts[i + 5] + verts[i + 8]) / 3,
      };
      assert.ok(!pointInPolygon(c, fp.outline), `triangle inside the dormer at ${c.x},${c.y}`);
    }
    for (let i = 0; i < verts.length; i += 3) {
      const p = { x: verts[i], y: verts[i + 2] };
      assert.ok(
        Math.abs(verts[i + 1] - availableHeightAt(p, ROOM, withDormer, 240, { dormers: false })) <
          1e-9,
      );
    }
  });

  test("cuts a roof window's footprint out too", () => {
    const geo = roofWindowGeometry(roofWindow(), ROOM, slope(), 240)!;
    const verts = buildCeilingSurface(ROOM, slope(), 240, rectTriangulate, {
      cutouts: [geo.footprint],
    });
    for (let i = 0; i < verts.length; i += 9) {
      const c = {
        x: (verts[i] + verts[i + 3] + verts[i + 6]) / 3,
        y: (verts[i + 2] + verts[i + 5] + verts[i + 8]) / 3,
      };
      assert.ok(!pointInPolygon(c, geo.footprint));
    }
  });

  test("dormerShell: a flat ceiling at its height, side walls from the knee wall up", () => {
    const [fp] = dormerFootprints(ROOM, withDormer);
    const { ceiling, cheeks } = dormerShell(fp);
    assert.equal(ceiling.length, 18);
    for (let i = 1; i < ceiling.length; i += 3) assert.equal(ceiling[i], 240);
    assert.deepEqual(cheeks.slice(0, 9), [0, KNEE, 100, 0, 240, 100, RUN, 240, 100]);
  });
});

describe("roofWindowGeometry", () => {
  test("puts the lower edge where the slope is at the sill height, and climbs the slope's pitch", () => {
    const geo = roofWindowGeometry(roofWindow(), ROOM, slope(), 240)!;
    const pitch = Math.atan2(130, RUN);
    assert.ok(Math.abs(geo.pitch - (pitch * 180) / Math.PI) < 1e-9);
    assert.ok(Math.abs(geo.lowOff - (RUN * 10) / 130) < 1e-9);
    assert.ok(Math.abs(geo.highOff - geo.lowOff - 118 * Math.cos(pitch)) < 1e-9);
    assert.ok(Math.abs(geo.high - (120 + 118 * Math.sin(pitch))) < 1e-9);
    // Its footprint is inside the room, on the slope: the left wall's inward normal is +x.
    assert.deepEqual(geo.footprint[0], { x: geo.lowOff, y: 100 });
    assert.deepEqual(geo.footprint[2], { x: geo.highOff, y: 178 });
  });

  test("the floor plan and the height map agree along both edges", () => {
    const geo = roofWindowGeometry(roofWindow(), ROOM, slope(), 240)!;
    assert.ok(Math.abs(availableHeightAt(geo.footprint[0], ROOM, slope()) - geo.low) < 1e-9);
    assert.ok(Math.abs(availableHeightAt(geo.footprint[2], ROOM, slope()) - geo.high) < 1e-9);
  });

  test("needs a slope to sit in", () => {
    assert.equal(roofWindowGeometry(roofWindow({ wall: "top" }), ROOM, slope(), 240), null);
  });
});

describe("openingProblem", () => {
  test("a roof window inside the slope is fine", () => {
    assert.equal(openingProblem(roofWindow(), shell(slope())), null);
  });

  test("refuses a roof window below the knee wall, past the slope, or without one", () => {
    assert.deepEqual(openingProblem(roofWindow({ sill: 100 }), shell(slope())), {
      code: "below-knee",
      kneeHeight: KNEE,
    });
    assert.deepEqual(openingProblem(roofWindow({ sill: 200 }), shell(slope())), {
      code: "above-slope",
      ceilingHeight: 240,
    });
    assert.deepEqual(openingProblem(roofWindow({ wall: "top" }), shell(slope())), {
      code: "needs-slope",
    });
  });

  test("refuses a roof window across a dormer, or over another roof window", () => {
    const withDormer = slope([{ id: "d", position: 150, width: 100 }]);
    assert.deepEqual(openingProblem(roofWindow(), shell(withDormer)), { code: "in-dormer" });
    const other = roofWindow({ id: "other", position: 150 });
    assert.deepEqual(openingProblem(roofWindow(), shell(slope(), [other])), { code: "overlap" });
    // The same stretch of wall, but one above the other on the slope: fine.
    const above = roofWindow({ id: "above", sill: 120, slopeLength: 60 });
    const below = roofWindow({
      id: "below",
      sill: 120 + 60 * Math.sin(Math.atan2(130, RUN)) + 1,
      slopeLength: 40,
    });
    assert.equal(openingProblem(below, shell(slope(), [above])), null);
  });

  test("refuses a roof window where another wall's slope comes down lower", () => {
    const corner: WallSlopeMap = { ...slope(), top: { kneeHeight: 100, run: 200 } };
    assert.deepEqual(openingProblem(roofWindow({ position: 5 }), shell(corner)), {
      code: "under-other-slope",
    });
  });

  test("a door or window on a sloped wall needs a dormer around it", () => {
    const window: Opening = { id: "w", kind: "window", wall: "left", position: 120, width: 80 };
    assert.deepEqual(openingProblem(window, shell(slope())), { code: "sloped-wall" });
    const withDormer = slope([{ id: "d", position: 100, width: 120 }]);
    assert.equal(openingProblem(window, shell(withDormer)), null);
    // Half in, half out of the dormer is still on the knee wall.
    assert.deepEqual(openingProblem({ ...window, position: 180 }, shell(withDormer)), {
      code: "sloped-wall",
    });
  });

  test("measures a window in a dormer against the dormer's height", () => {
    const low = slope([{ id: "d", position: 100, width: 120, height: 200 }]);
    const window: Opening = { id: "w", kind: "window", wall: "left", position: 120, width: 80 };
    assert.deepEqual(openingProblem(window, shell(low)), {
      code: "too-tall",
      top: 210,
      wallHeight: 200,
      inDormer: true,
    });
  });

  test("still refuses openings off the wall's end", () => {
    assert.deepEqual(openingProblem(roofWindow({ position: 250 }), shell(slope())), {
      code: "out-of-bounds",
    });
  });
});

describe("dormerProblem", () => {
  const check = (
    dormer: { id: string; position: number; width: number; height?: number },
    openings: Opening[] = [],
    extra: WallSlopeMap = {},
  ) => dormerProblem("left", dormer, shell({ ...slope([dormer]), ...extra }, openings));

  test("a dormer within its wall is fine", () => {
    assert.equal(check({ id: "d", position: 100, width: 120 }), null);
  });

  test("refuses one past the wall's end, too narrow, or no higher than the knee wall", () => {
    assert.deepEqual(check({ id: "d", position: 250, width: 120 }), { code: "out-of-bounds" });
    assert.deepEqual(check({ id: "d", position: 100, width: 30 }), { code: "too-narrow", min: 50 });
    assert.deepEqual(check({ id: "d", position: 100, width: 120, height: KNEE }), {
      code: "too-low",
      kneeHeight: KNEE,
    });
  });

  test("refuses one over a roof window or another dormer", () => {
    assert.deepEqual(check({ id: "d", position: 60, width: 120 }, [roofWindow()]), {
      code: "roof-window",
    });
    const room = shell(
      slope([
        { id: "a", position: 0, width: 120 },
        { id: "b", position: 100, width: 120 },
      ]),
    );
    assert.deepEqual(dormerProblem("left", { id: "b", position: 100, width: 120 }, room), {
      code: "overlap",
    });
  });

  test("refuses one whose ceiling would rise through another wall's slope", () => {
    assert.deepEqual(
      check({ id: "d", position: 0, width: 120 }, [], { top: { kneeHeight: 100, run: 200 } }),
      {
        code: "under-other-slope",
      },
    );
  });
});

describe("newRoomProblem", () => {
  test("ignores problems the room already had, and names the one an edit adds", () => {
    const broken = roofWindow({ id: "old", sill: 50 });
    const before = shell(slope(), [broken]);
    assert.equal(roomProblems(before).length, 1);
    assert.equal(newRoomProblem(before, before), null);
    const after = shell(slope(), [broken, roofWindow({ id: "new", sill: 220 })]);
    assert.equal(newRoomProblem(before, after)?.key, "opening:new:above-slope");
  });

  test("raising the knee wall above a roof window's lower edge is a new problem", () => {
    const before = shell(slope(), [roofWindow()]);
    const after = shell({ left: { kneeHeight: 130, run: RUN } }, [roofWindow()]);
    assert.equal(newRoomProblem(before, after)?.problem.code, "below-knee");
  });
});

describe("placing new roof windows and dormers", () => {
  test("a new roof window's lower edge is 100 cm, or the knee wall, and still fits", () => {
    assert.equal(defaultRoofWindowSill({ kneeHeight: KNEE, run: RUN }, 118, 240), KNEE);
    assert.equal(defaultRoofWindowSill({ kneeHeight: 60, run: 300 }, 118, 240), 100);
    // A short, steep slope: moved down until the top edge fits.
    const steep = defaultRoofWindowSill({ kneeHeight: 150, run: 60 }, 118, 240);
    assert.equal(steep, null);
  });

  test("a new dormer is centred when that's free, otherwise in the first gap", () => {
    assert.equal(freeDormerPosition("left", 120, shell(slope())), 90);
    const rw = roofWindow({ position: 80, width: 100 });
    assert.equal(freeDormerPosition("left", 80, shell(slope(), [rw])), 190);
    assert.equal(freeDormerPosition("left", 290, shell(slope())), null);
  });

  test("a new dormer's window is centred and up to a metre wide, when one fits", () => {
    assert.deepEqual(dormerWindowSpan({ id: "d", position: 100, width: 160 }, 240), {
      position: 130,
      width: 100,
    });
    assert.equal(dormerWindowSpan({ id: "d", position: 100, width: 160, height: 200 }, 240), null);
  });
});
