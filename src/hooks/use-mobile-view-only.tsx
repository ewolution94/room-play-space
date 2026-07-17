import { useEffect, useState } from "react";

/**
 * Anything narrower than this (in either orientation -- see below) gets the
 * stripped-down mobile "view only" canvas experience instead of the full
 * desktop editor chrome. Matches the app's existing `lg` Tailwind breakpoint
 * (1024px), which is already the one place the app collapses its two-column
 * sidebar+canvas layout down to a single stacked column -- so this hook just
 * extends that same cutoff into JS-driven behavior (hiding tools, floating
 * panels becoming bottom sheets, etc.) instead of introducing a second,
 * inconsistent breakpoint.
 *
 * Deliberately just `innerWidth`, not `Math.min(innerWidth, innerHeight)`:
 * no real phone's landscape width gets anywhere near 1024px (the largest
 * mainstream phones top out around ~930px landscape), so a plain width
 * check already keeps a phone in view-only mode in both orientations --
 * rotating to landscape only ever gives you more canvas room, it never
 * exits view-only mode (which is the point of the "rotate hint" -- it's
 * suggesting a better view, not a different mode).
 */
const VIEW_ONLY_BREAKPOINT = 1024;

export interface MobileViewOnlyState {
  /** True below the view-only breakpoint, in either orientation. */
  isMobileViewOnly: boolean;
  /** True when the viewport is taller than it is wide -- drives the
   * "rotate to landscape" hint, independent of isMobileViewOnly itself. */
  isPortrait: boolean;
}

function readState(): MobileViewOnlyState {
  return {
    isMobileViewOnly: window.innerWidth < VIEW_ONLY_BREAKPOINT,
    isPortrait: window.innerHeight > window.innerWidth,
  };
}

// This app is server-rendered (TanStack Start) and hydrated on the client.
// The initializer below deliberately does NOT read `window` -- it always
// starts as { isMobileViewOnly: false, isPortrait: false }, matching what
// the server rendered (which has no viewport to measure), even though
// `window` is already available by the time this runs on the client. If it
// read the real viewport here instead, a mobile-sized client would render
// different HTML on its very first (hydration) pass than the server did --
// e.g. the Sidebar present in the server markup but absent client-side --
// and React would throw a hydration mismatch error and re-render the whole
// tree from scratch (see src/hooks/use-mobile.tsx for the same pattern
// already established elsewhere in this app). The real value is applied a
// moment later inside the effect below, which only ever runs client-side,
// after hydration has already completed.
export function useMobileViewOnly(): MobileViewOnlyState {
  const [state, setState] = useState<MobileViewOnlyState>({
    isMobileViewOnly: false,
    isPortrait: false,
  });

  useEffect(() => {
    const update = () => setState(readState());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return state;
}
