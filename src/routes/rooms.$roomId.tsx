import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { findHomeIdForRoom, loadHomes } from "@/lib/homes";

export const Route = createFileRoute("/rooms/$roomId")({
  component: RoomsRoomIdRedirect,
});

/**
 * The old address for a room inside the one implicit building. A room now
 * lives on a floor of a Home and is edited at `/home/$homeId/room/$roomId`,
 * so this redirects rather than 404ing an old bookmark.
 *
 * This is the one place searching every home for a room id is the right
 * answer: the incoming URL genuinely doesn't say which home, because it
 * predates homes existing. Everywhere else the route carries the home id
 * precisely so nothing has to guess (see RoomSource in types/planner.ts).
 * A room that no longer exists falls back to the dashboard.
 */
function RoomsRoomIdRedirect() {
  const { roomId } = Route.useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const homeId = findHomeIdForRoom(loadHomes() ?? [], roomId);
    if (!homeId) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    navigate({
      to: "/home/$homeId/room/$roomId",
      params: { homeId, roomId },
      replace: true,
    });
  }, [roomId, navigate]);

  return null;
}
