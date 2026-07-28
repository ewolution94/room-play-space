import React, {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  Suspense,
  lazy,
} from "react";
import { toast } from "sonner";
import type { RoomLayout, Point, Floor } from "@/types/planner";
import type { TranslationStrings } from "@/lib/planner-translations";
import {
  resolveSweptMove,
  rectilinearPolygonsOverlap,
  rectilinearPolygonRects,
} from "@/lib/planner-math";
import {
  resolveWallSegment,
  insetRectilinearPolygon,
  wallSegments,
  wallColorKey,
  polygonClipPathPercent,
} from "@/lib/hallway-shapes";
import {
  computeAutoOpenIntervals,
  resolveEffectiveOpenIntervals,
  closedSubIntervals,
  projectPointToFrame,
  globalCorners,
  computeRoomConnectivity,
} from "@/lib/room-adjacency";
import {
  FLOOR_W,
  FLOOR_L,
  rotateRoomLayout,
  duplicateRoomLayout,
  removeRoomLayout,
  clampRoomResize,
} from "@/lib/multi-room-actions";
import { HelpCircle, FolderOpen, Box, SlidersHorizontal } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { MultiRoomInspector } from "./MultiRoomInspector";
import type { RoomInstance3D } from "./ThreeDView";
import { ThreeDViewFallback } from "./ThreeDViewFallback";
import { RotateHint } from "./RotateHint";
import { MobileZoomButtons } from "./canvas/MobileZoomButtons";
import { FloorSwitcher } from "./FloorSwitcher";
import { CanvasLoadingOverlay } from "./canvas/CanvasLoadingOverlay";
import { useMobileViewOnly } from "@/hooks/use-mobile-view-only";
import { useCtrlHeld } from "@/hooks/use-ctrl-held";
import { FloorPatternDef } from "@/lib/floor-pattern-svg";
import { resolveFlooring } from "@/lib/floor-materials";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MultiRoomCanvasProps {
  t: TranslationStrings;
  rooms: RoomLayout[];
  setRooms: React.Dispatch<React.SetStateAction<RoomLayout[]>>;
  // Undo/redo for `rooms` -- see the doc comment on rooms.index.tsx's own
  // pushRoomsHistory/undoRooms/redoRooms for the full reasoning (mirrors
  // the single-room planner's historyRef/futureRef pattern, scoped to
  // whichever floor is currently active). `pushRoomsHistory` is called
  // once at the start of every discrete room-mutating action below --
  // never inside a setRooms(prev => ...) updater itself, and never on
  // every pointermove tick of a drag (only once at drag-start), same
  // convention use-room-planner.ts already uses for single-room items.
  pushRoomsHistory: () => void;
  undoRooms: () => void;
  redoRooms: () => void;
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
  showDimensions: boolean;
  setShowDimensions: (show: boolean) => void;
  showLabels: boolean;
  setShowLabels: (show: boolean) => void;
  multiSelectMode: boolean;
  setMultiSelectMode: (enabled: boolean) => void;
  threeDActive: boolean;
  setThreeDActive: (active: boolean) => void;
  // Multi-floor building state (see Floor in types/planner.ts) -- `rooms`
  // above is already scoped to whichever floor is active; these are only
  // needed for the floor-switcher pill bar itself and its switch-direction
  // transition animation (see FloorSwitcher.tsx and the keyed wrapper
  // around the room-rendering block below).
  floors: Floor[];
  activeFloorId: string;
  floorSwitchDirection: "up" | "down";
  onSelectFloor: (id: string) => void;
  onAddFloor: () => void;
  onRenameFloor: (id: string, name: string) => void;
  onDeleteFloor: (id: string) => void;
  onReorderFloors: (orderedIds: string[]) => void;
}

// Code-split from the eagerly-loaded route bundle -- see the matching
// comment in canvas/CanvasArea.tsx (the other ThreeDView consumer).
const ThreeDView = lazy(() => import("./ThreeDView").then((m) => ({ default: m.ThreeDView })));

export function MultiRoomCanvas({
  t,
  rooms,
  setRooms,
  pushRoomsHistory,
  undoRooms,
  redoRooms,
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
  showDimensions,
  setShowDimensions,
  showLabels,
  setShowLabels,
  multiSelectMode,
  setMultiSelectMode,
  threeDActive,
  setThreeDActive,
  floors,
  activeFloorId,
  floorSwitchDirection,
  onSelectFloor,
  onAddFloor,
  onRenameFloor,
  onDeleteFloor,
  onReorderFloors,
}: MultiRoomCanvasProps) {
  const navigate = useNavigate();
  const stageRef = useRef<HTMLDivElement>(null);
  // 800x600 is only ever a placeholder for the very first render, before
  // the container has a real measured size -- see stageReady below.
  const [stageSize, setStageSize] = useState({ w: 800, h: 600 });
  // False until the stage has been measured at least once with a real,
  // non-zero size. Gates CanvasLoadingOverlay below, masking the moment
  // where offsetX/offsetY/scale would otherwise still be based on the
  // 800x600 guess above (visibly shoving every room into the top-left
  // corner, mis-scaled, for a beat) -- see the matching stageReady in
  // use-room-planner.ts for the single-room planner's equivalent fix.
  const [stageReady, setStageReady] = useState(false);

  // Mobile "view only" mode (see useMobileViewOnly): room drag/select is
  // disabled (onRoomPointerDown below becomes a no-op) and the always-
  // visible "Layout Options" panel becomes a togglable bottom sheet.
  const { isMobileViewOnly, isPortrait } = useMobileViewOnly();
  const [mobileOptionsOpen, setMobileOptionsOpen] = useState(false);

  // Whether each room's flooring pattern renders in its 2D thumbnail here --
  // mirrors CanvasArea.tsx's own "Show Flooring" toggle for the single-room
  // view, but defaults OFF here: at the whole-floor-plan zoom level the
  // per-room patterns add visual noise across many rooms at once, so it's
  // an opt-in rather than an opt-out like the single-room view. Local to
  // this component, same as CanvasArea's version, since it's purely a
  // 2D-thumbnail display preference and doesn't need to persist or be
  // shared with the 3D whole-apartment view (which has its own independent
  // "Show Flooring" toggle in ThreeDView.tsx, on by default there).
  const [showFlooring, setShowFlooring] = useState(false);

  // While Control is held, multi-select behaves as if the "Enable
  // Multi-Select" checkbox were on too, without flipping its persisted
  // state -- see use-ctrl-held.ts.
  const ctrlHeld = useCtrlHeld();

  // A drag on mobile should only ever pan the floor plan -- never draw a
  // marquee selection box. That toggle is already hidden from the mobile
  // Layout Options sheet, but forcing it off here too covers a mid-session
  // transition into mobile view-only (e.g. shrinking the browser window)
  // while it was already on from desktop use, guaranteeing
  // onStagePointerDown's plain-pan branch below always runs.
  useEffect(() => {
    if (!isMobileViewOnly) return;
    setMultiSelectMode(false);
  }, [isMobileViewOnly, setMultiSelectMode]);

  const [activeDragIds, setActiveDragIds] = useState<Set<string>>(new Set());
  const [blockedRoomIds, setBlockedRoomIds] = useState<Set<string>>(new Set());
  const blockedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Which spans of each room's walls touch a neighbor's wall right now --
  // the "0-4 walls" feature's auto-suggestion half (see room-adjacency.ts).
  // Recomputed whenever the room list changes (drag, resize, add/remove);
  // O(rooms^2) but floor plans here run to tens of rooms, not thousands.
  const autoOpenWalls = useMemo(() => computeAutoOpenIntervals(rooms), [rooms]);

  // Whole-apartment 3D view: only ever offered once every room/hallway is
  // reachable from every other one through a genuinely open connection --
  // no room left floating on its own (see computeRoomConnectivity in
  // room-adjacency.ts, which reuses the exact same touching-wall detection
  // as the auto-open-wall suggestion above). Recomputed alongside
  // autoOpenWalls whenever the room list changes.
  const connectivity = useMemo(() => computeRoomConnectivity(rooms), [rooms]);
  const isolatedRoomNames = connectivity.isolatedRoomIds
    .map((id) => rooms.find((r) => r.id === id)?.name)
    .filter((n): n is string => !!n);
  const threeDEnabled = rooms.length > 0 && connectivity.isFullyConnected;
  const threeDDisabledReason =
    rooms.length === 0
      ? lang === "de"
        ? "Füge zuerst Räume hinzu."
        : "Add some rooms first."
      : !connectivity.isFullyConnected
        ? isolatedRoomNames.length > 0
          ? lang === "de"
            ? `Noch nicht verbunden: ${isolatedRoomNames.join(", ")}`
            : `Not yet connected: ${isolatedRoomNames.join(", ")}`
          : lang === "de"
            ? "Die Räume bilden noch getrennte Gruppen. Verbinde sie, um die 3D-Ansicht freizuschalten."
            : "Your rooms form separate groups. Connect them to unlock the 3D view."
        : null;

  // Every room/hallway's geometry translated into the shared-scene instance
  // shape ThreeDView.tsx now renders (see RoomInstance3D there) -- reusing
  // exactly the same local-corners fallback and effective-open-wall
  // resolution the 2D thumbnail below already computes per room, just
  // gathered up front for every room at once instead of per-render inside
  // the .map() below.
  const roomInstances = useMemo<RoomInstance3D[]>(
    () =>
      rooms.map((room) => {
        const instanceCorners =
          room.corners && room.corners.length >= 3
            ? room.corners
            : [
                { x: 0, y: 0 },
                { x: room.width, y: 0 },
                { x: room.width, y: room.length },
                { x: 0, y: room.length },
              ];
        const effectiveOpenWalls = resolveEffectiveOpenIntervals(
          room,
          instanceCorners,
          autoOpenWalls.get(room.id) ?? new Map(),
        );
        return {
          id: room.id,
          x: room.x,
          y: room.y,
          width: room.width,
          length: room.length,
          corners: instanceCorners,
          items: room.items,
          openings: room.openings,
          wallColors: room.wallColors ?? {},
          openWalls: effectiveOpenWalls,
          flooring: room.flooring,
        };
      }),
    [rooms, autoOpenWalls],
  );

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

  // Measures synchronously, before the browser paints, so the very first
  // frame the user could possibly see already uses the real container size
  // instead of the 800x600 placeholder above -- useLayoutEffect (not
  // useEffect) is what makes this happen before paint rather than after.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el || el.clientWidth === 0 || el.clientHeight === 0) return;
    setStageSize({ w: el.clientWidth, h: el.clientHeight });
    setStageReady(true);
  }, []);

  // Monitor stage size changes
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === 0 || el.clientHeight === 0) return;
      setStageSize({ w: el.clientWidth, h: el.clientHeight });
      setStageReady(true);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Scroll-wheel zoom -- see the matching effect in use-room-planner.ts for
  // why this is a native, non-passive listener attached straight to the
  // stage element rather than a React onWheel prop (preventDefault() is a
  // silent no-op on a passive listener, which is what React's onWheel uses
  // by default). Scoped to the stage div, so it only fires while hovering
  // the floor plan and never steals scroll from anywhere else in the app.
  // Skipped in 3D mode, where OrbitControls owns the wheel for camera zoom.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (threeDActive) return;
      e.preventDefault();
      const step = 0.05;
      const direction = e.deltaY > 0 ? -1 : 1;
      const next = Math.round((zoomFactor + direction * step) * 100) / 100;
      setZoomFactor(Math.max(0.2, Math.min(2.0, next)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [threeDActive, zoomFactor, setZoomFactor]);

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

  // Floor-switch transition (see the keyed wrapper around "Render Rooms"
  // below): rising to a higher floor feels like the new content is
  // arriving from below, so it slides in from the bottom; dropping to a
  // lower floor slides in from the top instead. Purely presentational --
  // the underlying room positions/math are completely unaffected, this
  // just re-triggers a CSS enter animation (tw-animate-css, already used
  // throughout this app's Radix-based dialogs/menus) each time
  // activeFloorId changes via the `key` below. Written out as two full
  // literal class strings (not built via template-literal concatenation)
  // since Tailwind's build-time scanner needs to see each complete
  // class name verbatim in the source to generate its CSS.
  const floorTransitionClasses =
    floorSwitchDirection === "up"
      ? "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-6 duration-300 ease-out"
      : "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-6 duration-300 ease-out";

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

    if (multiSelectMode || ctrlHeld) {
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
    // Left click or touch only. Also a no-op entirely in mobile view-only
    // mode (see useMobileViewOnly) -- room dragging/selecting is an editing
    // tool, not a view option, so it's disabled there. Double-click
    // navigation into a room (below) is now ALSO disabled in mobile
    // view-only mode (see that handler's own comment) -- /rooms/$roomId
    // doesn't know about mobile view-only at all, so entering a room from
    // here used to strand the user in a broken desktop layout with no
    // visible canvas.
    if (e.button !== 0 || isMobileViewOnly) return;
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

    pushRoomsHistory();
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
          // Each room's REAL shape (globalCorners -- local `corners`
          // translated by x/y, rotation already baked in via
          // rotateRoomLayout's width/length swap rather than re-applied as
          // an angular transform, since a room is never actually CSS/SVG-
          // rotated) fed through rectilinearPolygonsOverlap, so a dragged
          // room's collision footprint matches its visual silhouette
          // exactly -- this is what lets a room be dragged directly into
          // the notch/leg of an L or T-shaped hallway instead of being
          // blocked by its rectangular bounding box.
          const candidateCorners = globalCorners({ ...currentRoom, x, y });
          return next.some(
            (other) =>
              !idsSet.has(other.id) &&
              rectilinearPolygonsOverlap(candidateCorners, globalCorners(other)),
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
    pushRoomsHistory();
    setRooms((prev) => rotateRoomLayout(prev, roomId, collisionEnabled));
  };

  const duplicateRoom = (roomId: string) => {
    const newRoom = duplicateRoomLayout(rooms, roomId, lang);
    if (!newRoom) return;
    pushRoomsHistory();
    setRooms((prev) => [...prev, newRoom]);
    setSelectedRoomId(newRoom.id);
  };

  // Deleting a room deletes everything inside it (furniture, doors,
  // windows) with no undo available in this view (see AUDIT.md) -- so
  // unlike every other room action here, this one is gated behind an
  // explicit confirm step instead of firing immediately on click. `deleteRoom`/
  // `deleteSelectedRooms` (passed to MultiRoomInspector) only ever open that
  // confirmation; the actual mutation lives in performDeleteRoom/
  // performDeleteSelectedRooms below, run from the AlertDialog's confirm
  // button.
  const [deleteConfirm, setDeleteConfirm] = useState<
    { mode: "single"; roomId: string } | { mode: "bulk" } | null
  >(null);

  const deleteRoom = (roomId: string) => {
    setDeleteConfirm({ mode: "single", roomId });
  };

  const performDeleteRoom = (roomId: string) => {
    pushRoomsHistory();
    setRooms((prev) => removeRoomLayout(prev, roomId));
    if (selectedRoomId === roomId) {
      setSelectedRoomId(null);
    }
  };

  const updateSelectedRoom = (patch: Partial<RoomLayout>) => {
    if (!selectedRoomId) return;
    pushRoomsHistory();
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== selectedRoomId) return r;

        // A polygon (L/T-shaped hallway) room's width/length are a derived
        // bounding box, not an independent editable pair -- there's no
        // single well-defined way to "resize" an L-shape from one number,
        // so the width/length quick-edit fields don't apply to it (the
        // Inspector hides them for a hallway; this guard is defense in
        // depth against rebuilding its corners into a plain rectangle if
        // a width/length patch reaches here some other way).
        const isPolygon = !!r.corners && r.corners.length !== 4;
        if (isPolygon && (patch.width !== undefined || patch.length !== undefined)) {
          const { width: _w, length: _l, ...rest } = patch;
          patch = rest;
          if (Object.keys(patch).length === 0) return r;
        }

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

        // Re-scale corners if width/length changed (rectangular rooms only
        // -- see the polygon guard above).
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
    setDeleteConfirm({ mode: "bulk" });
  };

  const performDeleteSelectedRooms = () => {
    pushRoomsHistory();
    setRooms((prev) => prev.filter((r) => !selectedRoomIds.has(r.id)));
    setSelectedRoomIds(new Set());
  };

  const confirmPendingDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.mode === "single") performDeleteRoom(deleteConfirm.roomId);
    else performDeleteSelectedRooms();
    setDeleteConfirm(null);
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
    if (newIds.length === 0) return;
    pushRoomsHistory();
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

      // Ctrl/Cmd+Z (Shift for redo) and Ctrl/Cmd+Y -- same shortcuts as the
      // single-room planner (see use-room-planner.ts), now that this view
      // has undo/redo history too (see pushRoomsHistory's doc comment).
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redoRooms();
        else undoRooms();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redoRooms();
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
      pushRoomsHistory();
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
          // Exact polygon shapes (globalCorners + rectilinearPolygonsOverlap)
          // -- see the comment on the drag `collides` closure above for why
          // rotation is never re-applied here, and why this makes a room's
          // collision footprint match its visual silhouette exactly.
          const collided = next.some(
            (r) =>
              ids.has(r.id) &&
              next.some(
                (other) =>
                  other.id !== r.id &&
                  !ids.has(other.id) &&
                  rectilinearPolygonsOverlap(globalCorners(r), globalCorners(other)),
              ),
          );
          if (collided) return prev;
        }

        return next;
      });
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    selectedRoomId,
    selectedRoomIds,
    collisionEnabled,
    floorW,
    floorL,
    setRooms,
    pushRoomsHistory,
    undoRooms,
    redoRooms,
  ]);

  // flex-1 min-h-0 apply unconditionally below (not just lg:) -- see the
  // matching comment in canvas/CanvasArea.tsx for why: without it, <main>
  // has no defined height below lg, so the canvas below collapses to
  // ~0px instead of filling the mobile flex wrapper.
  return (
    <main className="min-w-0 flex-1 min-h-0 lg:h-full flex flex-col gap-2">
      {/* Confirm-before-delete -- unlike every other room action here
          (drag/rotate/duplicate), deleting a room deletes everything
          inside it (furniture, doors, windows), so it stays gated behind
          an explicit confirmation instead of firing immediately on click
          (mirrors the single-room planner's Reset confirm flow in
          routes/index.tsx) even now that Ctrl+Z can undo it too -- a
          confirmation up front is still cheaper than relying on someone
          remembering undo exists after the fact. */}
      <AlertDialog open={deleteConfirm !== null} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirm?.mode === "bulk" ? t.deleteRoomsTitle : t.deleteRoomTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.mode === "bulk"
                ? t.confirmDeleteRooms(selectedRoomIds.size)
                : t.confirmDeleteRoom}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPendingDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {lang === "de" ? "Löschen" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hint banner -- hidden in mobile view-only mode (see
          useMobileViewOnly): it's a room-dragging instruction for a tool
          that's disabled there, so the space goes back to the canvas
          (the RotateHint below covers the one thing worth telling a
          mobile viewer). */}
      {!isMobileViewOnly && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/50 px-4 py-2.5 text-xs text-muted-foreground shadow-sm">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary shrink-0" />
            <span>{t.dragRoomHint}</span>
          </div>
        </div>
      )}

      <div
        ref={stageRef}
        className={`relative min-h-0 flex-1 w-full rounded-lg border bg-muted/30 overflow-hidden select-none transition-colors duration-150
          ${threeDActive ? "" : multiSelectMode || ctrlHeld ? "cursor-crosshair" : isPanning ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ touchAction: "none" }}
        onPointerDown={threeDActive ? undefined : onStagePointerDown}
        onPointerMove={threeDActive ? undefined : onStagePointerMove}
        onPointerUp={threeDActive ? undefined : onStagePointerUp}
      >
        {/* Masks the moment before the stage has a real measured size --
            see stageReady's doc comment above and CanvasLoadingOverlay's
            own doc comment for why this exists. Also covers route-switch
            transitions for free, since navigating here fully remounts
            this component. */}
        <CanvasLoadingOverlay ready={stageReady} />

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

        {/* Floor switcher -- top-center, clear of the dimensions badge
            (top-left) and the Layout Options trigger/panel (top-right). Not
            shown in 3D mode: the whole-apartment 3D view is intentionally
            single-floor-scoped for now (see Floor's doc comment in
            types/planner.ts), so switching floors there wouldn't do
            anything meaningful with the 3D scene still on screen. Also
            hidden in mobile portrait, where the RotateHint below occupies
            this exact same top-center spot -- floor switching waits for
            landscape/desktop rather than stacking two pills in an already
            tight portrait viewport. */}
        {!threeDActive && !(isMobileViewOnly && isPortrait) && (
          <FloorSwitcher
            floors={floors}
            activeFloorId={activeFloorId}
            lang={lang}
            onSelectFloor={onSelectFloor}
            onAddFloor={onAddFloor}
            onRenameFloor={onRenameFloor}
            onDeleteFloor={onDeleteFloor}
            onReorderFloors={onReorderFloors}
          />
        )}

        {/* Rotate-to-landscape hint -- mobile view-only mode only, and only
            in portrait (see useMobileViewOnly): rotating never exits
            view-only mode, it just gives more canvas room. */}
        {isMobileViewOnly && isPortrait && <RotateHint lang={lang} />}

        {/* 3D View toggle -- mirrors the single-room planner's ToolbarOverlay
            3D toggle exactly (see ToolbarOverlay.tsx), gated on every room
            forming one connected structure (see computeRoomConnectivity in
            room-adjacency.ts). Always rendered (even while active) so it
            also serves as the way back to the 2D layout. */}
        <div
          className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 backdrop-blur-md px-3.5 py-1.5 shadow-lg select-none"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <HoverTooltip
            content={
              threeDDisabledReason ??
              (!threeDActive && isMobileViewOnly && isPortrait
                ? lang === "de"
                  ? "3D-Modus benötigt Querformat"
                  : "3D mode requires landscape orientation"
                : lang === "de"
                  ? "3D-Ansicht der gesamten Wohnung"
                  : "3D view of the whole apartment")
            }
          >
            <button
              onClick={() => {
                if (!threeDEnabled) return;
                if (!threeDActive && isMobileViewOnly && isPortrait) {
                  toast.info(
                    lang === "de"
                      ? "Bitte drehe dein Gerät ins Querformat, um den 3D-Modus zu nutzen."
                      : "Rotate your device to landscape to use 3D mode.",
                  );
                  return;
                }
                setThreeDActive(!threeDActive);
              }}
              disabled={!threeDEnabled}
              className={`h-8 rounded-full px-3 text-xs gap-1.5 font-medium flex items-center transition-colors ${
                !threeDEnabled || (!threeDActive && isMobileViewOnly && isPortrait)
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : threeDActive
                    ? "cursor-pointer text-purple-600 bg-purple-500/10 hover:bg-purple-500/20 dark:text-purple-400 dark:bg-purple-400/10 dark:hover:bg-purple-400/20"
                    : "cursor-pointer text-muted-foreground hover:text-foreground"
              }`}
            >
              <Box className="h-3.5 w-3.5" />
              {threeDActive
                ? lang === "de"
                  ? "2D-Modus"
                  : "2D Mode"
                : lang === "de"
                  ? "3D-Ansicht"
                  : "3D View"}
            </button>
          </HoverTooltip>
        </div>

        {/* Whole-apartment 3D view -- every room/hallway (walls, doors,
            windows, furniture) rendered together in one shared scene, using
            the exact same per-room geometry/opening data the 2D thumbnail
            below uses (see roomInstances above). Reuses the single-room 3D
            view's own renderer entirely (see ThreeDView.tsx's RoomInstance3D
            generalization) rather than a separate implementation. */}
        {threeDActive && (
          <div className="absolute inset-0 z-10">
            <Suspense fallback={<ThreeDViewFallback />}>
              <ThreeDView
                t={t}
                lang={lang}
                rooms={roomInstances}
                selectedIds={new Set()}
                isDark={isDark}
              />
            </Suspense>
          </div>
        )}

        {/* Layout Options -- desktop keeps the always-visible floating
            panel; mobile view-only mode (see useMobileViewOnly) swaps it
            for a small trigger button + a bottom sheet, and drops the
            edit-adjacent toggles (collision, multi-select) since room
            dragging/selecting is disabled there (onRoomPointerDown is a
            no-op on mobile). */}
        {!threeDActive && isMobileViewOnly && (
          <Drawer open={mobileOptionsOpen} onOpenChange={setMobileOptionsOpen}>
            <HoverTooltip content={lang === "de" ? "Ansichtsoptionen" : "View Options"}>
              <DrawerTrigger asChild>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute top-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-border/40 bg-background/85 backdrop-blur-md shadow-md text-foreground hover:bg-accent transition-colors"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </DrawerTrigger>
            </HoverTooltip>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>{lang === "de" ? "Layout Optionen" : "Layout Options"}</DrawerTitle>
              </DrawerHeader>
              <div className="flex flex-col gap-3 px-4 pb-6 text-sm">
                <label className="flex items-center gap-2.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={showFurniture}
                    onChange={(e) => setShowFurniture(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
                  />
                  <span>{lang === "de" ? "Möbel anzeigen" : "Show Furniture"}</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={showDimensions}
                    onChange={(e) => setShowDimensions(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
                  />
                  <span>{lang === "de" ? "Maße anzeigen" : "Show Dimensions"}</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={showLabels}
                    onChange={(e) => setShowLabels(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
                  />
                  <span>{lang === "de" ? "Beschriftungen anzeigen" : "Show Labels"}</span>
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
                        setZoomFactor(Math.max(0.2, Math.round((zoomFactor - 0.1) * 10) / 10))
                      }
                      className="h-7 w-7 rounded border border-border bg-background hover:bg-accent text-sm font-bold flex items-center justify-center transition-colors"
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
                      className="h-7 w-7 rounded border border-border bg-background hover:bg-accent text-sm font-bold flex items-center justify-center transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="border-t border-border/20 pt-3">
                  <button
                    onClick={() => {
                      setPanX(0);
                      setPanY(0);
                      setZoomFactor(0.85);
                    }}
                    className="w-full h-9 rounded border border-border bg-background hover:bg-accent text-xs font-semibold flex items-center justify-center gap-1 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <span>{lang === "de" ? "Ansicht zurücksetzen" : "Reset View"}</span>
                  </button>
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        )}

        {/* Replaces pinch-to-zoom on mobile (removed -- see
            MobileZoomButtons.tsx doc comment). Flush to the right edge,
            clear of the top-right Layout Options trigger and the
            bottom-center 2D/3D toolbar pill. */}
        {!threeDActive && isMobileViewOnly && (
          <MobileZoomButtons
            zoomFactor={zoomFactor}
            setZoomFactor={setZoomFactor}
            min={0.2}
            max={2.0}
          />
        )}

        {/* 2D control options overlay (desktop) */}
        {!threeDActive && !isMobileViewOnly && (
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
                checked={showDimensions}
                onChange={(e) => setShowDimensions(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
              />
              <span>{lang === "de" ? "Maße anzeigen" : "Show Dimensions"}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-primary transition-colors py-1">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
              />
              <span>{lang === "de" ? "Beschriftungen anzeigen" : "Show Labels"}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-primary transition-colors py-1">
              <input
                type="checkbox"
                checked={showFlooring}
                onChange={(e) => setShowFlooring(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
              />
              <span>{lang === "de" ? "Bodenbelag anzeigen" : "Show Flooring"}</span>
            </label>

            <HoverTooltip
              content={
                lang === "de"
                  ? "Tipp: Strg gedrückt halten aktiviert die Mehrfachauswahl vorübergehend."
                  : "Tip: hold Ctrl to activate multi-select temporarily."
              }
            >
              <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-primary transition-colors py-1">
                <input
                  type="checkbox"
                  checked={multiSelectMode}
                  onChange={(e) => setMultiSelectMode(e.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
                />
                <span>{lang === "de" ? "Mehrfachauswahl" : "Enable Multi-Select"}</span>
              </label>
            </HoverTooltip>

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
        )}

        {/* Scaled Floor Area */}
        {!threeDActive && scale > 0 && (
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

            {/* Render Rooms -- keyed on the active floor so switching
                floors remounts this layer with a fresh enter animation
                (see floorTransitionClasses above) instead of the room
                cards just silently swapping in place. `absolute inset-0`
                exactly matches the parent "Scaled Floor Area" box (no
                offset of its own), so every room's own left/top math
                below is completely unaffected by this wrapper. */}
            <div key={activeFloorId} className={`absolute inset-0 ${floorTransitionClasses}`}>
              {rooms.map((room) => {
                const rx = cm(room.x);
                const ry = cm(room.y);
                const rw = cm(room.width);
                const rl = cm(room.length);
                const isSelected = selectedRoomId === room.id || selectedRoomIds.has(room.id);
                const isDragging = activeDragIds.has(room.id);
                const isBlocked = blockedRoomIds.has(room.id);

                // The room's own polygon, defaulting to a plain rectangle for
                // any room saved before `corners` existed. The thumbnail
                // below renders this shape directly (a true L/T outline for
                // a hallway instead of a plain rect) -- the outer card itself
                // stays a simple rounded-rectangle selection frame either way
                // (matches every other room card; the thumbnail is what
                // actually communicates the floor shape).
                const roomCorners =
                  room.corners && room.corners.length >= 4
                    ? room.corners
                    : [
                        { x: 0, y: 0 },
                        { x: room.width, y: 0 },
                        { x: room.width, y: room.length },
                        { x: 0, y: room.length },
                      ];
                const isPolygonRoom = roomCorners.length !== 4;

                // For an L/T-shaped hallway, the card's own background/
                // border/ring/shadow chrome is clipped to the room's exact
                // silhouette (percentages of the card's own box, so this
                // works regardless of the current zoom scale) instead of
                // staying a plain rectangle -- otherwise hovering/selecting a
                // hallway showed a rectangular highlight box bleeding into
                // its notch even though no wall was ever drawn there. A
                // plain rectangular room gets no clip-path at all (undefined)
                // so its normal rounded corners are unaffected.
                const polygonClipPath = isPolygonRoom
                  ? polygonClipPathPercent(roomCorners, room.width, room.length)
                  : undefined;

                // Dimension labels and the room name used to be positioned
                // against the room's full bounding box (room.width/2,
                // room.length/2, etc.) -- fine for a plain rectangle, but for
                // an L/T hallway that center/corner can fall in the notch,
                // outside the shape entirely. Anchoring them instead to the
                // largest axis-aligned rectangle in the shape's own
                // decomposition (see rectilinearPolygonRects/
                // rectilinearPolygonsOverlap in planner-math.ts, the same
                // exact-collision machinery) keeps them on real floor space.
                // For a plain rectangle this decomposition is just the room's
                // own full bounds, so this is a no-op there.
                const dimRects = rectilinearPolygonRects(roomCorners);
                const primaryRect = dimRects.reduce(
                  (best, r) => (r.width * r.height > best.width * best.height ? r : best),
                  dimRects[0],
                ) ?? { x: 0, y: 0, width: room.width, height: room.length };

                // Merges this room's manual wallOverrides on top of the
                // auto-detected touching-neighbor spans above -- see
                // room-adjacency.ts. Each wall's open interval(s) get no
                // outline drawn over them below (an actual gap), while the
                // rest of that same wall still renders normally -- so a long
                // wall next to a short neighbor only opens the matching span
                // instead of vanishing entirely.
                const effectiveOpenWalls = resolveEffectiveOpenIntervals(
                  room,
                  roomCorners,
                  autoOpenWalls.get(room.id) ?? new Map(),
                );

                return (
                  <div
                    key={room.id}
                    onPointerDown={(e) => onRoomPointerDown(e, room)}
                    onPointerMove={onRoomPointerMove}
                    onPointerUp={onRoomPointerUp}
                    className={`absolute rounded-lg border-2 shadow-sm transition-shadow cursor-all-scroll select-none flex flex-col items-center justify-center overflow-hidden
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
                      // Clips the card's own background/border/ring/shadow --
                      // AND, just as importantly, its hit-test area -- to the
                      // room's exact polygon silhouette for an L/T hallway
                      // (undefined for a plain rectangle, leaving its rounded
                      // corners and full-box hit area untouched). clip-path
                      // excludes the clipped-away region from pointer hit
                      // testing, so hovering/clicking/dragging in a hallway's
                      // notch now falls through to whatever's actually there
                      // (the floor plan, or another room placed in the
                      // notch) instead of grabbing the hallway by accident.
                      ...(polygonClipPath ? { clipPath: polygonClipPath } : {}),
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      // Disabled in mobile view-only mode: /rooms/$roomId
                      // doesn't apply useMobileViewOnly at all, so entering
                      // a room there drops a phone-width viewport into the
                      // full desktop two-column layout (Sidebar stacked
                      // above the canvas by the plain grid-cols-1 fallback)
                      // instead of the stripped-down mobile canvas -- the
                      // user loses the canvas entirely and has to scroll
                      // past the whole Add/Elements sidebar to find it.
                      // Simplest fix for now: stay on this overview scene
                      // (with its own working mobile view options) rather
                      // than navigating into a route that isn't mobile-aware.
                      if (isMobileViewOnly) return;
                      navigate({ to: "/rooms/$roomId", params: { roomId: room.id } });
                    }}
                  >
                    {/* Miniature Inside preview (scaled SVG Blueprint style) */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0">
                      <svg
                        width="100%"
                        height="100%"
                        viewBox={`0 0 ${room.width} ${room.length}`}
                        preserveAspectRatio="none"
                        className="w-full h-full"
                      >
                        {/* Floor background, shaped to the room's exact
                          silhouette (a polygon for an L/T hallway, matching
                          roomCorners exactly) rather than a plain rect --
                          otherwise this would repaint a rectangular floor
                          color straight back over the notch that the
                          chrome layer above just clipped away. Pixel-
                          identical to the old <rect> for a plain
                          rectangular room, since its polygon points ARE its
                          4 rect corners. When "Show Flooring" is on, this
                          becomes the room's own flooring color instead of
                          the plain card background, with the actual
                          material pattern (wood/tile/carpet/etc, see
                          floor-pattern-svg.tsx) layered on top -- mirrors
                          CanvasArea.tsx's single-room 2D floor rendering
                          exactly. The viewBox here is already in real cm
                          units (see the <svg> above), so `cm` is the
                          identity function -- no separate pixel-per-cm
                          scale factor to thread through like the single-
                          room canvas has. */}
                        {showFlooring && (
                          <defs>
                            <FloorPatternDef
                              flooring={room.flooring}
                              cm={(v) => v}
                              patternId={`floorPattern-${room.id}`}
                            />
                          </defs>
                        )}
                        <polygon
                          points={roomCorners.map((c) => `${c.x},${c.y}`).join(" ")}
                          fill={showFlooring ? resolveFlooring(room.flooring).color : undefined}
                          className={showFlooring ? "" : "fill-card"}
                        />
                        {showFlooring && (
                          <polygon
                            points={roomCorners.map((c) => `${c.x},${c.y}`).join(" ")}
                            fill={`url(#floorPattern-${room.id})`}
                          />
                        )}

                        {/* Thick CAD outer walls (8cm thickness), drawn as
                          independent per-wall segments (rather than one
                          closed outline), each further split into its
                          closed sub-run(s) around any open interval(s) --
                          see room-adjacency.ts -- so a long wall next to a
                          shorter touching neighbor only opens the matching
                          span instead of the entire wall vanishing. Uses
                          the same inset corner points for a rectangular
                          room as the old hardcoded x=4/y=4/width-8/
                          height-8 rect (verified in hallway-shapes.test.ts),
                          so a fully-closed room renders pixel-identical to
                          before. */}
                        {(() => {
                          // Open/closed intervals (effectiveOpenWalls, via
                          // room-adjacency.ts) are computed against each
                          // wall's TRUE, un-inset geometry -- t=0 is the
                          // actual corner point. But this thumbnail draws a
                          // "thick wall" by mitring every wall inward via
                          // insetRectilinearPolygon, which retracts each
                          // wall's own t=0 origin and shortens its length.
                          // Drawing the interval numbers directly against
                          // that shifted frame (as this used to do) silently
                          // moves every gap by the inset amount -- and since
                          // two touching rooms' walls face opposite
                          // directions, one room's gap drifts one way and the
                          // neighbor's drifts the other, so a shared door
                          // looked slightly offset between the two rooms.
                          // Fix: project each interval boundary's real
                          // physical point (from the true wall) onto the
                          // inset wall's own frame before drawing, so the
                          // rendered gap always lands on the same physical
                          // spot no matter how much a given wall got mitred.
                          //
                          // One subtlety: the wall's own two endpoints (t=0,
                          // t=origSeg.length) are the room's outer silhouette
                          // corners, not real door edges -- projecting *those*
                          // through the same formula overshoots past the
                          // mitred corner by exactly `inset` in each direction
                          // (the mitre retracts the inset wall's own frame by
                          // `inset` at both ends, which the physical-point
                          // projection doesn't know about), which is exactly
                          // what caused the "overhanging"/non-flush corners
                          // reported for hallway end-walls whose door reaches
                          // the very edge. Clamping the projected value to the
                          // inset wall's own valid range recovers the exact
                          // mitred corner whenever a boundary touches the
                          // wall's own end (closed runs, edge-flush doors),
                          // while leaving true interior door edges untouched.
                          const origSegs = wallSegments(roomCorners);
                          const insetSegs = wallSegments(insetRectilinearPolygon(roomCorners, 4));
                          return origSegs.flatMap((origSeg, idx) => {
                            const insetSeg = insetSegs[idx];
                            const key = wallColorKey(origSeg.index, roomCorners.length);
                            const openIntervals = effectiveOpenWalls.get(key) ?? [];
                            const closed = closedSubIntervals(origSeg.length, openIntervals);
                            const origUx = (origSeg.b.x - origSeg.a.x) / (origSeg.length || 1);
                            const origUy = (origSeg.b.y - origSeg.a.y) / (origSeg.length || 1);
                            const insetUx = (insetSeg.b.x - insetSeg.a.x) / (insetSeg.length || 1);
                            const insetUy = (insetSeg.b.y - insetSeg.a.y) / (insetSeg.length || 1);
                            const project = (t: number) => {
                              const physical = {
                                x: origSeg.a.x + origUx * t,
                                y: origSeg.a.y + origUy * t,
                              };
                              return Math.max(
                                0,
                                Math.min(insetSeg.length, projectPointToFrame(physical, insetSeg)),
                              );
                            };
                            return closed.map((c, i) => {
                              const start = project(c.start);
                              const end = project(c.end);
                              return (
                                <line
                                  key={`${origSeg.index}-${i}`}
                                  x1={insetSeg.a.x + insetUx * start}
                                  y1={insetSeg.a.y + insetUy * start}
                                  x2={insetSeg.a.x + insetUx * end}
                                  y2={insetSeg.a.y + insetUy * end}
                                  className="stroke-zinc-800 dark:stroke-zinc-300"
                                  strokeWidth={8}
                                  strokeLinecap="round"
                                />
                              );
                            });
                          });
                        })()}

                        {/* CAD-style dimension lines -- restored for plain
                          (non-hallway) rooms behind the showDimensions
                          toggle, but deliberately never shown for an L/T
                          hallway: a line drawn from one end of the shape's
                          bounding box to the other doesn't read as a real
                          "wall to wall" measurement once the shape isn't a
                          plain rectangle (see the room-name/dimension-text
                          block below for how hallways show their size
                          instead). Uses room.width/room.length directly
                          (not primaryRect) since this path only ever runs
                          for a plain rectangular room, where they're the
                          same thing anyway. */}
                        {showDimensions && !isPolygonRoom && (
                          <>
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
                          </>
                        )}

                        {/* Room name + (hallways only) a plain "W x L cm"
                          text -- independent of showDimensions above.
                          Centered in primaryRect (the largest rectangle in
                          the room's own shape decomposition, see
                          dimRects/primaryRect above) rather than the full
                          bounding box, so it always sits on real floor
                          space instead of risking an L/T hallway's notch.
                          A plain room's own width/length are already shown
                          by the CAD dimension lines above when enabled, so
                          this text doesn't duplicate them there. */}
                        {showLabels && (
                          <text
                            x={primaryRect.x + primaryRect.width / 2}
                            y={primaryRect.y + primaryRect.height / 2}
                            className="text-[14px] uppercase font-bold tracking-wider fill-zinc-400/80 dark:fill-zinc-500/80 font-sans"
                            textAnchor="middle"
                          >
                            {room.name}
                          </text>
                        )}
                        {showLabels && isPolygonRoom && (
                          <text
                            x={primaryRect.x + primaryRect.width / 2}
                            y={primaryRect.y + primaryRect.height / 2 + 18}
                            className="text-[11px] font-sans font-semibold fill-zinc-500/70 dark:fill-zinc-400/70"
                            textAnchor="middle"
                          >
                            {Math.round(room.width)} × {Math.round(room.length)} cm
                          </text>
                        )}

                        {/* Openings (Doors/Windows) simplified representation.
                          An opening whose span actually falls inside an
                          open interval on its wall is skipped (not deleted
                          -- see MultiRoomInspector.tsx) since there's no
                          wall left there to draw it on; one still sitting
                          in a closed sub-run of a partially-open wall
                          keeps rendering normally. */}
                        {room.openings.map((op) => {
                          const wallKey = typeof op.wall === "string" ? op.wall : String(op.wall);
                          const openIntervals = effectiveOpenWalls.get(wallKey) ?? [];
                          const opStart = op.position;
                          const opEnd = op.position + op.width;
                          const overlapsOpenWall = openIntervals.some(
                            (iv) => opStart < iv.end && opEnd > iv.start,
                          );
                          if (overlapsOpenWall) return null;

                          let ox = 0,
                            oy = 0,
                            ow = op.width,
                            ol = 8;
                          let isHorizontal = op.wall === "top" || op.wall === "bottom";

                          if (typeof op.wall === "number") {
                            // Polygon (hallway) room -- numeric walls are
                            // always forward-winding (see hallway-shapes.ts),
                            // so the gap rect is the bounding box of the
                            // opening's span along the wall plus an inward
                            // extension by the same 8-unit thickness the
                            // named-wall path below uses.
                            const seg = resolveWallSegment(roomCorners, op.wall);
                            if (!seg) return null;
                            const dx = seg.b.x - seg.a.x;
                            const dy = seg.b.y - seg.a.y;
                            const segLen = Math.hypot(dx, dy) || 1;
                            const ux = dx / segLen;
                            const uy = dy / segLen;
                            const inX = -uy;
                            const inY = ux;
                            const gapThick = 8;
                            const p1 = {
                              x: seg.a.x + ux * op.position,
                              y: seg.a.y + uy * op.position,
                            };
                            const p2 = {
                              x: seg.a.x + ux * (op.position + op.width),
                              y: seg.a.y + uy * (op.position + op.width),
                            };
                            const p3 = { x: p1.x + inX * gapThick, y: p1.y + inY * gapThick };
                            const p4 = { x: p2.x + inX * gapThick, y: p2.y + inY * gapThick };
                            const xsAll = [p1.x, p2.x, p3.x, p4.x];
                            const ysAll = [p1.y, p2.y, p3.y, p4.y];
                            ox = Math.min(...xsAll);
                            oy = Math.min(...ysAll);
                            ow = Math.max(...xsAll) - ox;
                            ol = Math.max(...ysAll) - oy;
                            isHorizontal = Math.abs(ux) > Math.abs(uy);
                          } else if (op.wall === "top") {
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
                            // Door representation -- deliberately just the gap
                            // in the wall line, with no leaf, swing arc, or
                            // hinge marker drawn. Keeps the overview reading
                            // as a clean floor plan rather than a detailed
                            // door schedule; hinge/swing are still fully
                            // editable and rendered in the single-room view.
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
                              const rank: Record<string, number> = {
                                under: 0,
                                main: 1,
                                "on-top": 2,
                                wall: 3,
                              };
                              return (
                                (rank[a.layer ?? "main"] ?? 1) - (rank[b.layer ?? "main"] ?? 1)
                              );
                            })
                            .map((item) => {
                              const layer = item.layer ?? "main";
                              const shape = item.shape ?? "rect";
                              const opacity =
                                layer === "under"
                                  ? 0.35
                                  : layer === "on-top"
                                    ? 0.8
                                    : layer === "wall"
                                      ? 0.7
                                      : 0.6;
                              const cx = item.x + item.width / 2;
                              const cy = item.y + item.length / 2;
                              return (
                                <g
                                  key={item.id}
                                  transform={`rotate(${item.rotation}, ${cx}, ${cy})`}
                                >
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
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Floating Draggable Inspector Panel -- mirrors CanvasArea.tsx's single-room inspector */}
        {!threeDActive && (selectedRoomId || selectedRoomIds.size > 0) && (
          <div
            ref={inspectorRef}
            className="absolute z-40 w-72 pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
            style={{
              left: 0,
              top: 0,
              transform: `translate3d(${inspectorPos.x}px, ${inspectorPos.y}px, 0)`,
              willChange: "transform",
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
            <MultiRoomInspector
              t={t}
              lang={lang}
              selectedRoom={rooms.find((r) => r.id === selectedRoomId) || null}
              selectedRoomIds={selectedRoomIds}
              autoOpenWalls={
                selectedRoomId ? (autoOpenWalls.get(selectedRoomId) ?? new Map()) : new Map()
              }
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
