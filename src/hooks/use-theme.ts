import { useEffect, useLayoutEffect, useState } from "react";

export type Theme = "light" | "dark";

/**
 * Each theme's --background as hex, for theme-color: the browser chrome
 * around the page and, installed to a home screen, the status bar.
 */
export const THEME_COLOR: Record<Theme, string> = { light: "#ffffff", dark: "#020618" };

// The SSR pass has no window, so the initial render always yields "light"
// -- read the real preference in a layout effect (before paint) instead of
// in the useState initializer, so the client's first render matches the
// server's and hydration doesn't fail with a mismatch.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function readStoredTheme(): Theme {
  const saved = window.localStorage.getItem("planner-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  // `null` until the stored preference has been read. Applying the SSR default
  // before that would save "light" over the user's choice whenever the
  // component mounts twice before its first re-render: the update from the
  // first mount is dropped, and the second mount reads the "light" the first
  // one just wrote (seen in dev, opening a room from the dashboard).
  const [theme, setTheme] = useState<Theme | null>(null);

  useIsomorphicLayoutEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (theme === null) return;
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
    window.localStorage.setItem("planner-theme", theme);
  }, [theme]);

  // Listen to system theme changes if no manual preference is stored
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => {
      const saved = window.localStorage.getItem("planner-theme");
      if (!saved) {
        setTheme(e.matches ? "dark" : "light");
      }
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const current = theme ?? "light";
  return {
    theme: current,
    setTheme: (next: Theme) => setTheme(next),
    isDark: current === "dark",
    toggleTheme: () =>
      setTheme((prev) => ((prev ?? readStoredTheme()) === "dark" ? "light" : "dark")),
  };
}
