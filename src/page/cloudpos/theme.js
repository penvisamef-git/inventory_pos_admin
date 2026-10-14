import { SKIN_SEEDS } from "../theme/themeSeeds";
// POS colours follow the admin web: General settings → System theme (24 themes: forest / ocean / candy / navy + themeSeeds.js).
// The theme comes with the shop data (sync) and is kept on this computer so the screen opens in the right colours.
// POS fonts stay the bundled ones (they work offline).
const KEY = "pos_theme";

const T = (o) => o;
export const POS_THEMES = {
  forest: T({
    "--pos-green": "#1f7a4d", "--pos-green-dark": "#14532d", "--pos-green-light": "#2a8a57", "--pos-green-soft": "#e7f3ec", "--pos-mint": "#b9dcc8", "--pos-rgb": "31, 122, 77",
    "--pos-gold": "#f59e0b", "--pos-gold-soft": "#fff4dd", "--pos-gold-rgb": "245, 158, 11", "--pos-gold-line": "#e7b766", "--pos-gold-text": "#8a5a00", "--pos-gold-bright": "#ffd27a",
    "--pos-bg": "#eef1ef", "--pos-line": "#e3e8e5", "--pos-text": "#18221d", "--pos-muted": "#66706b", "--pos-soft": "#fafbfa", "--pos-soft2": "#f3f6f4",
    "--pos-on-dark": "#d4f5e2", "--pos-shadow-rgb": "16, 40, 28", "--pos-radius": "16px",
  }),
  ocean: T({
    "--pos-green": "#1d64d8", "--pos-green-dark": "#1748a6", "--pos-green-light": "#2d74e6", "--pos-green-soft": "#e8f0fd", "--pos-mint": "#bcd5fa", "--pos-rgb": "29, 100, 216",
    "--pos-gold": "#f59e0b", "--pos-gold-soft": "#fff6e5", "--pos-gold-rgb": "245, 158, 11", "--pos-gold-line": "#f2c46b", "--pos-gold-text": "#8a5a00", "--pos-gold-bright": "#fcd34d",
    "--pos-bg": "#e9edf3", "--pos-line": "#e2e7ef", "--pos-text": "#172033", "--pos-muted": "#5b6576", "--pos-soft": "#f6f8fb", "--pos-soft2": "#f1f4f9",
    "--pos-on-dark": "#dbe8fd", "--pos-shadow-rgb": "15, 35, 70", "--pos-radius": "10px",
  }),
  candy: T({
    "--pos-green": "#c2417f", "--pos-green-dark": "#8f2b5c", "--pos-green-light": "#e0609c", "--pos-green-soft": "#fdeaf3", "--pos-mint": "#f7c3dc", "--pos-rgb": "194, 65, 127",
    "--pos-gold": "#8b5cf6", "--pos-gold-soft": "#f1ecff", "--pos-gold-rgb": "139, 92, 246", "--pos-gold-line": "#c4b5fd", "--pos-gold-text": "#5b21b6", "--pos-gold-bright": "#e9d5ff",
    "--pos-bg": "#f4ecf4", "--pos-line": "#f1e3ef", "--pos-text": "#2a1f2b", "--pos-muted": "#7a6479", "--pos-soft": "#fdf8fc", "--pos-soft2": "#faf1f7",
    "--pos-on-dark": "#fde4f0", "--pos-shadow-rgb": "120, 40, 100", "--pos-radius": "20px",
  }),
  navy: T({
    "--pos-green": "#1f3a63", "--pos-green-dark": "#132843", "--pos-green-light": "#2a4a7a", "--pos-green-soft": "#e9eef5", "--pos-mint": "#c9d5e6", "--pos-rgb": "31, 58, 99",
    "--pos-gold": "#c9962b", "--pos-gold-soft": "#fbf3e2", "--pos-gold-rgb": "201, 150, 43", "--pos-gold-line": "#e8c77a", "--pos-gold-text": "#7a5a12", "--pos-gold-bright": "#e8c77a",
    "--pos-bg": "#eceef2", "--pos-line": "#e3e7ed", "--pos-text": "#16202e", "--pos-muted": "#5d6878", "--pos-soft": "#f7f8fa", "--pos-soft2": "#f2f4f7",
    "--pos-on-dark": "#e8c77a", "--pos-shadow-rgb": "10, 20, 40", "--pos-radius": "12px",
  }),
};

// ---- the other system themes, made from the same seeds as the admin web ----
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => "#" + hexRgb(a).map((v, i) => Math.round(v + (hexRgb(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");
const rgb = (h) => hexRgb(h).join(", ");
const RADIUS = { flat: 9, dark: 11, soft: 16, playful: 20 };
SKIN_SEEDS.forEach(({ key, p, a, look }) => {
  const deep = mix(p, "#000000", 0.55);
  POS_THEMES[key] = {
    "--pos-green": p, "--pos-green-dark": mix(p, "#000000", 0.3), "--pos-green-light": mix(p, "#ffffff", 0.12), "--pos-green-soft": mix(p, "#ffffff", 0.9), "--pos-mint": mix(p, "#ffffff", 0.65), "--pos-rgb": rgb(p),
    "--pos-gold": a, "--pos-gold-soft": mix(a, "#ffffff", 0.88), "--pos-gold-rgb": rgb(a), "--pos-gold-line": mix(a, "#ffffff", 0.45), "--pos-gold-text": mix(a, "#000000", 0.45), "--pos-gold-bright": mix(a, "#ffffff", 0.5),
    "--pos-bg": mix("#eceeef", p, 0.06), "--pos-line": mix("#e5e7ea", p, 0.06), "--pos-text": mix("#1a1d21", p, 0.12), "--pos-muted": mix("#646b72", p, 0.12), "--pos-soft": mix("#f8f9f9", p, 0.03), "--pos-soft2": mix("#f4f5f6", p, 0.04),
    "--pos-on-dark": mix(p, "#ffffff", 0.85), "--pos-shadow-rgb": rgb(deep), "--pos-radius": `${Math.round(Math.min(Math.max(RADIUS[look] || 16, 8), 22) * 1)}px`,
  };
});

// Colours a cashier may pick for himself (menu → My colours). Saved per cashier on this computer;
// "" = follow the shop (the theme chosen in the admin web).
export const CASHIER_THEMES = [
  { key: "forest", kh: "ព្រៃបៃតង", en: "Forest" },
  { key: "emerald", kh: "មរកត", en: "Emerald" },
  { key: "jungle", kh: "ព្រៃព្រឹក្សា", en: "Jungle" },
  { key: "lagoon", kh: "បឹងទឹកថ្លា", en: "Lagoon" },
  { key: "arctic", kh: "ទឹកកក", en: "Arctic" },
  { key: "sky", kh: "មេឃ", en: "Sky" },
  { key: "ocean", kh: "សមុទ្រ", en: "Ocean" },
  { key: "indigo", kh: "ខៀវឥណ្ឌិ", en: "Indigo" },
  { key: "navy", kh: "ខៀវចាស់ & មាស", en: "Navy & Gold" },
  { key: "royal", kh: "រាជវង្ស", en: "Royal" },
  { key: "lavender", kh: "ឡាវេនឌ័រ", en: "Lavender" },
  { key: "grape", kh: "ទំពាំងបាយជូ", en: "Grape" },
  { key: "candy", kh: "ស្ករគ្រាប់", en: "Candy" },
  { key: "bubblegum", kh: "ស្ករកៅស៊ូ", en: "Bubblegum" },
  { key: "rose", kh: "ផ្កាកុលាប", en: "Rose" },
  { key: "cherry", kh: "ឈើរី", en: "Cherry" },
  { key: "coral", kh: "ផ្កាថ្មសមុទ្រ", en: "Coral" },
  { key: "sunset", kh: "ថ្ងៃលិច", en: "Sunset" },
  { key: "honey", kh: "ទឹកឃ្មុំ", en: "Honey" },
  { key: "mocha", kh: "កាហ្វេ", en: "Mocha" },
  { key: "charcoal", kh: "ធ្យូង", en: "Charcoal" },
].filter((t) => POS_THEMES[t.key]);

let current = ""; // colours on screen now
let shopKey = "forest"; // from the admin web
let userId = null; // cashier logged in
const userKeyOf = (id) => `pos_theme_user_${id}`;
const readUserTheme = (id) => {
  if (!id) return "";
  try {
    const k = localStorage.getItem(userKeyOf(id)) || "";
    return POS_THEMES[k] ? k : "";
  } catch {
    return "";
  }
};

// the shop's theme (admin web) — what currentTheme() / "theme updated" compare with
export const currentTheme = () => shopKey;
export const userTheme = () => readUserTheme(userId);

const listeners = new Set();
// colours on screen changed (cashier picked his own / logged in / out) → e.g. tell the customer display
export const onScreenTheme = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const screenTheme = () => current;

function paint(key) {
  const k = POS_THEMES[key] ? key : "forest";
  if (k === current) return;
  current = k;
  listeners.forEach((fn) => fn(k));
  const root = document.documentElement;
  Object.entries(POS_THEMES[k]).forEach(([n, v]) => root.style.setProperty(n, v));
  root.dataset.posTheme = k;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", POS_THEMES[k]["--pos-green"]);
}
const repaint = () => paint(readUserTheme(userId) || shopKey);

// the admin web's theme (comes with the sync)
export function applyTheme(key) {
  shopKey = POS_THEMES[key] ? key : "forest";
  try {
    localStorage.setItem(KEY, shopKey);
  } catch {
    // storage blocked → default next time
  }
  repaint();
}

// who is logged in (null = nobody → the shop's colours)
export function setThemeUser(id) {
  userId = id ? String(id) : null;
  repaint();
}

// the cashier picks his own colours ("" = follow the shop)
export function chooseUserTheme(key) {
  if (!userId) return;
  try {
    if (key && POS_THEMES[key]) localStorage.setItem(userKeyOf(userId), key);
    else localStorage.removeItem(userKeyOf(userId));
  } catch {
    // storage blocked → until reload
  }
  paint((key && POS_THEMES[key] && key) || shopKey);
}

// customer display: show the colours the POS screen uses now (sent with every display message)
export function showTheme(key) {
  if (POS_THEMES[key]) paint(key);
}

// at start: the last shop theme used on this computer (no flash of green)
let saved = "forest";
try {
  saved = localStorage.getItem(KEY) || "forest";
} catch {
  // ignore
}
applyTheme(saved);
