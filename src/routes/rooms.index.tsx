import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { loadActiveHomeId, loadHomes } from "@/lib/homes";

export const Route = createFileRoute("/rooms/")({
  component: RoomsRedirect,
});

/**
 * `/rooms` was the one implicit building's floor plan. Floors now belong to
 * a Home and live at `/home/$homeId` (see docs/HOMES-PROPOSAL.md), so this
 * is a redirect rather than a deleted route: a bookmark, or a `lastActive`
 * written before the change, would otherwise land on a 404.
 *
 * It resolves to the active home -- which, for anyone arriving from the old
 * world, is the single home their floors migrated into. With no homes at
 * all there's nothing to show, so it falls back to the dashboard. Nothing
 * here creates a home: a route must never write data just by being visited.
 */
function RoomsRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const homes = loadHomes() ?? [];
    if (homes.length === 0) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    navigate({ to: "/home/$homeId", params: { homeId: loadActiveHomeId(homes) }, replace: true });
  }, [navigate]);

  return null;
}
