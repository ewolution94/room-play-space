import { createFileRoute } from "@tanstack/react-router";
import { RoomEditor } from "@/components/planner/RoomEditor";

export const Route = createFileRoute("/rooms/$roomId")({
  component: FloorRoomRoute,
});

// One room inside a multi-room floor plan, opened from the /rooms overview
// -- stored as part of a Floor (lib/floors.ts). The editor itself is shared
// with the standalone single-room route (see RoomEditor); the only thing
// this route decides is which of the two systems the id belongs to.
function FloorRoomRoute() {
  const { roomId } = Route.useParams();
  return <RoomEditor roomId={roomId} source="floor" />;
}
