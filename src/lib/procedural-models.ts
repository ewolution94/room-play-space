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

/** A box body with N thin horizontal drawer/door-line accents, optional
 * overhanging top, optional short corner legs (raises the whole body --
 * used for low sideboard/credenza-style cabinets that sit on visible feet
 * rather than flush to the floor). `legs` defaults off so every existing
 * (non-IKEA) preset using this family renders exactly as before. */
const cabinetBox: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const doorLines = Math.round(num(params, "doorLines", 2));
  const topOverhang = bool(params, "topOverhang");
  const legs = bool(params, "legs");

  const legH = legs ? Math.max(1, h * 0.08) : 0;
  const bodyH = Math.max(1, h - legH);
  const bodyCenterY = legH + bodyH / 2;

  const parts: ProceduralPart[] = [
    { shape: "box", x: 0, y: bodyCenterY, z: 0, sx: w, sy: bodyH, sz: l },
  ];

  if (legs) {
    const legDiam = Math.max(1, Math.min(w, l) * 0.06);
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
          colorOffset: -0.25,
        });
      }
    }
  }

  if (topOverhang) {
    parts.push({
      shape: "box",
      x: 0,
      y: legH + bodyH - bodyH * 0.03,
      z: 0,
      sx: w * 1.06,
      sy: bodyH * 0.06,
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
      y: legH + bodyH * frac,
      z: frontZ,
      sx: w * 0.92,
      sy: Math.max(1.5, bodyH * 0.02),
      sz: 1,
      colorOffset: -0.18,
    });
  }

  return parts;
};

/** Open cube-grid storage: a thin back panel plus evenly spaced horizontal
 * and vertical divider boards forming a lattice of open square-ish cubbies --
 * KALLAX/EKET/TROFAST-style shelving. Grid size is derived from the item's
 * own current width/height against `cellSize` (each product line's real
 * module is ~33-39cm) rather than a fixed cols/rows param, so one shared
 * generator auto-fits every KALLAX/EKET/TROFAST variant (1x2 through 4x4 and
 * beyond) at its own real proportions, and still looks right if a user
 * resizes one via the inspector. */
const cubeGridShelf: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const cellSize = num(params, "cellSize", 38);
  const cols = Math.max(1, Math.round(w / cellSize));
  const rows = Math.max(1, Math.round(h / cellSize));
  const frameT = Math.max(1.5, Math.min(w, l) * 0.025);
  const backT = Math.max(0.5, l * 0.04);

  const parts: ProceduralPart[] = [
    // Thin back panel.
    {
      shape: "box",
      x: 0,
      y: h / 2,
      z: -l / 2 + backT / 2,
      sx: w,
      sy: h,
      sz: backT,
      colorOffset: -0.08,
    },
  ];

  for (let i = 0; i <= rows; i++) {
    const yRaw = (h * i) / rows;
    const y = Math.min(Math.max(yRaw, frameT / 2), h - frameT / 2);
    parts.push({
      shape: "box",
      x: 0,
      y,
      z: 0,
      sx: w,
      sy: frameT,
      sz: l,
      colorOffset: i === 0 || i === rows ? 0 : -0.03,
    });
  }

  for (let i = 0; i <= cols; i++) {
    const xRaw = -w / 2 + (w * i) / cols;
    const x = Math.min(Math.max(xRaw, -w / 2 + frameT / 2), w / 2 - frameT / 2);
    parts.push({
      shape: "box",
      x,
      y: h / 2,
      z: 0,
      sx: frameT,
      sy: h,
      sz: l,
      colorOffset: i === 0 || i === cols ? 0 : -0.03,
    });
  }

  return parts;
};

/** Open bookcase: two side panels, a thin back panel, and evenly spaced
 * horizontal shelf boards with an open front -- BILLY/IVAR/HEMNES-style
 * shelving, visually distinct from the closed-door `cabinetBox` family.
 * Shelf count is derived from height against `shelfGap` (a real adjustable
 * shelf's typical spacing) rather than a fixed param, so it fits low and
 * tall variants of the same product line without per-item tuning. */
const ladderShelf: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const shelfGap = num(params, "shelfGap", 34);
  const shelfCount = Math.max(2, Math.round(h / shelfGap));
  const sideT = Math.max(1.5, w * 0.035);
  const shelfT = Math.max(1, h * 0.02);
  const backT = Math.max(0.5, l * 0.04);
  const innerW = Math.max(1, w - sideT * 2);

  const parts: ProceduralPart[] = [];

  for (const sx of [-1, 1]) {
    parts.push({
      shape: "box",
      x: sx * (w / 2 - sideT / 2),
      y: h / 2,
      z: 0,
      sx: sideT,
      sy: h,
      sz: l,
      colorOffset: -0.05,
    });
  }

  parts.push({
    shape: "box",
    x: 0,
    y: h / 2,
    z: -l / 2 + backT / 2,
    sx: innerW,
    sy: h,
    sz: backT,
    colorOffset: -0.1,
  });

  for (let i = 0; i < shelfCount; i++) {
    const frac = shelfCount === 1 ? 0 : i / (shelfCount - 1);
    const y = Math.min(Math.max(frac * h, shelfT / 2), h - shelfT / 2);
    parts.push({ shape: "box", x: 0, y, z: 0, sx: innerW, sy: shelfT, sz: l });
  }

  return parts;
};

/** Tall door cabinet on short feet: a single body raised on four short legs,
 * with vertical door-seam lines splitting the front into evenly sized
 * leaves (count derived from width against `doorWidth`, a typical single
 * door-leaf span) plus a small handle accent per leaf near its seam --
 * PAX/BRIMNES/wardrobe-style, visually distinct from a plain box or the
 * horizontal-line `cabinetBox` look. */
const doorWardrobe: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const doorWidth = num(params, "doorWidth", 55);
  const doorCount = Math.max(2, Math.round(w / doorWidth));
  const legH = Math.max(1, h * 0.03);
  const bodyH = Math.max(1, h - legH);
  const legDiam = Math.max(1, Math.min(w, l) * 0.05);

  const parts: ProceduralPart[] = [
    { shape: "box", x: 0, y: legH + bodyH / 2, z: 0, sx: w, sy: bodyH, sz: l },
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

  const frontZ = l / 2 + 0.3;
  for (let i = 1; i < doorCount; i++) {
    const x = -w / 2 + (w * i) / doorCount;
    parts.push({
      shape: "box",
      x,
      y: legH + bodyH / 2,
      z: frontZ,
      sx: Math.max(0.5, w * 0.006),
      sy: bodyH * 0.96,
      sz: 1,
      colorOffset: -0.2,
    });
  }

  for (let i = 0; i < doorCount; i++) {
    const leafCenter = -w / 2 + (w * (i + 0.5)) / doorCount;
    const handleX = leafCenter + (i % 2 === 0 ? 1 : -1) * ((w / doorCount) * 0.38);
    parts.push({
      shape: "box",
      x: handleX,
      y: legH + bodyH * 0.5,
      z: frontZ,
      sx: Math.max(0.5, w * 0.01),
      sy: bodyH * 0.12,
      sz: 1.2,
      colorOffset: 0.25,
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

// ---------------------------------------------------------------------
// Content-expansion batch (laundry/garage/gym/pets categories + depth
// additions to outdoor/media/kids/seating) -- see docs/LEARNINGS.md and
// todo.md for the research/sourcing behind this batch. Same conventions as
// every family above: pure, dimension-driven, no rotation support (cylinders
// are always Y-axis, so anything that needs to read as horizontal -- a
// ladder rung, a dumbbell bar, a pegboard peg -- is a box, not a cylinder).
// ---------------------------------------------------------------------

/** Open wire/garage shelving: four thin corner posts and evenly spaced
 * horizontal shelf boards, with no back or side panels at all -- distinct
 * from `ladderShelf`'s solid-panelled bookcase look. Shelf count derived
 * from height against `shelfGap`. */
const postShelfUnit: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const shelfGap = num(params, "shelfGap", 40);
  const shelfCount = Math.max(2, Math.round(h / shelfGap));
  const postDiam = Math.max(1, Math.min(w, l) * 0.05);
  const shelfT = Math.max(1, h * 0.015);

  const parts: ProceduralPart[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push({
        shape: "cylinder",
        x: sx * (w / 2 - postDiam / 2),
        y: h / 2,
        z: sz * (l / 2 - postDiam / 2),
        sx: postDiam,
        sy: h,
        sz: postDiam,
        colorOffset: -0.2,
      });
    }
  }
  for (let i = 0; i < shelfCount; i++) {
    const frac = shelfCount === 1 ? 0.5 : i / (shelfCount - 1);
    const y = Math.min(Math.max(frac * h, shelfT / 2), h - shelfT / 2);
    parts.push({ shape: "box", x: 0, y, z: 0, sx: w, sy: shelfT, sz: l });
  }
  return parts;
};

/** A flat wall-mounted panel with a grid of small protruding pegs --
 * garage/workshop pegboard. Grid size derived from width/height against
 * `cellSize`. */
const pegGridPanel: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const cellSize = num(params, "cellSize", 12);
  const cols = Math.max(2, Math.round(w / cellSize));
  const rows = Math.max(2, Math.round(h / cellSize));
  const pegSize = Math.max(0.5, Math.min(w, h) * 0.015);
  const pegDepth = Math.max(1, l * 0.6);

  const parts: ProceduralPart[] = [
    { shape: "box", x: 0, y: h / 2, z: 0, sx: w, sy: h, sz: l, colorOffset: -0.05 },
  ];
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const fx = c / (cols + 1);
      const fy = r / (rows + 1);
      parts.push({
        shape: "box",
        x: (fx - 0.5) * w * 0.9,
        y: fy * h,
        z: l / 2 + pegDepth / 2,
        sx: pegSize,
        sy: pegSize,
        sz: pegDepth,
        colorOffset: -0.3,
      });
    }
  }
  return parts;
};

/** Two vertical side rails with evenly spaced horizontal rungs between
 * them -- a straight ladder at tall/narrow proportions, or (wide/short,
 * more rungs) a foldable clothes drying rack. Rung count derived from
 * height against `rungGap`. */
const ladderShape: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const rungGap = num(params, "rungGap", 28);
  const rungCount = Math.max(2, Math.round(h / rungGap));
  const railDiam = Math.max(1, Math.min(w, l) * 0.4);
  const rungT = Math.max(0.5, railDiam * 0.5);

  const parts: ProceduralPart[] = [];
  for (const sx of [-1, 1]) {
    parts.push({
      shape: "box",
      x: sx * (w / 2 - railDiam / 2),
      y: h / 2,
      z: 0,
      sx: railDiam,
      sy: h,
      sz: l,
      colorOffset: -0.1,
    });
  }
  for (let i = 1; i <= rungCount; i++) {
    const frac = i / (rungCount + 1);
    parts.push({
      shape: "box",
      x: 0,
      y: frac * h,
      z: 0,
      sx: Math.max(1, w - railDiam * 2),
      sy: rungT,
      sz: rungT,
      colorOffset: -0.05,
    });
  }
  return parts;
};

/** A vertical cylindrical tank with a darker cap and a small pipe/valve
 * accent poking above the top -- water heater / propane tank silhouette. */
const cylinderTank: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const capH = Math.max(1, h * 0.08);
  const pipeDiam = Math.max(1, Math.min(w, l) * 0.15);

  return [
    { shape: "cylinder", x: 0, y: (h - capH) / 2, z: 0, sx: w, sy: h - capH, sz: l },
    {
      shape: "cylinder",
      x: 0,
      y: h - capH / 2,
      z: 0,
      sx: w * 0.7,
      sy: capH,
      sz: l * 0.7,
      colorOffset: -0.15,
    },
    {
      shape: "cylinder",
      x: 0,
      y: h + pipeDiam / 2,
      z: 0,
      sx: pipeDiam,
      sy: pipeDiam,
      sz: pipeDiam,
      colorOffset: 0.2,
    },
  ];
};

/** A body with a distinctly lighter, thinner lid slab on top -- stackable
 * storage bin/tote silhouette. */
const lidBox: ProceduralGenerator = (dims) => {
  const { w, h, l } = dims;
  const lidH = Math.max(1, h * 0.12);
  const bodyH = Math.max(1, h - lidH);

  return [
    { shape: "box", x: 0, y: bodyH / 2, z: 0, sx: w, sy: bodyH, sz: l },
    {
      shape: "box",
      x: 0,
      y: bodyH + lidH / 2,
      z: 0,
      sx: w * 1.03,
      sy: lidH,
      sz: l * 1.03,
      colorOffset: 0.2,
    },
  ];
};

/** Treadmill: a long low running deck plus two angled-look console posts
 * with a small display panel near the front. */
const treadmillShape: ProceduralGenerator = (dims) => {
  const { w, h, l } = dims;
  const deckH = Math.max(1, h * 0.15);
  const postH = Math.max(1, h - deckH);
  const postDiam = Math.max(1, w * 0.08);
  const frontZ = -l / 2 + postDiam;

  return [
    { shape: "box", x: 0, y: deckH / 2, z: 0, sx: w * 0.85, sy: deckH, sz: l, colorOffset: -0.1 },
    {
      shape: "box",
      x: -w * 0.35,
      y: deckH + postH / 2,
      z: frontZ,
      sx: postDiam,
      sy: postH,
      sz: postDiam,
    },
    {
      shape: "box",
      x: w * 0.35,
      y: deckH + postH / 2,
      z: frontZ,
      sx: postDiam,
      sy: postH,
      sz: postDiam,
    },
    {
      shape: "box",
      x: 0,
      y: deckH + postH * 0.92,
      z: frontZ,
      sx: w * 0.7,
      sy: postH * 0.22,
      sz: 2,
      colorOffset: 0.15,
    },
  ];
};

/** Stationary exercise bike: a base plank, a front flywheel hub, a rear
 * seat post + saddle, and a forward handlebar post + bars. */
const exerciseBikeShape: ProceduralGenerator = (dims) => {
  const { w, h, l } = dims;
  const baseH = Math.max(1, h * 0.08);
  const seatH = h * 0.75;
  const barH = h * 0.95;
  const postDiam = Math.max(1, Math.min(w, l) * 0.1);
  const flywheelDiam = Math.max(1, Math.min(w, l) * 0.5);

  return [
    { shape: "box", x: 0, y: baseH / 2, z: 0, sx: w * 0.5, sy: baseH, sz: l, colorOffset: -0.1 },
    {
      shape: "cylinder",
      x: 0,
      y: baseH + flywheelDiam / 2,
      z: -l * 0.35,
      sx: flywheelDiam,
      sy: flywheelDiam * 0.25,
      sz: flywheelDiam,
      colorOffset: -0.2,
    },
    {
      shape: "cylinder",
      x: 0,
      y: baseH + seatH / 2,
      z: l * 0.25,
      sx: postDiam,
      sy: seatH,
      sz: postDiam,
    },
    {
      shape: "box",
      x: 0,
      y: baseH + seatH,
      z: l * 0.25,
      sx: w * 0.35,
      sy: postDiam,
      sz: l * 0.2,
      colorOffset: 0.1,
    },
    {
      shape: "cylinder",
      x: 0,
      y: baseH + barH / 2,
      z: -l * 0.1,
      sx: postDiam,
      sy: barH,
      sz: postDiam,
    },
    {
      shape: "box",
      x: 0,
      y: baseH + barH,
      z: -l * 0.1,
      sx: w * 0.7,
      sy: postDiam,
      sz: postDiam,
      colorOffset: -0.1,
    },
  ];
};

/** Tiered dumbbell rack: two side frames, evenly spaced shelves (count via
 * `tiers`), and a pair of sphere+bar dumbbell accents resting on each. */
const dumbbellRackShape: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const tierCount = Math.max(2, Math.round(num(params, "tiers", 3)));
  const frameDiam = Math.max(1, Math.min(w, l) * 0.08);
  const shelfT = Math.max(1, h * 0.04);

  const parts: ProceduralPart[] = [];
  for (const sx of [-1, 1]) {
    parts.push({
      shape: "box",
      x: sx * (w / 2 - frameDiam / 2),
      y: h / 2,
      z: 0,
      sx: frameDiam,
      sy: h,
      sz: l,
      colorOffset: -0.15,
    });
  }
  for (let i = 0; i < tierCount; i++) {
    const frac = (i + 1) / (tierCount + 1);
    const y = frac * h;
    parts.push({ shape: "box", x: 0, y, z: 0, sx: w, sy: shelfT, sz: l, colorOffset: -0.05 });
    const ballDiam = Math.max(1, l * 0.4);
    for (const dSign of [-1, 1]) {
      const dx = dSign * w * 0.22;
      parts.push({
        shape: "sphere",
        x: dx - dSign * ballDiam * 0.35,
        y: y + ballDiam / 2,
        z: 0,
        sx: ballDiam,
        sy: ballDiam,
        sz: ballDiam,
        colorOffset: 0.15,
      });
      parts.push({
        shape: "sphere",
        x: dx + dSign * ballDiam * 0.35,
        y: y + ballDiam / 2,
        z: 0,
        sx: ballDiam,
        sy: ballDiam,
        sz: ballDiam,
        colorOffset: 0.15,
      });
      parts.push({
        shape: "box",
        x: dx,
        y: y + ballDiam / 2,
        z: 0,
        sx: ballDiam * 0.6,
        sy: ballDiam * 0.35,
        sz: ballDiam * 0.35,
        colorOffset: -0.1,
      });
    }
  }
  return parts;
};

/** Squat/power rack: four tall vertical posts joined by a top brace and a
 * mid-height safety-bar brace, front and back. */
const squatRackShape: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const postDiam = Math.max(1, Math.min(w, l) * 0.08);
  const braceT = Math.max(1, postDiam * 0.6);
  const midFrac = num(params, "midFrac", 0.4);

  const parts: ProceduralPart[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push({
        shape: "box",
        x: sx * (w / 2 - postDiam / 2),
        y: h / 2,
        z: sz * (l / 2 - postDiam / 2),
        sx: postDiam,
        sy: h,
        sz: postDiam,
        colorOffset: -0.15,
      });
    }
  }
  for (const sz of [-1, 1]) {
    parts.push({
      shape: "box",
      x: 0,
      y: h - braceT / 2,
      z: sz * (l / 2 - postDiam / 2),
      sx: w,
      sy: braceT,
      sz: braceT,
      colorOffset: -0.05,
    });
    parts.push({
      shape: "box",
      x: 0,
      y: h * midFrac,
      z: sz * (l / 2 - postDiam / 2),
      sx: w,
      sy: braceT,
      sz: braceT,
      colorOffset: 0.05,
    });
  }
  return parts;
};

/** Wall-mounted pull-up bar: two small brackets and a horizontal bar
 * between them. */
const wallBarShape: ProceduralGenerator = (dims) => {
  const { w, h, l } = dims;
  const bracketW = Math.max(1, w * 0.12);
  const barDiam = Math.max(1, Math.min(h, l) * 0.5);

  const parts: ProceduralPart[] = [];
  for (const sx of [-1, 1]) {
    parts.push({
      shape: "box",
      x: sx * (w / 2 - bracketW / 2),
      y: h / 2,
      z: 0,
      sx: bracketW,
      sy: h,
      sz: l,
      colorOffset: -0.2,
    });
  }
  parts.push({
    shape: "box",
    x: 0,
    y: h * 0.85,
    z: 0,
    sx: Math.max(1, w - bracketW * 2),
    sy: barDiam,
    sz: barDiam,
  });
  return parts;
};

/** Cat tree: a base platform, one carpeted vertical post, and one or more
 * perch platforms at different heights (count via `perches`). */
const catTreeShape: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const baseH = Math.max(1, h * 0.08);
  const postDiam = Math.max(1, Math.min(w, l) * 0.35);
  const perchCount = Math.max(1, Math.round(num(params, "perches", 2)));

  const parts: ProceduralPart[] = [
    { shape: "cylinder", x: 0, y: baseH / 2, z: 0, sx: w, sy: baseH, sz: l, colorOffset: -0.1 },
    {
      shape: "cylinder",
      x: 0,
      y: baseH + (h - baseH) / 2,
      z: 0,
      sx: postDiam,
      sy: h - baseH,
      sz: postDiam,
      colorOffset: 0.05,
    },
  ];
  for (let i = 1; i <= perchCount; i++) {
    const frac = Math.min(0.95, i / (perchCount + 1) + 0.15);
    const y = h * frac;
    const perchDiam = w * (0.6 + i * 0.1);
    parts.push({
      shape: "cylinder",
      x: (i % 2 === 0 ? 1 : -1) * w * 0.1,
      y,
      z: 0,
      sx: perchDiam,
      sy: baseH * 0.6,
      sz: perchDiam,
      colorOffset: -0.05,
    });
  }
  return parts;
};

/** Open wire pet crate: a solid base tray, four corner posts, and a top
 * frame outline -- open sides implied by leaving them absent, same
 * philosophy as `railGate`. */
const crateShape: ProceduralGenerator = (dims) => {
  const { w, h, l } = dims;
  const trayH = Math.max(1, h * 0.08);
  const postDiam = Math.max(1, Math.min(w, l) * 0.04);
  const frameT = Math.max(0.5, postDiam * 0.7);

  const parts: ProceduralPart[] = [
    { shape: "box", x: 0, y: trayH / 2, z: 0, sx: w, sy: trayH, sz: l, colorOffset: -0.15 },
  ];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push({
        shape: "cylinder",
        x: sx * (w / 2 - postDiam / 2),
        y: h / 2,
        z: sz * (l / 2 - postDiam / 2),
        sx: postDiam,
        sy: h,
        sz: postDiam,
        colorOffset: -0.1,
      });
    }
  }
  for (const sz of [-1, 1]) {
    parts.push({
      shape: "box",
      x: 0,
      y: h - frameT / 2,
      z: sz * (l / 2 - postDiam / 2),
      sx: w,
      sy: frameT,
      sz: frameT,
      colorOffset: 0.1,
    });
  }
  for (const sx of [-1, 1]) {
    parts.push({
      shape: "box",
      x: sx * (w / 2 - postDiam / 2),
      y: h - frameT / 2,
      z: 0,
      sx: postDiam,
      sy: frameT,
      sz: l,
      colorOffset: 0.1,
    });
  }
  return parts;
};

/** A flat floor mat with two shallow bowls -- pet food/water station. */
const bowlStation: ProceduralGenerator = (dims) => {
  const { w, h, l } = dims;
  const matH = Math.max(0.5, h * 0.15);
  const bowlH = Math.max(1, h - matH);
  const bowlDiam = Math.min(w, l) * 0.35;

  const parts: ProceduralPart[] = [
    { shape: "box", x: 0, y: matH / 2, z: 0, sx: w, sy: matH, sz: l, colorOffset: -0.05 },
  ];
  for (const sx of [-1, 1]) {
    parts.push({
      shape: "cylinder",
      x: sx * w * 0.22,
      y: matH + bowlH / 2,
      z: 0,
      sx: bowlDiam,
      sy: bowlH,
      sz: bowlDiam,
      colorOffset: sx > 0 ? 0.15 : -0.15,
    });
  }
  return parts;
};

/** Round fire pit: an outer rim, a darker recessed inner bowl (like
 * `tubShape`'s basin trick), and a small flame cone. */
const firePitShape: ProceduralGenerator = (dims) => {
  const { w, h, l } = dims;
  const wallThickness = Math.min(w, l) * 0.15;
  const flameH = h * 0.6;

  return [
    { shape: "cylinder", x: 0, y: h / 2, z: 0, sx: w, sy: h, sz: l, colorOffset: -0.1 },
    {
      shape: "cylinder",
      x: 0,
      y: h * 0.55 + (h * 0.45) / 2,
      z: 0,
      sx: Math.max(1, w - wallThickness * 2),
      sy: h * 0.45,
      sz: Math.max(1, l - wallThickness * 2),
      colorOffset: -0.3,
    },
    {
      shape: "cone",
      x: 0,
      y: h + flameH / 2,
      z: 0,
      sx: w * 0.3,
      sy: flameH,
      sz: l * 0.3,
      colorOffset: 0.4,
    },
  ];
};

/** Hammock: two end uprights (each with a small crossbar accent) and a
 * shallow bed slung between them at mid-height. */
const hammockShape: ProceduralGenerator = (dims) => {
  const { w, h, l } = dims;
  const postDiam = Math.max(1, Math.min(w, h) * 0.08);
  const bedH = h * 0.4;

  const parts: ProceduralPart[] = [];
  for (const sz of [-1, 1]) {
    parts.push({
      shape: "cylinder",
      x: 0,
      y: h / 2,
      z: sz * (l / 2 - postDiam / 2),
      sx: postDiam,
      sy: h,
      sz: postDiam,
      colorOffset: -0.15,
    });
    parts.push({
      shape: "box",
      x: 0,
      y: h * 0.92,
      z: sz * (l / 2 - postDiam / 2),
      sx: w * 0.5,
      sy: postDiam * 0.6,
      sz: postDiam,
      colorOffset: -0.05,
    });
  }
  parts.push({
    shape: "box",
    x: 0,
    y: bedH,
    z: 0,
    sx: w,
    sy: Math.max(1, h * 0.08),
    sz: l * 0.7,
    colorOffset: 0.1,
  });
  return parts;
};

/** Crib: a mattress slab, four tall corner posts, and vertical slatted
 * side rails (like `railGate`'s spindle technique). Spindle count via
 * `spindleCount`. */
const cribShape: ProceduralGenerator = (dims, params) => {
  const { w, h, l } = dims;
  const mattressH = Math.max(1, h * 0.15);
  const postDiam = Math.max(1, Math.min(w, l) * 0.06);
  const spindleCount = Math.max(2, Math.round(num(params, "spindleCount", 6)));
  const spindleDiam = Math.max(0.5, postDiam * 0.35);

  const parts: ProceduralPart[] = [
    {
      shape: "box",
      x: 0,
      y: Math.min(h * 0.95, mattressH * 1.5),
      z: 0,
      sx: w * 0.94,
      sy: mattressH,
      sz: l * 0.94,
      colorOffset: 0.1,
    },
  ];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push({
        shape: "cylinder",
        x: sx * (w / 2 - postDiam / 2),
        y: h / 2,
        z: sz * (l / 2 - postDiam / 2),
        sx: postDiam,
        sy: h,
        sz: postDiam,
        colorOffset: -0.1,
      });
    }
  }
  for (const sz of [-1, 1]) {
    for (let i = 1; i <= spindleCount; i++) {
      const frac = i / (spindleCount + 1);
      parts.push({
        shape: "cylinder",
        x: (frac - 0.5) * Math.max(1, w - postDiam * 2),
        y: h * 0.6,
        z: sz * (l / 2 - postDiam / 2),
        sx: spindleDiam,
        sy: h * 0.8,
        sz: spindleDiam,
        colorOffset: -0.05,
      });
    }
  }
  return parts;
};

/** High chair: a seat box with a backrest panel on four tall thin legs,
 * plus a small forward tray. */
const highChairShape: ProceduralGenerator = (dims) => {
  const { w, h, l } = dims;
  const seatH = h * 0.55;
  const seatT = Math.max(1, h * 0.08);
  const legDiam = Math.max(1, Math.min(w, l) * 0.08);
  const backH = Math.max(1, h - seatH);

  const parts: ProceduralPart[] = [
    { shape: "box", x: 0, y: seatH, z: 0, sx: w * 0.85, sy: seatT, sz: l * 0.85 },
    {
      shape: "box",
      x: 0,
      y: seatH + backH / 2,
      z: -l * 0.38,
      sx: w * 0.8,
      sy: backH,
      sz: Math.max(1, l * 0.1),
      colorOffset: -0.05,
    },
    {
      shape: "box",
      x: 0,
      y: seatH + seatT,
      z: l * 0.3,
      sx: w * 0.75,
      sy: Math.max(1, h * 0.03),
      sz: l * 0.25,
      colorOffset: 0.15,
    },
  ];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push({
        shape: "cylinder",
        x: sx * (w / 2 - legDiam),
        y: seatH / 2,
        z: sz * (l / 2 - legDiam),
        sx: legDiam,
        sy: seatH,
        sz: legDiam,
        colorOffset: -0.15,
      });
    }
  }
  return parts;
};

/** Bean bag chair: a large squashed sphere body with a smaller fold
 * accent near the top. */
const beanBagShape: ProceduralGenerator = (dims) => {
  const { w, h, l } = dims;
  return [
    { shape: "sphere", x: 0, y: h * 0.42, z: 0, sx: w, sy: h * 0.85, sz: l },
    {
      shape: "sphere",
      x: 0,
      y: h * 0.72,
      z: 0,
      sx: w * 0.5,
      sy: h * 0.35,
      sz: l * 0.5,
      colorOffset: -0.08,
    },
  ];
};

/** Low padded base with a thick cushion slab on top -- futon/daybed
 * silhouette. */
const paddedBaseShape: ProceduralGenerator = (dims) => {
  const { w, h, l } = dims;
  const baseH = h * 0.35;
  const cushionH = Math.max(1, h - baseH);

  return [
    {
      shape: "box",
      x: 0,
      y: baseH / 2,
      z: 0,
      sx: w * 0.96,
      sy: baseH,
      sz: l * 0.96,
      colorOffset: -0.15,
    },
    {
      shape: "box",
      x: 0,
      y: baseH + cushionH / 2,
      z: 0,
      sx: w,
      sy: cushionH,
      sz: l,
      colorOffset: 0.12,
    },
  ];
};

export const PROCEDURAL_GENERATORS: Record<string, ProceduralGenerator> = {
  legFrame,
  cabinetBox,
  cubeGridShelf,
  ladderShelf,
  doorWardrobe,
  postShelfUnit,
  pegGridPanel,
  ladderShape,
  cylinderTank,
  lidBox,
  treadmillShape,
  exerciseBikeShape,
  dumbbellRackShape,
  squatRackShape,
  wallBarShape,
  catTreeShape,
  crateShape,
  bowlStation,
  firePitShape,
  hammockShape,
  cribShape,
  highChairShape,
  beanBagShape,
  paddedBaseShape,
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
