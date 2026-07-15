import React, { useRef, useState, useEffect, useCallback } from "react";
import type { RoomLayout, Point } from "@/types/planner";
import type { TranslationStrings } from "@/lib/planner-translations";
import { obbOverlap, resolveSweptMove } from "@/lib/planner-math";
import {
  FLOOR_W,
  FLOOR_L,
  rotateRoomLayout,
  duplicateRoomLayout,
  removeRoomLayout,
  clampRoomResize,
} from "@/lib/multi-room-actions";
import { Button } from "@/components/ui/button";
import { ArrowRight, HelpCircle, FolderOpen } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { MultiRoomInspector } from "./MultiRoomInspector";

interface MultiRoomCanvasProps {
  t: TranslationStrings;
  rooms: RoomLayout[];
  setRooms: React.Dispatch<React.SetStateAction<RoomLayout[]>>;
  selectedRoomId: string | null;
  setSelectedRoomId: (id: string | null) => void;
  selectedRoomIds: Set<string>;
  setSelectedRoomIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  collisionEnabled: boolean;
  setCollisionEnabled: (enabled: boolean) => void;
  zoomFactor: number;
  setZoomFactor: (zoom: number) => void;
  lang: "en" | "de";
  isDark: boolean;
  showFurniture: boolean;
  setShowFurniture: (show: boolean) => void;
  multiSelectMode: boolean;
  setMultiSelectMode: (enabled: boolean) => void;
}

export function MultiRoomCanvas({
  t,
  rooms,
  setRooms,
  selectedRoomId,
  setSelectedRoomId,
  selectedRoomIds,
  setSelectedRoomIds,
  collisionEnabled,
  setCollisionEnabled,
  zoomFactor,
  setZoomFactor,
  lang,
  isDark,
  showFurniture,
  setShowFurniture,
  multiSelectMode,
  setMultiSelectMode,
}: MultiRoomCanvasProps) {
  const navigate = useNavigate();
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 800, h: 600 });
  const [activeDragIds, setActiveDragIds] = useState<Set<string>>(new Set());
  const [blockedRoomIds, setBlockedRoomIds] = useState<Set<string>>(new Set());
  const blockedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Floating draggable inspector state -- mirrors the single-room planner's
  // floating Inspector panel in CanvasArea.tsx exactly, so editing a room's
  // properties works the same way in both views instead of living in a
  // static sidebar card.
  const [inspectorPos, setInspectorPos] = useState({ x: 16, y: 16 });
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const inspectorPosRef = useRef(inspectorPos);
  useEffect(() => {
    inspectorPosRef.current = inspectorPos;
  }, [inspectorPos]);

  // Auto-expand inspector when selection changes
  useEffect(() => {
    if (selectedRoomId || selectedRoomIds.size > 0) {
      setInspectorCollapsed(false);
    }
  }, [selectedRoomId, selectedRoomIds]);

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

  useEffect(() => {
    return () => {
      if (blockedTimeoutRef.current) clearTimeout(blockedTimeoutRef.current);
    };
  }, []);

  // Fixed virtual workspace size: 2000cm x 1500cm (20m x 15m)
  const floorW = FLOOR_W;
  const floorL = FLOOR_L;

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

  // Marquee multi-select state (only active when multiSelectMode is on --
  // otherwise dragging on empty canvas pans, see onStagePointerDown below).
  const marqueeRef = useRef<{ startCx: number; startCy: number } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const stageToCm = (clientX: number, clientY: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    return {
      x: (clientX - r.left - offsetX) / scale,
      y: (clientY - r.top - offsetY) / scale,
    };
  };

  // Drag handler for the floating inspector header -- ported directly from
  // CanvasArea.tsx's onInspectorHeaderPointerDown.
  const onInspectorHeaderPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const panel = inspectorRef.current;
    if (!panel) return;

    try {
      target.setPointerCapture(e.pointerId);
    } catch {}

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

      panel.style.transition = "";
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      setInspectorPos({ x: currentX, y: currentY });
    };

    window.addEventListener("pointermove", move, { capture: true });
    window.addEventListener("pointerup", up, { capture: true });
    window.addEventListener("pointercancel", up, { capture: true });
  }, []);

  const onStagePointerDown = (e: React.PointerEvent) => {
    // Left click or touch only
    if (e.button !== 0) return;
    if (!stageRef.current) return;

    if (multiSelectMode) {
      setSelectedRoomId(null);
      setSelectedRoomIds(new Set());
      stageRef.current.setPointerCapture(e.pointerId);
      const p = stageToCm(e.clientX, e.clientY);
      marqueeRef.current = { startCx: p.x, startCy: p.y };
      setMarqueeRect({ x: p.x, y: p.y, w: 0, h: 0 });
      return;
    }

    setSelectedRoomId(null);
    setSelectedRoomIds(new Set());
    setIsPanning(true);
    stageRef.current.setPointerCapture(e.pointerId);

    panDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPanX: panX,
      startPanY: panY,
    };
  };

  const onStagePointerMove = (e: React.PointerEvent) => {
    if (marqueeRef.current) {
      const p = stageToCm(e.clientX, e.clientY);
      const x = Math.min(p.x, marqueeRef.current.startCx);
      const y = Math.min(p.y, marqueeRef.current.startCy);
      const w = Math.abs(p.x - marqueeRef.current.startCx);
      const h = Math.abs(p.y - marqueeRef.current.startCy);
      setMarqueeRect({ x, y, w, h });
      return;
    }

    if (!panDragRef.current || !isPanning) return;
    const dx = e.clientX - panDragRef.current.startX;
    const dy = e.clientY - panDragRef.current.startY;
    setPanX(panDragRef.current.startPanX + dx);
    setPanY(panDragRef.current.startPanY + dy);
  };

  const onStagePointerUp = (e: React.PointerEvent) => {
    if (marqueeRef.current) {
      const rect = marqueeRect;
      if (rect && rect.w > 1 && rect.h > 1) {
        const picked = rooms
          .filter((r) => {
            const cx = r.x + r.width / 2;
            const cy = r.y + r.length / 2;
            return cx >= rect.x && cx <= rect.x + rect.w && cy >= rect.y && cy <= rect.y + rect.h;
          })
          .map((r) => r.id);
        setSelectedRoomIds(new Set(picked));
        if (picked.length === 1) setSelectedRoomId(picked[0]);
      }
      marqueeRef.current = null;
      setMarqueeRect(null);
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {}
      return;
    }

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

  // Drag states. Note: dx/dy are recomputed against the *live* `scale` on every
  // pointer-move (not a value captured at drag-start), so this stays correct
  // even if the container is resized mid-drag. `startPos` holds every dragged
  // room's position at drag-start (mirrors the single-room item-drag's
  // startPos map) so a marquee-selected group of rooms all move together.
  const dragRef = useRef<{
    roomIds: string[];
    startX: number;
    startY: number;
    startPos: Map<string, { x: number; y: number }>;
  } | null>(null);

  const flashBlocked = (roomIds: string[]) => {
    setBlockedRoomIds(new Set(roomIds));
    if (blockedTimeoutRef.current) clearTimeout(blockedTimeoutRef.current);
    blockedTimeoutRef.current = setTimeout(() => setBlockedRoomIds(new Set()), 220);
  };

  const onRoomPointerDown = (e: React.PointerEvent, room: RoomLayout) => {
    // Left click or touch only
    if (e.button !== 0) return;
    e.stopPropagation();

    // If the clicked room is already part of a multi-room selection, drag the
    // whole group together; otherwise dragging always collapses the
    // selection down to just this one room (mirrors the single-room item
    // multi-select/drag behavior in use-room-planner.ts).
    const isPartOfGroup = selectedRoomIds.has(room.id) && selectedRoomIds.size > 1;
    const ids = isPartOfGroup ? Array.from(selectedRoomIds) : [room.id];

    if (!isPartOfGroup) {
      setSelectedRoomId(room.id);
      setSelectedRoomIds(new Set());
    }
    setActiveDragIds(new Set(ids));

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const startPos = new Map<string, { x: number; y: number }>();
    for (const id of ids) {
      const r = rooms.find((rr) => rr.id === id);
      if (r) startPos.set(id, { x: r.x, y: r.y });
    }

    dragRef.current = {
      roomIds: ids,
      startX: e.clientX,
      startY: e.clientY,
      startPos,
    };
  };

  const onRoomPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.stopPropagation();

    const drag = dragRef.current;
    const dx = (e.clientX - drag.startX) / scale;
    const dy = (e.clientY - drag.startY) / scale;

    // Everything below reads and writes through the setRooms(prev => ...)
    // updater -- never the `rooms` prop captured by this render's closure.
    // That matters: React 18 batches pointermove events, so several of these
    // handler calls can run back-to-back before a re-render happens. Reading
    // `rooms` directly (as an earlier version of this did, and as it still
    // does for e.g. rotateRoom/duplicateRoom, which aren't drag-rate-sensitive)
    // means every event in that batch would see the *same* stale snapshot and
    // resolve its collision independently of the others, instead of each one
    // building on the previous. The single-room item-drag code in
    // use-room-planner.ts avoids exactly this by doing all of its
    // `collidesWithOthers(candidate, prev, idsSet)` work inside the
    // setItems(prev => ...) updater -- this mirrors that.
    const blockedIds: string[] = [];
    const idsSet = new Set(drag.roomIds);

    setRooms((prev) => {
      let next = prev;

      // Each dragged room is resolved independently against everything
      // *outside* the dragged group (mirroring how single-room resolves each
      // selected item independently) -- so if one room in the group snags on
      // an obstacle, it can lag/slide along its own axis while the rest of
      // the group keeps moving, rather than the whole group locking up.
      for (const roomId of drag.roomIds) {
        const start = drag.startPos.get(roomId);
        const currentRoom = next.find((r) => r.id === roomId);
        if (!start || !currentRoom) continue;

        const clampToFloor = (x: number, y: number) => ({
          x: Math.max(0, Math.min(floorW - currentRoom.width, x)),
          y: Math.max(0, Math.min(floorL - currentRoom.length, y)),
        });

        const collides = (x: number, y: number) => {
          if (!collisionEnabled) return false;
          const candidateObb = {
            x,
            y,
            width: currentRoom.width,
            length: currentRoom.length,
            rotation: currentRoom.rotation,
          };
          return next.some(
            (other) =>
              !idsSet.has(other.id) &&
              obbOverlap(candidateObb, {
                x: other.x,
                y: other.y,
                width: other.width,
                length: other.length,
                rotation: other.rotation,
              }),
          );
        };

        // `from` is this room's last committed (and therefore known-valid)
        // position. Only testing the exact target coordinate is a "discrete"
        // check: at low zoom a single pointer-move event can carry a large cm
        // delta, large enough that the target lands entirely on the far side
        // of a neighboring room -- the endpoint alone looks collision-free
        // even though the straight-line path to it passes right through that
        // room, so the dragged room visibly tunnels through it.
        // Binary-searching along the segment from `from` to the target finds
        // the true contact point regardless of how big the jump is.
        const from = { x: currentRoom.x, y: currentRoom.y };
        const target = clampToFloor(start.x + dx, start.y + dy);

        // Binary-search-resolved swept move (see resolveSweptMove in
        // planner-math.ts) -- tries the full diagonal move first, then
        // slides along a single axis, so a room dragged diagonally toward a
        // neighbor slides flush along its face instead of stopping dead the
        // moment either axis touches something, and can't tunnel through an
        // obstacle when a single pointer-move event carries a large delta.
        const resolved = resolveSweptMove(from, target, collides, clampToFloor);

        if (!resolved) {
          blockedIds.push(roomId);
          continue;
        }

        next = next.map((r) => (r.id === roomId ? { ...r, x: resolved.x, y: resolved.y } : r));
      }

      return next;
    });

    // Fully blocked on both axes -- give a brief visual nudge instead of silently doing nothing.
    // (Done outside the updater above since setRooms(prev => ...) can run more
    // than once per call under React 18 Strict Mode and should stay a pure
    // computation; `blockedIds` just mirrors its outcome.)
    if (blockedIds.length > 0) flashBlocked(blockedIds);
  };

  const onRoomPointerUp = (e: React.PointerEvent) => {
    if (activeDragIds.size > 0) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setActiveDragIds(new Set());
    }
    dragRef.current = null;
  };

  const rotateRoom = (roomId: string) => {
    setRooms((prev) => rotateRoomLayout(prev, roomId, collisionEnabled));
  };

  const duplicateRoom = (roomId: string) => {
    const newRoom = duplicateRoomLayout(rooms, roomId, lang);
    if (!newRoom) return;
    setRooms((prev) => [...prev, newRoom]);
    setSelectedRoomId(newRoom.id);
  };

  const deleteRoom = (roomId: string) => {
    setRooms((prev) => removeRoomLayout(prev, roomId));
    if (selectedRoomId === roomId) {
      setSelectedRoomId(null);
    }
  };

  const updateSelectedRoom = (patch: Partial<RoomLayout>) => {
    if (!selectedRoomId) return;
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== selectedRoomId) return r;

        let nextPatch = patch;

        // Width/length changes used to be applied directly with no collision
        // check at all, so growing a room here could freely overlap a neighbor
        // even with collision enabled. Clamp the requested size to the largest
        // one that still fits (room's top-left x/y stays put).
        if (patch.width !== undefined || patch.length !== undefined) {
          const clamped = clampRoomResize(
            r,
            patch.width ?? r.width,
            patch.length ?? r.length,
            prev,
            collisionEnabled,
          );
          nextPatch = { ...patch, width: clamped.width, length: clamped.length };
        }

        const updated = { ...r, ...nextPatch };

        // Re-scale corners if width/length changed
        if (nextPatch.width !== undefined || nextPatch.length !== undefined) {
          const w = updated.width;
          const l = updated.length;
          updated.corners = [
            { x: 0, y: 0 },
            { x: w, y: 0 },
            { x: w, y: l },
            { x: 0, y: l },
          ];
        }
        return updated;
      }),
    );
  };

  // Bulk actions for a marquee-selected group of rooms.
  const deleteSelectedRooms = () => {
    setRooms((prev) => prev.filter((r) => !selectedRoomIds.has(r.id)));
    setSelectedRoomIds(new Set());
  };

  const duplicateSelectedRooms = () => {
    let working = rooms;
    const newIds: string[] = [];
    for (const id of selectedRoomIds) {
      const newRoom = duplicateRoomLayout(working, id, lang);
      if (!newRoom) continue;
      working = [...working, newRoom];
      newIds.push(newRoom.id);
    }
    setRooms(working);
    setSelectedRoomIds(new Set(newIds));
  };

  // Keyboard nudge for the selected room(s) -- mirrors the single-room
  // planner's item nudge (1cm per press, 10cm with Shift), so arrow keys work
  // the same way in both views for fine alignment.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const ids =
        selectedRoomIds.size > 0
          ? selectedRoomIds
          : selectedRoomId
            ? new Set([selectedRoomId])
            : new Set<string>();
      if (ids.size === 0) return;

      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else return;

      e.preventDefault();
      setRooms((prev) => {
        const next = prev.map((r) => {
          if (!ids.has(r.id)) return r;
          return {
            ...r,
            x: Math.max(0, Math.min(floorW - r.width, r.x + dx)),
            y: Math.max(0, Math.min(floorL - r.length, r.y + dy)),
          };
        });

        if (collisionEnabled) {
          const collided = next.some(
            (r) =>
              ids.has(r.id) &&
              next.some(
                (other) =>
                  other.id !== r.id &&
                  !ids.has(other.id) &&
                  obbOverlap(
                    { x: r.x, y: r.y, width: r.width, length: r.length, rotation: r.rotation },
                    {
                      x: other.x,
                      y: other.y,
                      width: other.width,
                      length: other.length,
                      rotation: other.rotation,
                    },
                  ),
              ),
          );
          if (collided) return prev;
        }

        return next;
      });
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedRoomId, selectedRoomIds, collisionEnabled, floorW, floorL, setRooms]);

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
          ${multiSelectMode ? "cursor-crosshair" : isPanning ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ touchAction: "none" }}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
      >
        {/* Dimensions label for the floor layout */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
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
          onPointerDown={(e) => e.stopPropagation()}
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

          <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-primary transition-colors py-1">
            <input
              type="checkbox"
              checked={multiSelectMode}
              onChange={(e) => setMultiSelectMode(e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
            />
            <span>{lang === "de" ? "Mehrfachauswahl" : "Enable Multi-Select"}</span>
          </label>

          {/* Zoom controls */}
          <div className="flex flex-col gap-1 border-t border-border/20 pt-2 mt-1">
            <div className="flex items-center justify-between font-medium text-[10.5px]">
              <span>{lang === "de" ? "Zoom" : "Zoom"}</span>
              <span className="font-semibold text-primary">{Math.round(zoomFactor * 100)}%</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <button
                onClick={() =>
                  setZoomFactor(Math.max(0.2, Math.round((zoomFactor - 0.1) * 10) / 10))
                }
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
                onClick={() =>
                  setZoomFactor(Math.min(2.0, Math.round((zoomFactor + 0.1) * 10) / 10))
                }
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

            {/* Marquee multi-select box */}
            {marqueeRect && (
              <div
                className="absolute border-2 border-primary/70 bg-primary/10 pointer-events-none z-30 rounded-sm"
                style={{
                  left: cm(marqueeRect.x),
                  top: cm(marqueeRect.y),
                  width: cm(marqueeRect.w),
                  height: cm(marqueeRect.h),
                }}
              />
            )}

            {/* Render Rooms */}
            {rooms.map((room) => {
              const rx = cm(room.x);
              const ry = cm(room.y);
              const rw = cm(room.width);
              const rl = cm(room.length);
              const isSelected = selectedRoomId === room.id || selectedRoomIds.has(room.id);
              const isDragging = activeDragIds.has(room.id);
              const isBlocked = blockedRoomIds.has(room.id);

              // The miniature preview's viewBox is normally an exact
              // room.width x room.length box, so a door leaf swinging
              // outward (drawn past the wall line, i.e. at negative/beyond
              // bounds coordinates) falls entirely outside it and never
              // renders. Pad the viewBox on every side by just enough to
              // fit the widest outward-swinging door's leaf -- rooms with
              // no outward doors get zero padding, so their preview is
              // pixel-identical to before.
              const outSwingPad = room.openings.reduce((max, op) => {
                if (op.kind !== "door" || (op.swing || "in") !== "out") return max;
                return Math.max(max, op.width * 0.6 + 6);
              }, 0);

              return (
                <div
                  key={room.id}
                  onPointerDown={(e) => onRoomPointerDown(e, room)}
                  onPointerMove={onRoomPointerMove}
                  onPointerUp={onRoomPointerUp}
                  className={`absolute rounded-lg border-2 shadow-sm transition-shadow group cursor-all-scroll select-none flex flex-col items-center justify-center overflow-hidden
                    ${isDragging ? "shadow-2xl scale-[1.015] transition-none" : "transition-transform duration-150"}
                    ${
                      isBlocked
                        ? "border-rose-500 ring-2 ring-rose-500/60"
                        : isSelected
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
                    zIndex: isDragging ? 15 : isSelected ? 10 : 5,
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    navigate({ to: "/rooms/$roomId", params: { roomId: room.id } });
                  }}
                >
                  {/* Miniature Inside preview (scaled SVG Blueprint style) */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0">
                    <svg
                      width="100%"
                      height="100%"
                      viewBox={`${-outSwingPad} ${-outSwingPad} ${room.width + 2 * outSwingPad} ${room.length + 2 * outSwingPad}`}
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
                        <line
                          x1={30}
                          y1={30}
                          x2={room.width - 30}
                          y2={30}
                          className="stroke-zinc-500/80 dark:stroke-zinc-400/80"
                          strokeWidth={1}
                        />
                        <line
                          x1={25}
                          y1={35}
                          x2={35}
                          y2={25}
                          className="stroke-zinc-500 dark:stroke-zinc-400"
                          strokeWidth={1.5}
                        />
                        <line
                          x1={room.width - 35}
                          y1={35}
                          x2={room.width - 25}
                          y2={25}
                          className="stroke-zinc-500 dark:stroke-zinc-400"
                          strokeWidth={1.5}
                        />
                        <rect
                          x={room.width / 2 - 25}
                          y={19}
                          width={50}
                          height={20}
                          rx={4}
                          className="fill-card stroke-none"
                        />
                        <text
                          x={room.width / 2}
                          y={33}
                          className="text-[12px] font-sans font-bold fill-zinc-500 dark:fill-zinc-300"
                          textAnchor="middle"
                        >
                          {Math.round(room.width)} cm
                        </text>
                      </g>

                      {/* Length Dimension */}
                      <g className="opacity-70">
                        <line
                          x1={30}
                          y1={30}
                          x2={30}
                          y2={room.length - 30}
                          className="stroke-zinc-500/80 dark:stroke-zinc-400/80"
                          strokeWidth={1}
                        />
                        <line
                          x1={25}
                          y1={35}
                          x2={35}
                          y2={25}
                          className="stroke-zinc-500 dark:stroke-zinc-400"
                          strokeWidth={1.5}
                        />
                        <line
                          x1={25}
                          y1={room.length - 25}
                          x2={35}
                          y2={room.length - 35}
                          className="stroke-zinc-500 dark:stroke-zinc-400"
                          strokeWidth={1.5}
                        />
                        <rect
                          x={19}
                          y={room.length / 2 - 10}
                          width={22}
                          height={20}
                          rx={4}
                          className="fill-card stroke-none"
                        />
                        <text
                          x={29}
                          y={room.length / 2 + 4}
                          className="text-[12px] font-sans font-bold fill-zinc-500 dark:fill-zinc-300"
                          textAnchor="middle"
                          transform={`rotate(-90, 29, ${room.length / 2})`}
                        >
                          {Math.round(room.length)} cm
                        </text>
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
                        let ox = 0,
                          oy = 0,
                          ow = op.width,
                          ol = 8;
                        if (op.wall === "top") {
                          ox = op.position;
                          oy = 0;
                          ow = op.width;
                          ol = 8;
                        } else if (op.wall === "bottom") {
                          ox = op.position;
                          oy = room.length - 8;
                          ow = op.width;
                          ol = 8;
                        } else if (op.wall === "left") {
                          ox = 0;
                          oy = op.position;
                          ow = 8;
                          ol = op.width;
                        } else if (op.wall === "right") {
                          ox = room.width - 8;
                          oy = op.position;
                          ow = 8;
                          ol = op.width;
                        }

                        const isHorizontal = op.wall === "top" || op.wall === "bottom";

                        if (op.kind === "window") {
                          return (
                            <g key={op.id}>
                              {/* Gap cover */}
                              <rect
                                x={ox}
                                y={oy}
                                width={ow}
                                height={ol}
                                className="fill-card stroke-none"
                              />
                              {/* Window double line box */}
                              <rect
                                x={ox}
                                y={oy}
                                width={ow}
                                height={ol}
                                className="stroke-zinc-800 dark:stroke-zinc-300 fill-none"
                                strokeWidth={1}
                              />
                              {isHorizontal ? (
                                <line
                                  x1={ox}
                                  y1={oy + ol / 2}
                                  x2={ox + ow}
                                  y2={oy + ol / 2}
                                  className="stroke-zinc-800 dark:stroke-zinc-300"
                                  strokeWidth={1}
                                />
                              ) : (
                                <line
                                  x1={ox + ow / 2}
                                  y1={oy}
                                  x2={ox + ow / 2}
                                  y2={oy + ol}
                                  className="stroke-zinc-800 dark:stroke-zinc-300"
                                  strokeWidth={1}
                                />
                              )}
                            </g>
                          );
                        } else {
                          // Door representation (Always draws the wall gap, hides frames and leaf line if hideDoors is enabled)
                          // The leaf's pivot side and swing direction mirror the
                          // room's own hinge/swing settings (editable in the
                          // single-room view's inspector) instead of a fixed
                          // "hinge at start, swing in" assumption -- purely
                          // visual, this has no bearing on room-vs-room
                          // collision, which only ever considers each room's
                          // rectangular wall footprint (see planner-math.ts).
                          const hinge = op.hinge || "start";
                          const swing = op.swing || "in";
                          const doorW = op.width;

                          return (
                            <g key={op.id}>
                              {/* Gap in wall */}
                              <rect
                                x={ox}
                                y={oy}
                                width={ow}
                                height={ol}
                                className="fill-card stroke-none"
                              />

                              {/* Frame ticks and simple door leaf line */}
                              {!room.hideDoors &&
                                (isHorizontal
                                  ? (() => {
                                      const interiorSign = op.wall === "top" ? 1 : -1;
                                      const perpSign = interiorSign * (swing === "in" ? 1 : -1);
                                      const pivotX = hinge === "start" ? ox : ox + ow;
                                      const tipDirX = hinge === "start" ? 1 : -1;
                                      return (
                                        <>
                                          <line
                                            x1={ox}
                                            y1={oy}
                                            x2={ox}
                                            y2={oy + ol}
                                            className="stroke-zinc-800 dark:stroke-zinc-300"
                                            strokeWidth={1.5}
                                          />
                                          <line
                                            x1={ox + ow}
                                            y1={oy}
                                            x2={ox + ow}
                                            y2={oy + ol}
                                            className="stroke-zinc-800 dark:stroke-zinc-300"
                                            strokeWidth={1.5}
                                          />
                                          <line
                                            x1={pivotX}
                                            y1={oy + ol / 2}
                                            x2={pivotX + tipDirX * doorW * 0.8}
                                            y2={oy + ol / 2 + perpSign * doorW * 0.6}
                                            className="stroke-zinc-800 dark:stroke-zinc-300"
                                            strokeWidth={1.5}
                                          />
                                        </>
                                      );
                                    })()
                                  : (() => {
                                      const interiorSign = op.wall === "left" ? 1 : -1;
                                      const perpSign = interiorSign * (swing === "in" ? 1 : -1);
                                      const pivotY = hinge === "start" ? oy : oy + ol;
                                      const tipDirY = hinge === "start" ? 1 : -1;
                                      return (
                                        <>
                                          <line
                                            x1={ox}
                                            y1={oy}
                                            x2={ox + ow}
                                            y2={oy}
                                            className="stroke-zinc-800 dark:stroke-zinc-300"
                                            strokeWidth={1.5}
                                          />
                                          <line
                                            x1={ox}
                                            y1={oy + ol}
                                            x2={ox + ow}
                                            y2={oy + ol}
                                            className="stroke-zinc-800 dark:stroke-zinc-300"
                                            strokeWidth={1.5}
                                          />
                                          <line
                                            x1={ox + ow / 2}
                                            y1={pivotY}
                                            x2={ox + ow / 2 + perpSign * doorW * 0.6}
                                            y2={pivotY + tipDirY * doorW * 0.8}
                                            className="stroke-zinc-800 dark:stroke-zinc-300"
                                            strokeWidth={1.5}
                                          />
                                        </>
                                      );
                                    })())}
                            </g>
                          );
                        }
                      })}

                      {/* Items / Furniture (Visible only when toggle is on) --
                          mirrors the single-room canvas's layer opacity tiers
                          (under < main < on-top) and renders circle-shaped
                          presets (e.g. a round table) as an ellipse instead
                          of a rect, purely visual -- collision never
                          considers item shape or layer. */}
                      {showFurniture &&
                        [...room.items]
                          .sort((a, b) => {
                            const rank: Record<string, number> = { under: 0, main: 1, "on-top": 2 };
                            return (rank[a.layer ?? "main"] ?? 1) - (rank[b.layer ?? "main"] ?? 1);
                          })
                          .map((item) => {
                            const layer = item.layer ?? "main";
                            const shape = item.shape ?? "rect";
                            const opacity =
                              layer === "under" ? 0.35 : layer === "on-top" ? 0.8 : 0.6;
                            const cx = item.x + item.width / 2;
                            const cy = item.y + item.length / 2;
                            return (
                              <g key={item.id} transform={`rotate(${item.rotation}, ${cx}, ${cy})`}>
                                {shape === "circle" ? (
                                  <ellipse
                                    cx={cx}
                                    cy={cy}
                                    rx={item.width / 2}
                                    ry={item.length / 2}
                                    fill={item.color || "#888888"}
                                    className="stroke-zinc-600 dark:stroke-zinc-400"
                                    strokeWidth={1}
                                    opacity={opacity}
                                  />
                                ) : (
                                  <rect
                                    x={item.x}
                                    y={item.y}
                                    width={item.width}
                                    height={item.length}
                                    rx={2}
                                    fill={item.color || "#888888"}
                                    className="stroke-zinc-600 dark:stroke-zinc-400"
                                    strokeWidth={1}
                                    opacity={opacity}
                                  />
                                )}
                              </g>
                            );
                          })}
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

        {/* Floating Draggable Inspector Panel -- mirrors CanvasArea.tsx's single-room inspector */}
        {(selectedRoomId || selectedRoomIds.size > 0) && (
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
            <MultiRoomInspector
              t={t}
              lang={lang}
              selectedRoom={rooms.find((r) => r.id === selectedRoomId) || null}
              selectedRoomIds={selectedRoomIds}
              updateSelectedRoom={updateSelectedRoom}
              rotateRoom={rotateRoom}
              duplicateRoom={duplicateRoom}
              deleteRoom={deleteRoom}
              duplicateSelectedRooms={duplicateSelectedRooms}
              deleteSelectedRooms={deleteSelectedRooms}
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
