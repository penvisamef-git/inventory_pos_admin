// color.script.js
import { getPrefs, savePrefs } from "../../../i18n";

// All color configurations for the theme — Inventory POS "forest" style:
// soft green-grey canvas, white rounded cards, deep forest green accent.
// Every value becomes a CSS variable: --color-<group>-<key>  (e.g. --color-primary-main)

export const themeColors = {
  // Primary (forest green)
  primary: {
    main: "#1f7a4d",
    light: "#3fa66f",
    dark: "#14532d",
    deep: "#0d3b22",
    soft: "#e7f3ec",
    mint: "#9fd8b5",
  },

  // Warm accent (kept under "gold" so existing pages keep working)
  gold: {
    main: "#f59e0b",
    light: "#fcd34d",
    bright: "#fbbf24",
    soft: "#fff6e5",
    text: "#1b2420",
  },

  // Background colors
  background: {
    app: "#e9ece9",
    sidebar: "#f6f7f6",
    main: "#f6f7f6",
    card: "#ffffff",
    soft: "#f3f5f4",
    input: "#ffffff",
    overlay: "rgba(13, 30, 21, 0.45)",
  },

  // Text colors
  text: {
    primary: "#1b2420",
    secondary: "#66706b",
    dark: "#1b2420",
    light: "#8b948f",
    white: "#ffffff",
    muted: "#9aa39e",
    cream: "#ffffff",
  },

  // Border colors
  border: {
    light: "#e6e9e7",
    strong: "#d5dad7",
    dashed: "#1f7a4d",
  },

  // Hover colors
  hover: {
    sidebar: "#eef3ef",
    submenu: "#eef3ef",
    logout: "#14532d",
    text: "#1f7a4d",
  },

  // Active colors
  active: {
    background: "#1f7a4d",
    text: "#ffffff",
    sidebar: "#ffffff",
    textColor: "#14532d",
  },

  // Menu colors
  menu: {
    group: "#66706b",
    hover: "#eef3ef",
    hoverText: "#14532d",
    open: "#eef3ef",
    openText: "#14532d",
    submenu: "#66706b",
    submenuHover: "#eef3ef",
    submenuHoverText: "#14532d",
    submenuActiveBg: "#ffffff",
    submenuActiveText: "#14532d",
  },

  // Button colors
  button: {
    logoutBg: "#eef3ef",
    logoutHover: "#1f7a4d",
    text: "#1f7a4d",
  },

  // Gradients (highlight cards, primary buttons)
  gradient: {
    primary: "linear-gradient(135deg, #2f8f5b 0%, #1f7a4d 45%, #0d3b22 100%)",
    button: "linear-gradient(180deg, #2a8a57 0%, #14532d 100%)",
  },

  // Shadow colors
  shadow: {
    default: "rgba(13, 30, 21, 0.08)",
    light: "rgba(13, 30, 21, 0.04)",
  },
};


// Dark palette — same keys as themeColors ("forest night")
export const darkColors = {
  primary: { main: "#3fa66f", light: "#6cc893", dark: "#8fd3ab", deep: "#0d3b22", soft: "#1a3426", mint: "#9fd8b5" },
  gold: { main: "#f5b544", light: "#fcd34d", bright: "#fbbf24", soft: "#3a2f16", text: "#f3efe4" },
  background: {
    app: "#0a0f0c",
    sidebar: "#111915",
    main: "#111915",
    card: "#18221d",
    soft: "#1d2923",
    input: "#141d18",
    overlay: "rgba(0, 0, 0, 0.6)",
  },
  text: {
    primary: "#e6ece8",
    secondary: "#a3b0a9",
    dark: "#e6ece8",
    light: "#7f8c85",
    white: "#ffffff",
    muted: "#6f7c75",
    cream: "#ffffff",
  },
  border: { light: "#26332c", strong: "#33433a", dashed: "#3fa66f" },
  hover: { sidebar: "#1b2721", submenu: "#1b2721", logout: "#8fd3ab", text: "#8fd3ab" },
  active: { background: "#3fa66f", text: "#ffffff", sidebar: "#18221d", textColor: "#e6ece8" },
  menu: {
    group: "#a3b0a9",
    hover: "#1b2721",
    hoverText: "#e6ece8",
    open: "#1b2721",
    openText: "#e6ece8",
    submenu: "#a3b0a9",
    submenuHover: "#1b2721",
    submenuHoverText: "#e6ece8",
    submenuActiveBg: "#18221d",
    submenuActiveText: "#e6ece8",
  },
  button: { logoutBg: "#1b2721", logoutHover: "#3fa66f", text: "#8fd3ab" },
  gradient: {
    primary: "linear-gradient(135deg, #2a8a57 0%, #1a6b42 45%, #0b2f1c 100%)",
    button: "linear-gradient(180deg, #3a9a65 0%, #1a6b42 100%)",
  },
  shadow: { default: "rgba(0, 0, 0, 0.35)", light: "rgba(0, 0, 0, 0.2)" },
};

// Function to apply theme colors to CSS variables
export const applyTheme = (colors = themeColors) => {
  const root = document.documentElement;

  Object.entries(colors).forEach(([category, values]) => {
    Object.entries(values).forEach(([key, value]) => {
      root.style.setProperty(`--color-${category}-${key}`, value);
    });
  });
};

// ================= Light / dark / system =================
const media = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

// "light" | "dark" for a saved mode ("light" | "dark" | "system")
export function resolvedTheme(mode = getPrefs().theme) {
  if (mode === "system") return media && media.matches ? "dark" : "light";
  return mode === "dark" ? "dark" : "light";
}

export function applyMode(mode = getPrefs().theme) {
  const theme = resolvedTheme(mode);
  applyTheme(theme === "dark" ? darkColors : themeColors);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

// Save + apply at once (no reload needed)
export function setThemeMode(mode) {
  savePrefs({ theme: mode });
  applyMode(mode);
}

// follow the OS while the mode is "system"
if (media) {
  const onChange = () => getPrefs().theme === "system" && applyMode("system");
  if (media.addEventListener) media.addEventListener("change", onChange);
  else if (media.addListener) media.addListener(onChange);
}

// Auto-apply on import
applyMode();

export default themeColors;
