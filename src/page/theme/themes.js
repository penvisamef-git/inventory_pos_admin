// ============================================================
// Themes (skins) for the whole admin web + shop portal.
// The admin picks one in General settings (saved on the server, same for everyone);
// light / dark stays each user's own choice, so every theme has both palettes.
//
// A theme = palette (CSS variables --color-<group>-<key>) + shape (--ui-radius scale)
//         + fonts (--font-*) + a few look tweaks in themes.css ([data-skin="…"]).
// Add a theme: copy one block below, change the values, add its key to UI_THEMES
// in inventory_pos_api/src/v1/admin/setup/setting/setting.model.js.
// ============================================================
import { themeColors, darkColors } from "./default/color.script.palette";

// helper: the same structure for every palette (keys must match color.script.palette.js)
const palette = ({ p, accent, bg, text, border, shadow, gradient, dark }) => ({
  primary: { main: p.main, light: p.light, dark: p.dark, deep: p.deep, soft: p.soft, mint: p.mint, rgb: p.rgb },
  gold: accent,
  background: bg,
  text,
  border: { light: border.light, strong: border.strong, dashed: p.main },
  hover: { sidebar: p.hover, submenu: p.hover, logout: p.dark, text: dark ? p.dark : p.main },
  active: { background: p.main, text: "#ffffff", sidebar: bg.card, textColor: dark ? text.primary : p.dark },
  menu: {
    group: text.secondary,
    hover: p.hover,
    hoverText: dark ? text.primary : p.dark,
    open: p.hover,
    openText: dark ? text.primary : p.dark,
    submenu: text.secondary,
    submenuHover: p.hover,
    submenuHoverText: dark ? text.primary : p.dark,
    submenuActiveBg: bg.card,
    submenuActiveText: dark ? text.primary : p.dark,
  },
  button: { logoutBg: p.hover, logoutHover: p.main, text: dark ? p.dark : p.main },
  gradient,
  shadow,
});

export const SKINS = {
  // ---------------- Forest (original) ----------------
  forest: {
    key: "forest",
    name_kh: "ព្រៃបៃតង",
    name_en: "Forest",
    desc_kh: "បៃតងស្រាល កាតពណ៌ស ជ្រុងមូល",
    desc_en: "Soft green, white rounded cards",
    fontName: "Plus Jakarta Sans",
    fontUrl: null, // already in index.css
    radius: 1,
    light: themeColors,
    dark: darkColors,
  },

  // ---------------- Ocean (corporate blue) ----------------
  ocean: {
    key: "ocean",
    name_kh: "សមុទ្រ",
    name_en: "Ocean",
    desc_kh: "ពណ៌ខៀវ ស្អាត បែបក្រុមហ៊ុន",
    desc_en: "Clean corporate blue, sharper corners",
    fontName: "Inter",
    fontUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400..800&display=swap",
    radius: 0.55,
    light: palette({
      p: { main: "#1d64d8", light: "#4c8df0", dark: "#1748a6", deep: "#0f2f6b", soft: "#e8f0fd", mint: "#bcd5fa", rgb: "29, 100, 216", hover: "#edf3fd" },
      accent: { main: "#f59e0b", light: "#fcd34d", bright: "#fbbf24", soft: "#fff6e5", text: "#172033" },
      bg: { app: "#e9edf3", sidebar: "#f6f8fb", main: "#f6f8fb", card: "#ffffff", soft: "#f1f4f9", input: "#ffffff", overlay: "rgba(12, 24, 48, 0.45)" },
      text: { primary: "#172033", secondary: "#5b6576", dark: "#172033", light: "#8a93a3", white: "#ffffff", muted: "#9aa2b1", cream: "#ffffff" },
      border: { light: "#e2e7ef", strong: "#cfd7e3" },
      gradient: {
        primary: "linear-gradient(135deg, #3b82f6 0%, #1d64d8 45%, #0f2f6b 100%)",
        button: "linear-gradient(180deg, #2d74e6 0%, #1748a6 100%)",
      },
      shadow: { default: "rgba(15, 35, 70, 0.08)", light: "rgba(15, 35, 70, 0.04)" },
    }),
    dark: palette({
      dark: true,
      p: { main: "#4c8df0", light: "#7aaaf5", dark: "#a9c8f7", deep: "#0f2f6b", soft: "#162a4a", mint: "#a9c8f7", rgb: "76, 141, 240", hover: "#16233a" },
      accent: { main: "#f5b544", light: "#fcd34d", bright: "#fbbf24", soft: "#3a2f16", text: "#eef2f8" },
      bg: { app: "#080d16", sidebar: "#0e1522", main: "#0e1522", card: "#151e2e", soft: "#1a2537", input: "#111a28", overlay: "rgba(0, 0, 0, 0.6)" },
      text: { primary: "#e6ecf5", secondary: "#a0acc0", dark: "#e6ecf5", light: "#7c889c", white: "#ffffff", muted: "#6c7890", cream: "#ffffff" },
      border: { light: "#232f44", strong: "#2f3d56" },
      gradient: {
        primary: "linear-gradient(135deg, #2d6fd6 0%, #1a4fa8 45%, #0b2350 100%)",
        button: "linear-gradient(180deg, #3d80ea 0%, #1a4fa8 100%)",
      },
      shadow: { default: "rgba(0, 0, 0, 0.35)", light: "rgba(0, 0, 0, 0.2)" },
    }),
  },

  // ---------------- Candy (kids pastel) ----------------
  candy: {
    key: "candy",
    name_kh: "ស្ករគ្រាប់",
    name_en: "Candy",
    desc_kh: "ពណ៌ផ្កាឈូក-ស្វាយ ទន់ៗ សម្រាប់ហាងកុមារ",
    desc_en: "Playful pink & purple pastels, extra round",
    fontName: "Nunito",
    fontUrl: "https://fonts.googleapis.com/css2?family=Nunito:wght@400..800&display=swap",
    radius: 1.35,
    light: palette({
      p: { main: "#c2417f", light: "#e070a8", dark: "#8f2b5c", deep: "#5a1a3b", soft: "#fdeaf3", mint: "#f7c3dc", rgb: "194, 65, 127", hover: "#fbeff5" },
      accent: { main: "#8b5cf6", light: "#c4b5fd", bright: "#a78bfa", soft: "#f1ecff", text: "#2a1f2b" },
      bg: { app: "#f4ecf4", sidebar: "#fdf8fc", main: "#fdf8fc", card: "#ffffff", soft: "#faf1f7", input: "#ffffff", overlay: "rgba(45, 18, 40, 0.42)" },
      text: { primary: "#2a1f2b", secondary: "#7a6479", dark: "#2a1f2b", light: "#a08c9f", white: "#ffffff", muted: "#b09cae", cream: "#ffffff" },
      border: { light: "#f1e3ef", strong: "#e5cfe2" },
      gradient: {
        primary: "linear-gradient(135deg, #f472b6 0%, #c2417f 50%, #7c3aed 100%)",
        button: "linear-gradient(180deg, #e0609c 0%, #a3336a 100%)",
      },
      shadow: { default: "rgba(120, 40, 100, 0.09)", light: "rgba(120, 40, 100, 0.05)" },
    }),
    dark: palette({
      dark: true,
      p: { main: "#e070a8", light: "#f19cc6", dark: "#f7c3dc", deep: "#5a1a3b", soft: "#3a1a2c", mint: "#f7c3dc", rgb: "224, 112, 168", hover: "#2a1823" },
      accent: { main: "#a78bfa", light: "#c4b5fd", bright: "#a78bfa", soft: "#2a2145", text: "#f6eef5" },
      bg: { app: "#100a10", sidebar: "#181018", main: "#181018", card: "#211621", soft: "#291b28", input: "#1b121b", overlay: "rgba(0, 0, 0, 0.6)" },
      text: { primary: "#f3e8f1", secondary: "#c0a9bd", dark: "#f3e8f1", light: "#927c8f", white: "#ffffff", muted: "#806b7d", cream: "#ffffff" },
      border: { light: "#33222f", strong: "#42303f" },
      gradient: {
        primary: "linear-gradient(135deg, #d9578f 0%, #a3336a 50%, #5b2bb5 100%)",
        button: "linear-gradient(180deg, #e070a8 0%, #a3336a 100%)",
      },
      shadow: { default: "rgba(0, 0, 0, 0.38)", light: "rgba(0, 0, 0, 0.22)" },
    }),
  },

  // ---------------- Navy & gold (premium) ----------------
  navy: {
    key: "navy",
    name_kh: "ខៀវចាស់ & មាស",
    name_en: "Navy & Gold",
    desc_kh: "ម៉ឺនុយខៀវចាស់ ពណ៌មាស បែបប្រណីត",
    desc_en: "Navy sidebar, gold accents, premium look",
    fontName: "Manrope",
    fontUrl: "https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&display=swap",
    radius: 0.7,
    light: palette({
      p: { main: "#1f3a63", light: "#3b5f93", dark: "#132843", deep: "#0b1a2e", soft: "#e9eef5", mint: "#e8c77a", rgb: "31, 58, 99", hover: "#eef2f7" },
      accent: { main: "#c9962b", light: "#e8c77a", bright: "#d9a93c", soft: "#fbf3e2", text: "#16202e" },
      bg: { app: "#eceef2", sidebar: "#f7f8fa", main: "#f7f8fa", card: "#ffffff", soft: "#f2f4f7", input: "#ffffff", overlay: "rgba(8, 16, 30, 0.5)" },
      text: { primary: "#16202e", secondary: "#5d6878", dark: "#16202e", light: "#8b94a2", white: "#ffffff", muted: "#9aa2ae", cream: "#ffffff" },
      border: { light: "#e3e7ed", strong: "#d0d6df" },
      gradient: {
        primary: "linear-gradient(135deg, #2a4a7a 0%, #1f3a63 45%, #0b1a2e 100%)",
        button: "linear-gradient(180deg, #2a4a7a 0%, #132843 100%)",
      },
      shadow: { default: "rgba(10, 20, 40, 0.09)", light: "rgba(10, 20, 40, 0.05)" },
    }),
    dark: palette({
      dark: true,
      p: { main: "#d9a93c", light: "#e8c77a", dark: "#f0d89c", deep: "#0b1a2e", soft: "#2c2614", mint: "#e8c77a", rgb: "217, 169, 60", hover: "#18202d" },
      accent: { main: "#d9a93c", light: "#e8c77a", bright: "#e8b84a", soft: "#2c2614", text: "#eef1f6" },
      bg: { app: "#070b12", sidebar: "#0c131f", main: "#0c131f", card: "#131c2b", soft: "#182335", input: "#0f1724", overlay: "rgba(0, 0, 0, 0.62)" },
      text: { primary: "#e8ecf3", secondary: "#a2acbd", dark: "#e8ecf3", light: "#7d8798", white: "#ffffff", muted: "#6c7688", cream: "#ffffff" },
      border: { light: "#212c3e", strong: "#2d3a50" },
      gradient: {
        primary: "linear-gradient(135deg, #22385c 0%, #172a47 50%, #0a1424 100%)",
        button: "linear-gradient(180deg, #e0b24a 0%, #b98a22 100%)",
      },
      shadow: { default: "rgba(0, 0, 0, 0.4)", light: "rgba(0, 0, 0, 0.22)" },
    }),
  },
};

export const SKIN_LIST = Object.values(SKINS);
export const DEFAULT_SKIN = "forest";
