import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSettings } from "@/hooks/use-settings";

export const Route = createFileRoute("/")({
  component: IndexRoute,
});

// Pure entry gate -- renders nothing itself, only ever decides where to
// send you: your last-active room/floor when "quick entry" is on, the
// Dashboard (/dashboard) otherwise. Deliberately never renders Dashboard
// content directly (that's /dashboard's job) so every in-app "back to the
// hub" link can point at a URL that's always exactly the dashboard, never
// subject to this redirect -- see routes/dashboard.tsx.
function IndexRoute() {
  const { settings, hydrated } = useSettings();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for the real localStorage value -- settings is still
    // DEFAULT_SETTINGS (quickEntry: false) before this, which would
    // otherwise always bounce straight to /dashboard even for a user who
    // has quick entry on.
    if (!hydrated) return;

    if (settings.quickEntry && settings.lastActive) {
      if (settings.lastActive.type === "room") {
        navigate({
          to: "/rooms/$roomId",
          params: { roomId: settings.lastActive.roomId },
          replace: true,
        });
      } else {
        navigate({ to: "/rooms", replace: true });
      }
      return;
    }

    navigate({ to: "/dashboard", replace: true });
  }, [hydrated, settings.quickEntry, settings.lastActive, navigate]);

  return null;
}
