import React from "react";
import type { Point } from "@/types/planner";

interface CanvasRulerProps {
  rulerMode: boolean;
  rulerStart: Point | null;
  rulerEnd: Point | null;
  rulerHover: Point | null;
  cm: (val: number) => number;
  roomPxW: number;
  roomPxL: number;
}

export function CanvasRuler({
  rulerMode,
  rulerStart,
  rulerEnd,
  rulerHover,
  cm,
  roomPxW,
  roomPxL,
}: CanvasRulerProps) {
  if (!rulerMode || !rulerStart) return null;

  const end = rulerEnd ?? rulerHover ?? rulerStart;
  const dx = end.x - rulerStart.x;
  const dy = end.y - rulerStart.y;
  const distCm = Math.sqrt(dx * dx + dy * dy);
  const midX = (rulerStart.x + end.x) / 2;
  const midY = (rulerStart.y + end.y) / 2;
  const ax = cm(rulerStart.x);
  const ay = cm(rulerStart.y);
  const bx = cm(end.x);
  const by = cm(end.y);

  return (
    <svg
      className="pointer-events-none absolute inset-0 text-foreground"
      width={roomPxW}
      height={roomPxL}
      style={{ overflow: "visible", zIndex: 6 }}
    >
      <line
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke="currentColor"
        strokeWidth={2}
        strokeDasharray="2 5"
        strokeLinecap="round"
      />
      <circle cx={ax} cy={ay} r={4} fill="currentColor" />
      <circle cx={bx} cy={by} r={4} fill="currentColor" />
      <g transform={`translate(${cm(midX)}, ${cm(midY)})`}>
        <rect
          x={-34}
          y={-24}
          width={68}
          height={20}
          rx={4}
          fill="white"
          stroke="currentColor"
          className="fill-background stroke-border"
        />
        <text
          x={0}
          y={-10}
          textAnchor="middle"
          fontSize={11}
          fill="currentColor"
          style={{ fontWeight: 600 }}
          className="fill-foreground"
        >
          {distCm.toFixed(1)} cm
        </text>
      </g>
    </svg>
  );
}
