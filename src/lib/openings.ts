import type { Opening, OpeningKind } from "@/types/planner";
import type { TranslationStrings } from "@/lib/planner-translations";

/**
 * What each kind of opening actually is, dimensionally.
 *
 * These numbers used to live as three `const`s inside ThreeDView's per-wall
 * loop, which was fine while the 3D view was the only thing that knew an
 * opening had a height at all. It isn't any more: terrace doors are defined
 * by being *bodentief* (floor-length) rather than sitting on a sill, so the
 * difference between a window and a terrace door IS the sill height -- and
 * the 2D canvas, the creation dialog and the wizard all need to agree with
 * the 3D view about it.
 *
 * Heights are in cm, measured from the floor:
 *
 *   window        90 -> 210   (a 120cm sash on a 90cm sill)
 *   door           0 -> 200   (standard interior door leaf)
 *   terrace-door   0 -> 210   (floor-length glazing; German terrace doors
 *                              are commonly 200-210, and 210 keeps a
 *                              little lintel under a 240 ceiling)
 *
 * A roof window sits in the slope, not in a wall, so its numbers are only
 * the defaults for a new one: the lower edge 100cm up (Velux suggests 90-120
 * for a view out sitting or standing) and 118cm along the slope. Each roof
 * window carries its own (`sill`, `slopeLength`), and nothing that asks how
 * tall a WALL must be counts it (isWallOpening).
 */
export const OPENING_GEOMETRY: Record<OpeningKind, { sill: number; height: number }> = {
  window: { sill: 90, height: 120 },
  door: { sill: 0, height: 200 },
  "terrace-door": { sill: 0, height: 210 },
  "roof-window": { sill: 100, height: 118 },
};

/** Is this a hole in a wall (everything but a roof window, which sits in the slope)? */
export function isWallOpening(kind: OpeningKind): boolean {
  return kind !== "roof-window";
}

/** Height of the opening's top edge above the floor. */
export function openingTopHeight(kind: OpeningKind): number {
  const g = OPENING_GEOMETRY[kind];
  return g.sill + g.height;
}

/**
 * How much taller a wall would have to be for this opening to fit in it,
 * in cm. 0 when it already fits.
 *
 * An opening is a hole in a wall, so unlike furniture -- which merely
 * stands in a room, and is warned about rather than blocked -- one that
 * doesn't fit is not a thing that can be built. A 210cm terrace door in a
 * room whose walls are 200cm high has no lintel and renders as glazing
 * floating above the wall.
 */
export function openingHeightShortfall(kind: OpeningKind, wallHeight: number): number {
  return Math.max(0, openingTopHeight(kind) - wallHeight);
}

export function openingFitsWall(kind: OpeningKind, wallHeight: number): boolean {
  return openingHeightShortfall(kind, wallHeight) === 0;
}

/**
 * The shortest a room's walls can be while still containing every opening
 * already in them -- i.e. the tallest opening's top edge. 0 for a room with
 * no openings, which is then free to have any ceiling height at all.
 */
export function requiredWallHeight(openings: Pick<Opening, "kind">[]): number {
  return openings
    .filter((o) => isWallOpening(o.kind))
    .reduce((tallest, o) => Math.max(tallest, openingTopHeight(o.kind)), 0);
}

/** Does this kind swing on hinges (leaf + arc in plan, floor space eaten)? */
export function isSwingingOpening(kind: OpeningKind): boolean {
  return kind === "door" || kind === "terrace-door";
}

/** Is this kind glazed (drawn with a glass tint, fades like glass in 3D)? */
export function isGlazedOpening(kind: OpeningKind): boolean {
  return kind === "window" || kind === "terrace-door" || kind === "roof-window";
}

/** Terrace doors come in one- and two-leaf ("einflügelig"/"zweiflügelig")
 * versions; nothing else has leaves, and a missing value means one. */
export function openingLeaves(o: Pick<Opening, "kind" | "leaves">): 1 | 2 {
  return o.kind === "terrace-door" && o.leaves === 2 ? 2 : 1;
}

/**
 * Real-world widths, used as the default when a kind is picked and as the
 * quick presets offered next to it. Sourced from what's actually sold: an
 * interior door is 80-100cm, a single-leaf terrace door the same (it's a
 * door), and a two-leaf one is simply two of those side by side.
 */
export const OPENING_WIDTH_PRESETS: Record<OpeningKind, number[]> = {
  door: [70, 80, 90, 100],
  window: [60, 90, 120, 160],
  "terrace-door": [80, 90, 100],
  // Velux's frame widths (C/F/M/P/S/U): 55 to 134cm.
  "roof-window": [55, 66, 78, 94, 114, 134],
};

/** Velux's frame lengths along the slope (04/06/08/10): 98 to 160cm, plus the short 78. */
export const ROOF_WINDOW_LENGTH_PRESETS = [78, 98, 118, 140, 160];

/** Common whole Velux sizes, width x length (CK04, FK06, MK04, MK06, MK08, SK06). */
export const ROOF_WINDOW_SIZES: [number, number][] = [
  [55, 98],
  [66, 118],
  [78, 98],
  [78, 118],
  [78, 140],
  [114, 118],
];

/** Two-leaf terrace doors get their own presets -- a 90cm one would be a
 * single leaf, so offering it under "2 leaves" would be nonsense. */
export const TERRACE_DOOR_2_WIDTH_PRESETS = [160, 180, 200];

export function defaultOpeningWidth(kind: OpeningKind, leaves: 1 | 2 = 1): number {
  if (kind === "terrace-door") return leaves === 2 ? 180 : 90;
  if (kind === "window") return 120;
  if (kind === "roof-window") return 78;
  return 90;
}

export function openingWidthPresets(kind: OpeningKind, leaves: 1 | 2 = 1): number[] {
  if (kind === "terrace-door" && leaves === 2) return TERRACE_DOOR_2_WIDTH_PRESETS;
  return OPENING_WIDTH_PRESETS[kind];
}

/**
 * What to call this opening on screen -- "Door", "Window", or a terrace
 * door with its leaf count, which is the only way to tell a 90cm single
 * from a 180cm pair once it's drawn. One function so the Elements list and
 * the canvas tooltip can't word it differently.
 */
export function openingKindLabel(
  o: Pick<Opening, "kind" | "leaves">,
  t: TranslationStrings,
): string {
  if (o.kind === "door") return t.door;
  if (o.kind === "window") return t.window;
  if (o.kind === "roof-window") return t.roofWindow;
  return `${t.terraceDoor} (${openingLeaves(o) === 1 ? t.oneLeaf : t.twoLeaves})`;
}
