import React, { useState, useEffect, useCallback, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import { generateDefaultApartmentLayout } from "@/lib/default-apartment";
import {
  loadFloors,
  saveFloors,
  loadActiveFloorId,
  saveActiveFloorId,
  createFloor,
  parseImportedFloors,
  floorDisplayName,
} from "@/lib/floors";
import { ExportImportDialog } from "@/components/planner/ExportImportDialog";
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
  ArrowRight,
  FileStack,
  MoreHorizontal,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { toast } from "sonner";

export const Route = createFileRoute("/rooms/")({
  component: MultiRoomOverview,
});

function MultiRoomOverview() {
  const { theme, toggleTheme, isDark } = useTheme();
  const { isMobileViewOnly, isPortrait } = useMobileViewOnly();
  const { collapsed: sidebarCollapsed, toggle: toggleSidebarCollapsed } = useSidebarCollapsed();
  // "My Own Catalog" -- there's no Sidebar/Inspector at this overview level
  // (see MultiRoomSidebar.tsx, a different component with no My Catalog
  // tab), so this instance exists purely to support the "Include My Catalog
  // items" checkbox on the floor/building export/import dialogs below.
  const customCatalog = useCustomCatalog();

  // Language + other cross-route preferences.
  const { settings, update: updateSettings, recordLastActive } = useSettings();
  const lang = settings.lang;
  const t = STRINGS[lang];

  const changeLanguage = (l: Lang) => {
    updateSettings({ lang: l });
  };

  // Building state loaded from localStorage -- floors[] is the whole
  // building (see Floor in types/planner.ts), activeFloorId picks which
  // one is currently being edited. `rooms`/`setRooms` below are derived
  // from just the active floor's slice, so every existing room-editing
  // code path (MultiRoomCanvas, MultiRoomSidebar, multi-room-actions.ts)
  // keeps operating on a plain RoomLayout[] exactly as before and never
  // needs to know floors exist at all.
  const [floors, setFloors] = useState<Floor[]>([]);
  const [activeFloorId, setActiveFloorId] = useState<string>("");
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
  // Whole-apartment 3D view -- gated inside MultiRoomCanvas on every room
  // forming one connected structure (see computeRoomConnectivity in
  // room-adjacency.ts). Mirrors the single-room planner's own threeDActive
  // toggle (see use-room-planner.ts).
  const [threeDActive, setThreeDActive] = useState(false);

  // Load the building's initial state. On true app startup (first mount
  // this session) we always generate a single ground floor with the
  // default fully-furnished 6-room apartment (see default-apartment.ts)
  // rather than reloading whatever was left over from last time, so every
  // session starts from the same deliberate showcase layout instead of
  // accumulating leftover test edits. Returning to this route later in the
  // same session (e.g. back from /rooms/$roomId) just reloads from
  // localStorage as normal (transparently migrating a legacy single-floor
  // save if that's all that's there -- see loadFloors in lib/floors.ts),
  // preserving whatever you were just editing, floors included.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = loadFloors();
    if (saved && saved.length > 0) {
      setFloors(saved);
      setActiveFloorId(loadActiveFloorId(saved));
      return;
    }

    // Truly nothing saved yet (first-ever visit) -- seed with the
    // showcase apartment. No name passed -- auto-named from position
    // (index 0 -> "Ground Floor"/"Erdgeschoss"), same reasoning as
    // addFloor above.
    const floor = createFloor(generateDefaultApartmentLayout(lang));
    setFloors([floor]);
    setActiveFloorId(floor.id);
    saveFloors([floor]);
    saveActiveFloorId(floor.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the building (all floors) to localStorage on any change.
  useEffect(() => {
    if (typeof window === "undefined" || floors.length === 0) return;
    saveFloors(floors);
  }, [floors]);

  // Persist which floor is active separately -- see ACTIVE_FLOOR_ID_KEY's
  // doc comment in lib/floors.ts for why this isn't folded into the floors
  // blob above.
  useEffect(() => {
    if (typeof window === "undefined" || !activeFloorId) return;
    saveActiveFloorId(activeFloorId);
    recordLastActive({ type: "floor" });
  }, [activeFloorId, recordLastActive]);

  // -------- Export / Import --------
  // Two scopes: just the currently-active floor, or the whole building
  // (every floor). Both go through the shared ExportImportDialog (see
  // that component's own doc comment) rather than downloading/replacing
  // directly, so there's a preview -- and, for import, a chance to back
  // out -- before anything actually changes. Export/import state
  // (floors/rooms counts, etc.) always reflects whatever's current at the
  // moment the dialog is opened, same as the direct-download version this
  // replaced.
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const floorScopes = [
    { id: "current", label: lang === "de" ? "Aktuelles Geschoss" : "Current floor" },
    { id: "all", label: lang === "de" ? "Alle Geschosse" : "All floors" },
  ];

  // `entries` pairs each floor with the display name it should show in
  // the preview -- computed by the CALLER, not derived from the floor's
  // position within `entries` itself, since that position is only the
  // floor's real index in the building for the "all floors" case. For a
  // single exported floor it's wherever that floor actually sits in the
  // full `floors` array (so "2nd Floor" exports as "2nd Floor", not
  // "Ground Floor"); for freshly-imported data there's no "real" building
  // position yet, so the imported array's own order is the only sensible
  // choice there.
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
        filename: buildExportFilename(lang === "de" ? "Gebaeude" : "Building"),
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
      json: { floors: base.json, customCatalog: customCatalog.items },
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
    const imported = parseImportedFloors(raw);
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
      setFloors(imported);
      setActiveFloorId(imported[0].id);
    }
    toast.success(
      lang === "de" ? "Layout erfolgreich importiert" : "Floor plan layout imported successfully",
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
            <img
              src="/logo.png"
              alt="Büro Planner Logo"
              className="h-10 w-10 shrink-0 object-contain rounded-md shadow-sm border border-border/20 bg-background/50 p-1"
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-teal-600 to-sky-600 bg-clip-text text-transparent dark:from-teal-400 dark:to-sky-400">
                {t.multiRoomTitle}
              </h1>
              <p className="hidden sm:block truncate text-xs text-muted-foreground">
                {lang === "de"
                  ? "Erstelle und ordne deine Räume an."
                  : "Create and arrange your rooms in a master plan."}
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
              single-room Header's own viewOnly treatment. The Single Room
              Planner link itself is decided by isPortrait, not viewOnly --
              see the matching comment in Header.tsx -- so it's consistent
              whether or not the rest of the toolbar is stripped down. */}
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
        title={lang === "de" ? "Layout exportieren" : "Export Floor Plan"}
        description={
          lang === "de"
            ? "Speichert dein Geschoss oder das gesamte Gebäude als JSON-Datei."
            : "Saves your floor or the whole building as a JSON file."
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
        title={lang === "de" ? "Layout importieren" : "Import Floor Plan"}
        description={
          lang === "de"
            ? "Ersetzt das aktuelle Geschoss oder das gesamte Gebäude durch den Inhalt einer JSON-Datei."
            : "Replaces the current floor or the whole building with the contents of a JSON file."
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

      {/* Main floor-plan planner panel */}
      <div
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
            same reasoning as the single-room Sidebar in routes/index.tsx. */}
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
