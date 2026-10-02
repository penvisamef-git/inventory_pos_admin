import { L } from "../../../i18n";

// shared helpers for the Sales screens
export const usd = (v, dp = 2) => (v === null || v === undefined ? "-" : `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`);
export const khr = (v) => `${Math.round(Number(v || 0)).toLocaleString("en-US")}៛`;
export const num = (v, dp = 2) => Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: dp });
export const pct = (v) => `${Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
export const nm = (o) => (o ? L(o.name_kh || o.name_en, o.name_en || o.name_kh) || o.code || "" : "");
export const ymd = (d) => new Date(new Date(d).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10); // Phnom Penh day
export const addDays = (s, n) => ymd(Date.parse(`${s}T12:00:00+07:00`) + n * 86400000);
export const timeText = (d) => (d ? new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Phnom_Penh" }) : "");
export const dateText = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Phnom_Penh" }) : "");
export const dtText = (d) => (d ? `${dateText(d)} ${timeText(d)}` : "-");
export const dayLabel = (s, opts = { day: "numeric", month: "short" }) => new Date(`${s}T12:00:00+07:00`).toLocaleDateString("en-GB", { ...opts, timeZone: "Asia/Phnom_Penh" });

// date presets for the filter bar
export function presetRange(key) {
  const t = ymd(Date.now());
  const [y, m] = t.split("-").map(Number);
  const first = (yy, mm) => `${yy}-${String(mm).padStart(2, "0")}-01`;
  switch (key) {
    case "yesterday":
      return { from: addDays(t, -1), to: addDays(t, -1) };
    case "7d":
      return { from: addDays(t, -6), to: t };
    case "30d":
      return { from: addDays(t, -29), to: t };
    case "month":
      return { from: first(y, m), to: t };
    case "last_month": {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      return { from: first(py, pm), to: addDays(first(y, m), -1) };
    }
    default:
      return { from: t, to: t };
  }
}
export const PRESETS = [
  ["today", L("ថ្ងៃនេះ", "Today")],
  ["yesterday", L("ម្សិលមិញ", "Yesterday")],
  ["7d", L("៧ ថ្ងៃ", "7 days")],
  ["30d", L("៣០ ថ្ងៃ", "30 days")],
  ["month", L("ខែនេះ", "This month")],
  ["last_month", L("ខែមុន", "Last month")],
];
