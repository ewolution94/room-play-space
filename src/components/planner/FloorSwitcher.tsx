import { useEffect, useRef, useState } from "react";
import type { Floor, Lang } from "@/types/planner";
import { Plus, Settings2, GripVertical, Trash2, Layers } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { floorDisplayName } from "@/lib/floors";

interface FloorSwitcherProps {
  floors: Floor[];
  activeFloorId: string;
  lang: Lang;
  onSelectFloor: (id: string) => void;
  onAddFloor: () => void;
  onRenameFloor: (id: string, name: string) => void;
  onDeleteFloor: (id: string) => void;
  /** Replaces the whole floor order in one shot (canonical order, index 0
   * = lowest floor) -- see the drag-and-drop reorder in the manage
   * popover below, which computes the complete resulting order itself. */
  onReorderFloors: (orderedIds: string[]) => void;
}

/**
 * Top-center floating pill tab bar for switching between a building's
 * floors, mirroring the bottom-center 3D-toggle pill's own styling
 * (rounded-full, border/40, background/80, backdrop-blur) so the two read
 * as one consistent "floating chrome" language rather than two different
 * UI systems. Selecting a floor is instant here -- the actual switch
 * animation (see MultiRoomCanvas.tsx) plays in the canvas itself, not in
 * this bar.
 *
 * floors[] order IS the building's physical stacking order (index 0 =
 * lowest -- see Floor in types/planner.ts), which this bar's left-to-right
 * tab order follows directly. The "Manage floors" popover below shows the
 * same floors highest-first instead (top of that list = top floor), which
 * is a more natural reading for a floor list -- it doesn't need to match
 * the tab bar's own order since drag-and-drop there operates on the
 * underlying array position either way, not on-screen position.
 */
export function FloorSwitcher({
  floors,
  activeFloorId,
  lang,
  onSelectFloor,
  onAddFloor,
  onRenameFloor,
  onDeleteFloor,
  onReorderFloors,
}: FloorSwitcherProps) {
  const [manageOpen, setManageOpen] = useState(false);

  if (floors.length === 0) return null;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute top-3 left-1/2 z-40 flex max-w-[min(88%,34rem)] -translate-x-1/2 items-center gap-1 rounded-full border border-border/40 bg-background/80 px-1.5 py-1.5 shadow-lg backdrop-blur-md select-none"
    >
      <div
        className="[&::-webkit-scrollbar]:hidden flex items-center gap-1 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {floors.map((floor, index) => {
          const isActive = floor.id === activeFloorId;
          const name = floorDisplayName(floor, index, lang);
          return (
            <button
              key={floor.id}
              type="button"
              onClick={() => onSelectFloor(floor.id)}
              className={`h-7 shrink-0 cursor-pointer whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-gradient-to-r from-teal-600 to-sky-600 text-white shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              title={name}
            >
              {name}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onAddFloor}
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title={lang === "de" ? "Geschoss hinzufügen" : "Add floor"}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      <Popover open={manageOpen} onOpenChange={setManageOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={lang === "de" ? "Geschosse verwalten" : "Manage floors"}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          className="w-64 p-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            <span>{lang === "de" ? "Geschosse" : "Floors"}</span>
          </div>
          <FloorManageList
            floors={floors}
            lang={lang}
            onRenameFloor={onRenameFloor}
            onDeleteFloor={onDeleteFloor}
            onReorderFloors={onReorderFloors}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Height of one row (including the flex gap below it) in the manage list,
// in px -- rows are a fixed h-9 (36px) with a 2px gap, matched here so the
// drag math below can work off simple arithmetic instead of measuring the
// DOM on every pointer move.
const ROW_STEP = 38;

/**
 * Highest floor first (see FloorSwitcher's own doc comment for why) with
 * simple pointer-driven drag-and-drop reordering: grab a row's handle,
 * drag up/down, drop it in the new slot. Deliberately not using the
 * native HTML5 Drag and Drop API (poor touch support without a polyfill)
 * -- window-level pointermove/pointerup listeners instead, matching the
 * same pattern this app already uses for every other drag interaction
 * (room dragging, the floating inspector panel, corner-drag handles).
 */
function FloorManageList({
  floors,
  lang,
  onRenameFloor,
  onDeleteFloor,
  onReorderFloors,
}: {
  floors: Floor[];
  lang: Lang;
  onRenameFloor: (id: string, name: string) => void;
  onDeleteFloor: (id: string) => void;
  onReorderFloors: (orderedIds: string[]) => void;
}) {
  // Highest floor first, purely for display -- see the module doc comment.
  const baseOrder = [...floors].reverse().map((f) => f.id);
  const floorsById = new Map(floors.map((f) => [f.id, f]));

  const [dragId, setDragId] = useState<string | null>(null);
  const [liveOrder, setLiveOrder] = useState<string[]>(baseOrder);
  const [dragOffset, setDragOffset] = useState(0);
  // Mirrors liveOrder so the pointerup handler below can read the latest
  // dragged order synchronously without closing over a stale render's
  // value (it's defined once per drag gesture, not on every render -- see
  // startDrag's own doc comment).
  const liveOrderRef = useRef(liveOrder);
  liveOrderRef.current = liveOrder;

  // liveOrder only tracks the drag; once floors itself changes (a rename,
  // or a reorder committed elsewhere) it needs to re-derive from the
  // current props rather than keep dragging a stale snapshot.
  useEffect(() => {
    if (!dragId) setLiveOrder(baseOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floors]);

  // Defines move/up/cancel fresh INSIDE this call (not as component-level
  // functions recreated every render) so the window listener added here
  // and the one removed on release are guaranteed to be the exact same
  // function reference for this one drag gesture, regardless of how many
  // re-renders happen in between -- the same pattern this app already
  // uses for every other pointer-driven drag (room dragging, the floating
  // inspector panel, corner-drag handles).
  const startDrag = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    const startY = e.clientY;
    const startIndex = liveOrder.indexOf(id);
    setDragId(id);
    setDragOffset(0);

    const finish = (commit: boolean) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      if (commit) {
        // Display order (highest floor first) -- reverse it back to the
        // canonical index-0-is-lowest order the rest of the app works in
        // (see Floor's doc comment in types/planner.ts).
        onReorderFloors([...liveOrderRef.current].reverse());
      }
      setDragId(null);
      setDragOffset(0);
    };

    const move = (ev: PointerEvent) => {
      const totalDeltaY = ev.clientY - startY;
      const shiftSteps = Math.round(totalDeltaY / ROW_STEP);
      const newIndex = Math.max(0, Math.min(baseOrder.length - 1, startIndex + shiftSteps));

      setLiveOrder((prev) => {
        const from = prev.indexOf(id);
        if (from === -1 || from === newIndex) return prev;
        const next = [...prev];
        next.splice(from, 1);
        next.splice(newIndex, 0, id);
        return next;
      });
      // Sub-step pixel offset so the dragged row visually keeps following
      // the pointer smoothly between the discrete slot swaps above,
      // instead of snapping to a fixed position the instant a swap
      // happens.
      setDragOffset(totalDeltaY - (newIndex - startIndex) * ROW_STEP);
    };
    const up = () => finish(true);
    const cancel = () => finish(false);

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };

  return (
    <div className="flex flex-col gap-0.5">
      {liveOrder.map((id) => {
        const floor = floorsById.get(id);
        if (!floor) return null;
        const realIndex = floors.findIndex((f) => f.id === id);
        const isDragging = id === dragId;
        return (
          <FloorRow
            key={id}
            floor={floor}
            displayName={floorDisplayName(floor, realIndex, lang)}
            total={floors.length}
            lang={lang}
            isDragging={isDragging}
            dragOffset={isDragging ? dragOffset : 0}
            onDragHandlePointerDown={(e) => startDrag(e, id)}
            onRenameFloor={onRenameFloor}
            onDeleteFloor={onDeleteFloor}
          />
        );
      })}
    </div>
  );
}

function FloorRow({
  floor,
  displayName,
  total,
  lang,
  isDragging,
  dragOffset,
  onDragHandlePointerDown,
  onRenameFloor,
  onDeleteFloor,
}: {
  floor: Floor;
  displayName: string;
  total: number;
  lang: Lang;
  isDragging: boolean;
  dragOffset: number;
  onDragHandlePointerDown: (e: React.PointerEvent) => void;
  onRenameFloor: (id: string, name: string) => void;
  onDeleteFloor: (id: string) => void;
}) {
  const [draft, setDraft] = useState(displayName);
  useEffect(() => {
    if (!isDragging) setDraft(displayName);
  }, [displayName, isDragging]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== displayName) onRenameFloor(floor.id, trimmed);
    else setDraft(displayName);
  };

  return (
    <div
      className={`flex h-9 items-center gap-1 rounded-md px-1 ${isDragging ? "relative z-10 bg-accent shadow-md" : "hover:bg-accent/40"}`}
      // Only the actively-dragged row gets a live transform (tracking the
      // pointer -- see startDrag's dragOffset above); siblings reorder via
      // a plain DOM re-sort as liveOrder changes, which isn't a
      // transitionable property, so there's nothing useful to animate on
      // them here.
      style={isDragging ? { transform: `translateY(${dragOffset}px)` } : undefined}
    >
      <button
        type="button"
        onPointerDown={onDragHandlePointerDown}
        className="flex h-7 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
        style={{ touchAction: "none" }}
        title={lang === "de" ? "Ziehen zum Umsortieren" : "Drag to reorder"}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") setDraft(displayName);
        }}
        className="h-7 min-w-0 flex-1 cursor-text rounded-md border border-transparent bg-transparent px-1.5 text-xs font-medium outline-none focus:border-input focus:bg-background"
      />
      <button
        type="button"
        disabled={total <= 1}
        onClick={() => onDeleteFloor(floor.id)}
        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
        title={lang === "de" ? "Geschoss löschen" : "Delete floor"}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
