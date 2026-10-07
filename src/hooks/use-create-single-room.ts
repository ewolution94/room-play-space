import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { addSingleRoom } from "@/lib/single-rooms";
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
      // No tour suppression here any more: a first-time visitor is offered
      // the tour in a small card in the room (useRoomPlanner), which doesn't
      // cover what they just built the way the old full-screen auto-open did.
      navigate({ to: "/room/$roomId", params: { roomId: room.id } });
    },
    [navigate],
  );
}
