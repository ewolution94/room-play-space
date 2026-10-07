import React, { useId } from "react";
import type { Item, Opening, Point, RoomFlooring } from "@/types/planner";
import {
  polygonBoundingBox,
  resolveWallSegment,
  wallColorKey,
  wallSegments,
} from "@/lib/hallway-shapes";
import { resolveFlooring } from "@/lib/floor-materials";
import { FloorPatternDef } from "@/lib/floor-pattern-svg";
import { DEFAULT_WALL_COLOR } from "@/lib/material-compare";
import {
  DEFAULT_CEILING_HEIGHT,
  dormerFootprints,
  inwardNormal,
  type WallSlopeMap,
} from "@/lib/wall-slopes";
import { roofWindowGeometry } from "@/lib/roof-windows";
import { openingClearance } from "@/lib/clearance";
import { isSwingingOpening, isWallOpening } from "@/lib/openings";
import { readableText } from "@/lib/planner-math";

interface RoomPlanSvgProps {
  corners: Point[];
  openings: Opening[];
  items: Item[];
  /** Text drawn upright on an item's centre, by item id: the blueprint's legend numbers. */
  labels?: Map<string, string>;
  className?: string;
  /** Accessible name for the drawing. */
  title: string;
  /** Overall width and length along the outside, and a 1 m scale bar: for the printed blueprint. */
  dimensions?: boolean;
  /** The floor in the room's material (lib/floor-pattern-svg.tsx) instead of a plain tone. */
  flooring?: RoomFlooring;
  /**
   * Each wall in its own colour, keyed like RoomLayout.wallColors: the material comparison's
   * view. The walls become a band around the outside, thick enough to judge a colour by at
   * thumbnail size; on the outside so it never covers the floor or the furniture.
   */
  wallColors?: Record<string, string>;
  /** With the room's slopes, roof windows and dormers are drawn where they
   * sit, dashed, the way a plan shows what's overhead. */
  wallSlopes?: WallSlopeMap;
  ceilingHeight?: number;
}

const WALL_CM = 6;
const PAD_CM = 30;
/** Room for the dimension labels and the scale bar when `dimensions` is on. */
const DIMENSION_PAD_CM = 70;
const RIM = "#334155";

/**
 * A static, top-down drawing of one room in room centimetres (the viewBox), for the share-link
 * preview, the printable blueprint and the material comparison: walls, doors and windows cut
 * into them, a door's swing (the same quarter circle the clearance warnings use,
 * lib/clearance.ts) and the furniture in its own colours. Deliberately simpler than the editor's
 * canvas: nothing here is interactive.
 */
export function RoomPlanSvg({
  corners,
  openings,
  items,
  labels,
  className,
  title,
  dimensions,
  flooring,
  wallColors,
  wallSlopes,
  ceilingHeight = DEFAULT_CEILING_HEIGHT,
}: RoomPlanSvgProps) {
  const patternId = `plan-floor-${useId().replace(/[^\w-]/g, "")}`;
  const bb = polygonBoundingBox(corners);
  // Painted walls: a band of `paint` with a thin `rim` outside it.
  const paint = wallColors ? Math.max(WALL_CM, Math.max(bb.width, bb.height) / 16) : 0;
  const rim = paint / 8;
  const pad = dimensions ? DIMENSION_PAD_CM : Math.max(PAD_CM, paint + rim + 10);
  const viewBox = `${bb.minX - pad} ${bb.minY - pad} ${bb.width + 2 * pad} ${bb.height + 2 * pad}`;
  const textSize = Math.max(10, Math.min(bb.width, bb.height) / 28);
  const points = corners.map((c) => `${c.x},${c.y}`).join(" ");
  const ordered = [...items].sort((a, b) => layerRank(a) - layerRank(b));
  const floorTone = flooring ? resolveFlooring(flooring).color : "var(--plan-floor, #f8fafc)";
  // Where the wall's body lies across its line: centred on it, or (painted) all outside it.
  const wallBody = wallColors ? paint + rim : WALL_CM;
  const wallCentre = wallColors ? wallBody / 2 : 0;
  // A roof window isn't a gap in the wall: it's drawn overhead, below.
  const cuts = openings
    .filter((o) => isWallOpening(o.kind))
    .flatMap((o) => {
      const seg = resolveWallSegment(corners, o.wall);
      if (!seg) return [];
      const len = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
      if (len === 0) return [];
      const ux = (seg.b.x - seg.a.x) / len;
      const uy = (seg.b.y - seg.a.y) / len;
      const into = inwardNormal(corners, seg.a, seg.b);
      // A point `along` the wall from its start, `out` beyond its line.
      const at = (along: number, out: number) => ({
        x: seg.a.x + ux * along - into.x * out,
        y: seg.a.y + uy * along - into.y * out,
      });
      const p0 = at(o.position, wallCentre);
      const p1 = at(o.position + o.width, wallCentre);
      const swing = isSwingingOpening(o.kind) ? openingClearance(o, corners) : null;
      return [{ o, p0, p1, swing }];
    });

  return (
    <svg viewBox={viewBox} className={className} role="img" aria-label={title}>
      <title>{title}</title>
      {flooring && (
        <defs>
          <FloorPatternDef flooring={flooring} cm={(v) => v} patternId={patternId} />
        </defs>
      )}
      {wallColors &&
        // Twice as wide as the band, centred on the wall line: the floor, drawn next, covers the
        // inner half. Every rim before any paint, so a corner's rim never cuts into the
        // neighbouring wall's paint.
        (["rim", "paint"] as const).map((layer) => (
          <g key={layer} strokeLinecap="round">
            {wallSegments(corners).map((seg) => (
              <line
                key={seg.index}
                x1={seg.a.x}
                y1={seg.a.y}
                x2={seg.b.x}
                y2={seg.b.y}
                stroke={
                  layer === "rim"
                    ? RIM
                    : wallColors[wallColorKey(seg.index, corners.length)] || DEFAULT_WALL_COLOR
                }
                strokeWidth={2 * (layer === "rim" ? paint + rim : paint)}
              />
            ))}
          </g>
        ))}
      <polygon
        points={points}
        fill={flooring ? `url(#${patternId})` : floorTone}
        stroke={wallColors ? RIM : "none"}
        strokeWidth={rim}
      />
      {ordered.map((it) => {
        const cx = it.x + it.width / 2;
        const cy = it.y + it.length / 2;
        const label = labels?.get(it.id);
        return (
          <g key={it.id}>
            <g transform={`rotate(${it.rotation} ${cx} ${cy})`}>
              {it.shape === "circle" ? (
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={it.width / 2}
                  ry={it.length / 2}
                  fill={it.color}
                  fillOpacity={it.layer === "under" ? 0.45 : 0.9}
                  stroke="#0f172a"
                  strokeOpacity={0.35}
                  strokeWidth={0.8}
                />
              ) : (
                <rect
                  x={it.x}
                  y={it.y}
                  width={it.width}
                  height={it.length}
                  rx={1}
                  fill={it.color}
                  fillOpacity={it.layer === "under" ? 0.45 : 0.9}
                  stroke="#0f172a"
                  strokeOpacity={0.35}
                  strokeWidth={0.8}
                />
              )}
            </g>
            {label && (
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={Math.max(8, Math.min(16, Math.min(it.width, it.length) * 0.45))}
                fontWeight={600}
                fill={readableText(it.color)}
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
      {!wallColors && (
        <polygon
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={WALL_CM}
          strokeLinejoin="miter"
        />
      )}
      {cuts.map(({ o, p0, p1, swing }) => (
        <g key={o.id}>
          {/* The gap in the wall. */}
          <line
            x1={p0.x}
            y1={p0.y}
            x2={p1.x}
            y2={p1.y}
            stroke={floorTone}
            strokeWidth={wallBody + 1}
          />
          {o.kind !== "door" && (
            <line
              x1={p0.x}
              y1={p0.y}
              x2={p1.x}
              y2={p1.y}
              stroke="#0ea5e9"
              strokeWidth={wallColors ? paint / 3 : 2.5}
            />
          )}
          {swing &&
            (o.swing ?? "in") === "in" &&
            swing.zones.map((zone, i) => (
              <polygon
                key={i}
                points={zone.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.55}
                strokeWidth={1}
              />
            ))}
        </g>
      ))}
      {wallSlopes && (
        <g strokeDasharray="6 4" strokeWidth={1.5}>
          {dormerFootprints(corners, wallSlopes, ceilingHeight).map((fp) => (
            <polygon
              key={fp.dormer.id}
              points={fp.outline.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.6}
            />
          ))}
          {openings
            .filter((o) => !isWallOpening(o.kind))
            .map((o) => {
              const geo = roofWindowGeometry(o, corners, wallSlopes, ceilingHeight);
              if (!geo) return null;
              return (
                <polygon
                  key={o.id}
                  points={geo.footprint.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="#0ea5e9"
                  fillOpacity={0.15}
                  stroke="#0ea5e9"
                />
              );
            })}
        </g>
      )}
      {dimensions && (
        <g fill="currentColor" stroke="currentColor" fontSize={textSize}>
          <line x1={bb.minX} y1={bb.minY - 30} x2={bb.maxX} y2={bb.minY - 30} strokeWidth={1} />
          <text x={bb.minX + bb.width / 2} y={bb.minY - 38} textAnchor="middle" stroke="none">
            {Math.round(bb.width)} cm
          </text>
          <line x1={bb.minX - 30} y1={bb.minY} x2={bb.minX - 30} y2={bb.maxY} strokeWidth={1} />
          <text
            x={bb.minX - 38}
            y={bb.minY + bb.height / 2}
            textAnchor="middle"
            stroke="none"
            transform={`rotate(-90 ${bb.minX - 38} ${bb.minY + bb.height / 2})`}
          >
            {Math.round(bb.height)} cm
          </text>
          {/* 1 m, to measure the print by. */}
          <line
            x1={bb.minX}
            y1={bb.maxY + 35}
            x2={bb.minX + 100}
            y2={bb.maxY + 35}
            strokeWidth={2}
          />
          <text x={bb.minX + 108} y={bb.maxY + 35} dominantBaseline="central" stroke="none">
            1 m
          </text>
        </g>
      )}
    </svg>
  );
}

function layerRank(it: Item): number {
  return { under: 0, main: 1, "on-top": 2, wall: 3 }[it.layer ?? "main"];
}
