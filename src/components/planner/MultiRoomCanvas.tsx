import React, { useRef, useState, useEffect } from "react";
import type { RoomLayout, Point, TranslationStrings } from "@/types/planner";
import { obbOverlap } from "@/lib/planner-math";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  RotateCw, 
  Copy, 
  Trash2, 
  Maximize2, 
  HelpCircle,
  FolderOpen
} from "lucide-react";
import { Link } from "@tanstack/react-router";

interface MultiRoomCanvasProps {
  t: TranslationStrings;
  rooms: RoomLayout[];
  setRooms: React.Dispatch<React.SetStateAction<RoomLayout[]>>;
  selectedRoomId: string | null;
  setSelectedRoomId: (id: string | null) => void;
  collisionEnabled: boolean;
  setCollisionEnabled: (enabled: boolean) => void;
  zoomFactor: number;
  setZoomFactor: (zoom: number) => void;
  lang: "en" | "de";
  isDark: boolean;
  showFurniture: boolean;
  setShowFurniture: (show: boolean) => void;
}

export function MultiRoomCanvas({
  t,
  rooms,
  setRooms,
  selectedRoomId,
  setSelectedRoomId,
  collisionEnabled,
  setCollisionEnabled,
  zoomFactor,
  setZoomFactor,
  lang,
  isDark,
  showFurniture,
  setShowFurniture
}: MultiRoomCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 800, h: 600 });
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Monitor stage size changes
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setStageSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fixed virtual workspace size: 2000cm x 1500cm (20m x 15m)
  const floorW = 2000;
  const floorL = 1500;

  const pad = 40;
  const baseScale = Math.min((stageSize.w - pad * 2) / floorW, (stageSize.h - pad * 2) / floorL);
  const scale = baseScale * zoomFactor;

  const cm = (v: number) => v * scale;
  const floorPxW = cm(floorW);
  const floorPxL = cm(floorL);

  // Panning State
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panDragRef = useRef<{
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  const baseOffsetX = (stageSize.w - floorPxW) / 2;
  const baseOffsetY = (stageSize.h - floorPxL) / 2;
  const offsetX = baseOffsetX + panX;
  const offsetY = baseOffsetY + panY;

  const scaleKey = Math.round(scale * 1000);

  const onStagePointerDown = (e: React.PointerEvent) => {
    // Left click or touch only
    if (e.button !== 0) return;
    
    setSelectedRoomId(null);
    setIsPanning(true);

    const container = stageRef.current;
    if (container) {
      container.setPointerCapture(e.pointerId);
    }

    panDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPanX: panX,
      startPanY: panY,
    };
  };

  const onStagePointerMove = (e: React.PointerEvent) => {
    if (!panDragRef.current || !isPanning) return;
    const dx = e.clientX - panDragRef.current.startX;
    const dy = e.clientY - panDragRef.current.startY;
    setPanX(panDragRef.current.startPanX + dx);
    setPanY(panDragRef.current.startPanY + dy);
  };

  const onStagePointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      const container = stageRef.current;
      if (container) {
        try {
          container.releasePointerCapture(e.pointerId);
        } catch {}
      }
      setIsPanning(false);
    }
    panDragRef.current = null;
  };

  // Drag states
  const dragRef = useRef<{
    roomId: string;
    startX: number;
    startY: number;
    startRoomX: number;
    startRoomY: number;
    dragScale: number;
  } | null>(null);

  const onRoomPointerDown = (e: React.PointerEvent, room: RoomLayout) => {
    // Left click or touch only
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedRoomId(room.id);
    setActiveDragId(room.id);

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    dragRef.current = {
      roomId: room.id,
      startX: e.clientX,
      startY: e.clientY,
      startRoomX: room.x,
      startRoomY: room.y,
      dragScale: scale,
    };
  };

  const onRoomPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || dragRef.current.roomId !== activeDragId) return;
    e.stopPropagation();

    const drag = dragRef.current;
    const dx = (e.clientX - drag.startX) / drag.dragScale;
    const dy = (e.clientY - drag.startY) / drag.dragScale;

    let targetX = drag.startRoomX + dx;
    let targetY = drag.startRoomY + dy;

    // Bounds checking inside the 2000 x 1500 canvas
    const currentRoom = rooms.find(r => r.id === drag.roomId);
    if (!currentRoom) return;

    // Keep center/corners within bounds
    targetX = Math.max(0, Math.min(floorW - currentRoom.width, targetX));
    targetY = Math.max(0, Math.min(floorL - currentRoom.length, targetY));

    // Collision check: block moves that would overlap any other room
    if (collisionEnabled) {
      const candidateObb = { x: targetX, y: targetY, width: currentRoom.width, length: currentRoom.length, rotation: currentRoom.rotation };

      const hasCollision = rooms.some(other => {
        if (other.id === currentRoom.id) return false;
        return obbOverlap(
          candidateObb,
          { x: other.x, y: other.y, width: other.width, length: other.length, rotation: other.rotation }
        );
      });

      if (hasCollision) return;
    }

    setRooms(prev => prev.map(r => r.id === drag.roomId ? { ...r, x: targetX, y: targetY } : r));
  };

  const onRoomPointerUp = (e: React.PointerEvent) => {
    if (activeDragId) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setActiveDragId(null);
    }
    dragRef.current = null;
  };

  const rotateRoom = (roomId: string) => {
    setRooms(prev => prev.map(r => {
      if (r.id !== roomId) return r;
      const nextRotation = (r.rotation + 90) % 360;
      const nextW = r.length;
      const nextL = r.width;

      // Rotate openings (doors/windows)
      const rotatedOpenings = r.openings.map(op => {
        let newWall = op.wall;
        let newPosition = op.position;
        if (op.wall === "top") {
          newWall = "right";
          newPosition = op.position;
        } else if (op.wall === "right") {
          newWall = "bottom";
          newPosition = r.length - op.position - op.width;
        } else if (op.wall === "bottom") {
          newWall = "left";
          newPosition = op.position;
        } else if (op.wall === "left") {
          newWall = "top";
          newPosition = r.length - op.position - op.width;
        }
        return { ...op, wall: newWall, position: Math.max(0, newPosition) };
      });

      // Rotate items (furniture)
      const rotatedItems = r.items.map(item => {
        const newX = r.length - (item.y + item.length);
        const newY = item.x;
        const newW = item.length;
        const newL = item.width;
        const newRot = (item.rotation + 90) % 360;
        return {
          ...item,
          x: Math.max(0, newX),
          y: Math.max(0, newY),
          width: newW,
          length: newL,
          rotation: newRot,
        };
      });

      const candidate = {
        ...r,
        rotation: nextRotation,
        width: nextW,
        length: nextL,
        openings: rotatedOpenings,
        items: rotatedItems,
      };

      // Collision check
      const hasCollision = collisionEnabled && prev.some(other => {
        if (other.id === r.id) return false;
        return obbOverlap(
          { x: candidate.x, y: candidate.y, width: candidate.width, length: candidate.length, rotation: candidate.rotation },
          { x: other.x, y: other.y, width: other.width, length: other.length, rotation: other.rotation }
        );
      });

      if (hasCollision) return r; // prevent rotation if it collides
      return candidate;
    }));
  };

  const duplicateRoom = (roomId: string) => {
    const source = rooms.find(r => r.id === roomId);
    if (!source) return;

    const margin = 30;
    let found = false;

    const candidate = {
      x: source.x + source.width + margin,
      y: source.y,
      width: source.width,
      length: source.length,
      rotation: source.rotation
    };

    // First try placing directly to the right of the source
    const paddedFirst = {
      x: candidate.x - margin,
      y: candidate.y - margin,
      width: source.width + margin * 2,
      length: source.length + margin * 2,
      rotation: source.rotation
    };
    if (
      candidate.x + source.width <= 1950 &&
      !rooms.some(other => obbOverlap(
        paddedFirst,
        { x: other.x, y: other.y, width: other.width, length: other.length, rotation: other.rotation }
      ))
    ) {
      found = true;
    }

    // Grid scan fallback
    if (!found) {
      const stepX = Math.max(60, Math.round(source.width / 3));
      const stepY = Math.max(60, Math.round(source.length / 3));

      for (let cy = 50; cy + source.length <= 1450 && !found; cy += stepY) {
        for (let cx = 50; cx + source.width <= 1950 && !found; cx += stepX) {
          const paddedCandidate = {
            x: cx - margin,
            y: cy - margin,
            width: source.width + margin * 2,
            length: source.length + margin * 2,
            rotation: source.rotation
          };
          const hasOverlap = rooms.some(other => obbOverlap(
            paddedCandidate,
            { x: other.x, y: other.y, width: other.width, length: other.length, rotation: other.rotation }
          ));
          if (!hasOverlap) {
            candidate.x = cx;
            candidate.y = cy;
            found = true;
          }
        }
      }
    }

    // Final fallback: below all existing rooms
    if (!found) {
      const maxY = rooms.reduce((m, r) => Math.max(m, r.y + r.length), 0);
      candidate.x = 50;
      candidate.y = maxY + margin;
    }

    const newRoom: RoomLayout = {
      ...JSON.parse(JSON.stringify(source)),
      id: crypto.randomUUID(),
      name: `${source.name} (${lang === "de" ? "Kopie" : "Copy"})`,
      x: candidate.x,
      y: candidate.y,
    };

    setRooms(prev => [...prev, newRoom]);
    setSelectedRoomId(newRoom.id);
  };

  const deleteRoom = (roomId: string) => {
    setRooms(prev => prev.filter(r => r.id !== roomId));
    if (selectedRoomId === roomId) {
      setSelectedRoomId(null);
    }
  };

  return (
    <main className="min-w-0 lg:h-full lg:min-h-0 flex flex-col gap-2">
      {/* Hint banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/50 px-4 py-2.5 text-xs text-muted-foreground shadow-sm">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary shrink-0" />
          <span>{t.dragRoomHint}</span>
        </div>
      </div>

      <div
        ref={stageRef}
        className={`relative min-h-0 flex-1 w-full rounded-lg border bg-muted/30 overflow-hidden select-none transition-colors duration-150
          ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ touchAction: "none" }}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
      >
        {/* Dimensions label for the floor layout */}
        <div 
          onPointerDown={e => e.stopPropagation()}
          className="absolute top-3 left-3 z-20 flex flex-col gap-1 select-none font-sans text-xs bg-background/85 backdrop-blur-md px-3 py-2 rounded-xl border border-border/40 shadow-sm"
        >
          <div className="flex items-center gap-1.5 font-semibold text-primary">
            <FolderOpen className="h-3.5 w-3.5 text-sky-500" />
            <span>{t.overviewGrid}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {floorW} x {floorL} cm ({Math.round(floorW / 100)}m x {Math.round(floorL / 100)}m)
          </span>
        </div>

        {/* 2D control options overlay */}
        <div 
          onPointerDown={e => e.stopPropagation()}
          className="absolute top-3 right-3 z-20 w-52 flex flex-col gap-2 rounded-xl border border-border/40 bg-background/85 backdrop-blur-md p-3 shadow-md text-[11px]"
        >
          <div className="flex items-center justify-between font-semibold border-b border-border/20 pb-1.5 text-[11.5px] text-primary">
            <span>{lang === "de" ? "Layout Optionen" : "Layout Options"}</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-primary transition-colors py-1">
            <input
              type="checkbox"
              checked={collisionEnabled}
              onChange={(e) => setCollisionEnabled(e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
            />
            <span>{lang === "de" ? "Kollision aktivieren" : "Enable Collision"}</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-primary transition-colors py-1">
            <input
              type="checkbox"
              checked={showFurniture}
              onChange={(e) => setShowFurniture(e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
            />
            <span>{lang === "de" ? "Möbel anzeigen" : "Show Furniture"}</span>
          </label>

          {/* Zoom controls */}
          <div className="flex flex-col gap-1 border-t border-border/20 pt-2 mt-1">
            <div className="flex items-center justify-between font-medium text-[10.5px]">
              <span>{lang === "de" ? "Zoom" : "Zoom"}</span>
              <span className="font-semibold text-primary">{Math.round(zoomFactor * 100)}%</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <button
                onClick={() => setZoomFactor(Math.max(0.2, Math.round((zoomFactor - 0.1) * 10) / 10))}
                className="w-5.5 h-5 rounded border border-border bg-background hover:bg-accent text-[11px] font-bold flex items-center justify-center transition-colors"
              >
                -
              </button>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.05"
                value={zoomFactor}
                onChange={(e) => setZoomFactor(parseFloat(e.target.value))}
                className="flex-1 h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <button
                onClick={() => setZoomFactor(Math.min(2.0, Math.round((zoomFactor + 0.1) * 10) / 10))}
                className="w-5.5 h-5 rounded border border-border bg-background hover:bg-accent text-[11px] font-bold flex items-center justify-center transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Reset View Button */}
          <div className="border-t border-border/20 pt-2">
            <button
              onClick={() => {
                setPanX(0);
                setPanY(0);
                setZoomFactor(0.85);
              }}
              className="w-full h-7 rounded border border-border bg-background hover:bg-accent text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors text-muted-foreground hover:text-foreground"
            >
              <span>{lang === "de" ? "Ansicht zurücksetzen" : "Reset View"}</span>
            </button>
          </div>
        </div>

        {/* Scaled Floor Area */}
        {scale > 0 && (
          <div
            className="absolute box-content border border-dashed border-border/40 shadow-sm"
            style={{
              left: offsetX,
              top: offsetY,
              width: floorPxW,
              height: floorPxL,
              zIndex: 0,
            }}
          >
            {/* Dotted Grid Pattern */}
            <svg className="absolute inset-0 pointer-events-none w-full h-full">
              <defs>
                <pattern
                  id={`multiCanvasGridPattern-${scaleKey}`}
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
              </defs>
              <rect width="100%" height="100%" fill={`url(#multiCanvasGridPattern-${scaleKey})`} />
            </svg>

            {/* Render Rooms */}
            {rooms.map((room) => {
              const rx = cm(room.x);
              const ry = cm(room.y);
              const rw = cm(room.width);
              const rl = cm(room.length);
              const isSelected = selectedRoomId === room.id;

              return (
                <div
                  key={room.id}
                  onPointerDown={(e) => onRoomPointerDown(e, room)}
                  onPointerMove={onRoomPointerMove}
                  onPointerUp={onRoomPointerUp}
                  className={`absolute rounded-lg border-2 shadow-sm transition-shadow group cursor-move select-none flex flex-col items-center justify-center overflow-hidden
                    ${
                      isSelected
                        ? "border-primary bg-card shadow-lg ring-1 ring-primary"
                        : "border-border/80 hover:border-primary/50 bg-card hover:shadow-md"
                    }`}
                  style={{
                    left: rx,
                    top: ry,
                    width: rw,
                    height: rl,
                    transformOrigin: "center center",
                    touchAction: "none",
                    zIndex: isSelected ? 10 : 5,
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    // Go to room page
                    window.location.hash = `/rooms/${room.id}`;
                  }}
                >
                  {/* Miniature Inside preview (scaled SVG Blueprint style) */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0">
                    <svg
                      width="100%"
                      height="100%"
                      viewBox={`0 0 ${room.width} ${room.length}`}
                      preserveAspectRatio="none"
                      className="w-full h-full bg-card"
                    >
                      {/* Floor background block grid (subtle CAD grid) */}
                      <rect width={room.width} height={room.length} className="fill-card" />
                      
                      {/* Thick CAD outer walls (8cm thickness) */}
                      <rect 
                        x={4} 
                        y={4} 
                        width={room.width - 8} 
                        height={room.length - 8} 
                        fill="none" 
                        className="stroke-zinc-800 dark:stroke-zinc-300" 
                        strokeWidth={8} 
                      />

                      {/* CAD Dimension lines inside the room */}
                      {/* Width Dimension */}
                      <g className="opacity-70">
                        <line x1={30} y1={30} x2={room.width - 30} y2={30} className="stroke-zinc-500/80 dark:stroke-zinc-400/80" strokeWidth={1} />
                        <line x1={25} y1={35} x2={35} y2={25} className="stroke-zinc-500 dark:stroke-zinc-400" strokeWidth={1.5} />
                        <line x1={room.width - 35} y1={35} x2={room.width - 25} y2={25} className="stroke-zinc-500 dark:stroke-zinc-400" strokeWidth={1.5} />
                        <rect x={room.width/2 - 25} y={19} width={50} height={20} rx={4} className="fill-card stroke-none" />
                        <text x={room.width/2} y={33} className="text-[12px] font-sans font-bold fill-zinc-500 dark:fill-zinc-300" textAnchor="middle">{Math.round(room.width)} cm</text>
                      </g>
                      
                      {/* Length Dimension */}
                      <g className="opacity-70">
                        <line x1={30} y1={30} x2={30} y2={room.length - 30} className="stroke-zinc-500/80 dark:stroke-zinc-400/80" strokeWidth={1} />
                        <line x1={25} y1={35} x2={35} y2={25} className="stroke-zinc-500 dark:stroke-zinc-400" strokeWidth={1.5} />
                        <line x1={25} y1={room.length - 25} x2={35} y2={room.length - 35} className="stroke-zinc-500 dark:stroke-zinc-400" strokeWidth={1.5} />
                        <rect x={19} y={room.length/2 - 10} width={22} height={20} rx={4} className="fill-card stroke-none" />
                        <text x={29} y={room.length/2 + 4} className="text-[12px] font-sans font-bold fill-zinc-500 dark:fill-zinc-300" textAnchor="middle" transform={`rotate(-90, 29, ${room.length/2})`}>{Math.round(room.length)} cm</text>
                      </g>

                      {/* CAD Room Name centered in floor plan */}
                      <text 
                        x={room.width / 2} 
                        y={room.length / 2 + 25} 
                        className="text-[14px] uppercase font-bold tracking-wider fill-zinc-400/80 dark:fill-zinc-500/80 font-sans" 
                        textAnchor="middle"
                      >
                        {room.name}
                      </text>
                      
                      {/* Openings (Doors/Windows) simplified representation */}
                      {room.openings.map((op) => {
                        let ox = 0, oy = 0, ow = op.width, ol = 8;
                        if (op.wall === "top") {
                          ox = op.position; oy = 0; ow = op.width; ol = 8;
                        } else if (op.wall === "bottom") {
                          ox = op.position; oy = room.length - 8; ow = op.width; ol = 8;
                        } else if (op.wall === "left") {
                          ox = 0; oy = op.position; ow = 8; ol = op.width;
                        } else if (op.wall === "right") {
                          ox = room.width - 8; oy = op.position; ow = 8; ol = op.width;
                        }

                        const isHorizontal = op.wall === "top" || op.wall === "bottom";

                        if (op.kind === "window") {
                          return (
                            <g key={op.id}>
                              {/* Gap cover */}
                              <rect x={ox} y={oy} width={ow} height={ol} className="fill-card stroke-none" />
                              {/* Window double line box */}
                              <rect x={ox} y={oy} width={ow} height={ol} className="stroke-zinc-800 dark:stroke-zinc-300 fill-none" strokeWidth={1} />
                              {isHorizontal ? (
                                <line x1={ox} y1={oy + ol/2} x2={ox + ow} y2={oy + ol/2} className="stroke-zinc-800 dark:stroke-zinc-300" strokeWidth={1} />
                              ) : (
                                <line x1={ox + ow/2} y1={oy} x2={ox + ow/2} y2={oy + ol} className="stroke-zinc-800 dark:stroke-zinc-300" strokeWidth={1} />
                              )}
                            </g>
                          );
                        } else {
                          // Door representation (Always draws the wall gap, hides frames and leaf line if hideDoors is enabled)
                          return (
                            <g key={op.id}>
                              {/* Gap in wall */}
                              <rect x={ox} y={oy} width={ow} height={ol} className="fill-card stroke-none" />
                              
                              {/* Frame ticks and simple door leaf line */}
                              {!room.hideDoors && (
                                isHorizontal ? (
                                  <>
                                    <line x1={ox} y1={oy} x2={ox} y2={oy + ol} className="stroke-zinc-800 dark:stroke-zinc-300" strokeWidth={1.5} />
                                    <line x1={ox + ow} y1={oy} x2={ox + ow} y2={oy + ol} className="stroke-zinc-800 dark:stroke-zinc-300" strokeWidth={1.5} />
                                    <line 
                                      x1={ox} 
                                      y1={oy + ol/2} 
                                      x2={ox + ow * 0.8} 
                                      y2={oy + ol/2 + (op.wall === "top" ? 0.6 : -0.6) * ow} 
                                      className="stroke-zinc-800 dark:stroke-zinc-300" 
                                      strokeWidth={1.5} 
                                    />
                                  </>
                                ) : (
                                  <>
                                    <line x1={ox} y1={oy} x2={ox + ow} y2={oy} className="stroke-zinc-800 dark:stroke-zinc-300" strokeWidth={1.5} />
                                    <line x1={ox} y1={oy + ol} x2={ox + ow} y2={oy + ol} className="stroke-zinc-800 dark:stroke-zinc-300" strokeWidth={1.5} />
                                    <line 
                                      x1={ox + ow/2} 
                                      y1={oy} 
                                      x2={ox + ow/2 + (op.wall === "left" ? 0.6 : -0.6) * ol} 
                                      y2={oy + ol * 0.8} 
                                      className="stroke-zinc-800 dark:stroke-zinc-300" 
                                      strokeWidth={1.5} 
                                    />
                                  </>
                                )
                              )}
                            </g>
                          );
                        }
                      })}

                      {/* Items / Furniture (Visible only when toggle is on) */}
                      {showFurniture && room.items.map((item) => (
                        <g key={item.id} transform={`rotate(${item.rotation}, ${item.x + item.width / 2}, ${item.y + item.length / 2})`}>
                          <rect
                            x={item.x}
                            y={item.y}
                            width={item.width}
                            height={item.length}
                            rx={2}
                            fill={item.color || "#888888"}
                            className="stroke-zinc-600 dark:stroke-zinc-400"
                            strokeWidth={1}
                            opacity={0.6}
                          />
                        </g>
                      ))}
                    </svg>
                  </div>

                  {/* Glassmorphic Enter button in top-right corner */}
                  <div
                    onPointerDown={(e) => e.stopPropagation()}
                    className={`absolute top-2.5 right-2.5 z-20 pointer-events-auto transition-opacity duration-150
                      ${isSelected ? "opacity-100 scale-100" : "opacity-0 scale-95 group-hover:opacity-100"}`}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-7 w-7 rounded-full p-0 bg-background/80 hover:bg-background border border-border/40 backdrop-blur shadow-sm text-muted-foreground hover:text-foreground"
                      title={t.enterRoom}
                    >
                      <Link to="/rooms/$roomId" params={{ roomId: room.id }}>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
