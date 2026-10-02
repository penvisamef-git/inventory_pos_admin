// color.script.js — applies the current theme (skin) + light / dark mode as CSS variables
import { getPrefs, savePrefs } from "../../../i18n";
import { themeColors } from "./color.script.palette";
import { SKINS, DEFAULT_SKIN } from "../themes";

export { themeColors, darkColors } from "./color.script.palette";

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

// ================= Theme (skin) — chosen by the admin for everyone =================
// Kept in this browser so the right look shows at once (also on the login page);
// refreshed from the server (GET /setup/theme) on every app start.
const SKIN_KEY = "inventory_pos_skin";
export function currentSkin() {
  try {
    const k = localStorage.getItem(SKIN_KEY);
    return SKINS[k] ? k : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

const loadedFonts = new Set();
function loadFont(url) {
  if (!url || loadedFonts.has(url)) return;
  loadedFonts.add(url);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

export function applyMode(mode = getPrefs().theme, skinKey = currentSkin()) {
  const theme = resolvedTheme(mode);
  const skin = SKINS[skinKey] || SKINS[DEFAULT_SKIN];
  applyTheme(theme === "dark" ? skin.dark : skin.light);
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.skin = skin.key;
  root.style.colorScheme = theme;
  // shape + fonts
  root.style.setProperty("--ui-radius", String(skin.radius));
  const stack = `"${skin.fontName}", "Kantumruy Pro", "Khmer OS Siem Reap", system-ui, sans-serif`;
  ["--font-body", "--font-title", "--font-brand"].forEach((v) => root.style.setProperty(v, stack));
  loadFont(skin.fontUrl);
}

// admin picked a theme (or the server told us) → save in this browser + apply now
export function setSkin(skinKey) {
  const key = SKINS[skinKey] ? skinKey : DEFAULT_SKIN;
  try {
    localStorage.setItem(SKIN_KEY, key);
  } catch {
    // storage blocked → applies until reload
  }
  applyMode(getPrefs().theme, key);
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
