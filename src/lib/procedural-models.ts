import type { ProceduralModel } from "@/types/planner";

/**
 * Low-poly procedural furniture shapes for presets that have no matching
 * Kenney kit model (see Preset.kitModel in types/planner.ts and the mapping
 * in planner-presets.ts -- roughly 70 of ~130 presets have a real .glb;
 * these generators fill in a meaningful chunk of the rest so the 3D view
 * doesn't fall back to a plain flat box for every recognizable piece of
 * furniture).
 *
 * Each generator is a pure function: given the item's actual current
 * width/height/length (cm -- NOT the preset default, so it reshapes live as
 * the user drags the inspector sliders, same as the plain box fallback
 * already does) plus a small params bag, it returns a flat list of
 * primitive parts (box/cylinder/cone/sphere) in a local coordinate frame:
 * x in [-w/2, w/2], z in [-l/2, l/2], y in [0, h] -- exactly the same
 * footprint-centered, floor-based frame ThreeDView.tsx already positions
 * the plain box fallback in, so a procedural group drops in at the exact
 * same outerGroup position/rotation math the kit-model path uses.
 *
 * Every part is rendered with the preset's own base color (via
 * ThreeDView.tsx's existing lighten/darken helpers and the same
 * material/roughness treatment getMaterialParams already applies to the
 * box path), offset per-part by `colorOffset` -- this is what keeps these
 * shapes visually in the same family as both the flat boxes and the
 * Kenney models (simple, low-detail primitives; no per-part custom
 * colors; same lighting response) rather than introducing a clashing
 * third visual style.
 */

export type ProceduralPartShape = "box" | "cylinder" | "cone" | "sphere";

export interface ProceduralPart {
  shape: ProceduralPartShape;
  /** Center position, cm, relative to the item's own footprint center/floor. */
  x: number;
  y: number;
  z: number;
  /**
   * Full extent along each axis, cm. For "box" this is the literal
   * width/height/depth. For "cylinder"/"cone"/"sphere" these are applied as
   * a non-uniform scale on a unit primitive (diameter along x, height along
   * y, diameter along z) -- an elliptical cross-section is fine, exactly
   * like the existing circle-shaped box-fallback path in ThreeDView.tsx.
   */
  sx: number;
  sy: number;
  sz: number;
  /**
   * -1..1: darkens (negative) or lightens (positive) this part relative to
   * the item's own base color, so accent details (drawer lines, an inset
   * panel, a firebox opening, a lamp shade) read as visually distinct
   * without every preset needing a second explicit color. Omitted/0 uses
   * the base color as-is.
   */
  colorOffset?: number;
}

export interface Dimensions3D {
  w: number;
  h: number;
  l: number;
}

type Params = Record<string, number | boolean | string>;
type ProceduralGenerator = (dims: Dimensions3D, params: Params) => ProceduralPart[];

function num(params: Params, key: string, fallback: number): number {
  const v = params[key];
  return typeof v === "number" ? v : fallback;
}
function bool(params: Params, key: string, fallback = false): boolean {
  const v = params[key];
  return typeof v === "boolean" ? v : fallback;
}
function str(params: Params, key: string, fallback: string): string {
  const v = params[key];
  return typeof v === "string" ? v : fallback;
}

/** A flat top (or round top, for stools) on four legs, with an optional mid-height shelf. */
const legFrame: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const legFrac = num(params, "legFrac", 0.06);
  const topThicknessFrac = num(params, "topThicknessFrac", 0.08);
  const roundTop = bool(params, "roundTop");
  const shelfFrac = num(params, "shelfFrac", 0);

  const legInsetX = w * legFrac;
  const legInsetZ = l * legFrac;
  const legDiam = Math.min(w, l) * legFrac * 1.4;
  const topThickness = h * topThicknessFrac;
  const legHeight = h - topThickness;

  const parts: ProceduralPart[] = [
    {
      shape: roundTop ? "cylinder" : "box",
      x: 0,
      y: h - topThickness / 2,
      z: 0,
      sx: w,
      sy: topThickness,
      sz: l,
    },
  ];

  const cornerX = w / 2 - legInsetX;
  const cornerZ = l / 2 - legInsetZ;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push({
        shape: "cylinder",
        x: sx * cornerX,
        y: legHeight / 2,
        z: sz * cornerZ,
        sx: legDiam,
        sy: legHeight,
        sz: legDiam,
        colorOffset: -0.1,
      });
    }
  }

  if (shelfFrac > 0) {
    parts.push({
      shape: roundTop ? "cylinder" : "box",
      x: 0,
      y: h * shelfFrac,
      z: 0,
      sx: w * 0.85,
      sy: topThickness * 0.6,
      sz: l * 0.85,
      colorOffset: -0.05,
    });
  }

  return parts;
};

/** A box body with N thin horizontal drawer/door-line accents, optional overhanging top. */
const cabinetBox: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const doorLines = Math.round(num(params, "doorLines", 2));
  const topOverhang = bool(params, "topOverhang");

  const parts: ProceduralPart[] = [{ shape: "box", x: 0, y: h / 2, z: 0, sx: w, sy: h, sz: l }];

  if (topOverhang) {
    parts.push({
      shape: "box",
      x: 0,
      y: h - h * 0.03,
      z: 0,
      sx: w * 1.06,
      sy: h * 0.06,
      sz: l * 1.06,
      colorOffset: 0.1,
    });
  }

  const frontZ = l / 2 + 0.3;
  for (let i = 0; i < doorLines; i++) {
    const frac = (i + 1) / (doorLines + 1);
    parts.push({
      shape: "box",
      x: 0,
      y: h * frac,
      z: frontZ,
      sx: w * 0.92,
      sy: Math.max(1.5, h * 0.02),
      sz: 1,
      colorOffset: -0.18,
    });
  }

  return parts;
};

/** A box body with a single recessed front panel (appliance fascia, a picture behind its frame). */
const panelAccentBox: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const panelWFrac = num(params, "panelWFrac", 0.7);
  const panelHFrac = num(params, "panelHFrac", 0.65);
  const colorOffset = num(params, "colorOffset", -0.25);

  return [
    { shape: "box", x: 0, y: h / 2, z: 0, sx: w, sy: h, sz: l },
    {
      shape: "box",
      x: 0,
      y: h / 2,
      z: l / 2 + 0.3,
      sx: w * panelWFrac,
      sy: h * panelHFrac,
      sz: 1,
      colorOffset,
    },
  ];
};

/** Toilet/bidet: a low pedestal base, a bowl, and an optional tank. */
const pedestalFixture: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const hasTank = bool(params, "hasTank");
  const bowlDiam = Math.min(w, l) * 0.75;
  const baseH = h * 0.35;
  const bowlH = h * (hasTank ? 0.55 : 0.7) - baseH;

  const parts: ProceduralPart[] = [
    { shape: "box", x: 0, y: baseH / 2, z: l * 0.15, sx: w * 0.6, sy: baseH, sz: l * 0.6 },
    {
      shape: "cylinder",
      x: 0,
      y: baseH + bowlH / 2,
      z: l * 0.1,
      sx: bowlDiam,
      sy: bowlH,
      sz: bowlDiam * 1.1,
    },
  ];

  if (hasTank) {
    parts.push({
      shape: "box",
      x: 0,
      y: h * 0.55 + (h * 0.45) / 2,
      z: -l * 0.32,
      sx: w * 0.7,
      sy: h * 0.45,
      sz: l * 0.3,
    });
  }

  return parts;
};

/** Bathtub/soaking-tub: an outer shell with a lighter recessed basin. */
const tubShape: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const round = bool(params, "round");
  const wallThickness = Math.min(w, l) * 0.12;

  return [
    { shape: round ? "cylinder" : "box", x: 0, y: h / 2, z: 0, sx: w, sy: h, sz: l },
    {
      shape: round ? "cylinder" : "box",
      x: 0,
      y: h * 0.55 + (h * 0.45) / 2,
      z: 0,
      sx: w - wallThickness * 2,
      sy: h * 0.45,
      sz: l - wallThickness * 2,
      colorOffset: 0.15,
    },
  ];
};

function shadePart(
  type: string,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
): ProceduralPart {
  if (type === "sphere" || type === "sphereCluster") {
    return { shape: "sphere", x, y, z, sx, sy, sz, colorOffset: 0.15 };
  }
  if (type === "disc") {
    return { shape: "cylinder", x, y, z, sx, sy: sy * 0.3, sz, colorOffset: 0.15 };
  }
  return { shape: "cone", x, y, z, sx, sy, sz, colorOffset: 0.15 };
}

/** Lamp family: floor (base+pole+shade), wall (bracket+shade), or ceiling (drop+shade/dome). */
const poleLamp: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const mount = str(params, "mount", "floor");
  const shade = str(params, "shade", "cone");
  const poleDiam = Math.min(w, l) * 0.15;
  const parts: ProceduralPart[] = [];

  if (mount === "wall") {
    parts.push({
      shape: "cylinder",
      x: 0,
      y: h * 0.3,
      z: -l * 0.3,
      sx: poleDiam,
      sy: h * 0.5,
      sz: poleDiam,
    });
    parts.push(shadePart(shade, 0, h * 0.6, l * 0.1, w * 0.9, h * 0.5, l * 0.9));
  } else if (mount === "ceiling") {
    if (shade === "disc") {
      parts.push({ shape: "cylinder", x: 0, y: h * 0.5, z: 0, sx: w, sy: h, sz: l });
    } else {
      const dropH = h * 0.5;
      parts.push({
        shape: "cylinder",
        x: 0,
        y: h - dropH / 2,
        z: 0,
        sx: poleDiam * 0.7,
        sy: dropH,
        sz: poleDiam * 0.7,
      });
      parts.push(shadePart(shade, 0, h - dropH, 0, w * 0.9, h * 0.5, l * 0.9));
    }
  } else {
    const baseDiam = Math.min(w, l) * 0.85;
    const baseH = h * 0.04;
    parts.push({
      shape: "cylinder",
      x: 0,
      y: baseH / 2,
      z: 0,
      sx: baseDiam,
      sy: baseH,
      sz: baseDiam,
      colorOffset: -0.1,
    });
    const shadeH = h * 0.22;
    const poleH = h - baseH - shadeH;
    parts.push({
      shape: "cylinder",
      x: 0,
      y: baseH + poleH / 2,
      z: 0,
      sx: poleDiam,
      sy: poleH,
      sz: poleDiam,
    });
    parts.push(shadePart(shade, 0, baseH + poleH + shadeH / 2, 0, w * 0.8, shadeH, l * 0.8));
  }

  return parts;
};

/** Two mattress slabs joined by four corner posts, plus a few ladder rungs on one side. */
const bunkBedShape: ProceduralGenerator = (dims) => {
  const { w, h, l } = dims;
  const mattressH = h * 0.12;
  const postDiam = Math.min(w, l) * 0.08;

  const parts: ProceduralPart[] = [
    { shape: "box", x: 0, y: mattressH / 2, z: 0, sx: w, sy: mattressH, sz: l },
    {
      shape: "box",
      x: 0,
      y: h - mattressH / 2,
      z: 0,
      sx: w,
      sy: mattressH,
      sz: l,
      colorOffset: -0.05,
    },
  ];

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push({
        shape: "box",
        x: sx * (w / 2 - postDiam),
        y: h / 2,
        z: sz * (l / 2 - postDiam),
        sx: postDiam,
        sy: h,
        sz: postDiam,
        colorOffset: -0.15,
      });
    }
  }

  for (let i = 1; i <= 3; i++) {
    parts.push({
      shape: "box",
      x: w / 2 + 1,
      y: (h * i) / 4,
      z: 0,
      sx: 2,
      sy: h * 0.05,
      sz: l * 0.4,
      colorOffset: -0.2,
    });
  }

  return parts;
};

/** A stepped chaise silhouette: low seat section, raised back section, four short legs. */
const loungerShape: ProceduralGenerator = (dims) => {
  const { w, h, l } = dims;
  const legH = h * 0.3;
  const seatH = h * 0.55;
  const backH = h;
  const legDiam = Math.min(w, l) * 0.06;

  const parts: ProceduralPart[] = [
    {
      shape: "box",
      x: 0,
      y: legH + (seatH - legH) / 2,
      z: -l * 0.15,
      sx: w,
      sy: seatH - legH,
      sz: l * 0.7,
    },
    {
      shape: "box",
      x: 0,
      y: legH + (backH - legH) / 2,
      z: l * 0.35,
      sx: w,
      sy: backH - legH,
      sz: l * 0.3,
      colorOffset: -0.05,
    },
  ];

  for (const sx of [-1, 1]) {
    for (const zpos of [-l * 0.4, l * 0.15]) {
      parts.push({
        shape: "cylinder",
        x: sx * (w / 2 - legDiam),
        y: legH / 2,
        z: zpos,
        sx: legDiam,
        sy: legH,
        sz: legDiam,
        colorOffset: -0.15,
      });
    }
  }

  return parts;
};

/** A planter box with a darker soil line and a few small foliage clusters poking up. */
const potAndFoliage: ProceduralGenerator = (dims) => {
  const { w, h, l } = dims;
  const potH = h * 0.6;
  const stems = 3;

  const parts: ProceduralPart[] = [
    { shape: "box", x: 0, y: potH / 2, z: 0, sx: w, sy: potH, sz: l, colorOffset: -0.1 },
    {
      shape: "box",
      x: 0,
      y: potH - h * 0.03,
      z: 0,
      sx: w * 0.9,
      sy: h * 0.06,
      sz: l * 0.9,
      colorOffset: -0.3,
    },
  ];

  for (let i = 0; i < stems; i++) {
    const fx = (i - (stems - 1) / 2) * (w / (stems + 1));
    parts.push({
      shape: "sphere",
      x: fx,
      y: potH + h * 0.2,
      z: 0,
      sx: w * 0.25,
      sy: h * 0.4,
      sz: l * 0.6,
      colorOffset: 0.2,
    });
  }

  return parts;
};

/** A cart body, a domed lid, and four short legs -- BBQ grill silhouette. */
const domedCart: ProceduralGenerator = (dims) => {
  const { w, h, l } = dims;
  const bodyH = h * 0.55;
  const legH = h * 0.25;
  const domeH = h - bodyH - legH;
  const legDiam = Math.min(w, l) * 0.08;

  const parts: ProceduralPart[] = [
    { shape: "box", x: 0, y: legH + bodyH / 2, z: 0, sx: w, sy: bodyH, sz: l },
    {
      shape: "sphere",
      x: 0,
      y: legH + bodyH + domeH * 0.3,
      z: 0,
      sx: w * 0.95,
      sy: domeH * 1.6,
      sz: l * 0.95,
      colorOffset: 0.1,
    },
  ];

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push({
        shape: "cylinder",
        x: sx * (w / 2 - legDiam),
        y: legH / 2,
        z: sz * (l / 2 - legDiam),
        sx: legDiam,
        sy: legH,
        sz: legDiam,
        colorOffset: -0.2,
      });
    }
  }

  return parts;
};

/** A wide short base and a thin center pole -- umbrella stand silhouette. */
const standAndPole: ProceduralGenerator = (dims) => {
  const { w, h, l } = dims;
  const baseH = h * 0.4;
  const poleDiam = Math.min(w, l) * 0.15;

  return [
    { shape: "cylinder", x: 0, y: baseH / 2, z: 0, sx: w, sy: baseH, sz: l, colorOffset: -0.05 },
    {
      shape: "cylinder",
      x: 0,
      y: baseH + (h - baseH) / 2,
      z: 0,
      sx: poleDiam,
      sy: h - baseH,
      sz: poleDiam,
    },
  ];
};

/** A flat base and a raised screen -- laptop silhouette (no hinge rotation, just two slabs). */
const hingedScreen: ProceduralGenerator = (dims) => {
  const { w, h, l } = dims;
  const baseH = h * 0.25;

  return [
    { shape: "box", x: 0, y: baseH / 2, z: -l * 0.1, sx: w, sy: baseH, sz: l * 0.8 },
    {
      shape: "box",
      x: 0,
      y: baseH + (h - baseH) / 2,
      z: l * 0.42,
      sx: w * 0.95,
      sy: h - baseH,
      sz: l * 0.06,
      colorOffset: 0.1,
    },
  ];
};

/** A flat handheld body with two raised thumbstick nubs and a small accent
 * button cluster -- game controller silhouette. */
const gamepadShape: ProceduralGenerator = (dims) => {
  const { w, h, l } = dims;
  const bodyH = h * 0.55;
  const stickDiam = Math.max(1.5, Math.min(w, l) * 0.16);
  const stickH = Math.max(1, h - bodyH);

  const parts: ProceduralPart[] = [
    { shape: "box", x: 0, y: bodyH / 2, z: 0, sx: w, sy: bodyH, sz: l },
  ];

  for (const sx of [-1, 1]) {
    parts.push({
      shape: "cylinder",
      x: sx * w * 0.22,
      y: bodyH + stickH / 2,
      z: -l * 0.08,
      sx: stickDiam,
      sy: stickH,
      sz: stickDiam,
      colorOffset: -0.25,
    });
  }

  parts.push({
    shape: "box",
    x: 0,
    y: bodyH + Math.max(0.5, h * 0.02),
    z: l * 0.28,
    sx: w * 0.26,
    sy: Math.max(0.5, h * 0.03),
    sz: l * 0.22,
    colorOffset: 0.2,
  });

  return parts;
};

/** A cylindrical body with either a narrower neck (vase) or a small flame cone (candle). */
const taperedVessel: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const flame = bool(params, "flame");
  const bodyH = flame ? h * 0.85 : h * 0.7;
  const neckH = h - bodyH;

  const parts: ProceduralPart[] = [
    { shape: "cylinder", x: 0, y: bodyH / 2, z: 0, sx: w, sy: bodyH, sz: l },
  ];

  if (flame) {
    parts.push({
      shape: "cone",
      x: 0,
      y: bodyH + neckH / 2,
      z: 0,
      sx: w * 0.4,
      sy: neckH * 1.6,
      sz: l * 0.4,
      colorOffset: 0.3,
    });
  } else {
    parts.push({
      shape: "cylinder",
      x: 0,
      y: bodyH + neckH / 2,
      z: 0,
      sx: w * 0.6,
      sy: neckH,
      sz: l * 0.6,
    });
  }

  return parts;
};

/** A rail-and-spindle barrier: top rail, bottom rail, corner posts, and
 * evenly spaced thin spindles between them -- the middle stays open (just
 * borders), unlike every other box/cabinet family here. Baby gate / low
 * fence silhouette. */
const railGate: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const railH = Math.max(2, h * 0.09);
  const postDiam = Math.max(2, l * 0.7);
  const spindleCount = Math.max(2, Math.round(num(params, "spindleCount", 7)));
  const spindleDiam = Math.max(1, postDiam * 0.4);

  const parts: ProceduralPart[] = [
    { shape: "box", x: 0, y: railH / 2, z: 0, sx: w, sy: railH, sz: l },
    { shape: "box", x: 0, y: h - railH / 2, z: 0, sx: w, sy: railH, sz: l, colorOffset: -0.05 },
  ];

  for (const sx of [-1, 1]) {
    parts.push({
      shape: "cylinder",
      x: sx * (w / 2 - postDiam / 2),
      y: h / 2,
      z: 0,
      sx: postDiam,
      sy: h,
      sz: postDiam,
      colorOffset: -0.15,
    });
  }

  for (let i = 1; i <= spindleCount; i++) {
    const frac = i / (spindleCount + 1);
    parts.push({
      shape: "cylinder",
      x: (frac - 0.5) * w,
      y: h / 2,
      z: 0,
      sx: spindleDiam,
      sy: Math.max(1, h - railH * 2),
      sz: spindleDiam,
      colorOffset: -0.05,
    });
  }

  return parts;
};

/** A shallow rimmed basin with a lighter recessed floor and a scatter of
 * small ball accents piled up over the rim -- kids' ball pit. */
const ballPit: ProceduralGenerator = (dims) => {
  const { w, h, l } = dims;
  const wallThickness = Math.min(w, l) * 0.12;

  const parts: ProceduralPart[] = [
    // Outer rim, full height.
    { shape: "cylinder", x: 0, y: h / 2, z: 0, sx: w, sy: h, sz: l, colorOffset: -0.1 },
    // Recessed "floor": same top height as the rim (like tubShape's basin
    // trick) so a thin ring of the darker rim stays visible around this
    // lighter, narrower disc instead of this being fully buried inside the
    // outer rim's solid body and never seen.
    {
      shape: "cylinder",
      x: 0,
      y: h * 0.6 + (h * 0.4) / 2,
      z: 0,
      sx: Math.max(1, w - wallThickness * 2),
      sy: h * 0.4,
      sz: Math.max(1, l - wallThickness * 2),
      colorOffset: 0.25,
    },
  ];

  // Balls centered just above the rim's top so roughly the top half of each
  // pokes up above the solid basin instead of being buried inside it.
  const ballSpots = [
    { fx: -0.22, fz: 0.18 },
    { fx: 0.2, fz: -0.15 },
    { fx: 0.02, fz: 0.28 },
    { fx: -0.12, fz: -0.28 },
    { fx: 0.28, fz: 0.05 },
    { fx: -0.3, fz: -0.02 },
  ];
  const ballDiam = Math.max(1, Math.min(w, l) * 0.16);
  ballSpots.forEach((spot, i) => {
    parts.push({
      shape: "sphere",
      x: w * spot.fx,
      y: h + ballDiam * (0.15 + (i % 3) * 0.12),
      z: l * spot.fz,
      sx: ballDiam,
      sy: ballDiam,
      sz: ballDiam,
      colorOffset: i % 3 === 0 ? 0.35 : i % 3 === 1 ? -0.2 : 0.1,
    });
  });

  return parts;
};

export const PROCEDURAL_GENERATORS: Record<string, ProceduralGenerator> = {
  legFrame,
  cabinetBox,
  panelAccentBox,
  pedestalFixture,
  tubShape,
  poleLamp,
  bunkBedShape,
  loungerShape,
  potAndFoliage,
  domedCart,
  standAndPole,
  hingedScreen,
  gamepadShape,
  taperedVessel,
  railGate,
  ballPit,
};

/** Every family name a Preset.proceduralModel is allowed to reference. */
export const PROCEDURAL_FAMILIES = Object.keys(PROCEDURAL_GENERATORS);

/**
 * Resolves a preset's proceduralModel spec against this item's actual
 * current dimensions. Returns an empty array (falls back to the plain box)
 * if the family name doesn't match a known generator -- defensive only;
 * a catalog-integrity test asserts every preset's family is real.
 */
export function generateProceduralParts(
  model: ProceduralModel,
  dims: Dimensions3D,
): ProceduralPart[] {
  const gen = PROCEDURAL_GENERATORS[model.family];
  if (!gen) return [];
  return gen(dims, model.params ?? {});
}
