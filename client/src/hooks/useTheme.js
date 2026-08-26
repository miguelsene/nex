import { useCallback, useEffect, useState } from "react";

export const THEMES = [
  {
    id: "rosa",
    dot: "#ffb2c7",
    vars: {
      "--accent-violet": "#d990a5",
      "--accent-violet-strong": "#b46e83",
      "--accent-cyan": "#ffb2c7",
      "--accent-pink": "#8e4b60",
      "--gradient-aurora": "linear-gradient(135deg, #d990a5 0%, #b46e83 40%, #ffb2c7 100%)",
      "--gradient-aurora-soft": "linear-gradient(135deg, rgba(217,144,165,0.35), rgba(255,178,199,0.25))",
      "--shadow-glow-violet": "0 0 40px rgba(217,144,165,0.4)",
      "--shadow-glow-cyan": "0 0 40px rgba(255,178,199,0.3)",
    },
  },
  {
    id: "vermelho",
    dot: "#fa1e0c",
    vars: {
      "--accent-violet": "#ce1709",
      "--accent-violet-strong": "#a30f06",
      "--accent-cyan": "#fa1e0c",
      "--accent-pink": "#770803",
      "--gradient-aurora": "linear-gradient(135deg, #ce1709 0%, #a30f06 40%, #fa1e0c 100%)",
      "--gradient-aurora-soft": "linear-gradient(135deg, rgba(206,23,9,0.35), rgba(250,30,12,0.25))",
      "--shadow-glow-violet": "0 0 40px rgba(206,23,9,0.4)",
      "--shadow-glow-cyan": "0 0 40px rgba(250,30,12,0.3)",
    },
  },
  {
    id: "azul",
    dot: "#afb2ed",
    vars: {
      "--accent-violet": "#868cc4",
      "--accent-violet-strong": "#5c679b",
      "--accent-cyan": "#afb2ed",
      "--accent-pink": "#334172",
      "--gradient-aurora": "linear-gradient(135deg, #5c679b 0%, #868cc4 40%, #afb2ed 100%)",
      "--gradient-aurora-soft": "linear-gradient(135deg, rgba(134,140,196,0.35), rgba(175,178,237,0.25))",
      "--shadow-glow-violet": "0 0 40px rgba(134,140,196,0.4)",
      "--shadow-glow-cyan": "0 0 40px rgba(175,178,237,0.3)",
    },
  },
  {
    id: "dourado",
    dot: "#ffdc68",
    vars: {
      "--accent-violet": "#cc982a",
      "--accent-violet-strong": "#a7321c",
      "--accent-cyan": "#ffdc68",
      "--accent-pink": "#928941",
      "--gradient-aurora": "linear-gradient(135deg, #a7321c 0%, #cc982a 40%, #ffdc68 100%)",
      "--gradient-aurora-soft": "linear-gradient(135deg, rgba(204,152,42,0.35), rgba(255,220,104,0.25))",
      "--shadow-glow-violet": "0 0 40px rgba(204,152,42,0.4)",
      "--shadow-glow-cyan": "0 0 40px rgba(255,220,104,0.3)",
    },
  },
];

const STORAGE_KEY = "nexa_theme";

function applyTheme(theme) {
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

function clearTheme() {
  const root = document.documentElement;
  THEMES[0].vars && Object.keys(THEMES[0].vars).forEach((k) => root.style.removeProperty(k));
}

export function useTheme() {
  const [activeId, setActiveId] = useState(() => localStorage.getItem(STORAGE_KEY) || null);

  useEffect(() => {
    if (activeId) {
      const theme = THEMES.find((t) => t.id === activeId);
      if (theme) applyTheme(theme);
    }
  }, []);

  const setTheme = useCallback((id) => {
    if (id === activeId) {
      // Toggle off — volta ao padrão
      clearTheme();
      localStorage.removeItem(STORAGE_KEY);
      setActiveId(null);
      return;
    }
    const theme = THEMES.find((t) => t.id === id);
    if (!theme) return;
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, id);
    setActiveId(id);
  }, [activeId]);

  return { activeId, setTheme };
}
