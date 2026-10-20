import { createContext, useContext, useEffect, useState } from "react";

/**
 * Theme context — light/dark mode.
 * Persists the user's choice in localStorage under "cg-theme".
 * On first visit (no stored value) it follows the OS preference.
 * A matching blocking script in public/index.html sets the `dark` class
 * on <html> before paint to prevent a flash of the wrong theme.
 */
const ThemeCtx = createContext(null);

const STORAGE_KEY = "cg-theme";

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch (e) {
    /* localStorage unavailable — fall through to OS preference */
  }
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);
  const isDark = theme === "dark";

  // Keep <html> class and localStorage in sync with the chosen theme.
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* ignore write failures (private mode) */
    }
  }, [theme, isDark]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeCtx.Provider value={{ theme, isDark, setTheme, toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
