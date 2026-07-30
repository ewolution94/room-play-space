import { useCallback, useEffect, useState } from "react";
import type { LastActiveTarget, PlannerSettings, UseSettingsReturn } from "@/types/planner";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/lib/settings";

/**
 * Single consolidated settings store (localStorage key planner-settings-v1)
 * -- replaces the scattered/duplicated preference handling that predates
 * this hook (see use-room-planner.ts and rooms.index.tsx's old inline
 * `lang` useStates, now sourced from here instead). Same SSR-safe pattern
 * as useCustomCatalog/useSidebarCollapsed: starts at DEFAULT_SETTINGS
 * (matching what the server rendered), then hydrates from localStorage once
 * mounted, to avoid a hydration mismatch.
 */
export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<PlannerSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setHydrated(true);
  }, []);

  const update = useCallback((patch: Partial<PlannerSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const recordLastActive = useCallback((target: LastActiveTarget) => {
    setSettings((prev) => {
      const next = { ...prev, lastActive: target };
      saveSettings(next);
      return next;
    });
  }, []);

  return { settings, hydrated, update, recordLastActive };
}
