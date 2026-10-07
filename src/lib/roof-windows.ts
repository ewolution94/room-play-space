import type { Opening, Point } from "@/types/planner";
import { NAMED_WALLS, resolveWallSegment } from "@/lib/hallway-shapes";
import {
  availableHeightAt,
  dormerHeight,
  inwardNormal,
  parseWallKey,
  wallCoordinates,
  type Dormer,
  type WallSlope,
  type WallSlopeMap,
} from "@/lib/wall-slopes";
import {
  OPENING_GEOMETRY,
  isWallOpening,
  openingKindLabel,
  openingTopHeight,
} from "@/lib/openings";
import type { TranslationStrings } from "@/lib/planner-translations";

/**
 * Roof windows (Dachfenster) and the rules every opening and dormer has to
 * keep once a room has slopes.
 *
 * A roof window sits in a wall's Dachschräge: \`position\`/\`width\` along the
 * wall like any opening, \`sill\` (the lower edge's height above the floor)
 * and \`slopeLength\` (measured up the slope) for where it sits in the roof.
 * On the floor plan that's a rectangle inside the slope band; in 3D a hole in
 * the slanted ceiling with glass in it.
 *
 * A sloped wall is a knee wall, so a door or ordinary window only fits where
 * a dormer raises it -- every wall opening on a sloped wall lies inside one
 * dormer, and every roof window lies outside all of them.
 */

/** The room facts the rules need. */
export interface RoomShell {
  corners: Point[];
  wallSlopes: WallSlopeMap;
  ceilingHeight: number;
  openings: Opening[];
}

type Span = { position: number; width: number };

function spansOverlap(a: Span, b: Span): boolean {
  return a.position < b.position + b.width && b.position < a.position + a.width;
}

function isEffective(slope: WallSlope | undefined, ceilingHeight: number): slope is WallSlope {
  return !!slope && slope.run > 0 && slope.kneeHeight < ceilingHeight;
}

/** A wall's length, or Infinity when the key doesn't resolve (nothing to check against). */
export function wallLength(corners: Point[], wall: string | number): number {
  const seg = resolveWallSegment(corners, wall);
  return seg ? Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) : Infinity;
}

export function roofWindowSill(o: Pick<Opening, "sill">): number {
  return o.sill ?? OPENING_GEOMETRY["roof-window"].sill;
}

export function roofWindowLength(o: Pick<Opening, "slopeLength">): number {
  return o.slopeLength ?? OPENING_GEOMETRY["roof-window"].height;
}

export interface RoofWindowGeometry {
  /** On the floor plan: the lower edge from start to end along the wall,
   * then the upper edge from end back to start. */
  footprint: [Point, Point, Point, Point];
  /** Heights of the lower and upper edge above the floor. */
  low: number;
  high: number;
  /** How far from the wall line each edge sits on the floor plan. */
  lowOff: number;
  highOff: number;
  /** The slope's pitch, degrees. */
  pitch: number;
}

/**
 * Where a roof window sits: its lower edge at \`sill\` height on the slope,
 * its upper edge \`slopeLength\` further up it, so on the floor plan it spans
 * \`slopeLength * cos(pitch)\` and it rises \`slopeLength * sin(pitch)\`. null
 * when its wall has no effective slope to sit in.
 */
export function roofWindowGeometry(
  o: Pick<Opening, "wall" | "position" | "width" | "sill" | "slopeLength">,
  corners: Point[],
  wallSlopes: WallSlopeMap | undefined,
  ceilingHeight: number,
): RoofWindowGeometry | null {
  const slope = wallSlopes?.[String(o.wall)];
  if (!isEffective(slope, ceilingHeight)) return null;
  const seg = resolveWallSegment(corners, o.wall);
  if (!seg) return null;
  const len = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
  if (len === 0) return null;
  const u = { x: (seg.b.x - seg.a.x) / len, y: (seg.b.y - seg.a.y) / len };
  const n = inwardNormal(corners, seg.a, seg.b);
  const rise = ceilingHeight - slope.kneeHeight;
  const pitch = Math.atan2(rise, slope.run);
  const low = roofWindowSill(o);
  const length = roofWindowLength(o);
  const lowOff = (slope.run * (low - slope.kneeHeight)) / rise;
  const highOff = lowOff + length * Math.cos(pitch);
  const high = low + length * Math.sin(pitch);
  const at = (along: number, off: number): Point => ({
    x: seg.a.x + u.x * along + n.x * off,
    y: seg.a.y + u.y * along + n.y * off,
  });
  const start = o.position;
  const end = o.position + o.width;
  return {
    footprint: [at(start, lowOff), at(end, lowOff), at(end, highOff), at(start, highOff)],
    low,
    high,
    lowOff,
    highOff,
    pitch: (pitch * 180) / Math.PI,
  };
}

/**
 * The lower-edge height a new roof window of \`slopeLength\` gets on this
 * slope: 100cm (OPENING_GEOMETRY), or the knee wall if that's higher, moved
 * down if it would run past the flat ceiling. null when the slope is too
 * short for it at all.
 */
export function defaultRoofWindowSill(
  slope: WallSlope,
  slopeLength: number,
  ceilingHeight: number,
): number | null {
  if (!isEffective(slope, ceilingHeight)) return null;
  const rise = ceilingHeight - slope.kneeHeight;
  const climb = slopeLength * Math.sin(Math.atan2(rise, slope.run));
  const sill = Math.min(
    Math.max(OPENING_GEOMETRY["roof-window"].sill, slope.kneeHeight),
    ceilingHeight - climb,
  );
  return sill >= slope.kneeHeight - 0.01 ? Math.round(sill) : null;
}

/** The dormer on a slope that holds the whole span, if one does. */
export function dormerAround(slope: WallSlope | undefined, span: Span): Dormer | undefined {
  return slope?.dormers?.find(
    (d) =>
      span.position >= d.position - 0.01 &&
      span.position + span.width <= d.position + d.width + 0.01,
  );
}

export type OpeningProblem =
  | { code: "out-of-bounds" }
  | { code: "overlap" }
  /** Taller than the wall (or the dormer) it's in. */
  | { code: "too-tall"; top: number; wallHeight: number; inDormer: boolean }
  /** A door or window on a sloped wall, outside every dormer. */
  | { code: "sloped-wall" }
  /** A roof window on a wall without a slope. */
  | { code: "needs-slope" }
  | { code: "below-knee"; kneeHeight: number }
  | { code: "above-slope"; ceilingHeight: number }
  /** Another wall's slope comes down lower over it than its own roof. */
  | { code: "under-other-slope" }
  /** A roof window across a dormer. */
  | { code: "in-dormer" };

/** What's wrong with one opening in this room, or null if it can be built. */
export function openingProblem(o: Opening, room: RoomShell): OpeningProblem | null {
  if (
    o.position < 0 ||
    o.width <= 0 ||
    o.position + o.width > wallLength(room.corners, o.wall) + 0.01
  ) {
    return { code: "out-of-bounds" };
  }
  const key = String(o.wall);
  const others = room.openings.filter((x) => x.id !== o.id && String(x.wall) === key);
  const slope = room.wallSlopes[key];

  if (!isWallOpening(o.kind)) {
    const geo = roofWindowGeometry(o, room.corners, room.wallSlopes, room.ceilingHeight);
    if (!isEffective(slope, room.ceilingHeight) || !geo) return { code: "needs-slope" };
    if (geo.low < slope.kneeHeight - 0.01)
      return { code: "below-knee", kneeHeight: slope.kneeHeight };
    if (geo.high > room.ceilingHeight + 0.01) {
      return { code: "above-slope", ceilingHeight: room.ceilingHeight };
    }
    if ((slope.dormers ?? []).some((d) => spansOverlap(o, d))) return { code: "in-dormer" };
    if (underOtherSlope(geo.footprint, key, room, (p) => ownSlopeHeight(p, key, slope, room))) {
      return { code: "under-other-slope" };
    }
    const clash = others.some((x) => {
      if (isWallOpening(x.kind) || !spansOverlap(o, x)) return false;
      const g = roofWindowGeometry(x, room.corners, room.wallSlopes, room.ceilingHeight);
      return !!g && geo.lowOff < g.highOff && g.lowOff < geo.highOff;
    });
    return clash ? { code: "overlap" } : null;
  }

  let wallHeight = room.ceilingHeight;
  if (slope) {
    const dormer = dormerAround(slope, o);
    if (!dormer) return { code: "sloped-wall" };
    wallHeight = dormerHeight(dormer, room.ceilingHeight);
  }
  const top = openingTopHeight(o.kind);
  if (top > wallHeight + 0.01) return { code: "too-tall", top, wallHeight, inDormer: !!slope };
  if (others.some((x) => isWallOpening(x.kind) && spansOverlap(o, x))) return { code: "overlap" };
  return null;
}

function ownSlopeHeight(p: Point, key: string, slope: WallSlope, room: RoomShell): number {
  return availableHeightAt(p, room.corners, { [key]: slope }, room.ceilingHeight, {
    dormers: false,
  });
}

/** Whether any other wall's roof comes more than half a cm lower than
 * \`ownHeight\` at one of these floor points. */
function underOtherSlope(
  points: Point[],
  key: string,
  room: RoomShell,
  ownHeight: (p: Point) => number,
): boolean {
  const otherSlopes = Object.fromEntries(
    Object.entries(room.wallSlopes).filter(([k]) => k !== key),
  );
  return points.some(
    (p) => availableHeightAt(p, room.corners, otherSlopes, room.ceilingHeight) < ownHeight(p) - 0.5,
  );
}

/** The narrowest dormer worth building: room for a 30cm window and its frame. */
export const MIN_DORMER_WIDTH = 50;

/** A new dormer's width: a typical Schleppgaube, with room for a metre-wide window. */
export const NEW_DORMER_WIDTH = 140;

export type DormerProblem =
  | { code: "out-of-bounds" }
  | { code: "too-narrow"; min: number }
  /** No higher than the knee wall it would raise. */
  | { code: "too-low"; kneeHeight: number }
  | { code: "overlap" }
  | { code: "roof-window" }
  | { code: "under-other-slope" };

/** What's wrong with one dormer on its wall, or null if it can be built. */
export function dormerProblem(
  wallKey: string,
  dormer: Dormer,
  room: RoomShell,
): DormerProblem | null {
  const slope = room.wallSlopes[wallKey];
  if (!isEffective(slope, room.ceilingHeight)) return null;
  const len = wallLength(room.corners, parseWallKey(wallKey));
  if (dormer.position < 0 || dormer.position + dormer.width > len + 0.01) {
    return { code: "out-of-bounds" };
  }
  if (dormer.width < MIN_DORMER_WIDTH) return { code: "too-narrow", min: MIN_DORMER_WIDTH };
  const height = dormerHeight(dormer, room.ceilingHeight);
  if (height <= slope.kneeHeight + 0.5) return { code: "too-low", kneeHeight: slope.kneeHeight };
  if ((slope.dormers ?? []).some((d) => d.id !== dormer.id && spansOverlap(d, dormer))) {
    return { code: "overlap" };
  }
  const roofWindows = room.openings.filter(
    (o) => !isWallOpening(o.kind) && String(o.wall) === wallKey,
  );
  if (roofWindows.some((o) => spansOverlap(o, dormer))) return { code: "roof-window" };
  // The dormer's flat ceiling, out to its depth, must not rise through
  // another wall's roof (two slopes meeting near it, a gable that's too narrow).
  const seg = resolveWallSegment(room.corners, parseWallKey(wallKey));
  if (seg) {
    const lenAB = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) || 1;
    const u = { x: (seg.b.x - seg.a.x) / lenAB, y: (seg.b.y - seg.a.y) / lenAB };
    const n = inwardNormal(room.corners, seg.a, seg.b);
    const rise = room.ceilingHeight - slope.kneeHeight;
    const depth = (slope.run * Math.max(0, height - slope.kneeHeight)) / rise;
    const at = (along: number, off: number): Point => ({
      x: seg.a.x + u.x * along + n.x * off,
      y: seg.a.y + u.y * along + n.y * off,
    });
    const end = dormer.position + dormer.width;
    const points = [at(dormer.position, 0), at(end, 0), at(end, depth), at(dormer.position, depth)];
    if (underOtherSlope(points, wallKey, room, () => height)) return { code: "under-other-slope" };
  }
  return null;
}

/** One problem in a room, named by what it's about, so a check can tell an
 * old problem (an imported file, say) from one an edit just introduced. */
export interface RoomProblem {
  key: string;
  problem: OpeningProblem | DormerProblem;
  opening?: Opening;
  dormer?: Dormer;
}

/** Every problem with the room's openings and dormers. */
export function roomProblems(room: RoomShell): RoomProblem[] {
  const out: RoomProblem[] = [];
  for (const o of room.openings) {
    const problem = openingProblem(o, room);
    if (problem) out.push({ key: `opening:${o.id}:${problem.code}`, problem, opening: o });
  }
  for (const [wallKey, slope] of Object.entries(room.wallSlopes)) {
    for (const dormer of slope.dormers ?? []) {
      const problem = dormerProblem(wallKey, dormer, room);
      if (problem) out.push({ key: `dormer:${dormer.id}:${problem.code}`, problem, dormer });
    }
  }
  return out;
}

/**
 * The first problem an edit would introduce: in \`after\` and not in
 * \`before\`. Problems a room already had are left alone, so a file imported
 * with one doesn't lock every later edit. \`about\` picks the problem to
 * report when there are several -- the one about the thing being edited
 * (moving a dormer past the wall's end is the dormer's problem, even though
 * its window, moving with it, goes past the end too).
 */
export function newRoomProblem(
  before: RoomShell,
  after: RoomShell,
  about?: (p: RoomProblem) => boolean,
): RoomProblem | null {
  const old = new Set(roomProblems(before).map((p) => p.key));
  const fresh = roomProblems(after).filter((p) => !old.has(p.key));
  return (about && fresh.find(about)) ?? fresh[0] ?? null;
}

/**
 * Where a new dormer of \`width\` fits on a wall: centred if that's free,
 * otherwise the first gap from the wall's start that clears every dormer and
 * roof window (10cm from either end). null when nothing fits.
 */
export function freeDormerPosition(wallKey: string, width: number, room: RoomShell): number | null {
  const slope = room.wallSlopes[wallKey];
  const len = wallLength(room.corners, parseWallKey(wallKey));
  if (!slope || !Number.isFinite(len)) return null;
  const taken: Span[] = [
    ...(slope.dormers ?? []),
    ...room.openings.filter((o) => String(o.wall) === wallKey && !isWallOpening(o.kind)),
  ];
  const fits = (position: number) =>
    position >= 10 - 0.01 &&
    position + width <= len - 10 + 0.01 &&
    !taken.some((s) => spansOverlap(s, { position, width }));
  const centred = Math.round((len - width) / 2);
  if (fits(centred)) return centred;
  const candidates = [10, ...taken.map((s) => Math.ceil(s.position + s.width + 10))].sort(
    (a, b) => a - b,
  );
  return candidates.find(fits) ?? null;
}

/** The window a new dormer gets in its front: centred, up to 100cm wide,
 * when a standard window (90 -> 210cm) fits under the dormer's ceiling. */
export function dormerWindowSpan(dormer: Dormer, ceilingHeight: number): Span | null {
  if (openingTopHeight("window") > dormerHeight(dormer, ceilingHeight)) return null;
  const width = Math.min(100, dormer.width - 20);
  if (width < 40) return null;
  return { position: dormer.position + (dormer.width - width) / 2, width };
}

/** Where a point on the floor sits relative to an opening's wall (for
 * dragging a roof window up and down the slope). */
export function offWallDistance(p: Point, corners: Point[], wall: Opening["wall"]): number | null {
  const seg = resolveWallSegment(corners, wall);
  return seg ? wallCoordinates(p, seg.a, seg.b).off : null;
}

/** What to tell the user about a problem an edit would introduce. */
export function roomProblemMessage(rp: RoomProblem, t: TranslationStrings): string {
  const p = rp.problem;
  if (rp.dormer) {
    switch (p.code) {
      case "out-of-bounds":
        return t.dormerOutOfBounds;
      case "too-narrow":
        return t.dormerTooNarrow(p.min);
      case "too-low":
        return t.dormerTooLow(Math.round(p.kneeHeight));
      case "overlap":
        return t.dormerOverlap;
      case "roof-window":
        return t.dormerRoofWindow;
      default:
        return t.underOtherSlope;
    }
  }
  const o = rp.opening;
  switch (p.code) {
    case "out-of-bounds":
      return t.openingOutOfBounds;
    case "overlap":
      return o && !isWallOpening(o.kind) ? t.roofWindowOverlap : t.openingOverlap;
    case "too-tall": {
      const what = o ? openingKindLabel(o, t) : t.window;
      const message = p.inDormer ? t.openingTooTallForDormer : t.openingTooTall;
      return message(what, Math.round(p.top), Math.round(p.wallHeight));
    }
    case "sloped-wall":
      return t.openingOnSlopedWall;
    case "needs-slope":
      return t.roofWindowNeedsSlope;
    case "below-knee":
      return t.roofWindowBelowKnee(Math.round(p.kneeHeight));
    case "above-slope":
      return t.roofWindowAboveSlope(Math.round(p.ceilingHeight));
    case "in-dormer":
      return t.roofWindowInDormer;
    default:
      return t.underOtherSlope;
  }
}

/** Whether an opening's whole span is inside a dormer's stretch of wall. */
export function insideDormer(span: Span, dormer: Pick<Dormer, "position" | "width">): boolean {
  return (
    span.position >= dormer.position - 0.01 &&
    span.position + span.width <= dormer.position + dormer.width + 0.01
  );
}

/** The \`Opening["wall"]\` a wall key (wallColorKey) stands for: a name for a
 * four-corner room, a number for a polygon room. null for neither. */
export function wallForKey(key: string): Opening["wall"] | null {
  const named = NAMED_WALLS.find((w) => w === key);
  if (named) return named;
  const index = Number(key);
  return key !== "" && Number.isInteger(index) && index >= 0 ? index : null;
}
