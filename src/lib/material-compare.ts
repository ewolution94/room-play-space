import type { RoomFlooring } from "@/types/planner";
import type { FloorMaterialOption } from "@/lib/floor-materials";

/** What a wall shows when the room has no colour of its own for it (slate-100, as everywhere). */
export const DEFAULT_WALL_COLOR = "#f1f5f9";

/** The walls in `keys` all painted `color`; any other keys are kept as they were. */
export function paintAllWalls(
  wallColors: Record<string, string>,
  keys: string[],
  color: string,
): Record<string, string> {
  const next = { ...wallColors };
  for (const key of keys) next[key] = color;
  return next;
}

/**
 * Whether two sets of wall colours look the same on these walls: an unset wall counts as
 * DEFAULT_WALL_COLOR, and #ABCDEF is #abcdef (the native picker and saved rooms disagree on case).
 */
export function sameWalls(
  a: Record<string, string>,
  b: Record<string, string>,
  keys: string[],
): boolean {
  const shown = (colors: Record<string, string>, key: string) =>
    (colors[key] || DEFAULT_WALL_COLOR).toLowerCase();
  return keys.every((key) => shown(a, key) === shown(b, key));
}

/**
 * A floor option as the comparison shows and applies it: in the room's own colour for the
 * material the room had when the comparison opened (so picking it again puts the floor back
 * exactly), otherwise in the material's starting colour, as the inspector's swatches do.
 */
export function comparedFloor(option: FloorMaterialOption, before: RoomFlooring): RoomFlooring {
  return {
    key: option.key,
    color: option.key === before.key ? before.color : option.defaultColor,
  };
}
