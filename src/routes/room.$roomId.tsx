import { createFileRoute } from "@tanstack/react-router";
import { RoomEditor } from "@/components/planner/RoomEditor";

export const Route = createFileRoute("/room/$roomId")({
  component: SingleRoomRoute,
});

// A standalone single room -- deliberately singular "/room/", a genuinely
// different route from the plural "/rooms/$roomId" that serves the
// multi-room floor system. Its data lives in its own store with no Floor
// wrapper (lib/single-rooms.ts), it never appears in the floor switcher,
// and its back button returns to the dashboard rather than a floor plan it
// isn't part of.
function SingleRoomRoute() {
  const { roomId } = Route.useParams();
  return <RoomEditor roomId={roomId} source="single" />;
}
