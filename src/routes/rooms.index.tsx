import React, { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTheme } from "@/hooks/use-theme";
import { STRINGS } from "@/lib/planner-translations";
import type { RoomLayout, Lang } from "@/types/planner";
import { MultiRoomCanvas } from "@/components/planner/MultiRoomCanvas";
import { MultiRoomSidebar } from "@/components/planner/MultiRoomSidebar";
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

// Cozy default layout data to present a premium experience instantly
const INITIAL_DEFAULT_ROOMS: RoomLayout[] = [
  {
    id: "default-living-room",
    name: "Living Room",
    width: 480,
    length: 360,
    x: 150,
    y: 150,
    rotation: 0,
    color: "#3b82f6",
    corners: [
      { x: 0, y: 0 },
      { x: 480, y: 0 },
      { x: 480, y: 360 },
      { x: 0, y: 360 },
    ],
    wallColors: {
      top: "#f1f5f9",
      right: "#f1f5f9",
      bottom: "#f1f5f9",
      left: "#f1f5f9",
    },
    openings: [
      {
        id: "living-door",
        wall: "bottom",
        position: 65,
        width: 90,
        kind: "door",
        hinge: "start",
        swing: "in",
      },
      { id: "living-window-1", wall: "top", position: 60, width: 120, kind: "window" },
    ],
    items: [
      {
        id: "living-desk",
        name: "Desk",
        width: 160,
        length: 75,
        color: "#c28a5e",
        x: 160,
        y: 15,
        rotation: 0,
        kind: "furniture",
        icon: "desk",
      },
      {
        id: "living-chair",
        name: "Office chair",
        width: 60,
        length: 60,
        color: "#556270",
        x: 210,
        y: 100,
        rotation: 0,
        kind: "chair",
        icon: "chair-office",
      },
      {
        id: "living-plant",
        name: "Plant",
        width: 50,
        length: 50,
        color: "#4ade80",
        x: 20,
        y: 20,
        rotation: 0,
        kind: "furniture",
        icon: "plant",
      },
    ],
  },
  {
    id: "default-office",
    name: "Home Office",
    width: 360,
    length: 300,
    x: 670,
    y: 150,
    rotation: 0,
    color: "#14b8a6",
    corners: [
      { x: 0, y: 0 },
      { x: 360, y: 0 },
      { x: 360, y: 300 },
      { x: 0, y: 300 },
    ],
    wallColors: {
      top: "#f1f5f9",
      right: "#f1f5f9",
      bottom: "#f1f5f9",
      left: "#f1f5f9",
    },
    openings: [
      {
        id: "office-door",
        wall: "left",
        position: 100,
        width: 90,
        kind: "door",
        hinge: "end",
        swing: "in",
      },
      { id: "office-window", wall: "right", position: 90, width: 120, kind: "window" },
    ],
    items: [
      {
        id: "office-desk-2",
        name: "Executive Desk",
        width: 140,
        length: 80,
        color: "#a07855",
        x: 180,
        y: 20,
        rotation: 180,
        kind: "furniture",
        icon: "desk",
      },
      {
        id: "office-chair-2",
        name: "Comfy Chair",
        width: 60,
        length: 60,
        color: "#27272a",
        x: 220,
        y: 120,
        rotation: 0,
        kind: "chair",
        icon: "chair-office",
      },
    ],
  },
];

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
  const [collisionEnabled, setCollisionEnabled] = useState(true);
  const [zoomFactor, setZoomFactor] = useState(0.85);
  const [showFurniture, setShowFurniture] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load rooms initial state
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("planner-multi-rooms");
    if (saved) {
      try {
        setRooms(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved rooms, reverting to default", e);
        setRooms(INITIAL_DEFAULT_ROOMS);
      }
    } else {
      setRooms(INITIAL_DEFAULT_ROOMS);
      window.localStorage.setItem("planner-multi-rooms", JSON.stringify(INITIAL_DEFAULT_ROOMS));
    }
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
    toast.success(lang === "de" ? "Layout erfolgreich exportiert" : "Floor plan layout exported successfully");
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
          toast.success(lang === "de" ? "Layout erfolgreich importiert" : "Floor plan layout imported successfully");
        } else {
          throw new Error("Invalid format");
        }
      } catch (err) {
        toast.error(lang === "de" ? "Fehler beim Importieren" : "Failed to import file: Invalid format");
      }
    };
    r.readAsText(file);
  };

  const clearAllRooms = () => {
    if (window.confirm(lang === "de" ? "Möchtest du wirklich alle Räume löschen?" : "Are you sure you want to delete all rooms?")) {
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
                {lang === "de" ? "Erstelle und ordne deine Räume an." : "Create and arrange your rooms in a master plan."}
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
              title={theme === "light" ? (lang === "de" ? "Dunkelmodus aktivieren" : "Switch to Dark Mode") : (lang === "de" ? "Hellmodus aktivieren" : "Switch to Light Mode")}
              className="h-9 w-9 p-0 flex items-center justify-center"
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
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
                <DropdownMenuItem onClick={clearAllRooms} className="text-rose-500 hover:text-rose-600 focus:text-rose-600">
                  <Trash2 className="mr-2 h-4 w-4" /> {lang === "de" ? "Alles zurücksetzen" : "Clear All Rooms"}
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
          lang={lang}
          collisionEnabled={collisionEnabled}
        />

        {/* Right Column: master floor canvas */}
        <MultiRoomCanvas
          t={t}
          rooms={rooms}
          setRooms={setRooms}
          selectedRoomId={selectedRoomId}
          setSelectedRoomId={setSelectedRoomId}
          collisionEnabled={collisionEnabled}
          setCollisionEnabled={setCollisionEnabled}
          zoomFactor={zoomFactor}
          setZoomFactor={setZoomFactor}
          lang={lang}
          isDark={isDark}
          showFurniture={showFurniture}
          setShowFurniture={setShowFurniture}
        />
      </div>
    </div>
  );
}
