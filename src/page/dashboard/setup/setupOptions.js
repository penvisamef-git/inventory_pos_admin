import Auth from "../../util/auth";
import { ACCESS, canAccess } from "../../util/permission";

import { L } from "../../../i18n";
export const WAREHOUSE_TYPE_OPTIONS = [
  { value: "central", label: L("ឃ្លាំងកណ្តាល (Central)", "Central warehouse") },
  { value: "shop", label: L("ហាង + POS (Shop)", "Shop + POS") },
];

export const TAX_MODE_OPTIONS = [
  { value: "none", label: L("មិនប្រើពន្ធ", "No tax") },
  { value: "inclusive", label: L("តម្លៃរួមបញ្ចូលពន្ធរួច (Inclusive)", "Prices include tax (inclusive)") },
  { value: "exclusive", label: L("បូកពន្ធបន្ថែមលើតម្លៃ (Exclusive)", "Tax added on top (exclusive)") },
];

export const PAYMENT_TYPE_OPTIONS = [
  { value: "cash", label: L("សាច់ប្រាក់ (Cash)", "Cash") },
  { value: "qr", label: "QR (KHQR / ABA)" },
  { value: "card", label: L("កាត (Card)", "Card") },
  { value: "bank", label: L("ផ្ទេរតាមធនាគារ (Bank)", "Bank transfer") },
];

export const CURRENCY_OPTIONS = [
  { value: "any", label: "USD / KHR" },
  { value: "USD", label: "USD ($)" },
  { value: "KHR", label: "KHR (៛)" },
];

export const RATE_STATE = {
  current: { label: L("កំពុងប្រើ", "In use"), className: "md-badge-on" },
  upcoming: { label: L("នឹងចាប់ផ្តើម", "Upcoming"), className: "md-badge-gold" },
  past: { label: L("ប្រវត្តិ", "History"), className: "md-badge-off" },
};

export const riel = (v) => `${Number(v || 0).toLocaleString("en-US")} ៛`;

export const labelOf = (options, value) => options.find((o) => o.value === value)?.label || value || "-";

// display name in the current language (Khmer → name_kh first, English → name_en first)
export const nameKh = (row) =>
  L(row?.name_kh || row?.name_en || row?.code || "-", row?.name_en || row?.name_kh || row?.code || "-");

// the other language, shown small under the main name
export const nameOther = (row) => L(row?.name_en, row?.name_kh) || "";

// warehouse dropdown label: "ហាង ភ្នំពេញ ០១ (PP01)"
export const warehouseLabel = (w) => (w ? `${nameKh(w)} (${w.code})` : "-");

// can the signed-in user create / edit setup data (warehouse, setting, exchange rate, payment method)?
export const canEditSetup = () => canAccess(new Auth().getClientLogin(), ACCESS.ADMIN);
