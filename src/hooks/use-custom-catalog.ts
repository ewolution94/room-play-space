import { useCallback, useEffect, useState } from "react";
import type { CustomCatalogItem, UseCustomCatalogReturn } from "@/types/planner";
import {
  createCustomCatalogItem,
  loadCustomCatalog,
  saveCustomCatalog,
} from "@/lib/custom-catalog";

/**
 * Owns the user's "My Own Catalog" list: loads it once on mount and keeps
 * every mutation persisted to localStorage (see lib/custom-catalog.ts).
 * Called once per route (routes/index.tsx, routes/rooms.$roomId.tsx) and
 * threaded down as a prop to both Sidebar (MyCatalogSection's list) and
 * CanvasArea (InspectorSection's "Save to My Catalog" action) -- those two
 * are siblings, not nested, so the route is the lowest common place a single
 * shared instance can live. See SidebarProps/CanvasAreaProps' own doc
 * comments in types/planner.ts for the fuller reasoning.
 */
export function useCustomCatalog(): UseCustomCatalogReturn {
  const [items, setItems] = useState<CustomCatalogItem[]>([]);

  // Client-only load, same SSR-hydration-safe pattern as useMobileViewOnly
  // (see that hook's doc comment): starts empty, matching what the server
  // rendered (no localStorage there), then fills in once mounted.
  useEffect(() => {
    setItems(loadCustomCatalog());
  }, []);

  const addItem = useCallback((draft: Omit<CustomCatalogItem, "id" | "createdAt">) => {
    const created = createCustomCatalogItem(draft);
    setItems((prev) => {
      const next = [...prev, created];
      saveCustomCatalog(next);
      return next;
    });
    return created;
  }, []);

  const updateItem = useCallback(
    (id: string, patch: Partial<Omit<CustomCatalogItem, "id" | "createdAt">>) => {
      setItems((prev) => {
        const next = prev.map((it) => (it.id === id ? { ...it, ...patch } : it));
        saveCustomCatalog(next);
        return next;
      });
    },
    [],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== id);
      saveCustomCatalog(next);
      return next;
    });
  }, []);

  const replaceAll = useCallback((next: CustomCatalogItem[]) => {
    setItems(next);
    saveCustomCatalog(next);
  }, []);

  return { items, addItem, updateItem, removeItem, replaceAll };
}
