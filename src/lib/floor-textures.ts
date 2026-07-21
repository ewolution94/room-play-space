import * as THREE from "three";
import { resolveFlooring, shadeColor } from "@/lib/floor-materials";
import { buildFloorPatternSpec } from "@/lib/floor-pattern-geometry";
import type { RoomFlooring } from "@/types/planner";

/**
 * Builds (and caches) a tileable THREE.CanvasTexture for a room's flooring,
 * drawing the exact same pattern geometry the 2D SVG view uses (see
 * floor-pattern-geometry.ts) onto an offscreen 2D canvas instead of SVG
 * elements -- keeps the two views visually consistent without duplicating
 * the pattern math itself.
 *
 * Cached by `${materialKey}|${color}` (mirrors ThreeDView's existing
 * tintedMaterialCache/kitModelCache keying convention) since the same
 * flooring choice is shared across every room using it, and regenerating a
 * canvas texture per room-per-frame would be wasteful.
 */
const textureCache = new Map<
  string,
  { texture: THREE.CanvasTexture; tileW: number; tileH: number }
>();

// Pixels-per-cm for the offscreen canvas -- high enough that plank grain
// and grout lines stay crisp at typical room-scale zoom, capped by
// MAX_CANVAS_DIM below so an unusually large tile (e.g. hardwood's 60x400
// plank tile) doesn't balloon into a huge texture.
const PX_PER_CM = 6;
const MAX_CANVAS_DIM = 1024;

export function getFloorTexture(flooring: RoomFlooring | undefined): {
  texture: THREE.CanvasTexture;
  tileW: number;
  tileH: number;
} {
  const { option, color } = resolveFlooring(flooring);
  const key = `${option.key}|${color}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const spec = buildFloorPatternSpec(option.pattern);
  const scale = Math.min(PX_PER_CM, MAX_CANVAS_DIM / Math.max(spec.tileW, spec.tileH, 1));
  const w = Math.max(2, Math.round(spec.tileW * scale));
  const h = Math.max(2, Math.round(spec.tileH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);

    for (const r of spec.rects) {
      ctx.fillStyle = shadeColor(color, r.shade);
      if (!r.rotDeg) {
        ctx.fillRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale);
        continue;
      }
      const cx = (r.x + r.w / 2) * scale;
      const cy = (r.y + r.h / 2) * scale;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((r.rotDeg * Math.PI) / 180);
      ctx.fillRect((-r.w / 2) * scale, (-r.h / 2) * scale, r.w * scale, r.h * scale);
      ctx.restore();
    }

    for (const d of spec.dots ?? []) {
      ctx.fillStyle = shadeColor(color, d.shade);
      ctx.beginPath();
      ctx.arc(d.cx * scale, d.cy * scale, Math.max(0.5, d.r * scale), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  const entry = { texture, tileW: spec.tileW, tileH: spec.tileH };
  textureCache.set(key, entry);
  return entry;
}
