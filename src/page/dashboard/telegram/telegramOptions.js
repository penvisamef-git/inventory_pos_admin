import { L } from "../../../i18n";

export const LANG_OPTIONS = [
  { value: "both", label: L("ខ្មែរ + អង់គ្លេស", "Khmer + English") },
  { value: "kh", label: L("ខ្មែរ", "Khmer") },
  { value: "en", label: L("អង់គ្លេស", "English") },
];
export const langLabel = (v) => LANG_OPTIONS.find((o) => o.value === v)?.label || v;

export const CHAT_TYPES = [
  { value: "group", label: L("ក្រុម", "Group") },
  { value: "supergroup", label: L("ក្រុមធំ (Supergroup)", "Supergroup") },
  { value: "channel", label: L("ឆានែល", "Channel") },
  { value: "private", label: L("ផ្ទាល់ខ្លួន", "Private chat") },
];

export const GROUPS = {
  stock: L("ស្តុក", "Stock"),
  product: L("ទំនិញ", "Product"),
  staff: L("បុគ្គលិក", "Staff"),
  pos: L("POS", "POS"),
};

// 0 = Sunday (same as the API)
export const DAYS = [
  { value: "1", label: L("ច័ន្ទ", "Mon") },
  { value: "2", label: L("អង្គារ", "Tue") },
  { value: "3", label: L("ពុធ", "Wed") },
  { value: "4", label: L("ព្រហស្បតិ៍", "Thu") },
  { value: "5", label: L("សុក្រ", "Fri") },
  { value: "6", label: L("សៅរ៍", "Sat") },
  { value: "0", label: L("អាទិត្យ", "Sun") },
];

export const daysText = (days = []) => {
  const set = new Set(days.map(String));
  if (set.size === 7) return L("រាល់ថ្ងៃ", "Every day");
  if (set.size === 5 && ["1", "2", "3", "4", "5"].every((d) => set.has(d))) return L("ច័ន្ទ – សុក្រ", "Mon – Fri");
  return DAYS.filter((d) => set.has(d.value)).map((d) => d.label).join(", ") || "-";
};

// phase 4+ = not built yet → still selectable, marked "soon" (POS events / reports work since phase 3)
export const soon = (phase) => (phase >= 4 ? L(" · (ឆាប់ៗ)", " · (coming)") : "");
export const nameOf = (row) => L(row?.name_kh || row?.name_en, row?.name_en || row?.name_kh);

export const whLabel = (w) => (w ? `${w.code} · ${L(w.name_kh || w.name_en, w.name_en || w.name_kh)}` : "");

// Telegram HTML (b, i, u, s, code, pre) → safe HTML for the preview bubble. Values are already escaped by the API.
export function tgHtml(text = "") {
  return String(text)
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(b|i|u|s|code|pre)&gt;/g, "<$1$2>")
    .replace(/\n/g, "<br/>");
}

export const TgBubble = ({ text, empty }) =>
  text ? <div className="tg-bubble" dangerouslySetInnerHTML={{ __html: tgHtml(text) }} /> : <div className="tg-bubble tg-bubble-empty">{empty || "-"}</div>;
