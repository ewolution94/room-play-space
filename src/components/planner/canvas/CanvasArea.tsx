import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import type { CanvasAreaProps } from "@/types/planner";
import {
  wallSegments,
  resolveWallSegment,
  wallColorKey,
  wallOutwardNormal,
} from "@/lib/hallway-shapes";
import { ThreeDView } from "../ThreeDView";
import { HintBanner } from "./HintBanner";
import { RoomDimensionBadge } from "./RoomDimensionBadge";
import { CanvasOpenings } from "./CanvasOpenings";
import { CanvasItems } from "./CanvasItems";
import { CanvasMarquee } from "./CanvasMarquee";
import { CanvasRuler } from "./CanvasRuler";
import { ToolbarOverlay } from "./ToolbarOverlay";
import { InspectorSection } from "../sidebar/InspectorSection";
import { HelpCircle } from "lucide-react";

export function CanvasArea({
  t,
  stageRef,
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
  zoomFactor,
  setZoomFactor,
  isDark,
  updateItem,
  removeItem,
  duplicateSelected,
  removeSelected,
  updateOpening,
  removeOpening,
}: CanvasAreaProps) {
  const [showGrid2D, setShowGrid2D] = useState(true);
  const [enableCornerDrag, setEnableCornerDrag] = useState(false);
  const [showWallIds, setShowWallIds] = useState(false);

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
  const onInspectorHeaderPointerDown = useCallback((e: React.PointerEvent) => {
    // Don't start drag on button clicks (collapse toggle)
    if ((e.target as HTMLElement).closest('button')) return;
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
        const panelW = panel.offsetWidth;
        const panelH = panel.offsetHeight;
        currentX = Math.max(0, Math.min(bounds.width - panelW, startPosX + dx));
        currentY = Math.max(0, Math.min(bounds.height - panelH, startPosY + dy));
      }

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          panel.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
          rafId = null;
        });
      }
    };

    const up = (ev: PointerEvent) => {
      try { target.releasePointerCapture(ev.pointerId); } catch {}
      window.removeEventListener('pointermove', move, { capture: true });
      window.removeEventListener('pointerup', up, { capture: true });
      window.removeEventListener('pointercancel', up, { capture: true });

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

    window.addEventListener('pointermove', move, { capture: true });
    window.addEventListener('pointerup', up, { capture: true });
    window.addEventListener('pointercancel', up, { capture: true });
  }, [stageRef]);

  const selectedLabel = selectedIds.size > 0 ? t.selectedCount(selectedIds.size) : undefined;
  const lang = t.title === "Raumplaner" ? "de" : "en";
  const scaleKey = Math.round(scale * 1000);

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
      })
    );
  };

  return (
    <main className="min-w-0 lg:h-full lg:min-h-0 flex flex-col gap-2">
      <HintBanner
        t={t}
        scale={scale}
        rulerMode={rulerMode}
        threeDActive={threeDActive}
      />
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
            : !multiSelectMode
            ? isPanning
              ? "grabbing"
              : "grab"
            : undefined,
        }}
      >
        {/* Room dimensions label (top-left of canvas) */}
        <RoomDimensionBadge
          roomW={roomW}
          roomL={roomL}
          selectedLabel={selectedLabel}
        />

        {threeDActive ? (
          <ThreeDView
            t={t}
            roomW={roomW}
            roomL={roomL}
            items={items}
            openings={openings}
            selectedIds={selectedIds}
            corners={corners}
            wallColors={wallColors}
            isDark={isDark}
          />
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
                  <pattern
                    id={`canvasGridPattern-${scaleKey}`}
                    width={cm(50)}
                    height={cm(50)}
                    patternUnits="userSpaceOnUse"
                  >
                    <circle
                      cx={1.5}
                      cy={1.5}
                      r={1.5}
                      className="fill-foreground/10 dark:fill-foreground/15"
                    />
                  </pattern>
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
                </defs>

                {/* Polygonal Floor plane shadow & background */}
                <polygon
                  points={corners.map((c) => `${cm(c.x)},${cm(c.y)}`).join(" ")}
                  className="fill-background stroke-none"
                  style={{
                    filter: "drop-shadow(0px 4px 16px rgba(0,0,0,0.06))",
                  }}
                />

                {/* Floor grid dot texture */}
                <polygon
                  points={corners.map((c) => `${cm(c.x)},${cm(c.y)}`).join(" ")}
                  fill={`url(#canvasGridPattern-${scaleKey})`}
                  className="stroke-none"
                />

                {/* Background Grid Lines (Symmetrical Mesh) */}
                {showGrid2D && (
                  <rect
                    x={cm(-2000)}
                    y={cm(-2000)}
                    width={cm(6000)}
                    height={cm(6000)}
                    fill={`url(#canvasLineGridPattern-${scaleKey})`}
                    className="stroke-none"
                  />
                )}

                {/* --- Wall segments in 2D with inner color highlighting ---
                    Looped over every edge of the room's polygon (4 for a
                    plain rectangle, 6-8 for an L/T-shaped hallway) instead
                    of 4 hardcoded named segments. A <line>'s visual result
                    doesn't depend on which endpoint is "a" vs "b", so this
                    is pixel-identical to the old hardcoded top/right/
                    bottom/left blocks for every existing rectangular room. */}
                {wallSegments(corners).map((seg) => {
                  const colorKey = wallColorKey(seg.index, corners.length);
                  return (
                    <React.Fragment key={seg.index}>
                      <line
                        x1={cm(seg.a.x)}
                        y1={cm(seg.a.y)}
                        x2={cm(seg.b.x)}
                        y2={cm(seg.b.y)}
                        className="stroke-slate-700 dark:stroke-slate-400"
                        strokeWidth={cm(6)}
                        strokeLinecap="round"
                      />
                      <line
                        x1={cm(seg.a.x)}
                        y1={cm(seg.a.y)}
                        x2={cm(seg.b.x)}
                        y2={cm(seg.b.y)}
                        stroke={wallColors[colorKey] || "#f1f5f9"}
                        strokeWidth={cm(4)}
                        strokeLinecap="round"
                      />
                    </React.Fragment>
                  );
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
              </svg>

              {/* openings */}
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
              />

              {/* items */}
              <CanvasItems
                items={items}
                selectedIds={selectedIds}
                cm={cm}
                onItemPointerDown={onItemPointerDown}
                onRotateHandleDown={onRotateHandleDown}
                dragToRotateLabel={t.dragToRotate}
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
              {enableCornerDrag && corners.map((c, idx) => (
                <div
                  key={idx}
                  onPointerDown={(e) => onCornerPointerDown(e, idx)}
                  className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-full border border-primary bg-background shadow-md hover:scale-125 cursor-move active:bg-primary transition-[transform,background-color] duration-150 flex items-center justify-center group"
                  style={{
                    left: cm(c.x),
                    top: cm(c.y),
                    touchAction: "none",
                    zIndex: 20,
                  }}
                  title={lang === "de" ? "Wandecke anpassen" : "Adjust corner"}
                >
                  <span className="w-1 h-1 rounded-full bg-primary group-active:bg-background group-hover:bg-primary/80 transition-colors" />
                </div>
              ))}
              </div>

              {/* 2D Control Panel Overlay */}
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
                      checked={enableCornerDrag}
                      onChange={(e) => setEnableCornerDrag(e.target.checked)}
                      className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
                    />
                    <span className="flex items-center gap-1">
                      {lang === "de" ? "Ecken verschieben" : "Enable Corner Dragging"}
                      <span 
                        title={lang === "de" ? "Experimentelle Funktion: Ermöglicht das freie Ziehen der Raumecken zur Erstellung unregelmäßiger Grundrisse." : "Experimental Feature: Allows dragging room corners to shape custom non-rectangular layouts."}
                        className="cursor-help inline-flex items-center"
                      >
                        <HelpCircle 
                          className="h-3 w-3 text-muted-foreground/75 hover:text-amber-500 transition-colors" 
                        />
                      </span>
                    </span>
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
                      <span
                        title={lang === "de" ? "Zeigt die Wand-ID neben jeder Wand an -- praktisch, um die richtige Wand im Tür-/Fenster-Dialog auszuwählen." : "Shows each wall's id next to it on the canvas -- handy for picking the right wall in the Add Door/Window dialog."}
                        className="cursor-help inline-flex items-center"
                      >
                        <HelpCircle className="h-3 w-3 text-muted-foreground/75 hover:text-amber-500 transition-colors" />
                      </span>
                    </span>
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
                      <span
                        title={lang === "de" ? "Wenn deaktiviert, verschiebt das Ziehen auf leerer Fläche die Ansicht. Wenn aktiviert, zieht es ein Auswahlrechteck auf." : "When off, dragging on empty canvas pans the view. When on, it draws a marquee multi-select box instead."}
                        className="cursor-help inline-flex items-center"
                      >
                        <HelpCircle className="h-3 w-3 text-muted-foreground/75 hover:text-amber-500 transition-colors" />
                      </span>
                    </span>
                  </label>
                </div>

                {/* Zoom control */}
                <div className="flex flex-col gap-1 border-t border-border/20 pt-2 mt-1">
                  <div className="flex items-center justify-between font-medium text-[10.5px]">
                    <span>{lang === "de" ? "Zoom" : "Zoom"}</span>
                    <span className="font-semibold text-primary">{Math.round(zoomFactor * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <button
                      onClick={() => setZoomFactor((z) => Math.max(0.1, Math.round((z - 0.1) * 10) / 10))}
                      className="w-5.5 h-5 rounded border border-border bg-background hover:bg-accent text-[11px] font-bold flex items-center justify-center transition-colors"
                      title={lang === "de" ? "Herauszoomen" : "Zoom out"}
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
                      onClick={() => setZoomFactor((z) => Math.min(2.0, Math.round((z + 0.1) * 10) / 10))}
                      className="w-5.5 h-5 rounded border border-border bg-background hover:bg-accent text-[11px] font-bold flex items-center justify-center transition-colors"
                      title={lang === "de" ? "Hineinzoomen" : "Zoom in"}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </>
        )
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
        />

        {/* 2D Map-style Scale Bar Indicator */}
        {!threeDActive && scale > 0 && (
          <div className="absolute bottom-4 right-4 z-20 pointer-events-none flex flex-col items-center select-none font-mono text-[9px] font-semibold text-muted-foreground bg-background/60 backdrop-blur-sm px-2 py-1 rounded border border-border/20 shadow-sm animate-in fade-in duration-200">
            <span className="mb-0.5">{scaleCm >= 100 ? `${scaleCm / 100} m` : `${scaleCm} cm`}</span>
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

        {/* Floating Draggable Inspector Panel (2D only) */}
        {!threeDActive && (
          <div
            ref={inspectorRef}
            className="absolute z-40 w-72 pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
            style={{
              left: 0,
              top: 0,
              transform: `translate3d(${inspectorPos.x}px, ${inspectorPos.y}px, 0)`,
              willChange: "transform",
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
              selectedOpeningId={selectedOpeningId}
              setSelectedOpeningId={setSelectedOpeningId}
              wallColors={wallColors}
              setWallColors={setWallColors}
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
            />
          </div>
        )}
      </div>
    </main>
  );
}
