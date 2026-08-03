/**
 * Layout rules for the things that float over a canvas stage.
 *
 * The stage's bottom edge is crowded: the back pill sits bottom-left, the
 * 2D/3D + Ruler toolbar bottom-centre, the scale bar bottom-right. The
 * draggable Inspector panel knew nothing about any of them, so at ordinary
 * viewport heights it simply grew down over the back button -- which is a
 * single room's only way out of the editor.
 */

/**
 * How much of the stage's bottom edge the Inspector must leave alone.
 *
 * Sized to clear the back pill: `bottom-4` (16px) plus its own ~28px height,
 * plus a little air. Applied as a uniform band rather than a cut-out around
 * the pill's exact rectangle -- the toolbar and scale bar live in the same
 * band, so reserving the strip fixes all three, and a rule you can state in
 * one sentence beats a shape that has to be recomputed whenever one of those
 * overlays changes size.
 */
export const STAGE_BOTTOM_SAFE_ZONE = 64;

/** Never squeeze the panel smaller than this, however little room is left. */
export const INSPECTOR_MIN_HEIGHT = 140;

/**
 * Clamps a dragged Inspector's top-left corner into the stage, keeping its
 * bottom edge out of the safe zone.
 *
 * Note it clamps against the panel's CURRENT height. That's deliberate and
 * self-correcting: the panel's max-height is itself derived from its y (see
 * inspectorMaxHeight), so dragging it low makes it shorter, which frees up
 * the room the clamp then allows. Clamping against some fixed nominal height
 * instead would let a tall panel overhang.
 */
export function clampInspectorPos(
  x: number,
  y: number,
  stage: { width: number; height: number },
  panel: { width: number; height: number },
): { x: number; y: number } {
  const maxX = Math.max(0, stage.width - panel.width);
  const maxY = Math.max(0, stage.height - panel.height - STAGE_BOTTOM_SAFE_ZONE);
  return {
    x: Math.max(0, Math.min(maxX, x)),
    y: Math.max(0, Math.min(maxY, y)),
  };
}

/**
 * The CSS `max-height` for an Inspector whose top is `y` px down the stage:
 * everything left below it, minus the reserved strip, but never less than
 * INSPECTOR_MIN_HEIGHT. The panel's body scrolls past that.
 *
 * This is the half that actually fixes the reported overlap. Clamping the
 * drag alone doesn't: the panel was never dragged over the back button, it
 * *grew* over it as sections were expanded.
 */
export function inspectorMaxHeight(y: number): string {
  return `max(${INSPECTOR_MIN_HEIGHT}px, calc(100% - ${Math.round(y)}px - ${STAGE_BOTTOM_SAFE_ZONE}px))`;
}
