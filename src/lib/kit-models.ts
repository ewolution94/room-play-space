import type { KitModel } from "@/types/planner";

/**
 * Facing convention for every directional kit model in this catalog
 * (chairs, sofas, beds, cabinets/credenzas with doors, TVs, ...):
 *
 * Every Kenney Furniture Kit .glb is authored with its "front" (the open
 * side of a chair away from the backrest, the foot of a bed opposite the
 * headboard, the door side of a cabinet, ...) flush with local Z=0, and
 * the rest of the object extending backward into negative Z -- i.e.
 * `kitModel.maxZ` is 0 (or very close to it) and `kitModel.minZ` is
 * negative for essentially every entry in planner-presets.ts. This isn't
 * documented anywhere by Kenney; it was confirmed empirically by loading
 * a spread of directional models (chairDesk, loungeDesignSofa, bedDouble,
 * bookcaseClosedWide, ...) and checking where their tall/asymmetric
 * feature (backrest, headboard) actually sits in the mesh's own vertex
 * data -- consistently at the minZ extreme.
 *
 * ThreeDView.tsx applies `outerGroup.rotation.y = -(it.rotation * Math.PI)
 * / 180` uniformly to every item (kit model, procedural, or plain box), so
 * this convention translates directly to `Item.rotation`: at
 * `rotation: 0`, a directional item's front faces toward larger world Z
 * (i.e. toward larger 2D `y` -- "south"/into the room, away from a wall
 * the item is backed up against at small y). rotation:90 faces west
 * (smaller x), rotation:180 faces north (smaller y), rotation:270 faces
 * east (larger x). The procedural `cabinetBox` family (procedural-
 * models.ts) was deliberately built to match: its door panel sits at
 * `+l/2`, the same local-Z-facing-front convention.
 *
 * This is why a chair placed at `rotation: 0` right in front of (i.e.
 * south of) a desk visually faces AWAY from it -- the chair needs
 * `rotation: 180` to face back north toward the desk. See
 * buildDefaultOfficeItems (use-room-planner.ts) and
 * generateDefaultApartmentLayout (default-apartment.ts) for worked
 * examples of applying this per item based on which wall (if any) it's
 * backed up against, or what it's meant to face.
 */

/**
 * How far a placed item's current width/length/height is allowed to drift
 * from its preset's own default size before ThreeDView.tsx gives up on the
 * Kenney model and falls back to the flat box.
 *
 * Why the comparison is against the preset's DEFAULT size and not the kit
 * model's raw native bounding box: every kitModel mapping already applies
 * *some* fixed stretch to go from the model's native size to the preset's
 * shipped default (e.g. "sofa" scales loungeDesignSofa.glb by roughly 2x on
 * every axis to reach 220x95x80cm) -- that stretch was chosen by hand and
 * eyeballed to still look acceptable (see the mapping table + reasoning
 * left in planner-presets.ts's history). It's fixed and never changes. The
 * only *new* risk is a user then dragging that same item's own inspector
 * sliders further away from the default -- that's what this envelope
 * guards against, independent of however much native-to-default stretch a
 * given mapping already involved.
 */
export const KIT_ENVELOPE_MIN = 0.7;
export const KIT_ENVELOPE_MAX = 1.5;

/**
 * How far the three axes are allowed to *disagree* with each other before
 * the model is dropped for a box: `max(ratio) / min(ratio)`.
 *
 * This replaced a rule that judged each axis's absolute drift from the
 * preset default independently, which conflated "big" with "distorted".
 * Scaling all three axes by 1.7 does not distort a mesh at all -- it is the
 * same bed, larger -- yet the old rule rejected it, and a user who set a
 * HEMNES bed to its real 112cm headboard height got a featureless cube.
 * What actually looks wrong is one axis stretched while another isn't: the
 * round table pinched into an oval, the lamp pole squashed fat. That is
 * disproportion, and it is what this measures.
 *
 * The bound is exclusive -- one axis may drift up to, but not including,
 * twice as far as another. That keeps the cases the fallback exists for (a
 * 1.5x wide, 0.7x deep table is 2.14; a sofa stretched to double width with
 * unchanged depth is exactly 2.0) while comfortably allowing the 1.7x that
 * a real HEMNES headboard needs.
 */
export const KIT_MAX_DISPROPORTION = 2;

/**
 * glTF is authored in meters; every other coordinate/dimension in this app
 * (room size, wall height, item width/length/height) is in centimeters.
 * `KitModel.minX/maxX/...` are already stored pre-converted to cm (see
 * planner-presets.ts), so `computeModelScale`'s returned ratio is correct
 * for cm-based position math (multiplying a cm offset like `kitModel.minX`
 * by that ratio yields a cm result). But when that same ratio is handed to
 * Three.js's `instance.scale.set(...)`, it's applied to the mesh's RAW
 * local vertex data, which GLTFLoader leaves in meters, unconverted. Feed
 * the ratio in there directly and the model renders ~100x too small
 * (visually: doesn't render at all, since it collapses to a few
 * centimeters). Multiply by this constant at that specific call site to
 * convert "meters of raw geometry" into "centimeters of app scene units."
 */
export const KIT_MODEL_UNIT_SCALE = 100;

export interface Dimensions3D {
  w: number;
  h: number;
  l: number;
}

/** The kit model's own native size (cm), derived from its bounding box. */
export function nativeSize(model: KitModel): Dimensions3D {
  return {
    w: model.maxX - model.minX,
    h: model.maxY - model.minY,
    l: model.maxZ - model.minZ,
  };
}

/**
 * Decides whether a placed item's current dimensions can still be rendered
 * with the real Kenney model, or whether stretching it to fit would look
 * visibly distorted (a round table pinched oval, a lamp pole squashed fat)
 * and the flat box is the safer choice.
 *
 * `current` and `defaultDims` are both in cm, same w/h/l shape as an Item's
 * width/height/length. The test is **disproportion between the axes**, not
 * each axis's absolute drift: a mesh scaled evenly on all three axes is not
 * distorted at any size, so only disagreement between them can make it
 * look wrong. See KIT_MAX_DISPROPORTION for what that fixed.
 */
export function resolveRenderMode(
  current: Dimensions3D,
  defaultDims: Dimensions3D,
): "model" | "box" {
  if (defaultDims.w <= 0 || defaultDims.h <= 0 || defaultDims.l <= 0) return "box";
  if (current.w <= 0 || current.h <= 0 || current.l <= 0) return "box";
  const ratios = [current.w / defaultDims.w, current.h / defaultDims.h, current.l / defaultDims.l];
  return Math.max(...ratios) / Math.min(...ratios) < KIT_MAX_DISPROPORTION ? "model" : "box";
}

/**
 * Per-axis scale to apply to the model's own local geometry (whose bounds
 * are `model`'s native min/max) so it fills exactly `target` (cm) -- the
 * item's actual current width/height/length, not necessarily the preset
 * default. Always positive; the model's own min/max corner (not
 * necessarily centered -- see KitModel's doc comment) is what
 * ThreeDView.tsx uses alongside this to compute the final position offset.
 */
export function computeModelScale(
  target: Dimensions3D,
  model: KitModel,
): { x: number; y: number; z: number } {
  const native = nativeSize(model);
  return {
    x: target.w / native.w,
    y: target.h / native.h,
    z: target.l / native.l,
  };
}
