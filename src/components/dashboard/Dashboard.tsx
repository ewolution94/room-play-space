import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadFloors } from "@/lib/floors";
import type { Floor, Lang, PlannerSettings } from "@/types/planner";
import { CreateSingleRoomFlow } from "@/components/dashboard/CreateSingleRoomFlow";
import { CreateFloorFlow } from "@/components/dashboard/CreateFloorFlow";
import { RecentlyOpened } from "@/components/dashboard/RecentlyOpened";
import { IkeaRoomWizard } from "@/components/dashboard/IkeaRoomWizard";
import { SettingsDialog } from "@/components/planner/SettingsDialog";
import type { Theme } from "@/hooks/use-theme";
import { DoorOpen, LayoutGrid, Moon, Settings, Sparkles, Sun, Wand2 } from "lucide-react";

interface DashboardProps {
  settings: PlannerSettings;
  updateSettings: (patch: Partial<PlannerSettings>) => void;
  theme: Theme;
  toggleTheme: () => void;
}

export function Dashboard({ settings, updateSettings, theme, toggleTheme }: DashboardProps) {
  const lang: Lang = settings.lang;
  const [singleRoomMode, setSingleRoomMode] = useState<"scratch" | "example" | null>(null);
  const [ikeaWizardOpen, setIkeaWizardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Client-only, same SSR-hydration-safe pattern as the app's other
  // localStorage-backed reads (useCustomCatalog etc.) -- starts empty
  // (matching what the server rendered) then fills in once mounted.
  const [floors, setFloors] = useState<Floor[] | null>(null);
  useEffect(() => {
    setFloors(loadFloors() ?? []);
  }, []);

  const roomCount = floors?.reduce((sum, f) => sum + f.rooms.length, 0) ?? 0;
  const hasSavedContent = (floors?.length ?? 0) > 0;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/logo.png"
              alt="Room Planner Logo"
              className="h-10 w-10 shrink-0 object-contain rounded-md shadow-sm border border-border/20 bg-background/50 p-1"
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-teal-600 to-sky-600 bg-clip-text text-transparent dark:from-teal-400 dark:to-sky-400">
                {lang === "de" ? "Raumplaner" : "Room Planner"}
              </h1>
              <p className="hidden sm:block truncate text-xs text-muted-foreground">
                {lang === "de"
                  ? "Dein Raum, deine Regeln. Visualisiert."
                  : "Your room, your rules. Visualized."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="h-9 w-9 p-0 flex items-center justify-center shrink-0"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DoorOpen className="h-5 w-5 text-primary" />
                {lang === "de" ? "Einzelnen Raum erstellen" : "Create a Single Room"}
              </CardTitle>
              <CardDescription>
                {lang === "de"
                  ? "Ein Zimmer, direkt einrichten."
                  : "One room, ready to furnish right away."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setSingleRoomMode("scratch")}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-accent hover:border-primary/40"
              >
                <DoorOpen className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {lang === "de" ? "Von Grund auf" : "From scratch"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSingleRoomMode("example")}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-accent hover:border-primary/40"
              >
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {lang === "de" ? "Aus Beispiel" : "From example"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setIkeaWizardOpen(true)}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-accent hover:border-primary/40"
              >
                <Wand2 className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {lang === "de" ? "Geführt (Form wählen)" : "Guided (Pick a Shape)"}
                </span>
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LayoutGrid className="h-5 w-5 text-primary" />
                {lang === "de" ? "Etage erstellen" : "Create a Floor"}
              </CardTitle>
              <CardDescription>
                {lang === "de"
                  ? "Mehrere Räume, ein zusammenhängender Grundriss."
                  : "Multiple rooms, one connected floor plan."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreateFloorFlow lang={lang} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="h-5 w-5 text-primary" />
              {lang === "de" ? "Gespeicherte Räume laden" : "Load Saved Rooms"}
            </CardTitle>
            <CardDescription>
              {hasSavedContent
                ? lang === "de"
                  ? `${floors?.length ?? 0} Etage(n), ${roomCount} Raum/Räume gespeichert.`
                  : `${floors?.length ?? 0} floor(s), ${roomCount} room(s) saved.`
                : lang === "de"
                  ? "Noch nichts gespeichert -- erstelle oben deinen ersten Raum."
                  : "Nothing saved yet -- create your first room above."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <RecentlyOpened lang={lang} lastActive={settings.lastActive} />
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link to="/rooms">
                <LayoutGrid className="h-4 w-4" />
                {lang === "de" ? "Alle Grundrisse öffnen" : "Open All Floor Plans"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>

      <CreateSingleRoomFlow
        lang={lang}
        mode={singleRoomMode}
        onOpenChange={(o) => !o && setSingleRoomMode(null)}
      />
      <IkeaRoomWizard lang={lang} open={ikeaWizardOpen} onOpenChange={setIkeaWizardOpen} />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        updateSettings={updateSettings}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    </div>
  );
}
