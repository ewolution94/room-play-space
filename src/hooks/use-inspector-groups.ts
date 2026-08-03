import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "planner-inspector-groups-v1";

/** Every collapsible block in the Inspector, and whether it starts open. */
export const INSPECTOR_GROUP_DEFAULTS = {
  /* Room settings, shown when nothing is selected. */
  size: true,
  height: false,
  walls: false,
  floor: false,
  /* Selected-item settings. */
  itemColor: false,
  itemSize: true,
  itemRotation: false,
} satisfies Record<string, boolean>;

export type InspectorGroupId = keyof typeof INSPECTOR_GROUP_DEFAULTS;

/**
 * Which Inspector groups the user has open, remembered across sessions.
 *
 * Only one group in each mode starts open (the dimensions, in both cases),
 * because that's the whole point -- the panel used to render every control
 * at once and grew tall enough to reach the canvas's back button. Someone
 * who works mostly on flooring can open that once and have it stay open.
 *
 * Read in an effect rather than during render: `localStorage` doesn't exist
 * on the server, and seeding state from it during the first render is the
 * hydration trap documented in docs/LEARNINGS.md. The defaults are the
 * SSR-safe placeholder, and a stored value simply replaces them a tick
 * later -- harmless here, since this is presentation state that nothing
 * else is derived from.
 */
export function useInspectorGroups() {
  const [open, setOpen] = useState<Record<string, boolean>>(INSPECTOR_GROUP_DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          // Merge rather than replace, so a group added in a later release
          // picks up its default instead of being undefined for anyone who
          // already has this key saved.
          setOpen({ ...INSPECTOR_GROUP_DEFAULTS, ...(parsed as Record<string, boolean>) });
        }
      }
    } catch {
      // Unreadable or unparseable -- the defaults are already in place.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(open));
    } catch {
      // Private mode / quota -- collapsing state isn't worth surfacing.
    }
  }, [open, hydrated]);

  const toggle = useCallback((id: InspectorGroupId) => {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const isOpen = useCallback(
    (id: InspectorGroupId) => open[id] ?? INSPECTOR_GROUP_DEFAULTS[id],
    [open],
  );

  return { isOpen, toggle };
}
