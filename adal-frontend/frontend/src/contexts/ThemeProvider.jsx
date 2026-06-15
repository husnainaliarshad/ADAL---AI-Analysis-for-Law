import React, { useEffect, useMemo, useState } from "react";
import { ThemeProvider as MuiThemeProvider, CssBaseline } from "@mui/material";
import { ThemeContext } from "./ThemeContext";
import { getMuiTheme } from "../styles/muiTheme";

const syncFavicons = (mode) => {
  const iconHref = mode === "dark" ? "/adal-icon.svg" : "/adal-icon-light.svg";

  document.getElementById("app-favicon")?.setAttribute("href", iconHref);
  document.getElementById("app-apple-touch-icon")?.setAttribute("href", iconHref);
};

export default function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  const muiTheme = useMemo(() => {
    // Ensure CSS variables reflect the selected mode BEFORE creating the theme
    document.documentElement.setAttribute("data-theme", mode);
    try {
      localStorage.setItem("theme", mode);
    } catch {
      // ignore write failures (private mode, etc.)
    }
    return getMuiTheme();
  }, [mode]);

  useEffect(() => {
    syncFavicons(mode);
  }, [mode]);

  const toggleTheme = () =>
    setMode((prev) => (prev === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
