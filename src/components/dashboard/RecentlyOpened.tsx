import { Link } from "@tanstack/react-router";
import { loadFloors, floorDisplayName } from "@/lib/floors";
import type { Lang, LastActiveTarget } from "@/types/planner";
import { ArrowRight, DoorOpen, LayoutGrid } from "lucide-react";

interface RecentlyOpenedProps {
  lang: Lang;
  lastActive: LastActiveTarget | null;
}

/**
 * Settings only tracks a single lastActive target (see PlannerSettings in
 * types/planner.ts), not a history -- RoomLayout/Floor carry no
 * last-modified timestamp to genuinely rank more than one "most recent"
 * item against, so this renders at most one entry rather than the 2-3-item
 * list a real usage history could support.
 */
export function RecentlyOpened({ lang, lastActive }: RecentlyOpenedProps) {
  if (!lastActive) return null;
  const floors = loadFloors() ?? [];

  if (lastActive.type === "floor") {
    if (floors.length === 0) return null;
    return (
      <Link
        to="/rooms"
        className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent hover:border-primary/40"
      >
        <LayoutGrid className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">
            {lang === "de" ? "Weiter geht's" : "Continue where you left off"}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {lang === "de" ? "Zurück zu deinem Grundriss" : "Back to your floor plan"}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    );
  }

  let roomName: string | null = null;
  let floorLabel: string | null = null;
  for (let i = 0; i < floors.length; i++) {
    const room = floors[i].rooms.find((r) => r.id === lastActive.roomId);
    if (room) {
      roomName = room.name;
      floorLabel = floorDisplayName(floors[i], i, lang);
      break;
    }
  }
  // The room was deleted (or its floor removed) since it was last opened.
  if (!roomName) return null;

  return (
    <Link
      to="/rooms/$roomId"
      params={{ roomId: lastActive.roomId }}
      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent hover:border-primary/40"
    >
      <DoorOpen className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{roomName}</div>
        <div className="truncate text-xs text-muted-foreground">{floorLabel}</div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
