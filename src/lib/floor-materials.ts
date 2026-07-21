import type { FloorFamily, FloorPattern, RoomFlooring } from "@/types/planner";

/**
 * The flooring catalog: every family x pattern combination a room can pick
 * as its floor surface (see RoomFlooring/FloorFamily/FloorPattern in
 * types/planner.ts). Each option is a *shape* -- planks, tile grout lines,
 * fiber noise, etc -- rendered by src/lib/floor-pattern-svg.tsx (2D) and
 * src/lib/floor-textures.ts (3D). The actual displayed color always comes
 * from the room's own RoomFlooring.color, not from `defaultColor` here --
 * `defaultColor` is only the starting swatch color offered when a user
 * first picks that option in the inspector, exactly like how a catalog
 * Preset's own `color` is just a starting point for a placed Item.
 */
export interface FloorMaterialOption {
  key: string;
  family: FloorFamily;
  pattern: FloorPattern;
  nameEn: string;
  nameDe: string;
  defaultColor: string;
}

export const FLOOR_MATERIALS: FloorMaterialOption[] = [
  {
    key: "wood-laminate",
    family: "wood",
    pattern: "laminate",
    nameEn: "Laminate",
    nameDe: "Laminat",
    defaultColor: "#c9a06b",
  },
  {
    key: "wood-hardwood",
    family: "wood",
    pattern: "hardwood",
    nameEn: "Hardwood",
    nameDe: "Hartholz",
    defaultColor: "#8b5a2b",
  },
  {
    key: "wood-herringbone",
    family: "wood",
    pattern: "herringbone",
    nameEn: "Herringbone Parquet",
    nameDe: "Fischgrätparkett",
    defaultColor: "#a9744f",
  },
  {
    key: "concrete-polished",
    family: "concrete",
    pattern: "polished",
    nameEn: "Polished Concrete",
    nameDe: "Polierbeton",
    defaultColor: "#a8adb4",
  },
  {
    key: "concrete-raw",
    family: "concrete",
    pattern: "raw",
    nameEn: "Raw Concrete",
    nameDe: "Rohbeton",
    defaultColor: "#8f95a0",
  },
  {
    key: "tile-square",
    family: "tile",
    pattern: "square-tile",
    nameEn: "Square Tile",
    nameDe: "Fliesen (quadratisch)",
    defaultColor: "#e8e6e1",
  },
  {
    key: "tile-large",
    family: "tile",
    pattern: "large-tile",
    nameEn: "Large Format Tile",
    nameDe: "Grossformatfliesen",
    defaultColor: "#dcdad5",
  },
  {
    key: "tile-checkerboard",
    family: "tile",
    pattern: "checkerboard",
    nameEn: "Checkerboard Tile",
    nameDe: "Schachbrettfliesen",
    defaultColor: "#e8e6e1",
  },
  {
    key: "carpet-plush",
    family: "carpet",
    pattern: "plush",
    nameEn: "Carpet",
    nameDe: "Teppichboden",
    defaultColor: "#a9998a",
  },
  {
    key: "plain-flat",
    family: "plain",
    pattern: "flat",
    nameEn: "Plain Color",
    nameDe: "Einfarbig",
    defaultColor: "#e2e8f0",
  },
];

export const FLOOR_MATERIAL_BY_KEY: Record<string, FloorMaterialOption> = Object.fromEntries(
  FLOOR_MATERIALS.map((m) => [m.key, m]),
);

// Fallback for any room saved before this feature existed (no `flooring`
// field at all) -- a neutral light gray flat fill, close to the plain
// background this app already showed before floor materials existed, so
// old layouts don't visually jump on load.
export const DEFAULT_FLOORING: RoomFlooring = { key: "plain-flat", color: "#e2e8f0" };

export function resolveFlooring(flooring: RoomFlooring | undefined): {
  option: FloorMaterialOption;
  color: string;
} {
  const chosen = flooring ?? DEFAULT_FLOORING;
  const option = FLOOR_MATERIAL_BY_KEY[chosen.key] ?? FLOOR_MATERIAL_BY_KEY["plain-flat"];
  return { option, color: chosen.color || option.defaultColor };
}

// ---- Color shade helpers -----------------------------------------------
// Every pattern (plank seams, tile grout, carpet fiber flecks) is drawn
// using shades DERIVED from the room's own chosen color rather than a
// second color the user has to pick separately -- one color in, a whole
// tinted material out. `percent` > 0 lightens, < 0 darkens; magnitude is
// roughly how much of the remaining distance to white/black to move.
export function shadeColor(hex: string, percent: number): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0").slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return hex;
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const mix = (channel: number) =>
    percent >= 0
      ? Math.round(channel + (255 - channel) * percent)
      : Math.round(channel + channel * percent);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const nr = clamp(mix(r));
  const ng = clamp(mix(g));
  const nb = clamp(mix(b));
  return `#${[nr, ng, nb].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// A tiny deterministic pseudo-random generator (mulberry32) used by both
// the 2D SVG and 3D canvas-texture renderers so per-plank/per-fleck
// "randomness" (grain streaks, carpet flecks, concrete speckle) is
// identical across renders/sessions instead of jittering on every
// re-render -- purely cosmetic noise, but stable noise looks intentional
// and jittery noise looks broken.
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
