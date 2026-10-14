// Khmer / English for the POS screen (saved on this computer). Changing it reloads the page.
const KEY = "pos_lang";
let lang = "kh";
try {
  lang = localStorage.getItem(KEY) === "en" ? "en" : "kh";
} catch {
  // storage blocked → Khmer
}
export const LANG = lang;
export const L = (kh, en) => (LANG === "en" && en !== undefined && en !== null ? en : kh);
export const nm = (o) => (o ? (LANG === "en" ? o.name_en || o.name_kh : o.name_kh || o.name_en) || "" : "");
export function setLang(next) {
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // ignore
  }
  window.location.reload();
}

// money / numbers
export const usd = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const khr = (v) => `${Math.round(Number(v || 0)).toLocaleString("en-US")}៛`;
export const qtyText = (n) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 3 });
export const timeText = (d) => (d ? new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Phnom_Penh" }) : "");
export const dateTimeText = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Phnom_Penh" }) : "";
