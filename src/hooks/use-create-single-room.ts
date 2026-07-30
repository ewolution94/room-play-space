import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { addSingleRoom } from "@/lib/single-rooms";
import { TOUR_KEY } from "@/hooks/use-room-planner";
import type { RoomLayout } from "@/types/planner";

/**
 * The single way a standalone room gets created and opened -- shared by all
 * three dashboard entry points (from scratch, from example, and the guided
 * shape wizard) so they can't drift apart. They previously each did this
 * inline and didn't all agree, which is how the guided wizard ended up
 * being the only one that also set an active floor.
 *
 * Saves to the single-room store (never the floors store) and opens the
 * singular /room/$roomId route -- see lib/single-rooms.ts for why those are
 * deliberately separate from the multi-room system.
 */
export function useCreateSingleRoom() {
  const navigate = useNavigate();

  return useCallback(
    (room: RoomLayout) => {
      addSingleRoom(room);
      // The user just went through a creation flow deliberately -- don't
      // also ambush the room they built with the separate "welcome, here's
      // a tour" modal, which useRoomPlanner auto-opens on its first-ever
      // mount and which would cover the very content they just made. Still
      // reachable anytime via the Header's "Take the tour".
      window.localStorage.setItem(TOUR_KEY, "1");
      navigate({ to: "/room/$roomId", params: { roomId: room.id } });
    },
    [navigate],
  );
}
