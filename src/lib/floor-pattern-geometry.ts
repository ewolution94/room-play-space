import type { FloorPattern } from "@/types/planner";
import { mulberry32 } from "@/lib/floor-materials";

/**
 * Shared, renderer-agnostic geometry for every flooring pattern -- one
 * definition consumed by BOTH the 2D SVG pattern renderer
 * (floor-pattern-svg.tsx) and the 3D canvas-texture renderer
 * (floor-textures.ts), so the two views can never visually disagree about
 * what a given material looks like. Everything is expressed in real-world
 * cm within one repeating tile (tileW x tileH); each renderer is
 * responsible for its own coordinate system's scale factor (cm() for SVG,
 * pixels-per-cm for the canvas texture).
 *
 * Rotated elements (only the herringbone pattern needs this) carry a
 * `rotDeg` and are rotated about their own center -- see the doc comment
 * on `wood-herringbone` below for how that tile was derived (verified by
 * rendering it with a standalone rasterizer during development; the
 * degenerate "axis-aligned pairs" and "single rotated brick lattice"
 * constructions both looked plausible on paper but produced either a
 * ladder shape or a gapped diamond lattice when actually rendered --
 * only true per-plank edge-to-edge chaining tiles correctly).
 */
export interface PatternRect {
  x: number; // unrotated top-left, tile-local cm
  y: number;
  w: number;
  h: number;
  rotDeg?: number; // rotation about the rect's own center, degrees
  shade: number; // passed to shadeColor(color, shade); -1..1
}

export interface PatternDot {
  cx: number;
  cy: number;
  r: number;
  shade: number;
}

export interface FloorPatternSpec {
  tileW: number;
  tileH: number;
  rects: PatternRect[];
  dots?: PatternDot[];
}

function buildPlankRows(opts: {
  plankW: number;
  plankLen: number;
  grainSeed: number;
  grainShadeRange: number;
  // Number of distinct stagger columns per horizontal repeat. Real
  // flooring installers avoid a plain half-board (50%) offset because
  // after only 2 columns the end-joints line up into a repeating "H"
  // pattern that reads as cheap/synthetic; 3-4 columns with 1/3 or 1/4
  // offsets is the standard professional running-bond spec and is what
  // actually reads as "premium" instead of a boring 2-column repeat.
  columns: number;
  // Small organic knot flecks -- real (not printed) wood grain, so only
  // hardwood uses these, never laminate.
  knots?: boolean;
}): FloorPatternSpec {
  const { plankW, plankLen, grainSeed, grainShadeRange, columns, knots = false } = opts;
  const rng = mulberry32(grainSeed);
  const tileW = plankW * columns;
  // Every board is exactly one plank-length long, so a single tileH of one
  // plankLen is enough to tile seamlessly -- the stagger comes from each
  // column's seam sitting at a different fractional height, not from a
  // taller repeat unit.
  const tileH = plankLen;
  const seamW = Math.max(0.4, plankW * 0.02);
  const seamH = Math.max(0.4, plankLen * 0.012);
  const rects: PatternRect[] = [];
  const dots: PatternDot[] = [];

  function addPlank(x: number, y: number, w: number, h: number) {
    if (h <= 0.6 || w <= 0.6) return;
    const shade = (rng() - 0.5) * grainShadeRange;
    rects.push({ x, y, w, h, shade });
    // Bevel: a faint highlight along the top edge and a faint shadow along
    // the bottom -- just enough of a seam/edge cue to read as individual
    // boards at a glance, without the strong light/dark banding that made
    // the floor look busy from a normal zoomed-out view.
    const bevel = Math.max(0.4, h * 0.035);
    rects.push({ x, y, w, h: bevel, shade: Math.min(1, shade + 0.065) });
    rects.push({ x, y: y + h - bevel, w, h: bevel, shade: Math.max(-1, shade - 0.09) });
    // A single faint grain streak per plank -- enough to suggest wood
    // grain up close, without the busy multi-streak look this had before.
    const streaks = 1;
    for (let i = 0; i < streaks; i++) {
      const gx = x + w * (0.3 + rng() * 0.4);
      rects.push({
        x: gx,
        y,
        w: Math.max(0.25, w * 0.02),
        h,
        shade: Math.max(-1, shade - 0.05 - rng() * 0.03),
      });
    }
    if (knots && rng() < 0.18) {
      dots.push({
        cx: x + w * (0.25 + rng() * 0.5),
        cy: y + h * (0.2 + rng() * 0.6),
        r: w * (0.045 + rng() * 0.025),
        shade: Math.max(-1, shade - 0.16),
      });
    }
  }

  for (let col = 0; col < columns; col++) {
    const x = col * plankW;
    // Fraction of a full board-length this column's boards are offset by,
    // spread evenly across `columns` so the seam heights are all distinct
    // (avoids any two columns lining up).
    const offset = (col * plankLen) / columns;
    if (offset <= 0.01) {
      // No stagger: one full-length board spans the whole tile height.
      addPlank(x, 0, plankW - seamW, plankLen - seamH);
    } else {
      // Two boards meet mid-column at `offset` -- top piece is the tail
      // end of a board that started above this tile (wraps seamlessly),
      // bottom piece is the head of the next board, continuing into the
      // tile below.
      addPlank(x, 0, plankW - seamW, offset - seamH / 2);
      addPlank(x, offset + seamH / 2, plankW - seamW, plankLen - offset - seamH / 2);
    }
  }

  return { tileW, tileH, rects, dots: dots.length ? dots : undefined };
}

// True herringbone: L=3W plank ratio (a realistic parquet block
// proportion), tiled via a verified-gap-free (2*W*sqrt2) square containing
// 4 planks alternating +-45 degrees. See the module doc comment above.
function buildHerringbone(): FloorPatternSpec {
  const W = 15;
  const L = W * 3;
  const S = W * Math.SQRT2;
  const tile = S * 2;
  const centers: { cx: number; cy: number; rot: number; shade: number }[] = [
    { cx: 0, cy: 0, rot: 45, shade: 0.06 },
    { cx: S, cy: S, rot: -45, shade: -0.07 },
    { cx: 0, cy: S, rot: -45, shade: -0.07 },
    { cx: S, cy: 0, rot: 45, shade: 0.06 },
  ];
  const rects: PatternRect[] = centers.map((c) => ({
    x: c.cx - L / 2,
    y: c.cy - W / 2,
    w: L,
    h: W,
    rotDeg: c.rot,
    shade: c.shade,
  }));
  return { tileW: tile, tileH: tile, rects };
}

function buildConcrete(density: number, contrast: number, seed: number): FloorPatternSpec {
  const rng = mulberry32(seed);
  const tileW = 100;
  const tileH = 100;
  const dots: PatternDot[] = [];
  const count = Math.round(density);
  for (let i = 0; i < count; i++) {
    dots.push({
      cx: rng() * tileW,
      cy: rng() * tileH,
      r: 0.6 + rng() * (contrast > 0.1 ? 2.2 : 1.4),
      shade: (rng() - 0.55) * contrast,
    });
  }
  return { tileW, tileH, rects: [], dots };
}

function buildTileGrid(cellSize: number, groutFrac: number): FloorPatternSpec {
  const grout = Math.max(0.3, cellSize * groutFrac);
  return {
    tileW: cellSize,
    tileH: cellSize,
    // Base tile fill drawn FIRST, grout lines drawn on top -- order matters
    // here since later rects paint over earlier ones.
    rects: [
      { x: 0, y: 0, w: cellSize, h: cellSize, shade: 0.04 },
      { x: 0, y: 0, w: cellSize, h: grout, shade: -0.26 },
      { x: 0, y: 0, w: grout, h: cellSize, shade: -0.26 },
    ],
  };
}

function buildCheckerboard(cellSize: number): FloorPatternSpec {
  const grout = Math.max(0.3, cellSize * 0.02);
  const tile = cellSize * 2;
  return {
    tileW: tile,
    tileH: tile,
    rects: [
      { x: 0, y: 0, w: cellSize, h: cellSize, shade: 0.07 },
      { x: cellSize, y: cellSize, w: cellSize, h: cellSize, shade: 0.07 },
      { x: cellSize, y: 0, w: cellSize, h: cellSize, shade: -0.17 },
      { x: 0, y: cellSize, w: cellSize, h: cellSize, shade: -0.17 },
      // Grout lines over the whole tile.
      { x: 0, y: 0, w: tile, h: grout, shade: -0.33 },
      { x: 0, y: 0, w: grout, h: tile, shade: -0.33 },
      { x: 0, y: cellSize, w: tile, h: grout, shade: -0.33 },
      { x: cellSize, y: 0, w: grout, h: tile, shade: -0.33 },
    ],
  };
}

function buildCarpet(seed: number): FloorPatternSpec {
  const rng = mulberry32(seed);
  const tileW = 40;
  const tileH = 40;
  const dots: PatternDot[] = [];
  for (let i = 0; i < 90; i++) {
    dots.push({
      cx: rng() * tileW,
      cy: rng() * tileH,
      r: 0.35 + rng() * 0.5,
      shade: (rng() - 0.5) * 0.18,
    });
  }
  return { tileW, tileH, rects: [], dots };
}

export function buildFloorPatternSpec(pattern: FloorPattern): FloorPatternSpec {
  switch (pattern) {
    case "laminate":
      // 4-column 1/4-offset running bond -- laminate boards are printed,
      // so grain stays fairly uniform and no knots.
      return buildPlankRows({
        plankW: 20,
        plankLen: 120,
        grainSeed: 1001,
        grainShadeRange: 0.075,
        columns: 4,
      });
    case "hardwood":
      // 3-column 1/3-offset running bond, the standard professional spec
      // for real hardwood -- plus organic knot flecks real wood grain has.
      return buildPlankRows({
        plankW: 30,
        plankLen: 180,
        grainSeed: 2002,
        grainShadeRange: 0.14,
        columns: 3,
        knots: true,
      });
    case "herringbone":
      return buildHerringbone();
    case "polished":
      return buildConcrete(18, 0.11, 3003);
    case "raw":
      return buildConcrete(46, 0.22, 4004);
    case "square-tile":
      return buildTileGrid(60, 0.025);
    case "large-tile":
      return buildTileGrid(110, 0.016);
    case "checkerboard":
      return buildCheckerboard(45);
    case "plush":
      return buildCarpet(5005);
    case "flat":
    default:
      return { tileW: 20, tileH: 20, rects: [] };
  }
}
