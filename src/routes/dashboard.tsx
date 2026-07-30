import { createFileRoute } from "@tanstack/react-router";
import { useSettings } from "@/hooks/use-settings";
import { useTheme } from "@/hooks/use-theme";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const Route = createFileRoute("/dashboard")({
  component: DashboardRoute,
});

// The Dashboard's own stable, always-reachable home -- every in-app "back
// to the hub" link (Header.tsx's More menu, rooms.index.tsx's top link)
// points here specifically, never at "/", because "/" is a redirect gate
// (see routes/index.tsx) that can send you straight into a room when
// "quick entry" is on. This route never redirects: visiting it always
// shows the dashboard, full stop.
function DashboardRoute() {
  const { settings, update: updateSettings } = useSettings();
  const { theme, toggleTheme } = useTheme();

  return (
    <Dashboard
      settings={settings}
      updateSettings={updateSettings}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  );
}
