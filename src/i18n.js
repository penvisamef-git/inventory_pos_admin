// ============================================================
// Language + theme preferences (saved in this browser only)
//   L("ខ្មែរ", "English") → the text for the chosen language
//   Changing the language reloads the page, so every L() — also the
//   ones in module-level arrays (FIELDS, COLUMNS, routes) — is read again.
// ============================================================
const KEY = "inventory_pos_prefs";
const DEFAULTS = { lang: "kh", theme: "light" }; // theme: light | dark | system

export function getPrefs() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(patch) {
  const next = { ...getPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage blocked → the choice lasts until reload
  }
  return next;
}

export const LANG = getPrefs().lang === "en" ? "en" : "kh";

// Pick the text for the current language (falls back to Khmer)
export const L = (kh, en) => (LANG === "en" && en !== undefined && en !== null ? en : kh);

export function setLang(lang) {
  if (lang === LANG) return;
  savePrefs({ lang });
  window.location.reload();
}

if (typeof document !== "undefined") {
  document.documentElement.lang = LANG === "en" ? "en" : "km";
}
