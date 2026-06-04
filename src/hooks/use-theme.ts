import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const saved = window.localStorage.getItem("planner-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
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
    if (typeof window === "undefined") return;
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
