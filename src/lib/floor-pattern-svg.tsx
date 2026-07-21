import { FLOOR_MATERIAL_BY_KEY, shadeColor, resolveFlooring } from "@/lib/floor-materials";
import { buildFloorPatternSpec, type PatternRect } from "@/lib/floor-pattern-geometry";
import type { RoomFlooring } from "@/types/planner";

/**
 * Renders the <pattern> (and its children) used to paint a room's floor in
 * the 2D canvas -- one <pattern> def per room, keyed by patternId so a
 * multi-room view (if it ever needs one per room) never collides IDs.
 * `cm` is the same room-local px-per-cm scale function every other 2D
 * element already uses (CanvasArea.tsx), so the pattern tiles at the exact
 * same zoom level as the furniture.
 *
 * Rotated plank rects (only the herringbone pattern has any) are emitted
 * as <polygon> with the rotation baked directly into the 4 corner points,
 * rather than an SVG `transform="rotate()"` attribute -- functionally
 * identical in any spec-compliant renderer, but avoids any doubt since the
 * exact corner math was what got verified against a standalone rasterizer
 * during development (see floor-pattern-geometry.ts's doc comment).
 */
export function FloorPatternDef({
  flooring,
  cm,
  patternId,
}: {
  flooring: RoomFlooring | undefined;
  cm: (v: number) => number;
  patternId: string;
}) {
  const { option, color } = resolveFlooring(flooring);
  const spec = buildFloorPatternSpec(option.pattern);

  return (
    <pattern
      id={patternId}
      width={cm(spec.tileW)}
      height={cm(spec.tileH)}
      patternUnits="userSpaceOnUse"
    >
      <rect width={cm(spec.tileW)} height={cm(spec.tileH)} fill={color} />
      {spec.rects.map((r, i) => (
        <RectShape key={i} rect={r} color={color} cm={cm} />
      ))}
      {(spec.dots ?? []).map((d, i) => (
        <circle
          key={i}
          cx={cm(d.cx)}
          cy={cm(d.cy)}
          r={Math.max(0.5, cm(d.r))}
          fill={shadeColor(color, d.shade)}
        />
      ))}
    </pattern>
  );
}

function RectShape({
  rect,
  color,
  cm,
}: {
  rect: PatternRect;
  color: string;
  cm: (v: number) => number;
}) {
  const fill = shadeColor(color, rect.shade);
  if (!rect.rotDeg) {
    return (
      <rect x={cm(rect.x)} y={cm(rect.y)} width={cm(rect.w)} height={cm(rect.h)} fill={fill} />
    );
  }
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const rad = (rect.rotDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ].map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
  return <polygon points={corners.map((p) => `${cm(p.x)},${cm(p.y)}`).join(" ")} fill={fill} />;
}

// Used by the Inspector's material swatch grid -- a tiny (non-cm-scaled)
// standalone preview so each catalog option shows its actual pattern, not
// just a flat color chip.
export function FloorSwatchPreview({
  materialKey,
  color,
  size = 40,
}: {
  materialKey: string;
  color: string;
  size?: number;
}) {
  const option = FLOOR_MATERIAL_BY_KEY[materialKey] ?? FLOOR_MATERIAL_BY_KEY["plain-flat"];
  const spec = buildFloorPatternSpec(option.pattern);
  const scale = size / Math.max(spec.tileW, spec.tileH, 1);
  const cm = (v: number) => v * scale;
  const patternId = `swatch-${materialKey}-${color.replace("#", "")}`;
  return (
    // width/height are 100% (not the `size` prop) so this always exactly
    // fills whatever box it's placed in -- `size` only sets the viewBox/
    // pattern-tile math above, decoupled from the actual rendered pixel
    // size. Previously this used a fixed pixel size while its parent
    // button was a CSS-grid cell that stretched wider than that fixed
    // size, leaving empty bordered space around the visible swatch.
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="none"
      className="block rounded"
    >
      <defs>
        <FloorPatternDef flooring={{ key: materialKey, color }} cm={cm} patternId={patternId} />
      </defs>
      <rect width={size} height={size} fill={`url(#${patternId})`} />
    </svg>
  );
}
