import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadFloors } from "@/lib/floors";
import { loadSingleRooms } from "@/lib/single-rooms";
import { buildHomeOfficeRoom } from "@/lib/single-room-templates";
import { useCreateSingleRoom } from "@/hooks/use-create-single-room";
import { TOUR_KEY } from "@/hooks/use-room-planner";
import type { Lang, PlannerSettings } from "@/types/planner";
import { CreateSingleRoomFlow } from "@/components/dashboard/CreateSingleRoomFlow";
import { CreateFloorFlow } from "@/components/dashboard/CreateFloorFlow";
import { RecentlyOpened } from "@/components/dashboard/RecentlyOpened";
import { SingleRoomsList } from "@/components/dashboard/SingleRoomsList";
import { FloorPlansList } from "@/components/dashboard/FloorPlansList";
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
  const createSingleRoom = useCreateSingleRoom();
  const navigate = useNavigate();
  const [scratchRoomOpen, setScratchRoomOpen] = useState(false);
  const [ikeaWizardOpen, setIkeaWizardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  /**
   * The tour explains the room editor, so it can only run inside a room --
   * which is why the dashboard's Settings dialog showed no "take the tour"
   * option at all, even though the identical dialog inside a room does.
   * Rather than duplicate the tour here, this clears the seen-flag and
   * opens a room, letting useRoomPlanner's existing first-mount auto-open
   * do the rest. Returns null when there's no room to tour yet, which
   * leaves the button hidden (see SettingsDialog's `onTakeTour`).
   */
  const startTour = () => {
    const single = loadSingleRooms()[0];
    if (single) {
      window.localStorage.removeItem(TOUR_KEY);
      navigate({ to: "/room/$roomId", params: { roomId: single.id } });
      return;
    }
    const floorRoom = (loadFloors() ?? []).flatMap((f) => f.rooms)[0];
    if (!floorRoom) return;
    window.localStorage.removeItem(TOUR_KEY);
    navigate({ to: "/rooms/$roomId", params: { roomId: floorRoom.id } });
  };

  // Only offered when there's actually somewhere to run it. Read after
  // mount, not during render -- same SSR-hydration-safe pattern as the
  // saved lists below.
  const [hasAnyRoom, setHasAnyRoom] = useState(false);
  useEffect(() => {
    setHasAnyRoom(
      loadSingleRooms().length > 0 || (loadFloors() ?? []).some((f) => f.rooms.length > 0),
    );
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/logo.svg"
              alt="PLANUM"
              className="h-10 w-10 shrink-0 object-contain rounded-md shadow-sm border border-border/20 bg-background/50 p-1"
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-teal-600 to-sky-600 bg-clip-text text-transparent dark:from-teal-400 dark:to-sky-400">
                PLANUM
              </h1>
              <p className="hidden sm:block truncate text-xs text-muted-foreground">
                {lang === "de"
                  ? "Plane den Raum, den du wirklich hast."
                  : "Plan the space you actually have."}
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
        {/* First thing on the page: for a returning user, resuming is
            almost always what they came to do. */}
        <RecentlyOpened lang={lang} lastActive={settings.lastActive} />

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
                onClick={() => setScratchRoomOpen(true)}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-accent hover:border-primary/40"
              >
                <DoorOpen className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {lang === "de" ? "Von Grund auf" : "From scratch"}
                </span>
              </button>
              {/* No picker in between -- this builds the app's one example
                  room (the hand-tuned home office) and opens it. See
                  buildHomeOfficeRoom's doc comment. */}
              <button
                type="button"
                onClick={() => createSingleRoom(buildHomeOfficeRoom(lang))}
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

        {/* Saved content, split the same way the creation cards above are:
            standalone rooms and floor plans are two separate systems with
            separate storage and separate routes (see lib/single-rooms.ts),
            so listing them together would put back exactly the confusion
            that split was meant to remove. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DoorOpen className="h-5 w-5 text-primary" />
                {lang === "de" ? "Deine einzelnen Räume" : "Your Single Rooms"}
              </CardTitle>
              <CardDescription>
                {lang === "de"
                  ? "Räume für sich, unabhängig von jedem Grundriss."
                  : "Rooms on their own, independent of any floor plan."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SingleRoomsList lang={lang} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LayoutGrid className="h-5 w-5 text-primary" />
                {lang === "de" ? "Deine Grundrisse" : "Your Floor Plans"}
              </CardTitle>
              <CardDescription>
                {lang === "de"
                  ? "Mehrere Räume pro Etage, als zusammenhängendes Gebäude."
                  : "Multiple rooms per floor, as one connected building."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FloorPlansList lang={lang} />
            </CardContent>
          </Card>
        </div>
      </main>

      <CreateSingleRoomFlow lang={lang} open={scratchRoomOpen} onOpenChange={setScratchRoomOpen} />
      <IkeaRoomWizard lang={lang} open={ikeaWizardOpen} onOpenChange={setIkeaWizardOpen} />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        updateSettings={updateSettings}
        theme={theme}
        toggleTheme={toggleTheme}
        onTakeTour={hasAnyRoom ? startTour : undefined}
      />
    </div>
  );
}
