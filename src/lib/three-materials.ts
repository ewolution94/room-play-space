/**
 * Material-state helpers for the 3D view, kept out of ThreeDView.tsx so the
 * rule they encode can be stated -- and tested -- on its own.
 *
 * Typed structurally rather than against THREE.Material: these only ever
 * touch two boolean-ish fields, and keeping three.js out of this module
 * means the rules can be exercised in a plain node test.
 */
export interface TransparencyTarget {
  transparent: boolean;
  needsUpdate?: boolean;
}

/**
 * Flip a material between the opaque and transparent render queues, but
 * only when the answer actually changed.
 *
 * **Being transparent is neither free nor cosmetic.** three.js builds the
 * refraction seen through a `transmission` material from a render pass that
 * contains only the OPAQUE list -- every transparent object is excluded by
 * construction. So a surface flagged `transparent` does not exist as far as
 * any glass in the scene is concerned, even at full opacity.
 *
 * That is exactly how looking in through a window used to show the ground
 * grid where the room's far walls should be: the wall-fade loop set
 * `transparent = true` on every wall material on every frame, whether or
 * not it was actually fading, so no wall was ever in the pass the glass
 * samples. Large terrace-door glazing made it impossible to miss.
 *
 * The early return matters too: `transparent` participates in material
 * state, so assigning it (and `needsUpdate`) 60 times a second for a value
 * that hasn't changed is pure waste.
 *
 * @returns whether anything changed -- handy in tests, ignored in the loop.
 */
export function setMaterialTransparency(
  material: TransparencyTarget,
  transparent: boolean,
): boolean {
  if (material.transparent === transparent) return false;
  material.transparent = transparent;
  material.needsUpdate = true;
  return true;
}

/**
 * Whether a surface at this opacity should count as translucent.
 *
 * The small tolerance is deliberate. It pairs with settleOpacity below: an
 * exponential lerp only ever *approaches* its target, so without both of
 * these a wall returning to solid would sit fractionally under 1 -- still
 * counted translucent, and so still missing from every window's glass --
 * long after it looks solid.
 */
export function isTranslucent(opacity: number): boolean {
  return opacity < 0.999;
}

/**
 * The result of one fade step, snapped to the target once it is close
 * enough to make no visible difference.
 *
 * Without this the fade has an infinitely long tail: `lerp(x, 1, 0.12)`
 * closes 12% of the remaining gap per frame, so it approaches 1 but takes
 * roughly a second to get within a thousandth of it -- during which the
 * surface still counts as translucent. Snapping ends the transition
 * cleanly, which is what makes the opaque/transparent switch above
 * dependable rather than "eventually".
 */
export function settleOpacity(current: number, target: number, epsilon = 0.005): number {
  return Math.abs(current - target) < epsilon ? target : current;
}
