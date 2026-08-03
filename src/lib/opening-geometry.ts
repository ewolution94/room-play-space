import type { Point } from "@/types/planner";
import type { Opening } from "@/types/planner";
import { inwardNormal } from "@/lib/wall-slopes";

/**
 * Which way is "in", for a renderer that draws an opening in a rotated
 * local frame.
 *
 * The 2D canvas places each opening as a box rotated to its wall's angle
 * and then draws the door leaf/arc in that local frame, where "swing in"
 * means the local -y side. After a CSS `rotate(theta)` with theta =
 * atan2(b-a), local -y points along `(Uy, -Ux)` in room coordinates, where
 * U is the unit vector from a to b.
 *
 * Whether that is genuinely *into the room* depends entirely on the
 * direction a->b -- and `resolveWallSegment` deliberately walks "bottom"
 * and "left" in reverse of forward-winding order (see hallway-shapes.ts;
 * kept that way so every already-saved rectangular room keeps rendering
 * identically). So on exactly those two walls the local frame is mirrored,
 * and a `swing: "in"` door was drawn outside the room.
 *
 * That was a real, user-visible bug: a door placed in the guided wizard
 * showed inward there, outward in the room's 2D canvas, and inward again in
 * 3D -- three renderers, three answers. The wizard draws straight along
 * `inwardNormal()`, and the 3D view sidesteps it by building every wall
 * forward-wound and remapping the opening into that frame; only the 2D
 * canvas trusted the local frame.
 */
export function wallFrameIsMirrored(corners: Point[], a: Point, b: Point): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return false;
  // The direction a "swing: in" path actually draws toward, in room coords.
  const drawn = { x: dy / len, y: -(dx / len) };
  const trueIn = inwardNormal(corners, a, b);
  return drawn.x * trueIn.x + drawn.y * trueIn.y < 0;
}

/**
 * The swing a mirrored-frame renderer should draw so the result matches
 * what the opening actually means. Callers pass the segment exactly as
 * `resolveWallSegment` handed it to them.
 *
 * Deliberately a swap of the existing "in"/"out" cases rather than a
 * rewrite of the door-path math: those four hinge x swing SVG paths (and
 * their arc sweep flags) were worked out case by case and are noted in
 * docs/LEARNINGS.md as not derivable by pattern. Correcting the *input* to
 * that table leaves it untouched.
 */
export function effectiveSwing(
  swing: Opening["swing"],
  corners: Point[],
  a: Point,
  b: Point,
): "in" | "out" {
  const raw = swing ?? "in";
  if (!wallFrameIsMirrored(corners, a, b)) return raw;
  return raw === "in" ? "out" : "in";
}
