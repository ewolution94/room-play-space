import type { KitModel } from "@/types/planner";

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
