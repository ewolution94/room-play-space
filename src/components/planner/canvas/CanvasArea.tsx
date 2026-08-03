import React, { useState, useMemo, useEffect, useCallback, useRef, Suspense, lazy } from "react";
import { Link } from "@tanstack/react-router";
import type { CanvasAreaProps } from "@/types/planner";
import {
  wallSegments,
  resolveWallSegment,
  wallColorKey,
  wallOutwardNormal,
} from "@/lib/hallway-shapes";
import { closedSubIntervals } from "@/lib/room-adjacency";
import { useMobileViewOnly } from "@/hooks/use-mobile-view-only";
import type { RoomInstance3D } from "../ThreeDView";
import { ThreeDViewFallback } from "../ThreeDViewFallback";
import { RotateHint } from "../RotateHint";
import { HintBanner } from "./HintBanner";
import { RoomDimensionBadge } from "./RoomDimensionBadge";
import { CanvasOpenings } from "./CanvasOpenings";
import { CanvasSlopes } from "./CanvasSlopes";
import { CanvasItems } from "./CanvasItems";
import { CanvasMarquee } from "./CanvasMarquee";
import { CanvasRuler } from "./CanvasRuler";
import { ToolbarOverlay } from "./ToolbarOverlay";
import { MobileZoomButtons } from "./MobileZoomButtons";
import { CanvasLoadingOverlay } from "./CanvasLoadingOverlay";
import { InspectorSection } from "../sidebar/InspectorSection";
import { FloorPatternDef } from "@/lib/floor-pattern-svg";
import { resolveFlooring } from "@/lib/floor-materials";
import { clampInspectorPos, inspectorMaxHeight } from "@/lib/canvas-layout";
import { ArrowLeft, HelpCircle, SlidersHorizontal } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { HoverTooltip } from "@/components/ui/hover-tooltip";

// Code-split from the eagerly-loaded route bundle -- `three` (plus
// GLTFLoader/OrbitControls) is a large dependency that only matters once a
// user actually switches to 3D mode, and this used to be a *static* import
// even though ThreeDView only ever rendered when threeDActive was true, so
// every route paid for parsing/transforming the whole engine on load. Module
// scope (not inside the component) so React only creates the lazy wrapper
// once, not on every render.
const ThreeDView = lazy(() => import("../ThreeDView").then((m) => ({ default: m.ThreeDView })));

export function CanvasArea({
  t,
  lang,
  stageRef,
  stageReady,
  scale,
  offsetX,
  offsetY,
  roomPxW,
  roomPxL,
  cm,
  roomW,
  roomL,
  draftW,
  setDraftW,
  draftL,
  setDraftL,
  dirty,
  applyRoom,
  collisionEnabled,
  setCollisionEnabled,
  rulerMode,
  setRulerMode,
  openings,
  setOpenings,
  items,
  selectedIds,
  setSelectedIds,
  rulerStart,
  rulerEnd,
  rulerHover,
  clearRuler,
  marqueeRect,
  multiSelectMode,
  setMultiSelectMode,
  ctrlHeld,
  isPanning,
  onStagePointerDown,
  onStagePointerMove,
  onStagePointerUp,
  onItemPointerDown,
  onRotateHandleDown,
  pushHistory,
  threeDActive,
  setThreeDActive,
  corners,
  setCorners,
  wallColors,
  setWallColors,
  selectedOpeningId,
  setSelectedOpeningId,
  flooring,
  setFlooring,
  zoomFactor,
  setZoomFactor,
  isDark,
  updateItem,
  removeItem,
  duplicateSelected,
  removeSelected,
  updateOpening,
  removeOpening,
  openWalls,
  ceilingHeight,
  setCeilingHeight,
  wallSlopes,
  setWallSlopes,
  slopeIssues,
  backUrl,
  backLabel,
  openSaveDialog,
}: CanvasAreaProps) {
  const [showGrid2D, setShowGrid2D] = useState(true);
  // Corner-drag ("Enable Corner Dragging") is disabled from the UI for now
  // -- it caused confusion and could break the app in some ways -- but the
  // underlying drag logic and rendering below are kept intact for later.
  // See todo.md for the note. Hard-coded off with no setter exposed, since
  // there's no checkbox left to toggle it.
  const [enableCornerDrag] = useState(false);
  const [showWallIds, setShowWallIds] = useState(false);
  // Whether the room's flooring pattern renders in 2D/3D, or the room
  // falls back to its plain background -- on by default, off is an escape
  // hatch for anyone who prefers the flat pre-flooring look.
  const [showFlooring, setShowFlooring] = useState(true);

  // Mobile "view only" mode (see useMobileViewOnly): canvas-only, tools
  // disabled, the always-visible "2D View Options" panel becomes a
  // togglable bottom sheet instead of permanently eating screen space.
  const { isMobileViewOnly, isPortrait } = useMobileViewOnly();
  const [mobileOptionsOpen, setMobileOptionsOpen] = useState(false);

  // A drag on mobile should only ever pan the canvas -- never place a
  // ruler point or start a marquee selection. Both of those are gated
  // behind toggles that are already hidden from the mobile UI (see the
  // Drawer content below), but that alone doesn't cover a mid-session
  // transition into mobile view-only (e.g. shrinking the browser window)
  // while one of them was already on from desktop use. Forcing both off
  // here, once, whenever mobile view-only mode is entered guarantees the
  // stage's own onStagePointerDown (still the exact same pan/select logic
  // used on desktop) falls straight through to its plain-pan branch.
  useEffect(() => {
    if (!isMobileViewOnly) return;
    setRulerMode(false);
    setMultiSelectMode(false);
  }, [isMobileViewOnly, setRulerMode, setMultiSelectMode]);

  // Floating Inspector state
  const [inspectorPos, setInspectorPos] = useState({ x: 16, y: 80 });
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const inspectorRef = useRef<HTMLDivElement>(null);

  // Derive selected item / opening for the inspector
  const selectedItem = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const id = Array.from(selectedIds)[0];
    return items.find((i) => i.id === id) || null;
  }, [selectedIds, items]);

  const selectedOpening = useMemo(() => {
    if (!selectedOpeningId) return null;
    return openings.find((o) => o.id === selectedOpeningId) || null;
  }, [selectedOpeningId, openings]);

  // ThreeDView now renders a *list* of room instances (so it can also serve
  // the whole-apartment 3D view -- see MultiRoomCanvas.tsx), each with its
  // own x/y offset into a shared coordinate space. A standalone single room
  // is just a one-element list at x=0, y=0, which makes every position
  // calculation inside ThreeDView collapse back to exactly this room's own
  // frame. Memoized (rather than built inline in the JSX below) so its
  // reference only changes when one of this room's own fields actually
  // does -- otherwise ThreeDView's scene-rebuilding effect would tear down
  // and rebuild the whole Three.js scene on every unrelated re-render.
  const threeDRooms = useMemo<RoomInstance3D[]>(
    () => [
      {
        id: "single-room",
        x: 0,
        y: 0,
        width: roomW,
        length: roomL,
        corners,
        items,
        openings,
        wallColors,
        openWalls,
        flooring,
        ceilingHeight,
        wallSlopes,
      },
    ],
    [
      roomW,
      roomL,
      corners,
      items,
      openings,
      wallColors,
      openWalls,
      flooring,
      ceilingHeight,
      wallSlopes,
    ],
  );

  // Auto-expand inspector when selection changes
  useEffect(() => {
    if (selectedIds.size > 0 || selectedOpeningId) {
      setInspectorCollapsed(false);
    }
  }, [selectedIds, selectedOpeningId]);

  // Keep inspectorPos ref to avoid recreating the drag handler callback
  const inspectorPosRef = useRef(inspectorPos);
  useEffect(() => {
    inspectorPosRef.current = inspectorPos;
  }, [inspectorPos]);

  // Drag handler for floating inspector header
  const onInspectorHeaderPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Don't start drag on button clicks (collapse toggle)
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      const panel = inspectorRef.current;
      if (!panel) return;

      try {
        target.setPointerCapture(e.pointerId);
      } catch {}

      // Disable CSS transitions during drag and apply global grabbing styles
      panel.style.transition = "none";
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";

      const startX = e.clientX;
      const startY = e.clientY;
      const startPosX = inspectorPosRef.current.x;
      const startPosY = inspectorPosRef.current.y;

      let currentX = startPosX;
      let currentY = startPosY;
      let rafId: number | null = null;

      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        const container = stageRef.current;
        if (!container) {
          currentX = startPosX + dx;
          currentY = startPosY + dy;
        } else {
          const bounds = container.getBoundingClientRect();
          const clamped = clampInspectorPos(
            startPosX + dx,
            startPosY + dy,
            { width: bounds.width, height: bounds.height },
            { width: panel.offsetWidth, height: panel.offsetHeight },
          );
          currentX = clamped.x;
          currentY = clamped.y;
        }

        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            panel.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            rafId = null;
          });
        }
      };

      const up = (ev: PointerEvent) => {
        try {
          target.releasePointerCapture(ev.pointerId);
        } catch {}
        window.removeEventListener("pointermove", move, { capture: true });
        window.removeEventListener("pointerup", up, { capture: true });
        window.removeEventListener("pointercancel", up, { capture: true });

        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }

        // Restore style states
        panel.style.transition = "";
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        // Sync final position to state on release
        setInspectorPos({ x: currentX, y: currentY });
      };

      window.addEventListener("pointermove", move, { capture: true });
      window.addEventListener("pointerup", up, { capture: true });
      window.addEventListener("pointercancel", up, { capture: true });
    },
    [stageRef],
  );

  const selectedLabel = selectedIds.size > 0 ? t.selectedCount(selectedIds.size) : undefined;
  const scaleKey = Math.round(scale * 1000);
  const resolvedFlooringColor = resolveFlooring(flooring).color;

  // Map-like scale calculation
  const targetCm = 80 / scale;
  let scaleCm = 100;
  if (targetCm < 25) {
    scaleCm = 10;
  } else if (targetCm < 75) {
    scaleCm = 50;
  } else if (targetCm < 150) {
    scaleCm = 100;
  } else if (targetCm < 350) {
    scaleCm = 200;
  } else {
    scaleCm = 500;
  }
  const scalePx = scaleCm * scale;

  // Drag handler for room corners
  const onCornerPointerDown = (e: React.PointerEvent, idx: number) => {
    if (!enableCornerDrag) return;
    e.stopPropagation();
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    pushHistory();
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startCornerX = corners[idx].x;
    const startCornerY = corners[idx].y;

    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startMouseX) / scale;
      const dy = (ev.clientY - startMouseY) / scale;

      let newX = Math.round(startCornerX + dx);
      let newY = Math.round(startCornerY + dy);

      // Allow negative coordinates to enable dragging left/top walls outward
      newX = Math.max(-2000, Math.min(4000, newX));
      newY = Math.max(-2000, Math.min(4000, newY));

      setCorners((prev) => {
        const next = [...prev];
        next[idx] = { x: newX, y: newY };
        return next;
      });
    };

    const up = (ev: PointerEvent) => {
      try {
        target.releasePointerCapture(ev.pointerId);
      } catch (err) {}
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      clampOpeningsToWalls();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Clamps openings so they don't overflow resized walls
  const clampOpeningsToWalls = () => {
    setOpenings((prev) =>
      prev.map((o) => {
        const seg = resolveWallSegment(corners, o.wall);
        if (!seg) return o;
        const wallLength = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
        const maxPos = Math.max(0, wallLength - o.width);
        const clampedPos = Math.min(maxPos, Math.max(0, o.position));
        if (clampedPos === o.position) return o;
        return { ...o, position: clampedPos };
      }),
    );
  };

  // flex-1 min-h-0 apply unconditionally below (not just lg:) so this
  // <main> fills its parent's height in the mobile flex-column wrapper too
  // (see routes/index.tsx's isMobileViewOnly branch) -- without it, <main>
  // has no defined height below lg, so the canvas div inside (itself
  // flex-1/min-h-0) has nothing bounded to grow into and collapses to
  // ~0px, i.e. the whole canvas silently disappears. lg:h-full still does
  // the equivalent job in the lg+ CSS grid layout, where flex-1's
  // flex-grow is simply a no-op.
  return (
    <main className="min-w-0 flex-1 min-h-0 lg:h-full flex flex-col gap-2">
      {/* Hidden in mobile view-only mode: it's drag/rotate/ruler
          instructions for tools that are disabled there, and the whole
          point of view-only mode is reclaiming that space for the canvas
          (the RotateHint below covers the one thing worth telling a mobile
          viewer). */}
      {!isMobileViewOnly && (
        <HintBanner
          t={t}
          lang={lang}
          scale={scale}
          rulerMode={rulerMode}
          threeDActive={threeDActive}
        />
      )}
      <div
        ref={stageRef}
        id="tour-canvas"
        className="relative min-h-0 flex-1 w-full rounded-lg border bg-muted/30 overflow-hidden"
        onPointerDown={threeDActive ? undefined : onStagePointerDown}
        onPointerMove={threeDActive ? undefined : onStagePointerMove}
        onPointerUp={threeDActive ? undefined : onStagePointerUp}
        style={{
          touchAction: threeDActive ? "auto" : "none",
          cursor: threeDActive
            ? undefined
            : rulerMode
              ? "crosshair"
              : !multiSelectMode && !ctrlHeld
                ? isPanning
                  ? "grabbing"
                  : "grab"
                : undefined,
        }}
      >
        {/* Room dimensions label (top-left of canvas) */}
        <RoomDimensionBadge roomW={roomW} roomL={roomL} selectedLabel={selectedLabel} />

        {/* Masks the moment before the stage has a real measured size --
            see stageReady's doc comment in use-room-planner.ts and
            CanvasLoadingOverlay's own doc comment for why this exists.
            Also covers route-switch transitions for free, since navigating
            here fully remounts this component. */}
        <CanvasLoadingOverlay ready={stageReady} />

        {threeDActive ? (
          <Suspense fallback={<ThreeDViewFallback />}>
            <ThreeDView
              t={t}
              lang={lang}
              rooms={threeDRooms}
              selectedIds={selectedIds}
              isDark={isDark}
            />
          </Suspense>
        ) : (
          scale > 0 && (
            <>
              <div
                className="absolute box-content"
                style={{
                  left: offsetX,
                  top: offsetY,
                  width: roomPxW,
                  height: roomPxL,
                }}
              >
                {/* Floor and Walls SVG */}
                <svg
                  className="absolute pointer-events-none inset-0 overflow-visible"
                  style={{ zIndex: 0 }}
                >
                  <defs>
                    <FloorPatternDef
                      flooring={flooring}
                      cm={cm}
                      patternId={`floorPattern-${scaleKey}`}
                    />
                    <pattern
                      id={`canvasLineGridPattern-${scaleKey}`}
                      width={cm(50)}
                      height={cm(50)}
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d={`M ${cm(50)} 0 L 0 0 L 0 ${cm(50)}`}
                        fill="none"
                        strokeWidth="1"
                        className="stroke-foreground/10 dark:stroke-foreground/15"
                      />
                    </pattern>
                    {/* Punches the room's own footprint out of the
                      background grid (used below only while flooring is
                      shown) -- SVG mask luminance: white = visible, black =
                      hidden, so a white full-canvas rect with the room
                      polygon painted black over it hides the grid exactly
                      where the floor pattern already covers it, while
                      leaving the grid intact everywhere outside the room. */}
                    <mask id={`gridRoomCutout-${scaleKey}`}>
                      <rect
                        x={cm(-2000)}
                        y={cm(-2000)}
                        width={cm(6000)}
                        height={cm(6000)}
                        fill="white"
                      />
                      <polygon
                        points={corners.map((c) => `${cm(c.x)},${cm(c.y)}`).join(" ")}
                        fill="black"
                      />
                    </mask>
                  </defs>

                  {/* Polygonal Floor plane shadow & background -- filled
                    with the room's own flooring color as a solid base
                    coat underneath the pattern (see below), so there's
                    never a background-colored sliver at a polygon edge. */}
                  <polygon
                    points={corners.map((c) => `${cm(c.x)},${cm(c.y)}`).join(" ")}
                    fill={showFlooring ? resolvedFlooringColor : undefined}
                    className={showFlooring ? "stroke-none" : "fill-background stroke-none"}
                    style={{
                      filter: "drop-shadow(0px 4px 16px rgba(0,0,0,0.06))",
                    }}
                  />

                  {/* Floor material texture (wood/tile/concrete/carpet/etc,
                    see floor-pattern-svg.tsx) -- skipped entirely when the
                    "Show Flooring" view option is off, leaving the plain
                    background fill above as the room's floor. */}
                  {showFlooring && (
                    <polygon
                      points={corners.map((c) => `${cm(c.x)},${cm(c.y)}`).join(" ")}
                      fill={`url(#floorPattern-${scaleKey})`}
                      className="stroke-none"
                    />
                  )}

                  {/* Background Grid Lines (Symmetrical Mesh) -- this rect
                    spans the whole canvas, not just the area outside the
                    room, so while flooring is shown it's masked to cut out
                    the room's own footprint (see gridRoomCutout above):
                    grid lines still show anywhere outside the room for
                    scale/reference, but don't render on top of the floor
                    pattern itself, which got too busy layered together. */}
                  {showGrid2D && (
                    <rect
                      x={cm(-2000)}
                      y={cm(-2000)}
                      width={cm(6000)}
                      height={cm(6000)}
                      fill={`url(#canvasLineGridPattern-${scaleKey})`}
                      className="stroke-none"
                      mask={showFlooring ? `url(#gridRoomCutout-${scaleKey})` : undefined}
                    />
                  )}

                  {/* --- Wall segments in 2D with inner color highlighting ---
                    Looped over every edge of the room's polygon (4 for a
                    plain rectangle, 6-8 for an L/T-shaped hallway) instead
                    of 4 hardcoded named segments. A <line>'s visual result
                    doesn't depend on which endpoint is "a" vs "b", so this
                    is pixel-identical to the old hardcoded top/right/
                    bottom/left blocks for every existing rectangular room.
                    Each wall is further split into its closed sub-run(s)
                    around any `openWalls` interval(s) (the "0-4 walls"
                    feature -- either auto-detected as touching a neighbor
                    in the multi-room overview, or manually forced open) --
                    an actual gap in the floor plan, not a wide doorway,
                    and only over the span that's actually open rather than
                    the whole wall vanishing next to a shorter neighbor. */}
                  {wallSegments(corners).flatMap((seg) => {
                    const colorKey = wallColorKey(seg.index, corners.length);
                    const openIntervals = openWalls.get(colorKey) ?? [];
                    const closed = closedSubIntervals(seg.length, openIntervals);
                    const ux = (seg.b.x - seg.a.x) / (seg.length || 1);
                    const uy = (seg.b.y - seg.a.y) / (seg.length || 1);
                    return closed.map((c, i) => {
                      const ax = seg.a.x + ux * c.start;
                      const ay = seg.a.y + uy * c.start;
                      const bx = seg.a.x + ux * c.end;
                      const by = seg.a.y + uy * c.end;
                      return (
                        <React.Fragment key={`${seg.index}-${i}`}>
                          <line
                            x1={cm(ax)}
                            y1={cm(ay)}
                            x2={cm(bx)}
                            y2={cm(by)}
                            className="stroke-slate-700 dark:stroke-slate-400"
                            strokeWidth={cm(6)}
                            strokeLinecap="round"
                          />
                          <line
                            x1={cm(ax)}
                            y1={cm(ay)}
                            x2={cm(bx)}
                            y2={cm(by)}
                            stroke={wallColors[colorKey] || "#f1f5f9"}
                            strokeWidth={cm(4)}
                            strokeLinecap="round"
                          />
                        </React.Fragment>
                      );
                    });
                  })}

                  {/* Wall id/number labels -- opt-in debug overlay so users can
                    tell which wall is which when picking one in the
                    Add Door/Window dialog (which uses this exact same
                    named-for-rectangles / 1-based-index-for-polygons
                    convention, see OpeningsDialog.tsx). Offset outward from
                    the wall's midpoint by a constant number of screen pixels
                    (not room-cm) so the label stays a fixed, readable size no
                    matter the zoom level. The offset itself accounts for the
                    badge's own half-width/half-height along the normal
                    direction -- a wide "Bottom" badge sitting beside a
                    vertical wall needs to be pushed out further than a
                    narrow "3" badge would, otherwise a wide badge's near
                    edge ends up hugging the wall even though its center is
                    the same distance away. */}
                  {showWallIds &&
                    wallSegments(corners).map((seg) => {
                      const colorKey = wallColorKey(seg.index, corners.length);
                      const isFullyOpen =
                        closedSubIntervals(seg.length, openWalls.get(colorKey) ?? []).length === 0;
                      if (isFullyOpen) return null;
                      const midX = cm((seg.a.x + seg.b.x) / 2);
                      const midY = cm((seg.a.y + seg.b.y) / 2);
                      const n = wallOutwardNormal(seg.a, seg.b);
                      const label =
                        corners.length === 4
                          ? t[wallColorKey(seg.index, 4) as "top" | "right" | "bottom" | "left"]
                          : String(seg.index + 1);
                      // Badge width scales with label length (named walls like
                      // "Bottom" need noticeably more room than a 1-2 digit
                      // wall number) with generous horizontal padding so the
                      // text never crowds the badge edges.
                      const padX = 10;
                      const charW = 6.5;
                      const boxW = Math.max(22, Math.round(label.length * charW + padX * 2));
                      const boxH = 20;
                      const wallGap = 12; // visible gap between the wall and the badge's near edge
                      const halfExtent = Math.abs(n.x) * (boxW / 2) + Math.abs(n.y) * (boxH / 2);
                      const labelOffset = wallGap + halfExtent;
                      const lx = midX + n.x * labelOffset;
                      const ly = midY + n.y * labelOffset;
                      return (
                        <g key={`wall-id-${seg.index}`}>
                          <rect
                            x={lx - boxW / 2}
                            y={ly - boxH / 2}
                            width={boxW}
                            height={boxH}
                            rx={5}
                            className="fill-primary stroke-none"
                          />
                          <text
                            x={lx}
                            y={ly}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="fill-primary-foreground"
                            style={{ fontSize: 11, fontWeight: 600 }}
                          >
                            {label}
                          </text>
                        </g>
                      );
                    })}

                  {/* Sloped ceilings, drawn over the floor but under the
                      openings/items layers that follow -- see CanvasSlopes. */}
                  <CanvasSlopes
                    corners={corners}
                    wallSlopes={wallSlopes}
                    ceilingHeight={ceilingHeight}
                    cm={cm}
                    idKey={String(scaleKey)}
                    lang={lang}
                  />
                </svg>

                {/* openings -- viewOnly makes a tap/drag on a door or
                    window a no-op in mobile view-only mode, so it doesn't
                    steal the gesture out from under the stage's own pan
                    handler (see the viewOnly prop on CanvasOpenings). */}
                <CanvasOpenings
                  openings={openings}
                  setOpenings={setOpenings}
                  corners={corners}
                  scale={scale}
                  cm={cm}
                  pushHistory={pushHistory}
                  lang={lang}
                  selectedOpeningId={selectedOpeningId}
                  setSelectedOpeningId={setSelectedOpeningId}
                  openWalls={openWalls}
                  viewOnly={isMobileViewOnly}
                />

                {/* items -- pointer handlers are no-ops in mobile view-only
                    mode (see useMobileViewOnly): furniture is visible but
                    not draggable/rotatable/selectable, since there's no
                    Inspector to edit a selection with anyway. */}
                <CanvasItems
                  items={items}
                  selectedIds={selectedIds}
                  cm={cm}
                  onItemPointerDown={isMobileViewOnly ? () => {} : onItemPointerDown}
                  onRotateHandleDown={isMobileViewOnly ? () => {} : onRotateHandleDown}
                  dragToRotateLabel={t.dragToRotate}
                  dimsLabel={t.dimsLWH}
                  slopeIssues={slopeIssues}
                />

                {/* marquee */}
                <CanvasMarquee marqueeRect={marqueeRect} cm={cm} />

                {/* ruler overlay */}
                <CanvasRuler
                  rulerMode={rulerMode}
                  rulerStart={rulerStart}
                  rulerEnd={rulerEnd}
                  rulerHover={rulerHover}
                  cm={cm}
                  roomPxW={roomPxW}
                  roomPxL={roomPxL}
                />

                {/* Draggable Corner Handles */}
                {enableCornerDrag &&
                  !isMobileViewOnly &&
                  corners.map((c, idx) => (
                    <HoverTooltip
                      key={idx}
                      content={lang === "de" ? "Wandecke anpassen" : "Adjust corner"}
                    >
                      <div
                        onPointerDown={(e) => onCornerPointerDown(e, idx)}
                        className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-full border border-primary bg-background shadow-md hover:scale-125 cursor-move active:bg-primary transition-[transform,background-color] duration-150 flex items-center justify-center group"
                        style={{
                          left: cm(c.x),
                          top: cm(c.y),
                          touchAction: "none",
                          zIndex: 20,
                        }}
                      >
                        <span className="w-1 h-1 rounded-full bg-primary group-active:bg-background group-hover:bg-primary/80 transition-colors" />
                      </div>
                    </HoverTooltip>
                  ))}
              </div>

              {/* Replaces pinch-to-zoom on mobile (removed -- see
                  MobileZoomButtons.tsx doc comment). Flush to the right
                  edge, clear of the top-right View Options trigger and the
                  bottom-center 2D/3D toolbar pill. */}
              {isMobileViewOnly && (
                <MobileZoomButtons
                  zoomFactor={zoomFactor}
                  setZoomFactor={setZoomFactor}
                  min={0.1}
                  max={2.0}
                />
              )}

              {/* 2D View Options -- desktop keeps the always-visible floating
                  panel; mobile view-only mode (see useMobileViewOnly) swaps
                  it for a small trigger button + a vaul bottom sheet, and
                  drops the edit-adjacent toggles (corner dragging,
                  collision, multi-select) since there's no drag/select tool
                  active there anyway. */}
              {isMobileViewOnly ? (
                <Drawer open={mobileOptionsOpen} onOpenChange={setMobileOptionsOpen}>
                  <HoverTooltip content={lang === "de" ? "Ansichtsoptionen" : "View Options"}>
                    <DrawerTrigger asChild>
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        className="absolute top-3 right-3 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-border/40 bg-background/85 backdrop-blur-md shadow-md text-foreground hover:bg-accent transition-colors"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </button>
                    </DrawerTrigger>
                  </HoverTooltip>
                  <DrawerContent>
                    <DrawerHeader>
                      <DrawerTitle>
                        {lang === "de" ? "Optionen (2D)" : "2D View Options"}
                      </DrawerTitle>
                    </DrawerHeader>
                    <div className="flex flex-col gap-3 px-4 pb-6 text-sm">
                      <label className="flex items-center gap-2.5 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={showGrid2D}
                          onChange={(e) => setShowGrid2D(e.target.checked)}
                          className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
                        />
                        <span>{lang === "de" ? "Raster anzeigen" : "Show Grid Lines"}</span>
                      </label>

                      <label className="flex items-center gap-2.5 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={showWallIds}
                          onChange={(e) => setShowWallIds(e.target.checked)}
                          className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
                        />
                        <span>{lang === "de" ? "Wandnummern anzeigen" : "Show Wall Numbers"}</span>
                      </label>

                      <label className="flex items-center gap-2.5 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={showFlooring}
                          onChange={(e) => setShowFlooring(e.target.checked)}
                          className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
                        />
                        <span>{lang === "de" ? "Bodenbelag anzeigen" : "Show Flooring"}</span>
                      </label>

                      <div className="flex flex-col gap-1.5 border-t border-border/20 pt-3 mt-1">
                        <div className="flex items-center justify-between font-medium text-xs">
                          <span>{lang === "de" ? "Zoom" : "Zoom"}</span>
                          <span className="font-semibold text-primary">
                            {Math.round(zoomFactor * 100)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <button
                            onClick={() =>
                              setZoomFactor((z) => Math.max(0.1, Math.round((z - 0.1) * 10) / 10))
                            }
                            className="h-7 w-7 rounded border border-border bg-background hover:bg-accent text-sm font-bold flex items-center justify-center transition-colors"
                          >
                            -
                          </button>
                          <input
                            type="range"
                            min="0.1"
                            max="2.0"
                            step="0.05"
                            value={zoomFactor}
                            onChange={(e) => setZoomFactor(parseFloat(e.target.value))}
                            className="flex-1 h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                          />
                          <button
                            onClick={() =>
                              setZoomFactor((z) => Math.min(2.0, Math.round((z + 0.1) * 10) / 10))
                            }
                            className="h-7 w-7 rounded border border-border bg-background hover:bg-accent text-sm font-bold flex items-center justify-center transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </DrawerContent>
                </Drawer>
              ) : (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerMove={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="absolute top-3 right-3 z-50 pointer-events-auto w-52 flex flex-col gap-2 rounded-xl border border-border/40 bg-background/85 backdrop-blur-md p-3 shadow-md select-none text-[11px] text-foreground animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  <div className="flex items-center justify-between font-semibold border-b border-border/20 pb-1.5 text-[11.5px] text-primary">
                    <span>{lang === "de" ? "Optionen (2D)" : "2D View Options"}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-primary transition-colors">
                      <input
                        type="checkbox"
                        checked={showGrid2D}
                        onChange={(e) => setShowGrid2D(e.target.checked)}
                        className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
                      />
                      <span>{lang === "de" ? "Raster anzeigen" : "Show Grid Lines"}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-primary transition-colors">
                      <input
                        type="checkbox"
                        checked={showWallIds}
                        onChange={(e) => setShowWallIds(e.target.checked)}
                        className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
                      />
                      <span className="flex items-center gap-1">
                        {lang === "de" ? "Wandnummern anzeigen" : "Show Wall Numbers"}
                        <HoverTooltip
                          content={
                            lang === "de"
                              ? "Zeigt die Wand-ID neben jeder Wand an -- praktisch, um die richtige Wand im Tür-/Fenster-Dialog auszuwählen."
                              : "Shows each wall's id next to it on the canvas -- handy for picking the right wall in the Add Door/Window dialog."
                          }
                        >
                          <span className="cursor-help inline-flex items-center">
                            <HelpCircle className="h-3 w-3 text-muted-foreground/75 hover:text-amber-500 transition-colors" />
                          </span>
                        </HoverTooltip>
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-primary transition-colors">
                      <input
                        type="checkbox"
                        checked={showFlooring}
                        onChange={(e) => setShowFlooring(e.target.checked)}
                        className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
                      />
                      <span>{lang === "de" ? "Bodenbelag anzeigen" : "Show Flooring"}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-primary transition-colors">
                      <input
                        type="checkbox"
                        checked={collisionEnabled}
                        onChange={(e) => setCollisionEnabled(e.target.checked)}
                        className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
                      />
                      <span>{lang === "de" ? "Kollision aktivieren" : "Enable Collision"}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-primary transition-colors">
                      <input
                        type="checkbox"
                        checked={multiSelectMode}
                        onChange={(e) => setMultiSelectMode(e.target.checked)}
                        className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
                      />
                      <span className="flex items-center gap-1">
                        {lang === "de" ? "Mehrfachauswahl" : "Enable Multi-Select"}
                        <HoverTooltip
                          content={
                            lang === "de"
                              ? "Wenn deaktiviert, verschiebt das Ziehen auf leerer Fläche die Ansicht. Wenn aktiviert, zieht es ein Auswahlrechteck auf. Tipp: Strg gedrückt halten aktiviert die Mehrfachauswahl vorübergehend."
                              : "When off, dragging on empty canvas pans the view. When on, it draws a marquee multi-select box instead. Tip: hold Ctrl to activate multi-select temporarily."
                          }
                        >
                          <span className="cursor-help inline-flex items-center">
                            <HelpCircle className="h-3 w-3 text-muted-foreground/75 hover:text-amber-500 transition-colors" />
                          </span>
                        </HoverTooltip>
                      </span>
                    </label>
                  </div>

                  {/* Zoom control */}
                  <div className="flex flex-col gap-1 border-t border-border/20 pt-2 mt-1">
                    <div className="flex items-center justify-between font-medium text-[10.5px]">
                      <span>{lang === "de" ? "Zoom" : "Zoom"}</span>
                      <span className="font-semibold text-primary">
                        {Math.round(zoomFactor * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <HoverTooltip content={lang === "de" ? "Herauszoomen" : "Zoom out"}>
                        <button
                          onClick={() =>
                            setZoomFactor((z) => Math.max(0.1, Math.round((z - 0.1) * 10) / 10))
                          }
                          className="w-5.5 h-5 rounded border border-border bg-background hover:bg-accent text-[11px] font-bold flex items-center justify-center transition-colors"
                        >
                          -
                        </button>
                      </HoverTooltip>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.05"
                        value={zoomFactor}
                        onChange={(e) => setZoomFactor(parseFloat(e.target.value))}
                        className="flex-1 h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <HoverTooltip content={lang === "de" ? "Hineinzoomen" : "Zoom in"}>
                        <button
                          onClick={() =>
                            setZoomFactor((z) => Math.min(2.0, Math.round((z + 0.1) * 10) / 10))
                          }
                          className="w-5.5 h-5 rounded border border-border bg-background hover:bg-accent text-[11px] font-bold flex items-center justify-center transition-colors"
                        >
                          +
                        </button>
                      </HoverTooltip>
                    </div>
                  </div>
                </div>
              )}
            </>
          )
        )}

        {/* Rotate-to-landscape hint -- mobile view-only mode only, and only
            in portrait (see useMobileViewOnly): rotating never exits
            view-only mode, it just gives more canvas room. */}
        {isMobileViewOnly && isPortrait && <RotateHint lang={lang} />}

        {/* Back to wherever this room was opened from -- the multi-room
            overview, or the dashboard for a standalone single room (see
            backUrl/backLabel's doc comments in types/planner.ts).
            Bottom-left, clear of the bottom-center 2D/3D toolbar and the
            bottom-right scale bar/inspector, and paired with a visible
            label instead of the small icon-only button this used to be in
            the header (see Header.tsx). */}
        {backUrl && (
          <Link
            to={backUrl}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 backdrop-blur-md px-3.5 py-1.5 shadow-lg select-none text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>
              {backLabel ?? (lang === "de" ? "Zurück zur Übersicht" : "Back to Overview")}
            </span>
          </Link>
        )}

        {/* Floating bottom toolbar */}
        <ToolbarOverlay
          t={t}
          rulerMode={rulerMode}
          setRulerMode={setRulerMode}
          threeDActive={threeDActive}
          setThreeDActive={setThreeDActive}
          rulerStart={rulerStart}
          rulerEnd={rulerEnd}
          clearRuler={clearRuler}
          hideRuler={isMobileViewOnly}
          mobileLandscapeRequired={isMobileViewOnly && isPortrait}
          lang={lang}
        />

        {/* 2D Map-style Scale Bar Indicator */}
        {!threeDActive && scale > 0 && (
          <div className="absolute bottom-4 right-4 z-20 pointer-events-none flex flex-col items-center select-none font-mono text-[9px] font-semibold text-muted-foreground bg-background/60 backdrop-blur-sm px-2 py-1 rounded border border-border/20 shadow-sm animate-in fade-in duration-200">
            <span className="mb-0.5">
              {scaleCm >= 100 ? `${scaleCm / 100} m` : `${scaleCm} cm`}
            </span>
            <div className="relative flex items-center justify-between" style={{ width: scalePx }}>
              {/* Left tick */}
              <div className="w-[1.5px] h-2 bg-muted-foreground" />
              {/* Horizontal line */}
              <div className="flex-1 h-[1.5px] bg-muted-foreground" />
              {/* Right tick */}
              <div className="w-[1.5px] h-2 bg-muted-foreground" />
            </div>
          </div>
        )}

        {/* Floating Draggable Inspector Panel (2D only) -- hidden entirely
            in mobile view-only mode, since item selection/dragging is
            disabled there (see the CanvasItems pointer-handler no-ops
            above), so there's nothing for it to ever show. */}
        {!threeDActive && !isMobileViewOnly && (
          <div
            ref={inspectorRef}
            // data-stage-overlay marks this as UI floating over the canvas
            // rather than part of it, so the stage's wheel-to-zoom handler
            // leaves scrolling in here alone (see use-room-planner.ts).
            data-stage-overlay=""
            className="absolute z-40 flex w-72 flex-col pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
            style={{
              left: 0,
              top: 0,
              transform: `translate3d(${inspectorPos.x}px, ${inspectorPos.y}px, 0)`,
              willChange: "transform",
              // Never taller than the stage it floats over -- the body
              // scrolls internally past that point (see InspectorSection).
              // Derived from the panel's own y so its bottom edge always
              // stops short of the back pill / bottom toolbar strip, however
              // many sections are expanded -- see canvas-layout.ts. This is
              // the half that actually fixes the overlap: the panel was never
              // dragged over the back button, it grew over it.
              maxHeight: inspectorMaxHeight(inspectorPos.y),
              // The parent canvas stage sets cursor:grab/grabbing for
              // panning -- since cursor is CSS-inherited, this floating
              // panel would otherwise show the same "drag" hand everywhere
              // that isn't itself an interactive element. Reset it here so
              // the panel reads as a normal UI surface.
              cursor: "default",
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <InspectorSection
              t={t}
              lang={lang}
              threeDActive={threeDActive}
              selectedItem={selectedItem}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              selectedOpening={selectedOpening}
              openings={openings}
              selectedOpeningId={selectedOpeningId}
              setSelectedOpeningId={setSelectedOpeningId}
              wallColors={wallColors}
              setWallColors={setWallColors}
              flooring={flooring}
              setFlooring={setFlooring}
              ceilingHeight={ceilingHeight}
              setCeilingHeight={setCeilingHeight}
              wallSlopes={wallSlopes}
              setWallSlopes={setWallSlopes}
              corners={corners}
              items={items}
              updateItem={updateItem}
              removeItem={removeItem}
              duplicateSelected={duplicateSelected}
              removeSelected={removeSelected}
              updateOpening={updateOpening}
              removeOpening={removeOpening}
              draftW={draftW}
              setDraftW={setDraftW}
              draftL={draftL}
              setDraftL={setDraftL}
              applyRoom={applyRoom}
              dirty={dirty}
              isCollapsed={inspectorCollapsed}
              onToggleCollapse={() => setInspectorCollapsed((c) => !c)}
              onHeaderPointerDown={onInspectorHeaderPointerDown}
              openSaveDialog={openSaveDialog}
            />
          </div>
        )}
      </div>
    </main>
  );
}
