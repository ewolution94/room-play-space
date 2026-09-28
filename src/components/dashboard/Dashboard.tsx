import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { findHomeIdForRoom, loadHomes } from "@/lib/homes";
import { loadSingleRooms } from "@/lib/single-rooms";
import { buildHomeOfficeRoom } from "@/lib/room-templates";
import { useCreateSingleRoom } from "@/hooks/use-create-single-room";
import { useMobileViewOnly } from "@/hooks/use-mobile-view-only";
import { TOUR_KEY } from "@/hooks/use-room-planner";
import type { Lang, PlannerSettings } from "@/types/planner";
import { CreateSingleRoomFlow } from "@/components/dashboard/CreateSingleRoomFlow";
import { CreateHomeFlow } from "@/components/dashboard/CreateHomeFlow";
import {
  CREATE_OPTION_LIST_CLASS,
  CreateOptionButton,
} from "@/components/dashboard/CreateOptionButton";
import { RecentlyOpened } from "@/components/dashboard/RecentlyOpened";
import { SingleRoomsList } from "@/components/dashboard/SingleRoomsList";
import { HomesList } from "@/components/dashboard/HomesList";
import { IkeaRoomWizard } from "@/components/room-creation/IkeaRoomWizard";
import { SettingsDialog } from "@/components/planner/SettingsDialog";
import { MobileCreateBlockedDialog } from "@/components/dashboard/MobileCreateBlockedDialog";
import type { Theme } from "@/hooks/use-theme";
import { DoorOpen, Home as HomeIcon, Moon, Settings, Sparkles, Sun, Wand2 } from "lucide-react";

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
  const { isMobileViewOnly } = useMobileViewOnly();
  const [scratchRoomOpen, setScratchRoomOpen] = useState(false);
  const [ikeaWizardOpen, setIkeaWizardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileBlockedOpen, setMobileBlockedOpen] = useState(false);

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
    const homes = loadHomes() ?? [];
    const homeRoom = homes.flatMap((h) => h.floors).flatMap((f) => f.rooms)[0];
    if (!homeRoom) return;
    const homeId = findHomeIdForRoom(homes, homeRoom.id);
    if (!homeId) return;
    window.localStorage.removeItem(TOUR_KEY);
    navigate({ to: "/home/$homeId/room/$roomId", params: { homeId, roomId: homeRoom.id } });
  };

  // Only offered when there's actually somewhere to run it. Read after
  // mount, not during render -- same SSR-hydration-safe pattern as the
  // saved lists below.
  const [hasAnyRoom, setHasAnyRoom] = useState(false);
  useEffect(() => {
    setHasAnyRoom(
      loadSingleRooms().length > 0 ||
        (loadHomes() ?? []).some((h) => h.floors.some((f) => f.rooms.length > 0)),
    );
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-3">
          {/* A link to the page you're already on, deliberately: a logo
              that stops being clickable on one page is the kind of small
              inconsistency people notice without being able to say why. */}
          <Link
            to="/dashboard"
            aria-label="PLANUM — Dashboard"
            className="flex min-w-0 items-center gap-3 rounded-md transition-opacity hover:opacity-80"
          >
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
          </Link>
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

        {/* min-h-10 on every card description = two lines of text-sm, so a
            description that wraps in one language but not another (the Home
            card's does in German) can't push that card's buttons out of
            line with the card beside it. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DoorOpen className="h-5 w-5 text-primary" />
                {lang === "de" ? "Einzelnen Raum erstellen" : "Create a Single Room"}
              </CardTitle>
              <CardDescription className="min-h-10">
                {lang === "de"
                  ? "Ein Zimmer, direkt einrichten."
                  : "One room, ready to furnish right away."}
              </CardDescription>
            </CardHeader>
            <CardContent className={CREATE_OPTION_LIST_CLASS}>
              <CreateOptionButton
                icon={DoorOpen}
                title={lang === "de" ? "Von Grund auf" : "From scratch"}
                description={
                  lang === "de"
                    ? "Leerer Raum, Größe selbst wählen"
                    : "Empty room, you set the size"
                }
                onClick={
                  isMobileViewOnly
                    ? () => setMobileBlockedOpen(true)
                    : () => setScratchRoomOpen(true)
                }
              />
              {/* No picker in between -- this builds the app's one example
                  room (the hand-tuned home office) and opens it. See
                  buildHomeOfficeRoom's doc comment. */}
              <CreateOptionButton
                icon={Sparkles}
                title={lang === "de" ? "Aus Beispiel" : "From example"}
                description={
                  lang === "de"
                    ? "Ein voll eingerichtetes Arbeitszimmer"
                    : "A fully furnished home office"
                }
                onClick={() => createSingleRoom(buildHomeOfficeRoom(lang))}
              />
              <CreateOptionButton
                icon={Wand2}
                title={lang === "de" ? "Geführt" : "Guided"}
                description={
                  lang === "de" ? "Form wählen, Wände ziehen" : "Pick a shape, drag the walls"
                }
                onClick={
                  isMobileViewOnly
                    ? () => setMobileBlockedOpen(true)
                    : () => setIkeaWizardOpen(true)
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HomeIcon className="h-5 w-5 text-primary" />
                {lang === "de" ? "Erstelle ein Zuhause" : "Create a Home"}
              </CardTitle>
              <CardDescription className="min-h-10">
                {lang === "de"
                  ? "Eine Wohnung oder ein Haus, mit einer oder mehreren Etagen."
                  : "A flat or a house, with one floor or several."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreateHomeFlow lang={lang} />
            </CardContent>
          </Card>
        </div>

        {/* Saved content, split the same way the creation cards above are:
            standalone rooms and homes are two separate systems with
            separate storage and separate routes (see lib/single-rooms.ts
            and lib/homes.ts), so listing them together would put back
            exactly the confusion that split was meant to remove. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DoorOpen className="h-5 w-5 text-primary" />
                {lang === "de" ? "Deine einzelnen Räume" : "Your Single Rooms"}
              </CardTitle>
              <CardDescription className="min-h-10">
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
                <HomeIcon className="h-5 w-5 text-primary" />
                {lang === "de" ? "Deine geplanten Zuhause" : "Your Homes"}
              </CardTitle>
              <CardDescription className="min-h-10">
                {lang === "de"
                  ? "Jedes Zuhause mit seinen eigenen Etagen und Räumen."
                  : "Each home with its own floors and rooms."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HomesList lang={lang} />
            </CardContent>
          </Card>
        </div>
      </main>

      <CreateSingleRoomFlow lang={lang} open={scratchRoomOpen} onOpenChange={setScratchRoomOpen} />
      <IkeaRoomWizard
        lang={lang}
        open={ikeaWizardOpen}
        onOpenChange={setIkeaWizardOpen}
        onCreate={createSingleRoom}
      />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        updateSettings={updateSettings}
        theme={theme}
        toggleTheme={toggleTheme}
        onTakeTour={hasAnyRoom && !isMobileViewOnly ? startTour : undefined}
      />
      <MobileCreateBlockedDialog
        lang={lang}
        open={mobileBlockedOpen}
        onOpenChange={setMobileBlockedOpen}
      />
    </div>
  );
}
