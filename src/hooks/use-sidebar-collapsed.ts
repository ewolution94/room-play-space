import { useEffect, useState } from "react";

const STORAGE_KEY = "planner-sidebar-collapsed";

/**
 * Manual collapse toggle for the main Sidebar/MultiRoomSidebar -- independent
 * of useMobileViewOnly's automatic <1024px cutoff, this is for someone on a
 * merely narrow-ish desktop/laptop window who wants to reclaim canvas space
 * without dropping into the stripped-down mobile view-only experience.
 *
 * Same SSR-safe pattern as useMobileViewOnly: starts false (matching the
 * server's no-localStorage default) and only reads the real persisted value
 * client-side, inside the effect below, to avoid a hydration mismatch.
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return { collapsed, toggle };
}
