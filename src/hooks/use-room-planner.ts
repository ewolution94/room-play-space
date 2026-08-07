import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";
import type {
  Lang,
  Item,
  ItemLayer,
  ItemShape,
  Opening,
  OpeningKind,
  Preset,
  Snapshot,
  Point,
  MarqueeRect,
  MarqueeState,
  DragState,
  UseRoomPlannerReturn,
  RoomLayout,
  RoomFlooring,
  RoomSource,
  SlopeFitIssue,
} from "@/types/planner";
import { STRINGS } from "@/lib/planner-translations";
import {
  clampPos,
  collidesWithOthers,
  findFreeSpot,
  computeOnTopElevation,
} from "@/lib/planner-math";
import { importSchema, formatZodError } from "@/lib/planner-schema";
import { getDefaultHeight, resolveEffectiveElevation, PRESET_BY_KEY } from "@/lib/planner-presets";
import { findHome, updateHome } from "@/lib/homes";
import { findSingleRoom, updateSingleRoom } from "@/lib/single-rooms";
import {
  DEFAULT_CEILING_HEIGHT,
  checkItemFitsUnderSlopes,
  type WallSlopeMap,
} from "@/lib/wall-slopes";
import { DEFAULT_FLOORING } from "@/lib/floor-materials";
import { buildExportFilename } from "@/lib/export-filename";
import {
  computeAutoOpenIntervals,
  resolveEffectiveOpenIntervals,
  type WallOpenInterval,
} from "@/lib/room-adjacency";
import { resolveWallSegment } from "@/lib/hallway-shapes";
import {
  defaultOpeningWidth,
  isSwingingOpening,
  openingFitsWall,
  openingKindLabel,
  openingTopHeight,
  requiredWallHeight,
} from "@/lib/openings";
import { useCtrlHeld } from "@/hooks/use-ctrl-held";
import { useSettings } from "@/hooks/use-settings";

// Typical desk/table/counter height (cm) -- the default elevation a
// newly-placed "on-top" item (lamp, laptop, vase, ...) gets so the 3D view
// shows it sitting above the floor like it's resting on a surface, instead
// of floating at floor level as a small box. Purely a starting point: the
// Inspector's existing elevation field lets you fine-tune it per item to
// match whatever it's actually meant to sit on.
const ON_TOP_DEFAULT_ELEVATION = 75;

// Default mount height (cm) for a "wall" layer item (sconces, art, mirrors,
// pendant lights, ...) that doesn't specify its own Preset.elevation --
// roughly eye/picture-rail height, a reasonable default for most wall decor.
// Unlike ON_TOP_DEFAULT_ELEVATION above, this is never recomputed after
// placement: "wall" items are deliberately excluded from the drag-end
// auto-elevate effect below (which only ever touches "on-top" items), so a
// wall-mounted item keeps whatever height it's given here (or its own
// Preset.elevation) no matter what furniture ends up underneath it.
const WALL_MOUNT_DEFAULT_ELEVATION = 150;

// Default room size + furniture for the standalone single-room planner (no
// roomId, i.e. not a room inside the /rooms apartment) -- a fully-furnished
// home office showcasing the real Kenney kit models and procedural
// fallback shapes (see kit-models.ts / procedural-models.ts) rather than a
// handful of flat boxes. Every item's width/length/color is pulled straight
// from its preset's own default (see defaultOfficeItem below) so it exactly
// matches the size resolveRenderMode (kit-models.ts) expects, guaranteeing
// every kitModel-mapped piece here renders as the real 3D model.
export const DEFAULT_ROOM_W = 500;
export const DEFAULT_ROOM_L = 400;

// localStorage flag marking the onboarding tour as seen -- exported so the
// dashboard's create flows (CreateSingleRoomFlow/CreateFloorFlow) can set
// it directly at creation time. Without that, the tour still auto-opens
// the first time useRoomPlanner mounts regardless of how the user got
// there, which now means it ambushes a room/floor someone just deliberately
// built from the dashboard, hiding the very content they asked for -- see
// those components' own comments.
export const TOUR_KEY = "planner-tour-v1-done";

let defaultItemIdCounter = 0;
function defaultOfficeItem(
  key: string,
  x: number,
  y: number,
  opts: { rotation?: number; elevation?: number; swapDims?: boolean } = {},
): Item {
  const preset = PRESET_BY_KEY[key];
  if (!preset) throw new Error(`use-room-planner.ts default office: unknown preset key "${key}"`);
  defaultItemIdCounter += 1;
  // swapDims: this item has no kitModel/proceduralModel (a plain flat box,
  // e.g. the cork board), so there's no 3D mesh to distort -- swapping
  // which of the preset's own w/l becomes width/length is a safe, cheap way
  // to lay it out rotated 90 degrees (hugging a side wall instead of the
  // back wall) without needing an actual THREE.js rotation.
  const width = opts.swapDims ? preset.l : preset.w;
  const length = opts.swapDims ? preset.w : preset.l;
  const item: Item = {
    id: `default-${key}-${defaultItemIdCounter}`,
    name: preset.nameEn,
    width,
    length,
    color: preset.color,
    x,
    y,
    rotation: opts.rotation ?? 0,
    kind: "furniture",
    icon: key,
  };
  if (preset.layer) item.layer = preset.layer;
  if (preset.shape) item.shape = preset.shape;
  if (opts.elevation !== undefined) item.elevation = opts.elevation;
  else if (preset.layer === "wall")
    item.elevation = preset.elevation ?? WALL_MOUNT_DEFAULT_ELEVATION;
  return item;
}

// Both functions below reflect the user's own hand-tuned pass over the
// generated default (exported 2026-07, re-imported here verbatim) --
// positions/rotations/openings match that export exactly (values just
// rounded to 2 decimals, since the originals are raw mouse-drag floats
// with no meaningful extra precision). The one deliberate deviation:
// books-stack keeps using the *current* preset default width/length
// instead of the export's literal 25x20 -- that 25x20 was the preset
// default at export time, before the kitModel aspect-ratio fix (see
// planner-presets.ts's books-stack entry), and hard-coding the old
// pre-fix number here would silently reintroduce the same 3D stretch bug.
export function buildDefaultOfficeOpenings(): Opening[] {
  return [
    {
      id: "default-door-1",
      wall: "bottom",
      position: 310.25,
      width: 90,
      kind: "door",
      hinge: "end",
      swing: "in",
    },
    { id: "default-window-1", wall: "top", position: 190, width: 140, kind: "window" },
    { id: "default-window-2", wall: "right", position: 144.8, width: 100, kind: "window" },
  ];
}

export function buildDefaultOfficeItems(): Item[] {
  defaultItemIdCounter = 0;
  return [
    // Main layer -- desk + seating area, storage along the walls.
    defaultOfficeItem("desk", 170, 15),
    // Every Kenney kit model (and the matching procedural families, like
    // cabinetBox below) is authored "facing" its own local +Z at
    // rotation:0 -- confirmed by inspecting the actual mesh geometry (a
    // chair/sofa/bed's tall backrest/headboard consistently sits at the
    // model's minZ extreme, its origin flush with maxZ=0 on the open/front
    // side). In this app, rotation:0 that means "faces toward larger y"
    // (south/into the room, away from a wall the item is backed up
    // against at y=0). See kit-models.ts for the general note.
    //
    // The desk backs up to the top wall (y=15) and needs no rotation --
    // its front (drawer side, where the chair goes) already faces south at
    // rotation:0. The chair sits just south of the desk, so it needs to
    // face NORTH (back toward the desk) instead of the unrotated default
    // of facing south (away from it) -- rotation:180.
    defaultOfficeItem("chair-office", 220, 100, { rotation: 180 }),
    defaultOfficeItem("bookshelf", 40.26, 6.89),
    // Backed up to the right wall -- faces west (into the room).
    defaultOfficeItem("office-credenza", 409.97, 173.65, { rotation: 90 }),
    // Three filing cabinets stacked flush against the left wall, all
    // facing east (into the room, away from that wall).
    defaultOfficeItem("filing-cabinet", -0.98, 233.67, { rotation: 270 }),
    defaultOfficeItem("filing-cabinet", -0.5, 169.76, { rotation: 270 }),
    defaultOfficeItem("filing-cabinet", -0.37, 106.89, { rotation: 270 }),
    // Reading nook near the bottom wall -- faces north, into the room.
    defaultOfficeItem("guest-chair", 79.24, 338.73, { rotation: 180 }),
    defaultOfficeItem("side-table", 140.1, 346.21),
    defaultOfficeItem("floor-lamp", 443.63, 7.06),
    defaultOfficeItem("plant", 443.92, 343.73),
    defaultOfficeItem("plant", 5.86, 344.36),
    // Under layer -- rug beneath the desk + chair.
    defaultOfficeItem("rug", 150, 80),
    // On-top layer -- desk surface + side-table surface.
    defaultOfficeItem("monitor", 221.75, 21.85, { elevation: 75 }),
    defaultOfficeItem("desk-lamp", 302.92, 21.12, { elevation: 75 }),
    defaultOfficeItem("books-stack", 175.37, 20.01, { elevation: 75 }),
    // A laptop open next to the monitor, given a slight stylistic tilt
    // instead of sitting perfectly axis-aligned.
    defaultOfficeItem("laptop", 180.42, 52.4, { rotation: 333.9, elevation: 75 }),
    defaultOfficeItem("plant-small", 145.1, 361.21, { elevation: 55 }),
    // Wall layer -- overhead light + a cork board for the "office" feel.
    defaultOfficeItem("pendant-light", 235, 185, { elevation: 175 }),
    defaultOfficeItem("corkboard", 487.88, 45.94, { swapDims: true, elevation: 140 }),
  ];
}

// Real-world height of an item, used to figure out where an "on-top" item's
// surface lands when something is auto-elevated onto it (see
// computeOnTopElevation in planner-math.ts). Falls back through the same
// catalog/legacy logic the 3D view already uses for items that don't carry
// an explicit `height`.
const itemHeight = (it: Item) => it.height ?? getDefaultHeight(it.icon, it.kind);

export function useRoomPlanner(
  roomId?: string,
  source: RoomSource = "floor",
  /** Which Home owns this room. Required when source is "floor" -- passed
   * by the route, never inferred by searching every home for the room id
   * (see RoomSource's doc comment). Ignored for a standalone room, which
   * belongs to no home at all. */
  homeId?: string,
): UseRoomPlannerReturn {
  const { settings, hydrated: settingsHydrated, update: updateSettings } = useSettings();
  const lang = settings.lang;
  const setLang = useCallback((l: Lang) => updateSettings({ lang: l }), [updateSettings]);
  const t = STRINGS[lang];

  // Load data for a specific room if requested, from whichever store this
  // room actually lives in (see RoomSource in types/planner.ts). Also hangs
  // onto its own floor's sibling rooms (read once, at mount) purely so
  // `openWalls` below can auto-detect which of *this* room's walls touch a
  // neighbor's -- siblings are never referenced again after this, and are
  // not kept reactive: the room editor and the home's floor plan are
  // different routes, so there's no way to be looking at a sibling's live
  // position while editing this room. Deliberately scoped to the room's OWN
  // floor only (see Floor in types/planner.ts) -- two floors never share a
  // physical wall, so a room on another floor (let alone in another home)
  // should never be treated as a touching neighbor here. A "single" room
  // has no siblings at all, by definition: it isn't part of any floor plan,
  // so nothing can touch it.
  const getInitialRoomData = (): { room: any; siblings: RoomLayout[] } => {
    if (typeof window === "undefined" || !roomId) return { room: null, siblings: [] };
    if (source === "single") return { room: findSingleRoom(roomId), siblings: [] };
    const home = homeId ? findHome(homeId) : null;
    if (!home) return { room: null, siblings: [] };
    const owningFloor = home.floors.find((f) => f.rooms.some((r) => r.id === roomId));
    if (!owningFloor) return { room: null, siblings: [] };
    return {
      room: owningFloor.rooms.find((r) => r.id === roomId) || null,
      siblings: owningFloor.rooms,
    };
  };
  const { room: initialRoom, siblings: initialSiblings } = getInitialRoomData();

  // Which spans of this room's walls are effectively open (auto-detected
  // touching a sibling, or an explicit override on the room itself).
  // Computed once from the same snapshot the rest of this room's initial
  // state comes from -- see RoomLayout.wallOverrides and room-adjacency.ts.
  const [openWalls] = useState<Map<string, WallOpenInterval[]>>(() => {
    if (!initialRoom) return new Map();
    const roomCorners: Point[] =
      initialRoom.corners && initialRoom.corners.length >= 3
        ? initialRoom.corners
        : [
            { x: 0, y: 0 },
            { x: initialRoom.width, y: 0 },
            { x: initialRoom.width, y: initialRoom.length },
            { x: 0, y: initialRoom.length },
          ];
    const autoOpen = computeAutoOpenIntervals(initialSiblings).get(initialRoom.id) ?? new Map();
    return resolveEffectiveOpenIntervals(initialRoom, roomCorners, autoOpen);
  });

  const [roomW, setRoomW] = useState(() => initialRoom?.width ?? DEFAULT_ROOM_W);
  const [roomL, setRoomL] = useState(() => initialRoom?.length ?? DEFAULT_ROOM_L);
  const [draftW, setDraftW] = useState(() => String(initialRoom?.width ?? DEFAULT_ROOM_W));
  const [draftL, setDraftL] = useState(() => String(initialRoom?.length ?? DEFAULT_ROOM_L));
  const dirty = draftW !== String(roomW) || draftL !== String(roomL);
  const [threeDActive, setThreeDActive] = useState(false);
  const [zoomFactor, setZoomFactor] = useState(1);
  const [corners, setCorners] = useState<Point[]>(
    () =>
      initialRoom?.corners ?? [
        { x: 0, y: 0 },
        { x: initialRoom?.width ?? DEFAULT_ROOM_W, y: 0 },
        { x: initialRoom?.width ?? DEFAULT_ROOM_W, y: initialRoom?.length ?? DEFAULT_ROOM_L },
        { x: 0, y: initialRoom?.length ?? DEFAULT_ROOM_L },
      ],
  );
  const [wallColors, setWallColors] = useState<Record<string, string>>(
    () =>
      initialRoom?.wallColors ?? {
        top: "#f1f5f9",
        right: "#f1f5f9",
        bottom: "#f1f5f9",
        left: "#f1f5f9",
      },
  );
  const [flooring, setFlooring] = useState<RoomFlooring>(
    () => initialRoom?.flooring ?? { ...DEFAULT_FLOORING },
  );
  // Room height + sloped ceilings. Both default to "a plain box of the
  // height the 3D view used to hardcode", so a room saved before either
  // field existed behaves exactly as it always did.
  const [ceilingHeight, setCeilingHeight] = useState<number>(
    () => initialRoom?.ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
  );
  const [wallSlopes, setWallSlopes] = useState<WallSlopeMap>(() => initialRoom?.wallSlopes ?? {});
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);

  // Fully-furnished home office default -- see buildDefaultOfficeItems above.
  // Door is on the bottom wall, off-center so its swing arc lands on clear
  // floor space between the side-table/guest-chair reading nook and the
  // plant in the corner.
  const [items, setItems] = useState<Item[]>(() => initialRoom?.items ?? buildDefaultOfficeItems());
  const [openings, setOpenings] = useState<Opening[]>(
    () => initialRoom?.openings ?? buildDefaultOfficeOpenings(),
  );

  // Sync changes back to whichever store this room came from. For a
  // standalone room that's a one-line patch of its own entry; for a floor
  // room, every other floor of this home passes through untouched, and
  // every OTHER home is never even read (see updateHome in lib/homes.ts,
  // which also no-ops if this home was deleted in another tab).
  useEffect(() => {
    if (typeof window === "undefined" || !roomId) return;
    if (source === "single") {
      updateSingleRoom(roomId, {
        width: roomW,
        length: roomL,
        items,
        openings,
        corners,
        wallColors,
        flooring,
        ceilingHeight,
        wallSlopes,
      });
      return;
    }
    if (!homeId) return;
    const home = findHome(homeId);
    if (!home) return;
    const updatedFloors = home.floors.map((floor) => {
      if (!floor.rooms.some((r) => r.id === roomId)) return floor;
      return {
        ...floor,
        rooms: floor.rooms.map((r) =>
          r.id === roomId
            ? {
                ...r,
                width: roomW,
                length: roomL,
                items,
                openings,
                corners,
                wallColors,
                flooring,
                ceilingHeight,
                wallSlopes,
              }
            : r,
        ),
      };
    });
    updateHome(homeId, { floors: updatedFloors });
  }, [
    source,
    homeId,
    roomId,
    roomW,
    roomL,
    items,
    openings,
    corners,
    wallColors,
    flooring,
    ceilingHeight,
    wallSlopes,
  ]);

  /**
   * Which items are too tall for the sloped ceiling above them, and by how
   * much. Recomputed whenever anything that could change the answer moves --
   * including mid-drag, since `items` updates live, which is what makes the
   * on-item readout track continuously rather than only settling on drop.
   *
   * Lives here rather than in the canvas because the Elements list needs the
   * exact same answer, and those two are siblings -- see CatalogSaveDraft's
   * doc comment for the same reasoning about My Catalog. Costs nothing for
   * the overwhelmingly common no-slopes room: it bails before touching items.
   */
  const slopeIssues = useMemo(() => {
    const issues = new Map<string, SlopeFitIssue>();
    if (Object.keys(wallSlopes).length === 0) return issues;
    for (const it of items) {
      // An item riding on top of something needs its host's height too --
      // resolveEffectiveElevation already resolves that chain.
      const required =
        resolveEffectiveElevation(it, items) + (it.height ?? getDefaultHeight(it.icon, it.kind));
      const { fits, availableHeight, shortfallCm } = checkItemFitsUnderSlopes(
        it,
        required,
        corners,
        wallSlopes,
        ceilingHeight,
      );
      if (!fits) {
        issues.set(it.id, { available: availableHeight, required, shortfall: shortfallCm });
      }
    }
    return issues;
  }, [items, corners, wallSlopes, ceilingHeight]);

  // -------- History (undo / redo) --------
  const stateRef = useRef<Snapshot>({
    items,
    openings,
    roomW,
    roomL,
    corners,
    wallColors,
    flooring,
    ceilingHeight,
    wallSlopes,
  });
  useEffect(() => {
    stateRef.current = {
      items,
      openings,
      roomW,
      roomL,
      corners,
      wallColors,
      flooring,
      ceilingHeight,
      wallSlopes,
    };
  }, [items, openings, roomW, roomL, corners, wallColors, flooring, ceilingHeight, wallSlopes]);

  const historyRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const [, forceHistoryTick] = useState(0);

  const snapshotEqual = (a: Snapshot, b: Snapshot) => JSON.stringify(a) === JSON.stringify(b);

  const pushHistory = () => {
    const snap: Snapshot = JSON.parse(JSON.stringify(stateRef.current));
    const top = historyRef.current[historyRef.current.length - 1];
    if (top && snapshotEqual(top, snap)) return;
    historyRef.current = [...historyRef.current.slice(-99), snap];
    futureRef.current = [];
    forceHistoryTick((n) => n + 1);
  };

  const applySnapshot = (s: Snapshot) => {
    setItems(s.items);
    setOpenings(s.openings);
    setRoomW(s.roomW);
    setRoomL(s.roomL);
    setDraftW(String(s.roomW));
    setDraftL(String(s.roomL));
    // >= 3 (not === 4) so undo/redo doesn't flatten a hallway's L/T-shaped
    // polygon corners (5+ points) back into a plain rectangle.
    if (s.corners && s.corners.length >= 3) {
      setCorners(s.corners);
    } else {
      setCorners([
        { x: 0, y: 0 },
        { x: s.roomW, y: 0 },
        { x: s.roomW, y: s.roomL },
        { x: 0, y: s.roomL },
      ]);
    }
    if (s.wallColors) {
      setWallColors(s.wallColors);
    } else {
      setWallColors({
        top: "#f1f5f9",
        right: "#f1f5f9",
        bottom: "#f1f5f9",
        left: "#f1f5f9",
      });
    }
    setFlooring(s.flooring ?? { ...DEFAULT_FLOORING });
    setCeilingHeight(s.ceilingHeight ?? DEFAULT_CEILING_HEIGHT);
    setWallSlopes(s.wallSlopes ?? {});
  };

  const undo = () => {
    if (!historyRef.current.length) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    futureRef.current = [...futureRef.current, JSON.parse(JSON.stringify(stateRef.current))];
    historyRef.current = historyRef.current.slice(0, -1);
    applySnapshot(prev);
    forceHistoryTick((n) => n + 1);
  };

  const redo = () => {
    if (!futureRef.current.length) return;
    const next = futureRef.current[futureRef.current.length - 1];
    historyRef.current = [...historyRef.current, JSON.parse(JSON.stringify(stateRef.current))];
    futureRef.current = futureRef.current.slice(0, -1);
    applySnapshot(next);
    forceHistoryTick((n) => n + 1);
  };

  const canUndo = historyRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  // -------- Room dims --------
  const applyRoom = (customW?: number, customL?: number) => {
    // A polygon (L/T-shaped hallway) room's width/length are a derived
    // bounding box -- there's no single well-defined way to resize an
    // L-shape from one number, so this quick W/L editor doesn't apply to
    // one (same reasoning as the multi-room Inspector's guard). Bail out
    // rather than rebuilding `corners` into a plain rectangle and
    // destroying the shape.
    if (corners.length !== 4) return;
    const w = customW !== undefined ? customW : Math.max(50, parseInt(draftW, 10) || 0);
    const l = customL !== undefined ? customL : Math.max(50, parseInt(draftL, 10) || 0);
    if (w === roomW && l === roomL) return;
    pushHistory();
    setRoomW(w);
    setRoomL(l);
    setDraftW(String(w));
    setDraftL(String(l));
    setCorners([
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: l },
      { x: 0, y: l },
    ]);
    const nextCorners = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: l },
      { x: 0, y: l },
    ];
    setCorners(nextCorners);
    setItems((prev) =>
      prev.map((i) => {
        const c = clampPos(i, nextCorners, i.x, i.y);
        return { ...i, x: c.x, y: c.y };
      }),
    );
  };

  // -------- Custom box form --------
  const [nName, setNName] = useState("");
  const [nW, setNW] = useState(80);
  const [nL, setNL] = useState(40);
  const [nColor, setNColor] = useState("#5cbdb9");
  const [nLayer, setNLayer] = useState<ItemLayer>("main");
  const [nShape, setNShape] = useState<ItemShape>("rect");

  // -------- New opening form --------
  const [oKind, setOKind] = useState<OpeningKind>("door");
  // Terrace doors only (see Opening.leaves). Kept as its own field rather
  // than folded into oKind so "terrace door" stays one kind of thing in the
  // data, with a property, instead of two near-identical enum members.
  const [oLeaves, setOLeaves] = useState<1 | 2>(1);
  const [oWall, setOWall] = useState<Opening["wall"]>("top");
  const [oPos, setOPos] = useState(50);
  const [oWidth, setOWidth] = useState(defaultOpeningWidth("door"));

  const stageRef = useRef<HTMLDivElement>(null);
  // 600x400 is only ever a placeholder for the very first render, before
  // the container has a real measured size -- see stageReady below for how
  // that window is actually hidden from view instead of just minimized.
  const [stageSize, setStageSize] = useState({ w: 600, h: 400 });
  // False until the stage has been measured at least once with a real,
  // non-zero size. CanvasArea.tsx renders a CanvasLoadingOverlay until this
  // flips true, masking the moment where scale/offsetX/offsetY would
  // otherwise still be based on the 600x400 guess above (visibly shoving
  // the room into the top-left corner, mis-scaled, for a beat).
  const [stageReady, setStageReady] = useState(false);

  // Measures synchronously, before the browser paints, so the very first
  // frame the user could possibly see already uses the real container
  // size instead of the 600x400 placeholder -- useLayoutEffect (not
  // useEffect) is what makes this happen before paint rather than after.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el || el.clientWidth === 0 || el.clientHeight === 0) return;
    setStageSize({ w: el.clientWidth, h: el.clientHeight });
    setStageReady(true);
  }, []);

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

  // Scroll-wheel zoom: a native (non-passive) listener attached directly to
  // the stage element, not a React onWheel prop -- React attaches its wheel
  // listener passively by default, so calling preventDefault() inside a
  // synthetic handler would silently fail to stop the page from scrolling.
  // Scoping the listener to the stage div itself (rather than window/body)
  // means it only ever fires while the pointer is actually over the canvas,
  // so it can never hijack scrolling in the sidebar, a popover, or anywhere
  // else in the app. Skipped in 3D mode, where OrbitControls owns the wheel
  // for camera zoom instead.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (threeDActive) return;
      // Floating panels (the Inspector) live INSIDE the stage, so their
      // wheel events bubble here. Without this the panel can never be
      // scrolled -- the wheel zooms the canvas underneath it instead, which
      // is exactly what happens once the Inspector grows past the viewport
      // (a room with several walls, each with a slope). Let those scroll
      // normally: no preventDefault, no zoom.
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-stage-overlay]")) return;
      e.preventDefault();
      const step = 0.05;
      const direction = e.deltaY > 0 ? -1 : 1;
      setZoomFactor((z) => {
        const next = Math.round((z + direction * step) * 100) / 100;
        return Math.max(0.1, Math.min(2.0, next));
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [threeDActive]);

  const pad = 40;
  const baseScale = Math.min((stageSize.w - pad * 2) / roomW, (stageSize.h - pad * 2) / roomL);
  const scale = baseScale * zoomFactor;
  const cm = (v: number) => v * scale;
  const roomPxW = cm(roomW);
  const roomPxL = cm(roomL);

  // -------- Multi-select mode & canvas panning --------
  // Off by default: dragging on empty canvas pans the view (matches the
  // multi-room master floor plan). Turning it on switches empty-canvas drag
  // over to the marquee multi-select box instead.
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  // While Control is held, multi-select behaves as if the checkbox above
  // were on too -- without actually flipping its persisted state, so
  // releasing Control cleanly reverts to whatever the checkbox says.
  const ctrlHeld = useCtrlHeld();
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panDragRef = useRef<{
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  const offsetX = (stageSize.w - roomPxW) / 2 - 4 + panX;
  const offsetY = (stageSize.h - roomPxL) / 2 - 4 + panY;

  // -------- Selection --------
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  // Switching into 3D clears any 2D selection -- ThreeDView renders a
  // purple wireframe highlight box around every selected item (see its
  // `selectedIds.has(it.id)` check), which has no real equivalent
  // interaction in 3D (there's no way to select/deselect an item there) and
  // just reads as a stray, unexplained highlight left over from whatever
  // was selected in 2D a moment ago.
  useEffect(() => {
    if (threeDActive) setSelectedIds(new Set());
  }, [threeDActive]);

  // Scroll the selected item's row into view inside the right-column scroller
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedIds.size === 0) return;
    const id = Array.from(selectedIds).pop()!;
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-item-row="${id}"]`);
      if (!el) return;
      let scroller: HTMLElement | null = el.parentElement;
      while (scroller && scroller !== document.body) {
        const style = window.getComputedStyle(scroller);
        const canScrollY = /(auto|scroll)/.test(style.overflowY);
        if (canScrollY && scroller.scrollHeight > scroller.clientHeight) break;
        scroller = scroller.parentElement;
      }
      if (!scroller || scroller === document.body) return;
      const elRect = el.getBoundingClientRect();
      const scRect = scroller.getBoundingClientRect();
      const fullyVisible = elRect.top >= scRect.top && elRect.bottom <= scRect.bottom;
      if (fullyVisible) return;
      const offset = elRect.top - scRect.top;
      const target = Math.max(
        0,
        scroller.scrollTop + offset - Math.max(0, (scroller.clientHeight - el.offsetHeight) / 2),
      );
      scroller.scrollTo({ top: target, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedIds]);

  // -------- Add items --------
  const addPreset = (preset: Preset) => {
    const layer = preset.layer ?? "main";
    const draft: Item = {
      id: crypto.randomUUID(),
      name: lang === "de" ? preset.nameDe : preset.nameEn,
      width: preset.w,
      length: preset.l,
      // Explicit rather than left for getDefaultHeight's lazy PRESET_BY_KEY
      // fallback to resolve later -- identical result for every ordinary
      // preset (that fallback looks up this exact same preset.h first), but
      // it's what lets a customCatalogItemToPreset() item (custom-catalog.ts)
      // carry a real height that differs from its sourceKey's generic preset
      // (e.g. an IKEA product's actual height) instead of silently
      // inheriting that preset's height merely because `icon` matches it.
      height: preset.h,
      color: preset.color,
      x: 10,
      y: 10,
      rotation: 0,
      kind: preset.iconUrl && preset.key === "chair-office" ? "chair" : "furniture",
      icon: preset.key,
      layer,
      shape: preset.shape ?? "rect",
      // An explicit elevation on the preset wins over the layer's default,
      // whatever the layer. Previously only "wall" consulted it, so a My
      // Catalog entry saved at a particular height came back sitting at its
      // layer's generic default instead -- the saved number was read from
      // storage and then thrown away here, at the last step. No change for
      // any built-in preset: all 23 that set an elevation are wall items,
      // which already took this path.
      elevation:
        preset.elevation ??
        (layer === "on-top"
          ? ON_TOP_DEFAULT_ELEVATION
          : layer === "wall"
            ? WALL_MOUNT_DEFAULT_ELEVATION
            : 0),
    };
    const spot = findFreeSpot(draft, items, corners, collisionEnabled);
    if (!spot) {
      toast.error(t.noFreeSpace);
      return;
    }
    pushHistory();
    const added = { ...draft, x: spot.x, y: spot.y };
    setItems((prev) => [...prev, added]);
    setSelectedIds(new Set([added.id]));
  };

  const addCustomBox = () => {
    if (!nName.trim()) return;
    const draft: Item = {
      id: crypto.randomUUID(),
      name: nName.trim(),
      width: nW,
      length: nL,
      color: nColor,
      x: 10,
      y: 10,
      rotation: 0,
      kind: "furniture",
      layer: nLayer,
      shape: nShape,
      elevation:
        nLayer === "on-top"
          ? ON_TOP_DEFAULT_ELEVATION
          : nLayer === "wall"
            ? WALL_MOUNT_DEFAULT_ELEVATION
            : 0,
    };
    const spot = findFreeSpot(draft, items, corners, collisionEnabled);
    if (!spot) {
      toast.error(t.noFreeSpace);
      return;
    }
    pushHistory();
    const added = { ...draft, x: spot.x, y: spot.y };
    setItems((prev) => [...prev, added]);
    setSelectedIds(new Set([added.id]));
    setNName("");
  };

  const removeItem = (id: string) => {
    pushHistory();
    // Anything riding on top of the removed item (see Item.placedOnId)
    // detaches and stays exactly where it is, rather than being deleted
    // along with its host or left silently floating at a now-nonexistent
    // item's height -- the least surprising default for a cascading delete.
    setItems((p) =>
      p
        .filter((i) => i.id !== id)
        .map((i) => (i.placedOnId === id ? { ...i, placedOnId: undefined, elevation: 0 } : i)),
    );
    setSelectedIds((s) => {
      if (!s.has(id)) return s;
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  };

  const removeSelected = () => {
    const ids = selectedIdsRef.current;
    if (!ids.size) return;
    pushHistory();
    // Same detach-on-delete as removeItem above, for every removed item at once.
    setItems((p) =>
      p
        .filter((i) => !ids.has(i.id))
        .map((i) =>
          i.placedOnId && ids.has(i.placedOnId) ? { ...i, placedOnId: undefined, elevation: 0 } : i,
        ),
    );
    setSelectedIds(new Set());
  };

  const duplicateSelected = () => {
    const ids = selectedIdsRef.current;
    if (!ids.size) return;
    pushHistory();
    setItems((prev) => {
      const toDup = prev.filter((i) => ids.has(i.id));
      const next = [...prev];
      const newIds: string[] = [];
      for (const src of toDup) {
        const draft: Item = { ...src, id: crypto.randomUUID(), x: src.x + 20, y: src.y + 20 };
        const spot = findFreeSpot(draft, next, corners, collisionEnabled);
        if (!spot) continue;
        const added = { ...draft, x: spot.x, y: spot.y };
        next.push(added);
        newIds.push(added.id);
      }
      if (newIds.length) {
        queueMicrotask(() => setSelectedIds(new Set(newIds)));
      } else {
        toast.error(t.noFreeSpace);
      }
      return next;
    });
  };

  const updateItem = (id: string, patch: Partial<Item>, options?: { history?: boolean }) => {
    // Read against the current (render-closure) `items` rather than inside
    // the setItems updater -- this mirrors addPreset/addCustomBox's own
    // findFreeSpot check below, and (unlike a functional update) lets this
    // decide up front whether the edit is going to be rejected, so it can
    // tell the user why instead of the field just silently reverting. Only
    // ever called from discrete, one-shot actions (Inspector field commits),
    // never a continuous per-frame drag loop, so reading the closure value
    // instead of `prev` carries none of the staleness risk it would for a
    // pointermove handler.
    const current = items.find((i) => i.id === id);
    if (!current) return;
    const merged = { ...current, ...patch };
    const c = clampPos(merged, corners, merged.x, merged.y);
    const candidate = { ...merged, x: c.x, y: c.y };
    // Respects the "Enable Collision" toggle exactly like the mouse-drag
    // path already does -- this used to always enforce collision here
    // regardless of the checkbox, which was the source of a confusing bug:
    // dragging one item onto another worked fine with collision disabled,
    // but editing that same overlap via a number field or arrow-key nudge
    // silently refused it.
    if (collidesWithOthers(candidate, items, undefined, collisionEnabled)) {
      toast.error(t.itemOverlap);
      return;
    }
    if (options?.history !== false) pushHistory();
    setItems((p) => p.map((i) => (i.id === id ? candidate : i)));
  };

  const addOpening = () => {
    // Reject placements that don't actually fit on the chosen wall, or that
    // overlap an opening already there -- previously neither was checked,
    // so a door/window could be placed hanging off the end of a short wall
    // or stacked directly on top of another door with no feedback at all.
    // A sloped wall is a knee wall of varying headroom -- an opening in it
    // would need its own height validation against kneeHeight and, in the
    // slope itself, is really a roof window. Neither is supported, so the
    // combination is refused outright rather than half-modelled.
    if (wallSlopes[String(oWall)]) {
      toast.error(t.openingOnSlopedWall);
      return;
    }
    // An opening is a hole in a wall, so one that is taller than the wall
    // simply can't be built -- it renders as glazing floating above the
    // wall with no lintel over it. Blocked rather than warned (which is
    // what too-tall *furniture* gets) for the same reason the
    // out-of-bounds check blocks: it isn't a judgement call.
    if (!openingFitsWall(oKind, ceilingHeight)) {
      toast.error(
        t.openingTooTall(
          openingKindLabel({ kind: oKind, leaves: oLeaves }, t),
          openingTopHeight(oKind),
          Math.round(ceilingHeight),
        ),
      );
      return;
    }
    const seg = resolveWallSegment(corners, oWall);
    const wallLength = seg ? Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) : Infinity;
    if (oPos < 0 || oWidth <= 0 || oPos + oWidth > wallLength + 0.01) {
      toast.error(t.openingOutOfBounds);
      return;
    }
    const overlapsExisting = openings.some(
      (o) =>
        String(o.wall) === String(oWall) &&
        oPos < o.position + o.width &&
        o.position < oPos + oWidth,
    );
    if (overlapsExisting) {
      toast.error(t.openingOverlap);
      return;
    }
    pushHistory();
    setOpenings((p) => [
      ...p,
      {
        id: crypto.randomUUID(),
        kind: oKind,
        wall: oWall,
        position: oPos,
        width: oWidth,
        // Anything you walk through gets hinges; a terrace door is a door
        // that happens to be glazed (see isSwingingOpening).
        ...(isSwingingOpening(oKind) ? { hinge: "start" as const, swing: "in" as const } : {}),
        ...(oKind === "terrace-door" ? { leaves: oLeaves } : {}),
      },
    ]);
  };
  /**
   * The wall-height field, guarded: shortening the walls below an opening
   * already in them would leave that opening protruding with no wall around
   * it, so it's refused with a message naming the height that's blocking it.
   *
   * Only this user-facing setter is guarded. Undo/redo restore and file
   * import call the raw setState directly -- they replay a state that
   * existed as a whole, and validating one field of it in isolation would
   * corrupt history.
   */
  const applyCeilingHeight: React.Dispatch<React.SetStateAction<number>> = (value) => {
    const next = typeof value === "function" ? value(ceilingHeight) : value;
    const needed = requiredWallHeight(openings);
    if (next < needed) {
      toast.error(t.ceilingBelowOpenings(needed));
      return;
    }
    setCeilingHeight(next);
  };

  const removeOpening = (id: string) => {
    pushHistory();
    setOpenings((p) => p.filter((o) => o.id !== id));
  };
  const updateOpening = (id: string, patch: Partial<Opening>) => {
    const current = openings.find((o) => o.id === id);
    if (!current) return;
    const merged = { ...current, ...patch };
    // Only re-validate when the edit actually touches placement -- a color
    // or hinge/swing change can't push a door/window out of bounds or into
    // an overlap, so it skips straight to committing (same reasoning as the
    // position/width fields being the only inspector inputs that can
    // reintroduce the addOpening bug this mirrors).
    if (
      patch.position !== undefined ||
      patch.width !== undefined ||
      patch.wall !== undefined ||
      patch.kind !== undefined
    ) {
      // Moving an opening onto a sloped wall was the way round addOpening's
      // refusal: that check only ran at creation, so the wall picker could
      // put a door on a knee wall afterwards. Same rule, same message.
      if (patch.wall !== undefined && wallSlopes[String(merged.wall)]) {
        toast.error(t.openingOnSlopedWall);
        return;
      }
      if (!openingFitsWall(merged.kind, ceilingHeight)) {
        toast.error(
          t.openingTooTall(
            openingKindLabel(merged, t),
            openingTopHeight(merged.kind),
            Math.round(ceilingHeight),
          ),
        );
        return;
      }
      const seg = resolveWallSegment(corners, merged.wall);
      const wallLength = seg ? Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) : Infinity;
      if (
        merged.position < 0 ||
        merged.width <= 0 ||
        merged.position + merged.width > wallLength + 0.01
      ) {
        toast.error(t.openingOutOfBounds);
        return;
      }
      const overlapsExisting = openings.some(
        (o) =>
          o.id !== id &&
          String(o.wall) === String(merged.wall) &&
          merged.position < o.position + o.width &&
          o.position < merged.position + merged.width,
      );
      if (overlapsExisting) {
        toast.error(t.openingOverlap);
        return;
      }
    }
    pushHistory();
    setOpenings((p) => p.map((o) => (o.id === id ? merged : o)));
  };

  // -------- Reset --------
  const [resetMode, setResetMode] = useState<"items" | "all" | null>(null);

  const clearItemsOnly = () => {
    pushHistory();
    setItems([]);
    setSelectedIds(new Set());
  };
  const clearAll = () => {
    pushHistory();
    setItems([]);
    setOpenings([]);
    setSelectedIds(new Set());
  };
  const confirmReset = () => {
    if (resetMode === "items") clearItemsOnly();
    else if (resetMode === "all") clearAll();
    setResetMode(null);
  };

  // -------- Ruler --------
  const [rulerMode, setRulerMode] = useState(false);
  const [collisionEnabled, setCollisionEnabled] = useState(true);
  const [rulerStart, setRulerStart] = useState<Point | null>(null);
  const [rulerEnd, setRulerEnd] = useState<Point | null>(null);
  const [rulerHover, setRulerHover] = useState<Point | null>(null);
  const clearRuler = () => {
    setRulerStart(null);
    setRulerEnd(null);
    setRulerHover(null);
  };
  useEffect(() => {
    if (!rulerMode) clearRuler();
  }, [rulerMode]);

  // -------- Apply user defaults (Settings dialog) on open --------
  // threeDActive/zoomFactor/collisionEnabled above all start at fixed
  // literals because useSettings() itself starts at DEFAULT_SETTINGS and
  // only reflects the real saved value after its own hydration effect --
  // reading settings.defaultView etc. directly in those useState()
  // initializers would just capture that placeholder forever. Once
  // settingsHydrated flips true (guaranteed to carry the real values, set
  // together in the same update -- see useSettings' own doc comment), this
  // applies them exactly once via the appliedDefaultsRef guard: these are
  // "what a room starts as when opened," not something that should snap an
  // already-open room to match if the user tweaks Settings mid-session.
  const appliedDefaultsRef = useRef(false);
  useEffect(() => {
    if (!settingsHydrated || appliedDefaultsRef.current) return;
    appliedDefaultsRef.current = true;
    setThreeDActive(settings.defaultView === "3d");
    setZoomFactor(settings.defaultZoom);
    setCollisionEnabled(settings.collisionDefault);
  }, [settingsHydrated, settings.defaultView, settings.defaultZoom, settings.collisionDefault]);

  // -------- Onboarding tour --------
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(TOUR_KEY)) {
      setTourOpen(true);
      setTourStep(0);
    }
  }, []);
  const closeTour = () => {
    setTourOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOUR_KEY, "1");
    }
  };

  // -------- Drag & marquee --------
  const dragRef = useRef<DragState | null>(null);

  const marqueeRef = useRef<MarqueeState | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);

  const stageToCm = (clientX: number, clientY: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    return {
      x: (clientX - r.left - offsetX - 4) / scale,
      y: (clientY - r.top - offsetY - 4) / scale,
    };
  };

  const onItemPointerDown = (e: React.PointerEvent, item: Item) => {
    if (rulerMode) {
      e.stopPropagation();
      const p = stageToCm(e.clientX, e.clientY);
      const cmPt = { x: p.x, y: p.y };
      if (!rulerStart || (rulerStart && rulerEnd)) {
        setRulerStart(cmPt);
        setRulerEnd(null);
        setRulerHover(cmPt);
      } else {
        setRulerEnd(cmPt);
      }
      return;
    }
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setSelectedOpeningId(null);

    if (e.shiftKey) {
      setSelectedIds((s) => {
        const n = new Set(s);
        if (n.has(item.id)) n.delete(item.id);
        else n.add(item.id);
        return n;
      });
      return;
    }

    const cur = selectedIdsRef.current;
    let ids: string[];
    if (cur.has(item.id) && cur.size > 1) {
      ids = Array.from(cur);
    } else {
      setSelectedIds(new Set([item.id]));
      ids = [item.id];
    }
    // Anything riding on top of an item being dragged (see Item.placedOnId)
    // rides along with it -- widen `ids` to include those children too, so
    // the existing per-id move loop below (onStagePointerMove) picks them
    // up automatically with no further changes: each one gets its own
    // startPos captured the same way, moves by the same mouse delta as its
    // host, and collidesWithOthers already exempts a host/child pair from
    // each other (see lib/planner-math.ts), so being in the same drag
    // batch as its own host never blocks it.
    const draggedIds = new Set(ids);
    for (const it of items) {
      if (it.placedOnId && draggedIds.has(it.placedOnId)) draggedIds.add(it.id);
    }
    ids = Array.from(draggedIds);
    const startPos = new Map<string, { x: number; y: number }>();
    for (const it of items) {
      if (ids.includes(it.id)) startPos.set(it.id, { x: it.x, y: it.y });
    }
    pushHistory();
    dragRef.current = {
      mode: "move",
      ids,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPos,
    };
  };

  const onRotateHandleDown = (e: React.PointerEvent, item: Item) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const stageRect = stageEl.getBoundingClientRect();
    const centerClientX = stageRect.left + offsetX + 4 + cm(item.x + item.width / 2);
    const centerClientY = stageRect.top + offsetY + 4 + cm(item.y + item.length / 2);
    const startAngle =
      (Math.atan2(e.clientY - centerClientY, e.clientX - centerClientX) * 180) / Math.PI;
    pushHistory();
    dragRef.current = {
      mode: "rotate",
      id: item.id,
      centerClientX,
      centerClientY,
      startAngle,
      startRotation: item.rotation,
    };
  };

  const onStagePointerDown = (e: React.PointerEvent) => {
    if (!stageRef.current) return;
    if (rulerMode) {
      const p = stageToCm(e.clientX, e.clientY);
      const cmPt = { x: p.x, y: p.y };
      if (!rulerStart || (rulerStart && rulerEnd)) {
        setRulerStart(cmPt);
        setRulerEnd(null);
        setRulerHover(cmPt);
      } else {
        setRulerEnd(cmPt);
      }
      return;
    }

    if (!multiSelectMode && !ctrlHeld) {
      // Empty-canvas drag pans the view (matches the multi-room master floor
      // plan) instead of marquee-selecting.
      if (e.button !== 0) return;
      setSelectedIds(new Set());
      setSelectedOpeningId(null);
      setIsPanning(true);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      panDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPanX: panX,
        startPanY: panY,
      };
      return;
    }

    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = stageToCm(e.clientX, e.clientY);
    marqueeRef.current = { startCx: p.x, startCy: p.y, addToSelection: e.shiftKey };
    if (!e.shiftKey) {
      setSelectedIds(new Set());
      setSelectedOpeningId(null);
    }
    setMarqueeRect({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onStagePointerMove = (e: React.PointerEvent) => {
    if (rulerMode) {
      const p = stageToCm(e.clientX, e.clientY);
      setRulerHover({ x: p.x, y: p.y });
      return;
    }

    if (panDragRef.current) {
      const dx = e.clientX - panDragRef.current.startX;
      const dy = e.clientY - panDragRef.current.startY;
      setPanX(panDragRef.current.startPanX + dx);
      setPanY(panDragRef.current.startPanY + dy);
      return;
    }

    const d = dragRef.current;
    if (d) {
      if (d.mode === "move") {
        const dx = (e.clientX - d.startMouseX) / scale;
        const dy = (e.clientY - d.startMouseY) / scale;
        const idsSet = new Set(d.ids);
        setItems((prev) =>
          prev.map((i) => {
            if (!idsSet.has(i.id)) return i;
            const start = d.startPos.get(i.id)!;
            const c = clampPos(i, corners, start.x + dx, start.y + dy);
            const candidate = { ...i, x: c.x, y: c.y };

            if (collisionEnabled) {
              if (collidesWithOthers(candidate, prev, idsSet)) {
                const xOnly = clampPos(i, corners, start.x + dx, i.y);
                const cx = { ...i, x: xOnly.x, y: xOnly.y };
                if (!collidesWithOthers(cx, prev, idsSet)) return cx;

                const yOnly = clampPos(i, corners, i.x, start.y + dy);
                const cy = { ...i, x: yOnly.x, y: yOnly.y };
                if (!collidesWithOthers(cy, prev, idsSet)) return cy;

                return i;
              }
            }
            return candidate;
          }),
        );
      } else {
        const angle =
          (Math.atan2(e.clientY - d.centerClientY, e.clientX - d.centerClientX) * 180) / Math.PI;
        const delta = angle - d.startAngle;
        const next = (((d.startRotation + delta) % 360) + 360) % 360;
        setItems((prev) =>
          prev.map((i) => {
            if (i.id !== d.id) return i;
            const merged = { ...i, rotation: next };
            const c = clampPos(merged, corners, merged.x, merged.y);
            const candidate = { ...merged, x: c.x, y: c.y };
            if (collidesWithOthers(candidate, prev)) return i;
            return candidate;
          }),
        );
      }
      return;
    }

    const m = marqueeRef.current;
    if (m) {
      const p = stageToCm(e.clientX, e.clientY);
      const x = Math.min(p.x, m.startCx);
      const y = Math.min(p.y, m.startCy);
      const w = Math.abs(p.x - m.startCx);
      const h = Math.abs(p.y - m.startCy);
      setMarqueeRect({ x, y, w, h });
    }
  };

  const onStagePointerUp = (e: React.PointerEvent) => {
    if (panDragRef.current) {
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {}
      setIsPanning(false);
      panDragRef.current = null;
      return;
    }

    const d = dragRef.current;
    if (d) {
      if (d.mode === "move") {
        const idsSet = new Set(d.ids);
        setItems((prev) => {
          let anyCollision = false;
          for (const i of prev) {
            if (!idsSet.has(i.id)) continue;
            // Must respect collisionEnabled here too -- this used to always
            // re-check collision on drop regardless of the toggle, which
            // meant a drag that was allowed to overlap mid-drag (collision
            // disabled) would snap right back to its start position the
            // instant the mouse was released, as if collision were still on.
            if (collidesWithOthers(i, prev, idsSet, collisionEnabled)) {
              anyCollision = true;
              break;
            }
          }
          const resolved = !anyCollision
            ? prev
            : prev.map((i) => {
                if (!idsSet.has(i.id)) return i;
                const start = d.startPos.get(i.id);
                return start ? { ...i, x: start.x, y: start.y } : i;
              });

          // Any dragged "on-top" item (lamp, TV, console, ...) auto-settles
          // onto whichever main item its footprint now lands on -- or the
          // floor (elevation 0) if it isn't over anything.
          let changed = false;
          const next = resolved.map((i) => {
            if (!idsSet.has(i.id) || (i.layer ?? "main") !== "on-top") return i;
            const elevation = computeOnTopElevation(i, resolved, itemHeight);
            if (elevation === (i.elevation ?? 0)) return i;
            changed = true;
            return { ...i, elevation };
          });
          return changed ? next : resolved;
        });
      }
      dragRef.current = null;
      return;
    }

    const m = marqueeRef.current;
    const r = marqueeRect;
    if (m && r) {
      const picked: string[] = [];
      if (r.w > 1 && r.h > 1) {
        for (const it of items) {
          const cx = it.x + it.width / 2;
          const cy = it.y + it.length / 2;
          if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) picked.push(it.id);
        }
      }
      if (picked.length || m.addToSelection) {
        setSelectedIds((prev) => {
          const next = m.addToSelection ? new Set(prev) : new Set<string>();
          for (const id of picked) next.add(id);
          return next;
        });
      }
    }
    marqueeRef.current = null;
    setMarqueeRect(null);
  };

  // -------- Keyboard --------
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

      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === "Escape") {
        if (rulerMode) {
          if (rulerStart || rulerEnd) clearRuler();
          else setRulerMode(false);
          e.preventDefault();
          return;
        }
      }

      const ids = selectedIdsRef.current;
      if (!ids.size) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeSelected();
        return;
      }

      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        const dir = e.shiftKey ? -15 : 15;
        pushHistory();
        setItems((prev) =>
          prev.map((i) => {
            if (!ids.has(i.id)) return i;
            const merged = { ...i, rotation: (((i.rotation + dir) % 360) + 360) % 360 };
            const c = clampPos(merged, corners, merged.x, merged.y);
            const candidate = { ...merged, x: c.x, y: c.y };
            if (collidesWithOthers(candidate, prev, ids, collisionEnabled)) return i;
            return candidate;
          }),
        );
        return;
      }

      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else if (e.key === "Escape") {
        setSelectedIds(new Set());
        return;
      } else return;

      e.preventDefault();
      pushHistory();
      setItems((prev) => {
        const next = prev.map((i) => {
          if (!ids.has(i.id)) return i;
          const c = clampPos(i, corners, i.x + dx, i.y + dy);
          return { ...i, x: c.x, y: c.y };
        });
        for (const i of next) {
          if (!ids.has(i.id)) continue;
          if (collidesWithOthers(i, next, ids, collisionEnabled)) return prev;
        }
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomW, roomL, collisionEnabled, corners]);

  // -------- Export / Import --------
  // Both entry points below are pure(-ish) functions rather than
  // click/change handlers -- the ExportImportDialog component owns the
  // actual file input, drag-drop, and download-trigger mechanics, and
  // calls these to get preview data (export) or to validate/apply a
  // file's parsed JSON (import). This is what lets the dialog show a
  // live preview -- summary + raw JSON -- before anything actually
  // downloads or gets applied to the room.

  const buildRoomExportPreview = () => {
    const payload = {
      version: 3,
      room: { width: roomW, length: roomL },
      openings,
      items,
      corners,
      wallColors,
      flooring,
      ceilingHeight,
      wallSlopes,
    };
    const summaryLines = [
      `${roomW} × ${roomL} cm`,
      lang === "de" ? `${items.length} Objekte` : `${items.length} items`,
      lang === "de" ? `${openings.length} Öffnungen` : `${openings.length} openings`,
    ];
    // Prefer the room's own name (every saved room has one, in either
    // store -- see RoomLayout.name) as the filename's basis, falling back
    // to a generic "Room"/"Raum" label when there's no saved room behind
    // this editor at all. Either way, buildExportFilename
    // slugifies it and appends today's date -- just the starting point
    // shown in the dialog's editable filename field, not the final say.
    const roomLabel = initialRoom?.name || (lang === "de" ? "Raum" : "Room");
    return {
      summaryLines,
      filename: buildExportFilename(roomLabel),
      json: payload,
    };
  };

  // Preview-only: parses and validates without touching any room state,
  // so the dialog can show a summary (or a validation error) before the
  // user commits to importing.
  const validateRoomImport = (raw: unknown) => {
    try {
      const data = importSchema.parse(raw);
      const summaryLines = [
        `${Math.round(data.room.width)} × ${Math.round(data.room.length)} cm`,
        lang === "de" ? `${data.items.length} Objekte` : `${data.items.length} items`,
        lang === "de" ? `${data.openings.length} Öffnungen` : `${data.openings.length} openings`,
      ];
      return { ok: true as const, summaryLines };
    } catch (err) {
      return { ok: false as const, error: formatZodError(err) };
    }
  };

  // Actually applies an already-validated import to the room -- called
  // once, on confirm. Re-parses rather than trusting a value threaded
  // through from validateRoomImport above, since that keeps this function
  // safely callable on its own (e.g. from a future non-dialog entry
  // point) without relying on validation having already happened.
  const applyRoomImport = (raw: unknown) => {
    try {
      const data = importSchema.parse(raw);

      pushHistory();
      const nextW = Math.max(50, Math.round(data.room.width));
      const nextL = Math.max(50, Math.round(data.room.length));
      setRoomW(nextW);
      setRoomL(nextL);
      setDraftW(String(nextW));
      setDraftL(String(nextL));

      // >= 3 (not === 4) so importing a hallway's exported JSON keeps its
      // L/T-shaped polygon corners instead of getting flattened to a rect.
      if (data.corners && data.corners.length >= 3) {
        setCorners(data.corners);
      } else {
        setCorners([
          { x: 0, y: 0 },
          { x: nextW, y: 0 },
          { x: nextW, y: nextL },
          { x: 0, y: nextL },
        ]);
      }

      if (data.wallColors) {
        setWallColors(data.wallColors);
      } else {
        setWallColors({
          top: "#f1f5f9",
          right: "#f1f5f9",
          bottom: "#f1f5f9",
          left: "#f1f5f9",
        });
      }

      setFlooring(data.flooring ?? { ...DEFAULT_FLOORING });
      setCeilingHeight(data.ceilingHeight ?? DEFAULT_CEILING_HEIGHT);
      setWallSlopes(data.wallSlopes ?? {});

      setOpenings(
        data.openings.map((o) => ({
          id: o.id || crypto.randomUUID(),
          wall: o.wall,
          position: o.position,
          width: o.width,
          kind: o.kind,
          hinge: o.kind === "door" ? (o.hinge === "end" ? "end" : "start") : undefined,
          swing: o.kind === "door" ? (o.swing === "out" ? "out" : "in") : undefined,
          color: o.color,
        })),
      );
      setItems(
        data.items.map((i) => ({
          id: i.id || crypto.randomUUID(),
          name: i.name,
          width: i.width,
          length: i.length,
          color: i.color,
          x: i.x,
          y: i.y,
          rotation: i.rotation,
          kind: i.kind,
          icon: i.icon,
          height: i.height,
          elevation: i.elevation,
          layer: i.layer,
          shape: i.shape,
        })),
      );
      setSelectedIds(new Set());
      toast.success(t.imported);
    } catch (err) {
      console.error("Import failed:", err);
      toast.error(t.importFail + formatZodError(err));
    }
  };

  return {
    // State
    lang,
    setLang,
    t,
    roomW,
    setRoomW,
    roomL,
    setRoomL,
    draftW,
    setDraftW,
    draftL,
    setDraftL,
    dirty,
    items,
    setItems,
    openings,
    setOpenings,
    selectedIds,
    setSelectedIds,
    rulerMode,
    setRulerMode,
    collisionEnabled,
    setCollisionEnabled,
    rulerStart,
    rulerEnd,
    rulerHover,
    resetMode,
    setResetMode,
    marqueeRect,
    multiSelectMode,
    setMultiSelectMode,
    ctrlHeld,
    isPanning,
    stageSize,
    stageReady,
    scale,
    roomPxW,
    roomPxL,
    offsetX,
    offsetY,
    canUndo,
    canRedo,
    tourOpen,
    setTourOpen,
    tourStep,
    setTourStep,
    threeDActive,
    setThreeDActive,
    zoomFactor,
    setZoomFactor,

    // Form inputs
    nName,
    setNName,
    nW,
    setNW,
    nL,
    setNL,
    nColor,
    setNColor,
    nLayer,
    setNLayer,
    nShape,
    setNShape,
    oKind,
    setOKind,
    oLeaves,
    setOLeaves,
    oWall,
    setOWall,
    oPos,
    setOPos,
    oWidth,
    setOWidth,

    // Refs
    stageRef,

    // Helpers / Actions
    cm,
    undo,
    redo,
    applyRoom,
    addPreset,
    addCustomBox,
    removeItem,
    removeSelected,
    duplicateSelected,
    updateItem,
    addOpening,
    removeOpening,
    updateOpening,
    confirmReset,
    clearRuler,
    closeTour,
    buildRoomExportPreview,
    validateRoomImport,
    applyRoomImport,
    onItemPointerDown,
    onRotateHandleDown,
    onStagePointerDown,
    onStagePointerMove,
    onStagePointerUp,
    pushHistory,
    corners,
    setCorners,
    wallColors,
    setWallColors,
    flooring,
    setFlooring,
    ceilingHeight,
    setCeilingHeight: applyCeilingHeight,
    wallSlopes,
    setWallSlopes,
    slopeIssues,
    selectedOpeningId,
    setSelectedOpeningId,
    openWalls,
  };
}
