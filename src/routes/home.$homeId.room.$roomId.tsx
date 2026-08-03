import { createFileRoute } from "@tanstack/react-router";
import { RoomEditor } from "@/components/planner/RoomEditor";

export const Route = createFileRoute("/home/$homeId/room/$roomId")({
  component: HomeRoomRoute,
});

// One room on one floor of a Home, opened from that home's floor plan --
// stored inside the Home (lib/homes.ts). The editor itself is shared with
// the standalone single-room route (see RoomEditor); the only things this
// route decides are which of the two systems the id belongs to, and which
// home it's in.
//
// The home id is in the URL on purpose, even though room ids are UUIDs and
// could be found by searching every home: that search is precisely the
// "look it up and guess" pattern docs/LEARNINGS.md warns against, and the
// back-link needs the home id anyway to know where to return to.
function HomeRoomRoute() {
  const { homeId, roomId } = Route.useParams();
  return <RoomEditor roomId={roomId} source="floor" homeId={homeId} />;
}
