import React, { useState, useEffect, useCallback, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTheme } from "@/hooks/use-theme";
import { useMobileViewOnly } from "@/hooks/use-mobile-view-only";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { useCustomCatalog } from "@/hooks/use-custom-catalog";
import { useSettings } from "@/hooks/use-settings";
import { extractBundledCustomCatalog, mergeCustomCatalog } from "@/lib/custom-catalog";
import { STRINGS } from "@/lib/planner-translations";
import type { RoomLayout, Lang, Floor } from "@/types/planner";
import { MultiRoomCanvas } from "@/components/planner/MultiRoomCanvas";
import { MultiRoomSidebar } from "@/components/planner/MultiRoomSidebar";
import { createFloor, parseImportedFloors, floorDisplayName } from "@/lib/floors";
import {
  findHome,
  parseImportedHome,
  updateHome,
  loadHomes,
  loadActiveFloorId,
  saveActiveFloorId,
  saveActiveHomeId,
  homeDisplayName,
} from "@/lib/homes";
import { ExportImportDialog } from "@/components/planner/ExportImportDialog";
import { MeasurementsDialog } from "@/components/planner/MeasurementsDialog";
import { measureHome } from "@/lib/measurements";
import { buildExportFilename } from "@/lib/export-filename";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Undo2,
  Redo2,
  Languages,
  Download,
  Upload,
  Trash2,
  Sun,
  Moon,
  LayoutGrid,
  LayoutDashboard,
  FileStack,
  MoreHorizontal,
  Plus,
  Ruler,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { toast } from "sonner";

export const Route = createFileRoute("/home/$homeId/")({
  component: HomeOverview,
});

/**
 * One Home's floor plan -- the route that used to be `/rooms`, now keyed by
 * a Home id from the URL instead of reading the one global floors array.
 *
 * Everything below the floors themselves is unchanged: `rooms`/`setRooms`
 * are still derived from just the active floor's slice, so MultiRoomCanvas,
 * MultiRoomSidebar and multi-room-actions.ts keep operating on a plain
 * RoomLayout[] and never need to know that floors -- let alone homes --
 * exist. What changed is only *which* floors those are, and where they save
 * back to (see lib/homes.ts).
 */
function HomeOverview() {
  const { homeId } = Route.useParams();
  const navigate = useNavigate();
  const { theme, toggleTheme, isDark } = useTheme();
  const { isMobileViewOnly, isPortrait } = useMobileViewOnly();
  const { collapsed: sidebarCollapsed, toggle: toggleSidebarCollapsed } = useSidebarCollapsed();
  // "My Own Catalog" -- there's no Sidebar/Inspector at this overview level
  // (see MultiRoomSidebar.tsx, a different component with no My Catalog
  // tab), so this instance exists purely to support the "Include My Catalog
  // items" checkbox on the floor export/import dialogs below.
  const customCatalog = useCustomCatalog();

  // Language + other cross-route preferences.
  const { settings, update: updateSettings, recordLastActive } = useSettings();
  const lang = settings.lang;
  const t = STRINGS[lang];

  const changeLanguage = (l: Lang) => {
    updateSettings({ lang: l });
  };

  // This home's floors -- floors[] is the whole home (see Home in
  // types/planner.ts), activeFloorId picks which one is currently being
  // edited.
  const [floors, setFloors] = useState<Floor[]>([]);
  const [activeFloorId, setActiveFloorId] = useState<string>("");
  // The home's own name, kept as it's stored (null = "use the position
  // default") plus its position, so the displayed name re-translates on a
  // language switch instead of being frozen at hydration time.
  const [homeName, setHomeName] = useState<string | null>(null);
  const [homeIndex, setHomeIndex] = useState(0);
  // False until the load effect below has read localStorage. Everything
  // that writes floors back has to wait for this: `floors` starts as [] to
  // match what the server rendered, and persisting that placeholder would
  // wipe the real saved home on every mount. Distinguishing "not read yet"
  // from "genuinely has no floors" is also what lets an empty home be a
  // real, savable state instead of an impossible one.
  const [hydrated, setHydrated] = useState(false);
  // Which way the floor-switch transition animation should play -- "up"
  // when the newly-active floor sits higher in the stack (floors[] index)
  // than the one we just left, "down" otherwise. Set right before
  // activeFloorId changes, read once by MultiRoomCanvas's transition
  // wrapper (see FloorSwitcher.tsx / MultiRoomCanvas.tsx).
  const [floorSwitchDirection, setFloorSwitchDirection] = useState<"up" | "down">("up");

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());

  const activeFloorIndex = floors.findIndex((f) => f.id === activeFloorId);
  const rooms = activeFloorIndex >= 0 ? floors[activeFloorIndex].rooms : [];
  const setRooms: React.Dispatch<React.SetStateAction<RoomLayout[]>> = useCallback(
    (updater) => {
      setFloors((prev) =>
        prev.map((f) =>
          f.id === activeFloorId
            ? {
                ...f,
                rooms:
                  typeof updater === "function"
                    ? (updater as (p: RoomLayout[]) => RoomLayout[])(f.rooms)
                    : updater,
              }
            : f,
        ),
      );
    },
    [activeFloorId],
  );

  const selectFloor = useCallback(
    (id: string) => {
      if (id === activeFloorId) return;
      const fromIdx = floors.findIndex((f) => f.id === activeFloorId);
      const toIdx = floors.findIndex((f) => f.id === id);
      setFloorSwitchDirection(toIdx > fromIdx ? "up" : "down");
      setActiveFloorId(id);
      setSelectedRoomId(null);
      setSelectedRoomIds(new Set());
    },

    [activeFloorId, floors],
  );

  // -------- Rooms history (undo / redo) --------
  // Mirrors the single-room planner's historyRef/futureRef pattern (see
  // use-room-planner.ts) -- previously the multi-room view had no undo at
  // all (AUDIT.md section 1), so dragging, resizing, rotating, or deleting
  // a room here was permanent. Scoped to the CURRENTLY ACTIVE floor's
  // rooms only: a snapshot is just a RoomLayout[], and history is cleared
  // whenever the active floor changes (below) since a snapshot from a
  // different floor's rooms wouldn't make sense to restore here.
  const roomsRef = useRef<RoomLayout[]>(rooms);
  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  const historyRef = useRef<RoomLayout[][]>([]);
  const futureRef = useRef<RoomLayout[][]>([]);
  const [, forceHistoryTick] = useState(0);

  useEffect(() => {
    historyRef.current = [];
    futureRef.current = [];
    forceHistoryTick((n) => n + 1);
  }, [activeFloorId]);

  const pushRoomsHistory = useCallback(() => {
    const snap: RoomLayout[] = JSON.parse(JSON.stringify(roomsRef.current));
    const top = historyRef.current[historyRef.current.length - 1];
    if (top && JSON.stringify(top) === JSON.stringify(snap)) return;
    historyRef.current = [...historyRef.current.slice(-99), snap];
    futureRef.current = [];
    forceHistoryTick((n) => n + 1);
  }, []);

  const undoRooms = useCallback(() => {
    if (!historyRef.current.length) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    futureRef.current = [...futureRef.current, JSON.parse(JSON.stringify(roomsRef.current))];
    historyRef.current = historyRef.current.slice(0, -1);
    setRooms(prev);
    forceHistoryTick((n) => n + 1);
  }, [setRooms]);

  const redoRooms = useCallback(() => {
    if (!futureRef.current.length) return;
    const next = futureRef.current[futureRef.current.length - 1];
    historyRef.current = [...historyRef.current, JSON.parse(JSON.stringify(roomsRef.current))];
    futureRef.current = futureRef.current.slice(0, -1);
    setRooms(next);
    forceHistoryTick((n) => n + 1);
  }, [setRooms]);

  const canUndoRooms = historyRef.current.length > 0;
  const canRedoRooms = futureRef.current.length > 0;

  const addFloor = useCallback(() => {
    // No name passed -- a freshly-added floor is auto-named from its
    // position (see Floor.name's doc comment), so it reads correctly
    // ("Ground Floor"/"1st Floor"/...) in whatever language is active,
    // and keeps re-numbering itself correctly if floors are later
    // reordered or one below it is deleted.
    const floor = createFloor();
    setFloors((prev) => [...prev, floor]);
    setFloorSwitchDirection("up");
    setActiveFloorId(floor.id);
    setSelectedRoomId(null);
    setSelectedRoomIds(new Set());
  }, []);

  const renameFloor = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setFloors((prev) => prev.map((f) => (f.id === id ? { ...f, name: trimmed } : f)));
  }, []);

  const deleteFloor = useCallback(
    (id: string) => {
      // The last floor of a home can't be deleted from inside the home --
      // the floor you're standing on has nowhere to land, and the whole
      // home is deletable from the dashboard anyway (see HomesList.tsx).
      if (floors.length <= 1) return;
      const idx = floors.findIndex((f) => f.id === id);
      if (idx < 0) return;
      const next = floors.filter((f) => f.id !== id);
      setFloors(next);
      if (id === activeFloorId) {
        const fallback = next[Math.max(0, idx - 1)] ?? next[0];
        setFloorSwitchDirection(idx > 0 ? "down" : "up");
        setActiveFloorId(fallback.id);
        setSelectedRoomId(null);
        setSelectedRoomIds(new Set());
      }
    },
    [floors, activeFloorId],
  );

  // Applies a full new floor order in one shot -- see FloorSwitcher.tsx's
  // drag-and-drop reorder, which computes the complete resulting order
  // (canonical, index 0 = lowest) itself and hands it over wholesale
  // rather than describing a single incremental move.
  const reorderFloors = useCallback((orderedIds: string[]) => {
    setFloors((prev) => {
      const byId = new Map(prev.map((f) => [f.id, f]));
      const next = orderedIds.map((id) => byId.get(id)).filter((f): f is Floor => !!f);
      // Safety net: if the incoming id list doesn't account for every
      // floor (shouldn't happen), leave the order untouched rather than
      // silently dropping one.
      return next.length === prev.length ? next : prev;
    });
  }, []);

  const [collisionEnabled, setCollisionEnabled] = useState(true);
  const [zoomFactor, setZoomFactor] = useState(0.85);
  const [showFurniture, setShowFurniture] = useState(false);
  // On by default -- the CAD-style dimension lines/ticks for plain
  // (non-hallway) rooms; deliberately never shown for L/T hallways
  // regardless of this toggle (their bounding box isn't their real shape,
  // so a line-to-line measurement across it doesn't read correctly -- see
  // MultiRoomCanvas.tsx).
  const [showDimensions, setShowDimensions] = useState(true);
  // On by default -- room name + (for hallways only) the plain "W x L cm"
  // text, independent of showDimensions above.
  const [showLabels, setShowLabels] = useState(true);
  // Off by default so dragging on empty canvas pans the view (consistent with
  // the single-room planner); when on, empty-canvas drag draws a marquee box
  // to select multiple rooms at once instead.
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  // Whole-floor 3D view -- gated inside MultiRoomCanvas on every room
  // forming one connected structure (see computeRoomConnectivity in
  // room-adjacency.ts). Mirrors the single-room planner's own threeDActive
  // toggle (see use-room-planner.ts).
  const [threeDActive, setThreeDActive] = useState(false);

  // Load this home. Deliberately creates NOTHING -- not the home, not a
  // floor inside it. A route that writes data just by being visited is what
  // made deleting your last floor feel broken (it silently came back), and
  // an unknown id is a stale link, not an instruction to create something:
  // it bounces to the dashboard the same way /room/$roomId does.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const homes = loadHomes() ?? [];
    const index = homes.findIndex((h) => h.id === homeId);
    if (index === -1) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    const home = homes[index];
    setHomeName(home.name);
    setHomeIndex(index);
    setFloors(home.floors);
    setActiveFloorId(loadActiveFloorId(home));
    // Opening a home makes it the one the dashboard's "resume" and the
    // entry gate point at.
    saveActiveHomeId(homeId);
    recordLastActive({ type: "home", homeId });
    setHydrated(true);
  }, [homeId, navigate, recordLastActive]);

  // Persist this home's floors on any change. Gated on `hydrated` rather
  // than on floors being non-empty: the old length-based guard existed to
  // stop the pre-load placeholder clobbering saved data, but it also made
  // "no floors" unsavable, which is a legitimate state. updateHome no-ops
  // if this home was deleted in another tab, so nothing can resurrect it.
  useEffect(() => {
    if (typeof window === "undefined" || !hydrated) return;
    updateHome(homeId, { floors });
  }, [homeId, floors, hydrated]);

  // Persist which floor is active separately -- see
  // ACTIVE_FLOOR_BY_HOME_KEY's doc comment in lib/homes.ts for why this
  // isn't folded into the homes blob above, and why it's per-home.
  useEffect(() => {
    if (typeof window === "undefined" || !activeFloorId) return;
    saveActiveFloorId(homeId, activeFloorId);
  }, [homeId, activeFloorId]);

  // -------- Export / Import --------
  // Three scopes: just the currently-active floor, every floor in this
  // home, or the home itself (its floors *and* its name -- the one shape
  // that round-trips a whole home into another profile). All go through
  // the shared ExportImportDialog (see that
  // component's own doc comment) rather than downloading/replacing
  // directly, so there's a preview -- and, for import, a chance to back
  // out -- before anything actually changes. Export/import state
  // (floors/rooms counts, etc.) always reflects whatever's current at the
  // moment the dialog is opened, same as the direct-download version this
  // replaced.
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const floorScopes = [
    { id: "current", label: lang === "de" ? "Aktuelles Geschoss" : "Current floor" },
    { id: "all", label: lang === "de" ? "Alle Geschosse" : "All floors" },
    { id: "home", label: lang === "de" ? "Dieses Zuhause" : "This home" },
  ];

  const homeLabel = homeDisplayName({ id: homeId, name: homeName, floors }, homeIndex, lang);

  // `entries` pairs each floor with the display name it should show in
  // the preview -- computed by the CALLER, not derived from the floor's
  // position within `entries` itself, since that position is only the
  // floor's real index in the home for the "all floors" case. For a
  // single exported floor it's wherever that floor actually sits in the
  // full `floors` array (so "2nd Floor" exports as "2nd Floor", not
  // "Ground Floor"); for freshly-imported data there's no "real" position
  // yet, so the imported array's own order is the only sensible choice.
  function summarizeFloors(entries: { floor: Floor; displayName: string }[]): string[] {
    const totalRooms = entries.reduce((n, e) => n + e.floor.rooms.length, 0);
    const totalItems = entries.reduce(
      (n, e) => n + e.floor.rooms.reduce((m, r) => m + r.items.length, 0),
      0,
    );
    const totalOpenings = entries.reduce(
      (n, e) => n + e.floor.rooms.reduce((m, r) => m + r.openings.length, 0),
      0,
    );
    if (entries.length === 1) {
      return [
        entries[0].displayName,
        lang === "de" ? `${totalRooms} Räume` : `${totalRooms} rooms`,
        lang === "de" ? `${totalItems} Objekte` : `${totalItems} items`,
        lang === "de" ? `${totalOpenings} Öffnungen` : `${totalOpenings} openings`,
      ];
    }
    return [
      lang === "de" ? `${entries.length} Geschosse` : `${entries.length} floors`,
      lang === "de" ? `${totalRooms} Räume insgesamt` : `${totalRooms} rooms total`,
      lang === "de" ? `${totalItems} Objekte insgesamt` : `${totalItems} items total`,
      ...entries.map((e) => `· ${e.displayName} (${e.floor.rooms.length})`),
    ];
  }

  const buildFloorsExportPreview = (scopeId: string, includeCatalog: boolean) => {
    const base = (() => {
      if (scopeId === "home") {
        // The whole home: its floors AND its name, which is the only shape
        // that can be re-imported as a home somewhere else rather than as
        // a nameless pile of floors. No id -- see homeImportSchema.
        return {
          summaryLines: [
            homeLabel,
            ...summarizeFloors(
              floors.map((f, i) => ({ floor: f, displayName: floorDisplayName(f, i, lang) })),
            ),
          ],
          filename: buildExportFilename(homeLabel),
          json: { name: homeName, floors } as unknown,
        };
      }
      if (scopeId === "current") {
        const idx = Math.max(
          0,
          floors.findIndex((f) => f.id === activeFloorId),
        );
        const floor = floors[idx] ?? floors[0];
        const displayName = floorDisplayName(floor, idx, lang);
        return {
          summaryLines: summarizeFloors([{ floor, displayName }]),
          filename: buildExportFilename(displayName),
          json: [floor] as unknown,
        };
      }
      return {
        summaryLines: summarizeFloors(
          floors.map((f, i) => ({ floor: f, displayName: floorDisplayName(f, i, lang) })),
        ),
        filename: buildExportFilename(homeLabel),
        json: floors as unknown,
      };
    })();
    // Wraps the bare floors array into { floors, customCatalog } -- see
    // parseImportedFloors' own doc comment in lib/floors.ts for why this
    // only happens when there's actually something to bundle, so a plain
    // export (checkbox off, or nothing saved yet) stays the exact same
    // bare-array format it's always been.
    if (!includeCatalog || customCatalog.items.length === 0) return base;
    return {
      ...base,
      summaryLines: [
        ...base.summaryLines,
        lang === "de"
          ? `+ ${customCatalog.items.length} Katalog-Element(e)`
          : `+ ${customCatalog.items.length} My Catalog item(s)`,
      ],
      // A home export is already an object, so the catalog joins it as a
      // sibling key; a floors export is an array, so it gets wrapped. Both
      // shapes are what parseImportedHome/parseImportedFloors expect back.
      json:
        scopeId === "home"
          ? { ...(base.json as object), customCatalog: customCatalog.items }
          : { floors: base.json, customCatalog: customCatalog.items },
    };
  };

  // Preview-only: parses the file's shape without touching any app state.
  // Accepts either the current multi-floor export shape or a legacy flat
  // single-floor export (see parseImportedFloors in lib/floors.ts).
  const validateFloorsImport = (scopeId: string, raw: unknown, includeCatalog: boolean) => {
    const imported = parseImportedFloors(raw);
    if (!imported) {
      return {
        ok: false as const,
        error:
          lang === "de"
            ? "Ungültiges Format -- diese Datei sieht nicht wie ein exportiertes Geschoss-Layout aus."
            : "Invalid format -- this file doesn't look like an exported floor plan layout.",
      };
    }
    const bundled = includeCatalog ? extractBundledCustomCatalog(raw) : [];
    const catalogLine =
      bundled.length > 0
        ? [
            lang === "de"
              ? `+ ${bundled.length} Katalog-Element(e)`
              : `+ ${bundled.length} My Catalog item(s)`,
          ]
        : [];
    if (scopeId === "home") {
      const home = parseImportedHome(raw);
      if (!home) {
        return {
          ok: false as const,
          error:
            lang === "de"
              ? "Ungültiges Format -- diese Datei sieht nicht wie ein exportiertes Zuhause aus."
              : "Invalid format -- this file doesn't look like an exported home.",
        };
      }
      return {
        ok: true as const,
        summaryLines: [
          // Named explicitly because this scope overwrites the name too --
          // a file with no name of its own leaves the current one alone.
          home.name
            ? lang === "de"
              ? `Wird umbenannt in "${home.name}"`
              : `Will be renamed to "${home.name}"`
            : lang === "de"
              ? `Name unverändert ("${homeLabel}")`
              : `Name unchanged ("${homeLabel}")`,
          ...summarizeFloors(
            home.floors.map((f, i) => ({ floor: f, displayName: floorDisplayName(f, i, lang) })),
          ),
          ...catalogLine,
        ],
      };
    }
    if (scopeId === "current" && imported.length > 1) {
      return {
        ok: true as const,
        summaryLines: [
          lang === "de"
            ? `Hinweis: Datei enthält ${imported.length} Geschosse -- nur das erste wird in das aktuelle Geschoss übernommen.`
            : `Note: file contains ${imported.length} floors -- only the first will replace the current floor.`,
          ...summarizeFloors([
            { floor: imported[0], displayName: floorDisplayName(imported[0], 0, lang) },
          ]),
          ...catalogLine,
        ],
      };
    }
    return {
      ok: true as const,
      summaryLines: [
        ...summarizeFloors(
          imported.map((f, i) => ({ floor: f, displayName: floorDisplayName(f, i, lang) })),
        ),
        ...catalogLine,
      ],
    };
  };

  const applyFloorsImport = (scopeId: string, raw: unknown, includeCatalog: boolean) => {
    const imported =
      scopeId === "home" ? (parseImportedHome(raw)?.floors ?? null) : parseImportedFloors(raw);
    if (!imported) {
      toast.error(lang === "de" ? "Fehler beim Importieren" : "Failed to import file");
      return;
    }
    if (includeCatalog) {
      const bundled = extractBundledCustomCatalog(raw);
      if (bundled.length > 0) {
        customCatalog.replaceAll(mergeCustomCatalog(customCatalog.items, bundled));
      }
    }
    setSelectedRoomId(null);
    setSelectedRoomIds(new Set());
    if (scopeId === "current") {
      pushRoomsHistory();
      setFloors((prev) =>
        prev.map((f) => (f.id === activeFloorId ? { ...f, rooms: imported[0].rooms } : f)),
      );
    } else {
      // Replaces this home's floors only -- every other home is untouched,
      // which is the whole point of an import being scoped to the home
      // you're standing in rather than to "the building".
      setFloors(imported);
      setActiveFloorId(imported[0].id);
      // The "this home" scope also carries a name. A file without one (an
      // older floors-only export) leaves the current name alone rather
      // than blanking it.
      if (scopeId === "home") {
        const name = parseImportedHome(raw)?.name ?? null;
        if (name !== null) {
          setHomeName(name);
          updateHome(homeId, { name });
        }
      }
    }
    toast.success(
      scopeId === "home"
        ? lang === "de"
          ? "Zuhause importiert"
          : "Home imported"
        : lang === "de"
          ? "Layout erfolgreich importiert"
          : "Floor plan imported",
    );
  };

  // Clears the rooms on the CURRENT floor only -- the floor itself (and
  // every other floor) stays put. Deleting a whole floor is a separate
  // action in the floor switcher's manage menu (see FloorSwitcher.tsx).
  const clearAllRooms = () => {
    if (
      window.confirm(
        lang === "de"
          ? "Möchtest du wirklich alle Räume auf diesem Geschoss löschen?"
          : "Are you sure you want to delete all rooms on this floor?",
      )
    ) {
      pushRoomsHistory();
      setRooms([]);
      setSelectedRoomId(null);
      setSelectedRoomIds(new Set());
      toast.success(lang === "de" ? "Alle Räume gelöscht" : "All rooms cleared");
    }
  };

  // h-dvh (not just min-h-screen) -- see the matching comment in
  // routes/index.tsx for why: keeps the flex column bounded to the
  // actual visible viewport on mobile browsers, where 100vh alone is
  // notoriously unreliable (address bar show/hide).
  return (
    <div className="h-dvh lg:h-screen overflow-hidden flex flex-col bg-background">
      {/* Header section */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* Only the mark links to the dashboard here, not the heading
                beside it: on this route the heading is the home's name --
                page content, not the wordmark -- so making it navigate
                somewhere else would be a trap. */}
            <Link to="/dashboard" aria-label="PLANUM — Dashboard" className="shrink-0">
              <img
                src="/logo.svg"
                alt="PLANUM"
                className="h-10 w-10 shrink-0 object-contain rounded-md shadow-sm border border-border/20 bg-background/50 p-1 transition-opacity hover:opacity-80"
              />
            </Link>
            <div className="min-w-0">
              {/* The home's own name, not a generic "Floor Plan" heading --
                  with several homes on the dashboard, which one you're
                  standing in is the thing worth saying here. */}
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-teal-600 to-sky-600 bg-clip-text text-transparent dark:from-teal-400 dark:to-sky-400">
                {homeLabel}
              </h1>
              <p className="hidden sm:block truncate text-xs text-muted-foreground">
                {t.multiRoomTitle}
              </p>
            </div>
            {!isPortrait && (
              <Button variant="outline" size="sm" asChild className="ml-2 gap-1.5 shrink-0">
                <Link to="/dashboard">
                  <LayoutDashboard className="h-4 w-4 text-amber-500" />
                  <span>Dashboard</span>
                </Link>
              </Button>
            )}
          </div>

          {/* Mobile view-only mode: every editing action below (export/
              import/clear) is meaningless with no sidebar or tools to act
              on -- keep just navigation + theme/language, mirroring the
              single-room Header's own viewOnly treatment. The Dashboard
              link itself is decided by isPortrait, not viewOnly -- see the
              matching comment in Header.tsx -- so it's consistent whether
              or not the rest of the toolbar is stripped down. */}
          {isMobileViewOnly ? (
            <div className="flex items-center gap-2">
              {isPortrait && (
                <HoverTooltip content="Dashboard">
                  <Button variant="outline" size="sm" asChild className="h-9 w-9 p-0">
                    <Link to="/dashboard">
                      <LayoutDashboard className="h-4 w-4 text-amber-500" />
                    </Link>
                  </Button>
                </HoverTooltip>
              )}
              <HoverTooltip content={lang === "en" ? "Deutsch" : "English"}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => changeLanguage(lang === "en" ? "de" : "en")}
                  className="h-9 w-9 p-0 flex items-center justify-center"
                >
                  <Languages className="h-4 w-4" />
                </Button>
              </HoverTooltip>
              <HoverTooltip
                content={
                  theme === "light"
                    ? lang === "de"
                      ? "Dunkelmodus aktivieren"
                      : "Switch to Dark Mode"
                    : lang === "de"
                      ? "Hellmodus aktivieren"
                      : "Switch to Light Mode"
                }
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleTheme}
                  className="h-9 w-9 p-0 flex items-center justify-center"
                >
                  {theme === "light" ? (
                    <Moon className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Sun className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  )}
                </Button>
              </HoverTooltip>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {isPortrait && (
                <HoverTooltip content="Dashboard">
                  <Button variant="outline" size="sm" asChild className="h-9 w-9 p-0">
                    <Link to="/dashboard">
                      <LayoutDashboard className="h-4 w-4 text-amber-500" />
                    </Link>
                  </Button>
                </HoverTooltip>
              )}

              {/* History: one segmented control, always visible -- see the
                  matching treatment (and reasoning) in Header.tsx. */}
              <div className="flex items-center rounded-md border overflow-hidden shrink-0">
                <HoverTooltip content="Ctrl+Z">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={undoRooms}
                    disabled={!canUndoRooms}
                    className="rounded-none px-2 sm:px-3"
                  >
                    <Undo2 className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">{t.undo}</span>
                  </Button>
                </HoverTooltip>
                <div className="h-5 w-px bg-border" />
                <HoverTooltip content="Ctrl+Shift+Z">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={redoRooms}
                    disabled={!canRedoRooms}
                    className="rounded-none px-2 sm:px-3"
                  >
                    <Redo2 className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">{t.redo}</span>
                  </Button>
                </HoverTooltip>
              </div>

              <HoverTooltip
                content={
                  theme === "light"
                    ? lang === "de"
                      ? "Dunkelmodus aktivieren"
                      : "Switch to Dark Mode"
                    : lang === "de"
                      ? "Hellmodus aktivieren"
                      : "Switch to Light Mode"
                }
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleTheme}
                  className="h-9 w-9 p-0 flex items-center justify-center shrink-0"
                >
                  {theme === "light" ? (
                    <Moon className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Sun className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  )}
                </Button>
              </HoverTooltip>

              {/* File operations grouped behind one menu -- see the matching
                  treatment in Header.tsx. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                    <FileStack className="h-4 w-4" />
                    <span className="hidden sm:inline">{lang === "de" ? "Datei" : "File"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setExportOpen(true)}>
                    <Download className="mr-2 h-4 w-4" /> {t.export}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setImportOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" /> {t.import}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Language + the destructive "clear this floor" action --
                  neither reached for on every visit, and tucking the
                  destructive one behind a menu makes it harder to hit by
                  accident. */}
              <DropdownMenu>
                <HoverTooltip content="More">
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 w-9 p-0 shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </HoverTooltip>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => setMeasurementsOpen(true)}>
                    <Ruler className="mr-2 h-4 w-4" />
                    {t.measurements}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeLanguage(lang === "en" ? "de" : "en")}>
                    <Languages className="mr-2 h-4 w-4" />
                    {lang === "en" ? "Deutsch" : "English"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={clearAllRooms}
                    className="text-rose-500 focus:text-rose-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />{" "}
                    {lang === "de" ? "Geschoss leeren" : "Clear This Floor"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </header>

      <ExportImportDialog
        lang={lang}
        mode="export"
        open={exportOpen}
        onOpenChange={setExportOpen}
        title={lang === "de" ? "Aus diesem Zuhause exportieren" : "Export from this home"}
        description={
          lang === "de"
            ? "Speichert ein Geschoss, alle Geschosse oder dieses ganze Zuhause als JSON-Datei."
            : "Saves one floor, every floor, or this whole home as a JSON file."
        }
        scopes={floorScopes}
        buildExport={buildFloorsExportPreview}
        includeOption={{
          label: lang === "de" ? "Meine Katalog-Elemente einschließen" : "Include My Catalog items",
          hint:
            customCatalog.items.length > 0
              ? lang === "de"
                ? `${customCatalog.items.length} gespeicherte(s) Element(e) werden in diese Datei gebündelt.`
                : `${customCatalog.items.length} saved item(s) will be bundled into this file.`
              : lang === "de"
                ? "Du hast noch keine gespeicherten Katalog-Elemente."
                : "You have no saved catalog items yet.",
          disabled: customCatalog.items.length === 0,
        }}
      />
      <ExportImportDialog
        lang={lang}
        mode="import"
        open={importOpen}
        onOpenChange={setImportOpen}
        title={lang === "de" ? "In dieses Zuhause importieren" : "Import into this home"}
        description={
          lang === "de"
            ? "Ersetzt das aktuelle Geschoss, alle Geschosse oder dieses ganze Zuhause durch den Inhalt einer JSON-Datei. Andere Zuhause bleiben unverändert."
            : "Replaces the current floor, every floor, or this whole home with the contents of a JSON file. Your other homes are untouched."
        }
        scopes={floorScopes}
        validateImport={validateFloorsImport}
        applyImport={applyFloorsImport}
        includeOption={{
          label:
            lang === "de" ? "Auch Katalog-Elemente importieren" : "Also import My Catalog items",
          hint:
            lang === "de"
              ? "Falls diese Datei gespeicherte Katalog-Elemente enthält, werden neue zu Meinem Katalog hinzugefügt."
              : "If this file includes saved catalog items, any new ones are added to My Catalog.",
        }}
      />

      <MeasurementsDialog
        t={t}
        open={measurementsOpen}
        onOpenChange={setMeasurementsOpen}
        scope="home"
        filenameBase={homeLabel}
        rooms={measureHome({ id: homeId, name: homeName, floors }, lang)}
      />

      {/* A home always starts with one ground floor and the switcher won't
          let you delete the last one, so this is a safety net rather than a
          route you can normally reach -- but it offers the action instead
          of silently creating a floor behind your back, which is exactly
          what used to make deleting one look broken. */}
      {hydrated && floors.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <LayoutGrid className="h-10 w-10 text-muted-foreground/50" />
          <div>
            <p className="text-base font-medium">
              {lang === "de" ? "Noch keine Etage" : "No floors yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {lang === "de"
                ? "Erstelle eine leere Etage in diesem Zuhause."
                : "Create an empty floor in this home."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={addFloor}>
              <Plus className="h-4 w-4" />
              {lang === "de" ? "Etage erstellen" : "Create a floor"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Main floor-plan planner panel */}
      <div
        hidden={hydrated && floors.length === 0}
        className={
          isMobileViewOnly
            ? "flex flex-1 min-h-0 w-full flex-col p-2"
            : sidebarCollapsed
              ? "grid w-full gap-4 px-4 py-4 lg:grid-cols-[64px_minmax(0,1fr)] lg:flex-1 lg:min-h-0"
              : "grid w-full gap-4 px-4 py-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:flex-1 lg:min-h-0"
        }
      >
        {/* Left Column: Sidebar to add rooms and adjust selection details --
            hidden entirely in mobile view-only mode (see useMobileViewOnly),
            same reasoning as the single-room Sidebar in RoomEditor.tsx. */}
        {!isMobileViewOnly && (
          <MultiRoomSidebar
            t={t}
            rooms={rooms}
            setRooms={setRooms}
            pushRoomsHistory={pushRoomsHistory}
            selectedRoomId={selectedRoomId}
            setSelectedRoomId={setSelectedRoomId}
            selectedRoomIds={selectedRoomIds}
            setSelectedRoomIds={setSelectedRoomIds}
            lang={lang}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={toggleSidebarCollapsed}
          />
        )}

        {/* Right Column: master floor canvas */}
        <MultiRoomCanvas
          t={t}
          homeId={homeId}
          rooms={rooms}
          setRooms={setRooms}
          pushRoomsHistory={pushRoomsHistory}
          undoRooms={undoRooms}
          redoRooms={redoRooms}
          selectedRoomId={selectedRoomId}
          setSelectedRoomId={setSelectedRoomId}
          selectedRoomIds={selectedRoomIds}
          setSelectedRoomIds={setSelectedRoomIds}
          collisionEnabled={collisionEnabled}
          setCollisionEnabled={setCollisionEnabled}
          zoomFactor={zoomFactor}
          setZoomFactor={setZoomFactor}
          lang={lang}
          isDark={isDark}
          showFurniture={showFurniture}
          setShowFurniture={setShowFurniture}
          showDimensions={showDimensions}
          setShowDimensions={setShowDimensions}
          showLabels={showLabels}
          setShowLabels={setShowLabels}
          multiSelectMode={multiSelectMode}
          setMultiSelectMode={setMultiSelectMode}
          threeDActive={threeDActive}
          setThreeDActive={setThreeDActive}
          floors={floors}
          activeFloorId={activeFloorId}
          floorSwitchDirection={floorSwitchDirection}
          onSelectFloor={selectFloor}
          onAddFloor={addFloor}
          onRenameFloor={renameFloor}
          onDeleteFloor={deleteFloor}
          onReorderFloors={reorderFloors}
        />
      </div>
    </div>
  );
}
