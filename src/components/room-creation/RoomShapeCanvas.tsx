import { useLayoutEffect, useRef, useState } from "react";
import { wallSegments, resolveWallSegment, NAMED_WALLS } from "@/lib/hallway-shapes";
import { dragWallEdge } from "@/lib/room-shapes";
import type { Point, Opening } from "@/types/planner";
import { inwardNormal } from "@/lib/wall-slopes";

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
  /** Slide an existing opening along its own wall (drag to reposition). */
  onMoveOpening?: (id: string, position: number) => void;
  /** Which kind the next click will place -- drives the ghost preview. */
  ghostKind?: "door" | "window";
  /** Selection is lifted so the step's toolbar (width presets, delete) can
   * act on the same opening the canvas is highlighting. */
  selectedOpeningId?: string | null;
  onSelectOpening?: (id: string | null) => void;
  /** Commit a typed wall length. Only ever called for 4-corner shapes --
   * see canEditLengths. */
  onWallLengthChange?: (wallIndex: number, lengthCm: number) => void;
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

/** Gap between a wall and its dimension label, in screen pixels. */
const LABEL_PX_GAP = 22;

/** Screen-pixel thickness of the room's walls. Chunky on purpose: at the
 * old 3px they read as a wireframe outline rather than as walls, which is
 * the first thing you notice comparing this canvas to IKEA's. */
const WALL_STROKE_PX = 7;

/** How long a dimension line's end ticks are, in screen pixels. */
const DIM_TICK_PX = 7;

/** Default size for a newly placed opening, cm. */
const DEFAULT_OPENING_WIDTH = 90;
/** How close (cm) the pointer must be to a wall's midpoint before the ghost
 * snaps to it. Centred doors/windows are overwhelmingly the common case, and
 * hitting dead centre by hand is fiddly. */
const CENTRE_SNAP_CM = 18;

/**
 * A door or window drawn the way a floor plan draws it.
 *
 * Doors get a leaf plus a quarter-circle swing arc -- which is the only way
 * to see, at placement time, which direction it opens and how much floor it
 * sterilises. Windows get the conventional thin double line inset into the
 * wall. Previously both were a single fat coloured stroke, which told you
 * nothing beyond "something is here".
 */
function OpeningSymbol({
  geo,
  kind,
  selected,
  dashed,
}: {
  geo: OpeningGeometry;
  kind: "door" | "window";
  selected?: boolean;
  dashed?: boolean;
}) {
  const stroke = selected
    ? "stroke-primary"
    : kind === "door"
      ? "stroke-amber-600"
      : "stroke-sky-500";
  const common = {
    className: `${stroke} pointer-events-none`,
    vectorEffect: "non-scaling-stroke" as const,
    strokeDasharray: dashed ? "4 4" : undefined,
  };

  if (kind === "window") {
    // Two thin rails inset from the wall line, the standard window glyph.
    const off = geo.width * 0.06;
    return (
      <g>
        <line
          x1={geo.start.x + geo.nx * off}
          y1={geo.start.y + geo.ny * off}
          x2={geo.end.x + geo.nx * off}
          y2={geo.end.y + geo.ny * off}
          strokeWidth={selected ? 3 : 2}
          {...common}
        />
        <line
          x1={geo.start.x - geo.nx * off}
          y1={geo.start.y - geo.ny * off}
          x2={geo.end.x - geo.nx * off}
          y2={geo.end.y - geo.ny * off}
          strokeWidth={selected ? 3 : 2}
          {...common}
        />
      </g>
    );
  }

  // Door: hinge at `start`, leaf swung a quarter turn into the room, and the
  // arc it sweeps between open and closed.
  //
  // Always drawn INTO the room -- `geo.nx/ny` comes from inwardNormal(), so
  // this is right on every wall of every shape without the local-frame
  // correction the main 2D canvas needs (see lib/opening-geometry.ts). That
  // holds only because this wizard exclusively creates `swing: "in"` doors
  // and offers no control to change it. If a swing control is ever added
  // here, this has to honour it, or the wizard becomes the renderer that
  // disagrees with the other two.
  const leafEnd = { x: geo.start.x + geo.nx * geo.width, y: geo.start.y + geo.ny * geo.width };
  return (
    <g>
      <line
        x1={geo.start.x}
        y1={geo.start.y}
        x2={leafEnd.x}
        y2={leafEnd.y}
        strokeWidth={selected ? 3.5 : 2.5}
        {...common}
      />
      <path
        d={`M ${leafEnd.x} ${leafEnd.y} A ${geo.width} ${geo.width} 0 0 0 ${geo.end.x} ${geo.end.y}`}
        fill="none"
        strokeWidth={selected ? 2 : 1.5}
        className={`${stroke} pointer-events-none opacity-70`}
        vectorEffect="non-scaling-stroke"
        strokeDasharray={dashed ? "4 4" : "3 3"}
      />
    </g>
  );
}

interface OpeningGeometry {
  start: Point;
  end: Point;
  /** Unit vector along the wall. */
  ux: number;
  uy: number;
  /** Unit normal pointing into the room. */
  nx: number;
  ny: number;
  width: number;
}

export function RoomShapeCanvas({
  corners,
  viewBox,
  mode,
  onCornersChange,
  openings = [],
  onWallClick,
  onRemoveOpening,
  onMoveOpening,
  ghostKind = "door",
  selectedOpeningId = null,
  onSelectOpening,
  onWallLengthChange,
}: RoomShapeCanvasProps) {
  // Which wall's dimension label is currently being typed into, and the
  // in-progress text. Offered on every shape: setWallLength (room-shapes.ts)
  // resolves "make this wall 380" for polygons too, by moving the wall's
  // neighbour through the same dragWallEdge guards a manual drag uses.
  const [editingWall, setEditingWall] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const canEditLengths = mode === "drag" && !!onWallLengthChange;

  // --- Openings-step interaction state ---
  // A ghost preview follows the pointer along whichever wall it's over, so
  // you can see the actual door/window symbol land before committing. The
  // previous step gave no feedback at all until after the click.
  const [ghost, setGhost] = useState<{ wallIndex: number; position: number } | null>(null);

  // Which wall the pointer is over, and which one is mid-drag. Purely
  // visual, but the affordance is the point: before this, a wall gave no
  // sign it could be grabbed until you were already dragging it, which is
  // the main thing IKEA's own room builder does better -- theirs highlights
  // the wall under the cursor and keeps it highlighted through the drag.
  const [hoverWall, setHoverWall] = useState<number | null>(null);
  const [activeWall, setActiveWall] = useState<number | null>(null);

  const wallIndexOf = (wall: Opening["wall"]): number | null => {
    if (typeof wall === "number") return wall;
    const i = NAMED_WALLS.indexOf(wall as (typeof NAMED_WALLS)[number]);
    return i >= 0 ? i : null;
  };

  /** Everything the symbol renderer needs for one opening on one wall. */
  const openingGeometry = (
    wallIndex: number,
    position: number,
    width: number,
  ): OpeningGeometry | null => {
    const seg = segs[wallIndex];
    if (!seg) return null;
    const dx = seg.b.x - seg.a.x;
    const dy = seg.b.y - seg.a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const n = inwardNormal(corners, seg.a, seg.b);
    return {
      start: { x: seg.a.x + ux * position, y: seg.a.y + uy * position },
      end: { x: seg.a.x + ux * (position + width), y: seg.a.y + uy * (position + width) },
      ux,
      uy,
      nx: n.x,
      ny: n.y,
      width,
    };
  };

  /** Where along `wallIndex` a pointer sits, clamped so the opening stays on
   * the wall, and snapped to the wall's midpoint when close to it. */
  const positionOnWall = (wallIndex: number, client: { x: number; y: number }, width: number) => {
    const seg = segs[wallIndex];
    if (!seg) return null;
    const p = clientToSvgPoint(client.x, client.y);
    const dx = seg.b.x - seg.a.x;
    const dy = seg.b.y - seg.a.y;
    const lenSq = dx * dx + dy * dy || 1;
    const t = ((p.x - seg.a.x) * dx + (p.y - seg.a.y) * dy) / lenSq;
    let pos = t * seg.length - width / 2;
    const centre = (seg.length - width) / 2;
    if (Math.abs(pos - centre) < CENTRE_SNAP_CM) pos = centre;
    return Math.max(0, Math.min(pos, Math.max(0, seg.length - width)));
  };

  const onOpeningPointerDown = (e: React.PointerEvent<SVGLineElement>, o: Opening) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectOpening?.(o.id);
    const idx = wallIndexOf(o.wall);
    if (idx === null || !onMoveOpening) return;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const pos = positionOnWall(idx, { x: ev.clientX, y: ev.clientY }, o.width);
      if (pos !== null) onMoveOpening(o.id, pos);
    };
    const up = (ev: PointerEvent) => {
      try {
        target.releasePointerCapture(ev.pointerId);
      } catch {
        // already released by the browser
      }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const commitEdit = () => {
    if (editingWall === null) return;
    const next = Number(editDraft);
    if (Number.isFinite(next) && next >= 100 && next <= 2000) {
      onWallLengthChange?.(editingWall, next);
    }
    setEditingWall(null);
  };
  const cornersRef = useRef(corners);
  cornersRef.current = corners;
  const svgRef = useRef<SVGSVGElement>(null);

  const viewBoxParts = viewBox.split(" ").map(Number);
  const [vbX, vbY, vbW, vbH] = viewBoxParts.length === 4 ? viewBoxParts : [0, 0, 100, 100];
  const stableSpan = Math.max(vbW, vbH, 1);
  const hitWidth = stableSpan * 0.06;
  const cornerRadius = stableSpan * 0.012;

  /**
   * The grab/click target for a wall: the wall itself, pulled back from both
   * of its own ends.
   *
   * A hit area is a fat stroke centred on the wall, and its width is a
   * fraction of the whole canvas -- so at a corner, two neighbouring walls'
   * bands overlap in a blob roughly `hitWidth` square. On a long wall that
   * blob is a sliver you never notice. On a U-shape's 105cm notch it is most
   * of the wall, and grabbing the notch's ceiling would silently give you one
   * of its side walls instead (measured: a click 6px in from the end of a
   * 133cm wall resolved to its neighbour). Insetting each band by half its
   * own width -- never more than a quarter of the wall, so a short wall keeps
   * at least its middle half -- gives every wall an unambiguous span of its
   * own and leaves the corners to whichever wall you're actually nearer.
   */
  const hitSegment = (seg: { a: Point; b: Point; length: number }) => {
    const inset = Math.min(hitWidth / 2, seg.length * 0.25);
    const len = seg.length || 1;
    const ux = (seg.b.x - seg.a.x) / len;
    const uy = (seg.b.y - seg.a.y) / len;
    return {
      a: { x: seg.a.x + ux * inset, y: seg.a.y + uy * inset },
      b: { x: seg.b.x - ux * inset, y: seg.b.y - uy * inset },
    };
  };

  // Live pixel size of the SVG element. Needed because the HTML label
  // overlay has to agree with where the SVG actually DREW the shape, and an
  // SVG letterboxes its viewBox ("xMidYMid meet") whenever the element's
  // aspect ratio differs from the viewBox's. Mapping labels by naive
  // viewBox percentage ignores that letterbox, so labels sat at a growing
  // offset from their wall -- worst on horizontal walls, because dragging
  // those is what changes the element-vs-viewBox aspect mismatch most.
  const hostRef = useRef<HTMLDivElement>(null);
  const [elSize, setElSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setElSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Exact SVG-user-space -> container-pixel mapping, letterbox included.
   * Element size only changes on resize (never during a drag), so this is
   * stable and lag-free while dragging. */
  const toPx = (p: Point) => {
    if (elSize.w === 0 || elSize.h === 0) return { left: 0, top: 0 };
    const scale = Math.min(elSize.w / vbW, elSize.h / vbH);
    const offX = (elSize.w - vbW * scale) / 2;
    const offY = (elSize.h - vbH * scale) / 2;
    return {
      left: offX + (p.x - vbX) * scale,
      top: offY + (p.y - vbY) * scale,
    };
  };

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
    setActiveWall(wallIndex);

    const move = (ev: PointerEvent) => {
      const nowSvg = clientToSvgPoint(ev.clientX, ev.clientY);
      const delta = { x: nowSvg.x - startSvg.x, y: nowSvg.y - startSvg.y };
      const next = dragWallEdge(startCorners, wallIndex, delta);
      // The viewBox is fixed for the whole session (see computeStableViewBox)
      // and IS the visible canvas, so a shape that leaves it is a shape you
      // can no longer see or grab. Rather than letting the drag escape and
      // then trying to recover, refuse the frame outright -- the wall simply
      // stops at the edge, which reads as a wall you can't push through.
      const inView = next.every(
        (c) => c.x >= vbX && c.x <= vbX + vbW && c.y >= vbY && c.y <= vbY + vbH,
      );
      if (!inView) return;
      onCornersChange(next);
    };
    const up = (ev: PointerEvent) => {
      try {
        target.releasePointerCapture(ev.pointerId);
      } catch {
        // pointer capture may already be released by the browser
      }
      setActiveWall(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onWallClickCapture = (
    e: React.MouseEvent<SVGLineElement>,
    wallIndex: number,
    _seg: { a: Point; b: Point; length: number },
  ) => {
    if (mode !== "openings" || !onWallClick) return;
    // Place exactly where the ghost is showing -- including its centre snap
    // -- so what you saw is what you get, rather than re-deriving a
    // slightly different position from the raw click point.
    const pos = positionOnWall(wallIndex, { x: e.clientX, y: e.clientY }, DEFAULT_OPENING_WIDTH);
    if (pos === null) return;
    onSelectOpening?.(null);
    onWallClick(wallIndex, pos + DEFAULT_OPENING_WIDTH / 2);
  };

  const points = corners.map((c) => `${c.x},${c.y}`).join(" ");

  const segs = wallSegments(corners);

  /**
   * Where each wall's dimension label sits, in container pixels.
   *
   * Two stages. First, push each label a fixed number of SCREEN pixels off
   * its wall along the wall's normal -- offsetting in SVG units instead
   * meant the gap shrank with the viewBox scale until labels sat on top of
   * their own walls. Second, a short separation pass: on an L or cut-corner
   * shape two short walls meet at an inner corner, and their midpoints are
   * close enough that a fixed offset alone leaves the two labels
   * overprinting each other. A few relaxation rounds push any overlapping
   * pair apart along the line between them, which is enough for the handful
   * of labels a room shape ever has.
   */
  const labelPositions = (() => {
    const placed = segs.map((seg) => {
      const midX = (seg.a.x + seg.b.x) / 2;
      const midY = (seg.a.y + seg.b.y) / 2;
      const dx = seg.b.x - seg.a.x;
      const dy = seg.b.y - seg.a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = dy / len;
      const ny = -dx / len;
      const mid = toPx({ x: midX, y: midY });
      const off = (p: { left: number; top: number }) => ({
        left: p.left + nx * LABEL_PX_GAP,
        top: p.top + ny * LABEL_PX_GAP,
      });
      // The dimension line runs parallel to the wall at the same outward
      // offset the label uses, so the label lands on its own measurement.
      // `ux`/`uy` is the wall's own direction, which is what the end ticks
      // are drawn across.
      return {
        seg,
        pos: off(mid),
        line: {
          a: off(toPx(seg.a)),
          b: off(toPx(seg.b)),
          mid: off(mid),
          // Tick direction: perpendicular to the dimension line, which is
          // the wall's own outward normal.
          tickX: nx,
          tickY: ny,
          needsLeader: false,
        },
      };
    });

    const MIN_SEP_X = 52;
    const MIN_SEP_Y = 18;
    for (let round = 0; round < 4; round++) {
      let moved = false;
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i].pos;
          const b = placed[j].pos;
          const dx = b.left - a.left;
          const dy = b.top - a.top;
          if (Math.abs(dx) >= MIN_SEP_X || Math.abs(dy) >= MIN_SEP_Y) continue;
          const dist = Math.hypot(dx, dy) || 1;
          const push = (MIN_SEP_Y - Math.abs(dy) + 4) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          a.left -= ux * push;
          a.top -= uy * push;
          b.left += ux * push;
          b.top += uy * push;
          moved = true;
        }
      }
      if (!moved) break;
    }
    // A label the pass had to move no longer sits on its own dimension line,
    // so it gets a leader back to it -- otherwise, on a T or U, you can't
    // tell which of two crowded numbers belongs to which short wall.
    for (const p of placed) {
      const drift = Math.hypot(p.pos.left - p.line.mid.left, p.pos.top - p.line.mid.top);
      p.line.needsLeader = drift > 10;
    }
    return placed;
  })();

  return (
    <div ref={hostRef} className="relative h-full w-full" style={{ maxHeight: 440 }}>
      <svg ref={svgRef} viewBox={viewBox} className="h-full w-full touch-none select-none">
        <polygon points={points} className="fill-primary/10 stroke-none" />
        {/* The walls themselves, drawn once as the closed outline rather than
            per-segment: a single stroked polygon miters its own corners, so
            a thick wall meets its neighbour cleanly instead of showing the
            notch two overlapping round caps leave at every 270-degree corner
            (of which a U-shape has two and a T-shape four). */}
        <polygon
          points={points}
          className="fill-none stroke-foreground pointer-events-none"
          strokeWidth={WALL_STROKE_PX}
          strokeLinejoin="miter"
          vectorEffect="non-scaling-stroke"
        />
        {segs.map((seg) => {
          const emphasised =
            mode === "drag" && (activeWall === seg.index || hoverWall === seg.index);
          const hit = hitSegment(seg);
          return (
            <g key={seg.index}>
              {/* Highlight sits between the wall and its hit area so it reads
                  as the wall lighting up, not a separate line beside it. */}
              {emphasised && (
                <line
                  x1={seg.a.x}
                  y1={seg.a.y}
                  x2={seg.b.x}
                  y2={seg.b.y}
                  className={`stroke-primary pointer-events-none ${
                    activeWall === seg.index ? "opacity-100" : "opacity-70"
                  }`}
                  strokeWidth={WALL_STROKE_PX + 4}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <line
                x1={hit.a.x}
                y1={hit.a.y}
                x2={hit.b.x}
                y2={hit.b.y}
                stroke="transparent"
                strokeWidth={hitWidth}
                className={
                  mode === "drag" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"
                }
                onPointerDown={mode === "drag" ? (e) => onWallPointerDown(e, seg.index) : undefined}
                onPointerEnter={mode === "drag" ? () => setHoverWall(seg.index) : undefined}
                onPointerMove={
                  mode === "openings"
                    ? (e) => {
                        const pos = positionOnWall(
                          seg.index,
                          { x: e.clientX, y: e.clientY },
                          DEFAULT_OPENING_WIDTH,
                        );
                        if (pos !== null) setGhost({ wallIndex: seg.index, position: pos });
                      }
                    : undefined
                }
                onPointerLeave={
                  mode === "openings"
                    ? () => setGhost(null)
                    : () => setHoverWall((w) => (w === seg.index ? null : w))
                }
                onClick={
                  mode === "openings" ? (e) => onWallClickCapture(e, seg.index, seg) : undefined
                }
              />
            </g>
          );
        })}
        {/* --- Openings: real floor-plan symbols, not coloured blobs ---
            A door is drawn the way a plan draws one: the leaf plus its swing
            arc, so you can see which way it opens and how much floor it
            eats. A window is the conventional thin double line set into the
            wall. Both are what the finished room will actually look like in
            the main canvas, which is the whole point of placing them here. */}
        {mode === "openings" && (
          <g>
            {ghost &&
              (() => {
                const g = openingGeometry(ghost.wallIndex, ghost.position, DEFAULT_OPENING_WIDTH);
                if (!g) return null;
                return (
                  <g className="pointer-events-none" opacity={0.45}>
                    <line
                      x1={g.start.x}
                      y1={g.start.y}
                      x2={g.end.x}
                      y2={g.end.y}
                      className="stroke-background"
                      strokeWidth={6}
                      vectorEffect="non-scaling-stroke"
                    />
                    <OpeningSymbol geo={g} kind={ghostKind} dashed />
                  </g>
                );
              })()}

            {openings.map((o) => {
              const idx = wallIndexOf(o.wall);
              const g = idx === null ? null : openingGeometry(idx, o.position, o.width);
              if (!g) return null;
              const isSelected = o.id === selectedOpeningId;
              return (
                <g key={o.id}>
                  {/* Knock the wall out underneath, so an opening reads as a
                      hole in the wall rather than a sticker on top of it. */}
                  <line
                    x1={g.start.x}
                    y1={g.start.y}
                    x2={g.end.x}
                    y2={g.end.y}
                    className="stroke-background"
                    strokeWidth={6}
                    vectorEffect="non-scaling-stroke"
                  />
                  <OpeningSymbol geo={g} kind={o.kind} selected={isSelected} />
                  {/* Grab area: select on click, drag to slide along the
                      wall. Deliberately NOT delete-on-click -- that made
                      every mis-click destructive. */}
                  <line
                    x1={g.start.x}
                    y1={g.start.y}
                    x2={g.end.x}
                    y2={g.end.y}
                    stroke="transparent"
                    strokeWidth={hitWidth}
                    className="cursor-grab active:cursor-grabbing"
                    onPointerDown={(e) => onOpeningPointerDown(e, o)}
                  />
                </g>
              );
            })}
          </g>
        )}
        {/* Corner handles. In drag mode they're the white-fill/dark-ring
            markers a floor plan uses, which say "these are the points the
            walls run between" -- in openings mode that would just compete
            with the door/window symbols, so they stay a plain dot. */}
        {corners.map((c, i) =>
          mode === "drag" ? (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={cornerRadius * 1.5}
              className="fill-background stroke-foreground pointer-events-none"
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
            />
          ) : (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={cornerRadius}
              className="fill-primary pointer-events-none"
            />
          ),
        )}
      </svg>

      {/* --- Dimension lines ---
          Drawn in the container's PIXEL space, not the SVG's user space, for
          the same reason the labels are plain HTML (see labelPositions): the
          only way a tick can be a constant on-screen length, and the only way
          it can be guaranteed to line up with a label the separation pass may
          have nudged, is to compute both in the same pixel coordinates. */}
      {elSize.w > 0 && (
        <svg
          className="pointer-events-none absolute inset-0"
          width={elSize.w}
          height={elSize.h}
          aria-hidden="true"
        >
          {labelPositions.map(({ seg, pos, line }) => (
            <g key={seg.index} className="stroke-muted-foreground/60" strokeWidth={1}>
              <line x1={line.a.left} y1={line.a.top} x2={line.b.left} y2={line.b.top} />
              {/* End ticks, perpendicular to the dimension line -- the thing
                  that makes it read as a measurement rather than an outline. */}
              <line
                x1={line.a.left - line.tickX * DIM_TICK_PX}
                y1={line.a.top - line.tickY * DIM_TICK_PX}
                x2={line.a.left + line.tickX * DIM_TICK_PX}
                y2={line.a.top + line.tickY * DIM_TICK_PX}
              />
              <line
                x1={line.b.left - line.tickX * DIM_TICK_PX}
                y1={line.b.top - line.tickY * DIM_TICK_PX}
                x2={line.b.left + line.tickX * DIM_TICK_PX}
                y2={line.b.top + line.tickY * DIM_TICK_PX}
              />
              {/* Leader, only when the separation pass actually pushed the
                  label off its own line -- which now happens routinely, since
                  a T or U shape has short walls meeting at inner corners. */}
              {line.needsLeader && (
                <line
                  x1={line.mid.left}
                  y1={line.mid.top}
                  x2={pos.left}
                  y2={pos.top}
                  strokeDasharray="2 2"
                />
              )}
            </g>
          ))}
        </svg>
      )}
      {labelPositions.map(({ seg, pos }) => {
        if (editingWall === seg.index) {
          return (
            <input
              key={seg.index}
              autoFocus
              type="number"
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") setEditingWall(null);
              }}
              className="absolute w-20 -translate-x-1/2 -translate-y-1/2 rounded border border-primary bg-background px-1 py-0.5 text-center text-sm font-medium"
              style={{ left: pos.left, top: pos.top }}
            />
          );
        }
        return (
          <div
            key={seg.index}
            onClick={
              canEditLengths
                ? () => {
                    setEditingWall(seg.index);
                    setEditDraft(String(Math.round(seg.length)));
                  }
                : undefined
            }
            // bg-background is load-bearing now, not decoration: the label
            // sits ON its dimension line, so it has to knock a gap in it the
            // way a drawing does.
            className={`absolute -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap rounded px-1 text-sm font-medium text-muted-foreground bg-background ${
              canEditLengths
                ? "cursor-text hover:bg-accent hover:text-foreground"
                : "pointer-events-none"
            }`}
            style={{ left: pos.left, top: pos.top }}
          >
            {Math.round(seg.length)} cm
          </div>
        );
      })}
    </div>
  );
}
