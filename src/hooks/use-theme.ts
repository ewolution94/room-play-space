import { useEffect, useLayoutEffect, useState } from "react";

export type Theme = "light" | "dark";

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
  const [theme, setTheme] = useState<Theme>("light");

  useIsomorphicLayoutEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  useIsomorphicLayoutEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
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

  return {
    theme,
    setTheme,
    isDark: theme === "dark",
    toggleTheme: () => setTheme((prev) => (prev === "dark" ? "light" : "dark")),
  };
}
