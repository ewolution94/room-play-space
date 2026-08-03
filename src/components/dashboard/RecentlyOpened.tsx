import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { floorDisplayName } from "@/lib/floors";
import { countRooms, homeDisplayName, loadActiveFloorId, loadHomes } from "@/lib/homes";
import { findSingleRoom } from "@/lib/single-rooms";
import type { Lang, LastActiveTarget } from "@/types/planner";
import { ArrowRight, DoorOpen, History, Home as HomeIcon } from "lucide-react";

interface RecentlyOpenedProps {
  lang: Lang;
  lastActive: LastActiveTarget | null;
}

/**
 * The "pick up where you left off" entry, deliberately the first thing on
 * the dashboard: for a returning user it's almost always what they came to
 * do, and it used to sit below the creation cards where it read as an
 * afterthought.
 *
 * It names its target explicitly -- which room or home, and what kind of
 * thing that is -- rather than just saying "continue". A one-click shortcut
 * that doesn't say where it goes is a coin flip, and the two systems it can
 * land in (a standalone room vs. a room inside a home) are exactly the ones
 * this app has already confused users by blurring.
 *
 * Settings tracks a single lastActive target (see PlannerSettings in
 * types/planner.ts), not a history -- RoomLayout/Floor/Home carry no
 * last-modified timestamp to rank more than one "most recent" item
 * against -- so this is always at most one entry. Every id it needs is in
 * the stored target itself; nothing here searches for one.
 */
export function RecentlyOpened({ lang, lastActive }: RecentlyOpenedProps) {
  if (!lastActive) return null;

  if (lastActive.type === "single-room") {
    const room = findSingleRoom(lastActive.roomId);
    // Deleted since it was last opened.
    if (!room) return null;
    return (
      <Link to="/room/$roomId" params={{ roomId: room.id }} className={RESUME_CARD_CLASS}>
        <ResumeBody
          lang={lang}
          icon={<DoorOpen className="h-5 w-5 shrink-0 text-primary" />}
          title={room.name}
          detail={`${lang === "de" ? "Einzelner Raum" : "Single room"} · ${Math.round(room.width)}×${Math.round(room.length)} cm`}
        />
      </Link>
    );
  }

  const homes = loadHomes() ?? [];
  const homeIndex = homes.findIndex((h) => h.id === lastActive.homeId);
  // The home was deleted since it was last opened.
  if (homeIndex === -1) return null;
  const home = homes[homeIndex];

  if (lastActive.type === "home") {
    const activeFloorId = loadActiveFloorId(home);
    const floorIndex = Math.max(
      0,
      home.floors.findIndex((f) => f.id === activeFloorId),
    );
    const floorLabel = home.floors[floorIndex]
      ? floorDisplayName(home.floors[floorIndex], floorIndex, lang)
      : "";
    const roomCount = countRooms(home);
    return (
      <Link to="/home/$homeId" params={{ homeId: home.id }} className={RESUME_CARD_CLASS}>
        <ResumeBody
          lang={lang}
          icon={<HomeIcon className="h-5 w-5 shrink-0 text-primary" />}
          title={homeDisplayName(home, homeIndex, lang)}
          detail={
            lang === "de"
              ? `Zuhause · ${roomCount} Raum/Räume · ${floorLabel}`
              : `Home · ${roomCount} room${roomCount === 1 ? "" : "s"} · ${floorLabel}`
          }
        />
      </Link>
    );
  }

  const floorIndex = home.floors.findIndex((f) => f.rooms.some((r) => r.id === lastActive.roomId));
  // The room was deleted (or its floor removed) since it was last opened.
  if (floorIndex === -1) return null;
  const room = home.floors[floorIndex].rooms.find((r) => r.id === lastActive.roomId)!;

  return (
    <Link
      to="/home/$homeId/room/$roomId"
      params={{ homeId: home.id, roomId: room.id }}
      className={RESUME_CARD_CLASS}
    >
      <ResumeBody
        lang={lang}
        icon={<DoorOpen className="h-5 w-5 shrink-0 text-primary" />}
        title={room.name}
        detail={`${lang === "de" ? "Raum in" : "Room in"} ${floorDisplayName(home.floors[floorIndex], floorIndex, lang)} · ${homeDisplayName(home, homeIndex, lang)}`}
      />
    </Link>
  );
}

// Same split as SavedRow.tsx and for the same reason: each branch keeps its
// own <Link> because TanStack types `to` and `params` as a correlated pair,
// so only the shared class and the shared body are factored out.
const RESUME_CARD_CLASS =
  "flex items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10 hover:border-primary/50";

function ResumeBody({
  lang,
  icon,
  title,
  detail,
}: {
  lang: Lang;
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <>
      <History className="h-5 w-5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-wide text-primary">
          {lang === "de" ? "Weitermachen, wo du aufgehört hast" : "Continue where you left off"}
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          {icon}
          <span className="truncate text-sm font-semibold">{title}</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground">
        {lang === "de" ? "Öffnen" : "Open"}
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </>
  );
}
