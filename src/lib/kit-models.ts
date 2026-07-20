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
 * Decides whether a placed item's current dimensions are close enough to
 * its preset's default size to still render the real Kenney model, or
 * whether it's drifted far enough that stretching the model would look
 * visibly distorted (a round table pinched oval, a lamp pole squashed
 * fat, ...) and the flat box is the safer choice.
 *
 * `current` and `defaultDims` are both in cm, same w/h/l shape as an Item's
 * width/height/length. Every ratio (not just one axis) must fall inside
 * [KIT_ENVELOPE_MIN, KIT_ENVELOPE_MAX] for the model to still be used --
 * one wildly-off axis is enough to fall back, even if the other two are
 * unchanged.
 */
export function resolveRenderMode(
  current: Dimensions3D,
  defaultDims: Dimensions3D,
): "model" | "box" {
  if (defaultDims.w <= 0 || defaultDims.h <= 0 || defaultDims.l <= 0) return "box";
  const ratios = [current.w / defaultDims.w, current.h / defaultDims.h, current.l / defaultDims.l];
  return ratios.every((r) => r >= KIT_ENVELOPE_MIN && r <= KIT_ENVELOPE_MAX) ? "model" : "box";
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
