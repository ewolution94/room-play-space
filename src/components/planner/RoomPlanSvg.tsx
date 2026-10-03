import React from "react";
import type { Item, Opening, Point } from "@/types/planner";
import { polygonBoundingBox, resolveWallSegment } from "@/lib/hallway-shapes";
import { openingClearance } from "@/lib/clearance";
import { isSwingingOpening } from "@/lib/openings";
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
}

const WALL_CM = 6;
const PAD_CM = 30;

/**
 * A static, top-down drawing of one room in room centimetres (the viewBox), for the share-link
 * preview and the printable blueprint: walls, doors and windows cut into them, a door's swing
 * (the same quarter circle the clearance warnings use, lib/clearance.ts) and the furniture in its
 * own colours. Deliberately simpler than the editor's canvas: nothing here is interactive.
 */
export function RoomPlanSvg({
  corners,
  openings,
  items,
  labels,
  className,
  title,
}: RoomPlanSvgProps) {
  const bb = polygonBoundingBox(corners);
  const viewBox = `${bb.minX - PAD_CM} ${bb.minY - PAD_CM} ${bb.width + 2 * PAD_CM} ${bb.height + 2 * PAD_CM}`;
  const points = corners.map((c) => `${c.x},${c.y}`).join(" ");
  const ordered = [...items].sort((a, b) => layerRank(a) - layerRank(b));

  return (
    <svg viewBox={viewBox} className={className} role="img" aria-label={title}>
      <title>{title}</title>
      <polygon points={points} fill="var(--plan-floor, #f8fafc)" stroke="none" />
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
      <polygon
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={WALL_CM}
        strokeLinejoin="miter"
      />
      {openings.map((o) => {
        const seg = resolveWallSegment(corners, o.wall);
        if (!seg) return null;
        const len = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
        if (len === 0) return null;
        const ux = (seg.b.x - seg.a.x) / len;
        const uy = (seg.b.y - seg.a.y) / len;
        const p0 = { x: seg.a.x + ux * o.position, y: seg.a.y + uy * o.position };
        const p1 = {
          x: seg.a.x + ux * (o.position + o.width),
          y: seg.a.y + uy * (o.position + o.width),
        };
        const swing = isSwingingOpening(o.kind) ? openingClearance(o, corners) : null;
        return (
          <g key={o.id}>
            {/* The gap in the wall. */}
            <line
              x1={p0.x}
              y1={p0.y}
              x2={p1.x}
              y2={p1.y}
              stroke="var(--plan-floor, #f8fafc)"
              strokeWidth={WALL_CM + 1}
            />
            {o.kind !== "door" && (
              <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="#0ea5e9" strokeWidth={2.5} />
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
        );
      })}
    </svg>
  );
}

function layerRank(it: Item): number {
  return { under: 0, main: 1, "on-top": 2, wall: 3 }[it.layer ?? "main"];
}
