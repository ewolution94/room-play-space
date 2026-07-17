import React, { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTheme } from "@/hooks/use-theme";
import { STRINGS } from "@/lib/planner-translations";
import type { RoomLayout, Lang } from "@/types/planner";
import { MultiRoomCanvas } from "@/components/planner/MultiRoomCanvas";
import { MultiRoomSidebar } from "@/components/planner/MultiRoomSidebar";
import { generateRandomRoomLayout } from "@/lib/multi-room-actions";
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
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/rooms/")({
  component: MultiRoomOverview,
});

// Tracks whether this browser tab has already generated a random layout this
// session. Module-level (not component state) so it survives SPA navigation
// between /rooms and /rooms/$roomId -- it only resets on an actual page
// reload, which is what "on startup" should mean. Without this, navigating
// back to /rooms after editing a room inside /rooms/$roomId would regenerate
// a fresh layout and wipe out the edit you just made.
let hasGeneratedRoomsThisSession = false;

function MultiRoomOverview() {
  const { theme, toggleTheme, isDark } = useTheme();

  // Language management
  const [lang, setLang] = useState<Lang>("en");
  const t = STRINGS[lang];

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? window.localStorage.getItem("planner-lang") : null;
    if (saved === "en" || saved === "de") setLang(saved);
  }, []);

  const changeLanguage = (l: Lang) => {
    setLang(l);
    if (typeof window !== "undefined") window.localStorage.setItem("planner-lang", l);
  };

  // Rooms state loaded from localStorage
  const [rooms, setRooms] = useState<RoomLayout[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
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

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load rooms initial state. On true app startup (first mount this session)
  // we always generate a fresh randomized layout rather than reloading
  // whatever was left over from last time, so collision/drag testing always
  // starts from clean, non-overlapping positions. Returning to this route
  // later in the same session (e.g. back from /rooms/$roomId) just reloads
  // from localStorage as normal, preserving whatever you were just editing.
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!hasGeneratedRoomsThisSession) {
      hasGeneratedRoomsThisSession = true;
      const fresh = generateRandomRoomLayout(lang);
      setRooms(fresh);
      window.localStorage.setItem("planner-multi-rooms", JSON.stringify(fresh));
      return;
    }

    const saved = window.localStorage.getItem("planner-multi-rooms");
    if (saved) {
      try {
        setRooms(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved rooms, generating a fresh layout", e);
        const fresh = generateRandomRoomLayout(lang);
        setRooms(fresh);
        window.localStorage.setItem("planner-multi-rooms", JSON.stringify(fresh));
      }
    } else {
      const fresh = generateRandomRoomLayout(lang);
      setRooms(fresh);
      window.localStorage.setItem("planner-multi-rooms", JSON.stringify(fresh));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save rooms to localStorage on changes
  useEffect(() => {
    if (typeof window === "undefined" || rooms.length === 0) return;
    window.localStorage.setItem("planner-multi-rooms", JSON.stringify(rooms));
  }, [rooms]);

  // Export rooms layout
  const exportJSON = () => {
    const dataStr = JSON.stringify(rooms, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `multi-room-layout-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(
      lang === "de" ? "Layout erfolgreich exportiert" : "Floor plan layout exported successfully",
    );
  };

  // Import rooms layout
  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const r = new FileReader();
    r.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (Array.isArray(parsed)) {
          setRooms(parsed);
          toast.success(
            lang === "de"
              ? "Layout erfolgreich importiert"
              : "Floor plan layout imported successfully",
          );
        } else {
          throw new Error("Invalid format");
        }
      } catch (err) {
        toast.error(
          lang === "de" ? "Fehler beim Importieren" : "Failed to import file: Invalid format",
        );
      }
    };
    r.readAsText(file);
  };

  const clearAllRooms = () => {
    if (
      window.confirm(
        lang === "de"
          ? "Möchtest du wirklich alle Räume löschen?"
          : "Are you sure you want to delete all rooms?",
      )
    ) {
      setRooms([]);
      setSelectedRoomId(null);
      window.localStorage.removeItem("planner-multi-rooms");
      toast.success(lang === "de" ? "Alle Räume gelöscht" : "All rooms cleared");
    }
  };

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-background">
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
            <Button variant="outline" size="sm" asChild className="ml-2 gap-1.5 hidden md:flex">
              <Link to="/">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>{lang === "de" ? "Einzelraum Planer" : "Single Room Planner"}</span>
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="md:hidden h-9 w-9 p-0"
              title={lang === "de" ? "Einzelraum Planer" : "Single Room Planner"}
            >
              <Link to="/">
                <Sparkles className="h-4 w-4 text-amber-500" />
              </Link>
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onImportFile}
            />

            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              title={
                theme === "light"
                  ? lang === "de"
                    ? "Dunkelmodus aktivieren"
                    : "Switch to Dark Mode"
                  : lang === "de"
                    ? "Hellmodus aktivieren"
                    : "Switch to Light Mode"
              }
              className="h-9 w-9 p-0 flex items-center justify-center"
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              )}
            </Button>

            {/* Inline on desktop -- only collapses into the "Options" menu below
                the lg breakpoint, once there's genuinely not enough header
                width for these as standalone buttons. */}
            <div className="hidden lg:flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => changeLanguage(lang === "en" ? "de" : "en")}
                className="gap-1.5"
              >
                <Languages className="h-4 w-4" />
                <span>{lang === "en" ? "Deutsch" : "English"}</span>
              </Button>
              <Button variant="outline" size="sm" onClick={exportJSON} className="gap-1.5">
                <Download className="h-4 w-4" />
                <span>{t.export}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5"
              >
                <Upload className="h-4 w-4" />
                <span>{t.import}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllRooms}
                className="gap-1.5 text-rose-500 hover:text-rose-600 border-rose-200/60 hover:border-rose-300 dark:border-rose-900/40"
              >
                <Trash2 className="h-4 w-4" />
                <span>{lang === "de" ? "Alles zurücksetzen" : "Clear All Rooms"}</span>
              </Button>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <span>{lang === "de" ? "Optionen" : "Options"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => changeLanguage(lang === "en" ? "de" : "en")}>
                  <Languages className="mr-2 h-4 w-4" />
                  {lang === "en" ? "Deutsch" : "English"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportJSON}>
                  <Download className="mr-2 h-4 w-4" /> {t.export}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> {t.import}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={clearAllRooms}
                  className="text-rose-500 hover:text-rose-600 focus:text-rose-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />{" "}
                  {lang === "de" ? "Alles zurücksetzen" : "Clear All Rooms"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main floor-plan planner panel */}
      <div className="grid w-full gap-4 px-4 py-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:flex-1 lg:min-h-0">
        {/* Left Column: Sidebar to add rooms and adjust selection details */}
        <MultiRoomSidebar
          t={t}
          rooms={rooms}
          setRooms={setRooms}
          selectedRoomId={selectedRoomId}
          setSelectedRoomId={setSelectedRoomId}
          selectedRoomIds={selectedRoomIds}
          setSelectedRoomIds={setSelectedRoomIds}
          lang={lang}
        />

        {/* Right Column: master floor canvas */}
        <MultiRoomCanvas
          t={t}
          rooms={rooms}
          setRooms={setRooms}
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
        />
      </div>
    </div>
  );
}
