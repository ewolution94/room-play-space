import { useRef } from "react";
import { wallSegments, resolveWallSegment } from "@/lib/hallway-shapes";
import { dragWallEdge } from "@/lib/room-shapes";
import type { Point, Opening } from "@/types/planner";

interface RoomShapeCanvasProps {
  corners: Point[];
  /** Computed once by the caller (room-shapes.ts's computeStableViewBox)
   * from the shape's starting corners and held fixed thereafter -- see
   * that function's doc comment for why this must NOT be recomputed from
   * the live corners on every drag frame. Every fixed-size element below
   * (dimension labels, hit-areas, corner dots) derives its size from THIS
   * stable box too, not from the live corners, so nothing visibly grows
   * or shrinks mid-drag -- only wall positions move. */
  viewBox: string;
  mode: "drag" | "openings";
  /** "drag" mode only. */
  onCornersChange?: (next: Point[]) => void;
  /** "openings" mode only. */
  openings?: Opening[];
  onWallClick?: (wallIndex: number, positionAlongWall: number) => void;
  onRemoveOpening?: (id: string) => void;
}

/**
 * The wizard's interactive shape/openings canvas: in "drag" mode, dragging
 * a wall resizes it via dragWallEdge (room-shapes.ts) -- both endpoints
 * move together, every other wall keeps its own angle. In "openings" mode,
 * walls are click targets instead of drag targets: clicking one places a
 * door/window at that point, and clicking an already-placed opening's own
 * mark removes it. Dimension labels are plain HTML overlays (not SVG
 * <text>) positioned by percentage within the stable viewBox -- an SVG
 * text element's on-screen size is a function of the viewBox scale, so
 * with the previous version's font-size expressed in viewBox units, the
 * labels visibly grew/shrank as a drag changed the room's live bounding
 * box even though the viewBox itself had already been fixed. Rendering
 * them as normal HTML text with a fixed Tailwind size sidesteps that
 * entirely: position tracks the (live) wall, size never changes.
 */
export function RoomShapeCanvas({
  corners,
  viewBox,
  mode,
  onCornersChange,
  openings = [],
  onWallClick,
  onRemoveOpening,
}: RoomShapeCanvasProps) {
  const cornersRef = useRef(corners);
  cornersRef.current = corners;
  const svgRef = useRef<SVGSVGElement>(null);

  const viewBoxParts = viewBox.split(" ").map(Number);
  const [vbX, vbY, vbW, vbH] = viewBoxParts.length === 4 ? viewBoxParts : [0, 0, 100, 100];
  const stableSpan = Math.max(vbW, vbH, 1);
  const hitWidth = stableSpan * 0.06;
  const cornerRadius = stableSpan * 0.012;
  const labelOffset = stableSpan * 0.035;

  const toPercent = (p: Point) => ({
    left: ((p.x - vbX) / vbW) * 100,
    top: ((p.y - vbY) / vbH) * 100,
  });

  const clientToSvgPoint = (clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const onWallPointerDown = (e: React.PointerEvent<SVGLineElement>, wallIndex: number) => {
    if (mode !== "drag" || !onCornersChange) return;
    e.preventDefault();
    e.stopPropagation();
    const startCorners = cornersRef.current;
    const startSvg = clientToSvgPoint(e.clientX, e.clientY);
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const nowSvg = clientToSvgPoint(ev.clientX, ev.clientY);
      const delta = { x: nowSvg.x - startSvg.x, y: nowSvg.y - startSvg.y };
      onCornersChange(dragWallEdge(startCorners, wallIndex, delta));
    };
    const up = (ev: PointerEvent) => {
      try {
        target.releasePointerCapture(ev.pointerId);
      } catch {
        // pointer capture may already be released by the browser
      }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onWallClickCapture = (
    e: React.MouseEvent<SVGLineElement>,
    wallIndex: number,
    seg: { a: Point; b: Point; length: number },
  ) => {
    if (mode !== "openings" || !onWallClick) return;
    const p = clientToSvgPoint(e.clientX, e.clientY);
    const wallDx = seg.b.x - seg.a.x;
    const wallDy = seg.b.y - seg.a.y;
    const lenSq = wallDx * wallDx + wallDy * wallDy || 1;
    const t = ((p.x - seg.a.x) * wallDx + (p.y - seg.a.y) * wallDy) / lenSq;
    const clampedT = Math.max(0, Math.min(1, t));
    onWallClick(wallIndex, clampedT * seg.length);
  };

  const points = corners.map((c) => `${c.x},${c.y}`).join(" ");
  const segs = wallSegments(corners);

  return (
    <div className="relative h-full w-full" style={{ maxHeight: 320 }}>
      <svg ref={svgRef} viewBox={viewBox} className="h-full w-full touch-none select-none">
        <polygon points={points} className="fill-primary/10 stroke-none" />
        {segs.map((seg) => (
          <g key={seg.index}>
            <line
              x1={seg.a.x}
              y1={seg.a.y}
              x2={seg.b.x}
              y2={seg.b.y}
              stroke="transparent"
              strokeWidth={hitWidth}
              className={
                mode === "drag" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"
              }
              onPointerDown={mode === "drag" ? (e) => onWallPointerDown(e, seg.index) : undefined}
              onClick={
                mode === "openings" ? (e) => onWallClickCapture(e, seg.index, seg) : undefined
              }
            />
            <line
              x1={seg.a.x}
              y1={seg.a.y}
              x2={seg.b.x}
              y2={seg.b.y}
              className="stroke-foreground pointer-events-none"
              strokeWidth={3}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
            />
          </g>
        ))}
        {mode === "openings" &&
          openings.map((o) => {
            const seg = resolveWallSegment(corners, o.wall);
            if (!seg) return null;
            const dx = seg.b.x - seg.a.x;
            const dy = seg.b.y - seg.a.y;
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len;
            const uy = dy / len;
            const startPt = { x: seg.a.x + ux * o.position, y: seg.a.y + uy * o.position };
            const endPt = {
              x: seg.a.x + ux * (o.position + o.width),
              y: seg.a.y + uy * (o.position + o.width),
            };
            return (
              <line
                key={o.id}
                x1={startPt.x}
                y1={startPt.y}
                x2={endPt.x}
                y2={endPt.y}
                className={
                  o.kind === "door"
                    ? "stroke-amber-600 hover:stroke-destructive cursor-pointer"
                    : "stroke-sky-400 hover:stroke-destructive cursor-pointer"
                }
                strokeWidth={7}
                strokeLinecap="butt"
                vectorEffect="non-scaling-stroke"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveOpening?.(o.id);
                }}
              />
            );
          })}
        {corners.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={cornerRadius}
            className="fill-primary pointer-events-none"
          />
        ))}
      </svg>
      {segs.map((seg) => {
        const midX = (seg.a.x + seg.b.x) / 2;
        const midY = (seg.a.y + seg.b.y) / 2;
        const dx = seg.b.x - seg.a.x;
        const dy = seg.b.y - seg.a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = dy / len;
        const ny = -dx / len;
        const pos = toPercent({ x: midX + nx * labelOffset, y: midY + ny * labelOffset });
        return (
          <div
            key={seg.index}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap text-sm font-medium text-muted-foreground"
            style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
          >
            {Math.round(seg.length)} cm
          </div>
        );
      })}
    </div>
  );
}
