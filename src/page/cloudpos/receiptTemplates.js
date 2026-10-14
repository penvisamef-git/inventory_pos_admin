// ============================================================
// 24 receipt styles (80 mm). The admin picks one (General settings / POS devices → Receipt style);
// it comes to every POS with the sync (setting.receipt_template). Same file in local_pos/src/receiptTemplates.js
// and the keys in inventory_pos_api/src/v1/admin/setup/setting/setting.model.js (RECEIPT_TEMPLATES).
//
// font  sans · mono · serif · narrow           head   center · left · logo-left · banner · boxed
// rule  dashed · solid · double · dotted · stars · none
// items two-line · one-line · table · numbered  total  big · boxed · inverted · underline · huge
// meta  stack · grid · inline                   size   s · m · l
// foot  center · box · barcode                  upper  CAPITAL headings
// ============================================================
export const RECEIPT_TEMPLATES = [
  { key: "classic", kh: "បុរាណ", en: "Classic", font: "sans", head: "center", rule: "dashed", items: "two-line", total: "big", meta: "stack", size: "m", foot: "center" },
  { key: "typewriter", kh: "ម៉ាស៊ីនអង្គុលីលេខ", en: "Typewriter", font: "mono", head: "center", rule: "dashed", items: "one-line", total: "big", meta: "stack", size: "m", foot: "center" },
  { key: "minimal", kh: "សាមញ្ញ", en: "Minimal", font: "sans", head: "left", rule: "none", items: "one-line", total: "underline", meta: "inline", size: "m", foot: "center" },
  { key: "modern", kh: "ទំនើប", en: "Modern", font: "sans", head: "logo-left", rule: "solid", items: "one-line", total: "boxed", meta: "grid", size: "m", foot: "center" },
  { key: "bold", kh: "ដិត", en: "Bold", font: "sans", head: "banner", rule: "solid", items: "two-line", total: "inverted", meta: "stack", size: "m", foot: "box", upper: true },
  { key: "elegant", kh: "ប្រណីត", en: "Elegant", font: "serif", head: "center", rule: "double", items: "two-line", total: "underline", meta: "stack", size: "m", foot: "center" },
  { key: "compact", kh: "តូចចង្អៀត", en: "Compact", font: "narrow", head: "center", rule: "dotted", items: "one-line", total: "big", meta: "inline", size: "s", foot: "center" },
  { key: "table", kh: "តារាង", en: "Table", font: "sans", head: "center", rule: "solid", items: "table", total: "boxed", meta: "grid", size: "m", foot: "center" },
  { key: "large", kh: "អក្សរធំ", en: "Large print", font: "sans", head: "center", rule: "dashed", items: "two-line", total: "huge", meta: "stack", size: "l", foot: "center" },
  { key: "retro", kh: "ចាស់បុរាណ", en: "Retro", font: "mono", head: "center", rule: "stars", items: "two-line", total: "big", meta: "stack", size: "m", foot: "center", upper: true },
  { key: "boxed", kh: "ប្រអប់", en: "Boxed", font: "sans", head: "boxed", rule: "solid", items: "one-line", total: "boxed", meta: "grid", size: "m", foot: "box" },
  { key: "numbered", kh: "មានលេខរៀង", en: "Numbered", font: "sans", head: "center", rule: "dashed", items: "numbered", total: "big", meta: "stack", size: "m", foot: "center" },
  { key: "barcode", kh: "បាកូដ", en: "Barcode", font: "mono", head: "center", rule: "dashed", items: "one-line", total: "big", meta: "stack", size: "m", foot: "barcode" },
  { key: "banner_table", kh: "ក្បាលខ្មៅ + តារាង", en: "Banner table", font: "sans", head: "banner", rule: "none", items: "table", total: "inverted", meta: "grid", size: "m", foot: "center", upper: true },
  { key: "boutique", kh: "ហាងទំនើប", en: "Boutique", font: "serif", head: "left", rule: "solid", items: "one-line", total: "underline", meta: "grid", size: "m", foot: "center" },
  { key: "playful", kh: "សប្បាយ", en: "Playful", font: "sans", head: "boxed", rule: "dotted", items: "two-line", total: "boxed", meta: "stack", size: "l", foot: "box" },
  { key: "mono_lite", kh: "Mono ស្រាល", en: "Mono lite", font: "mono", head: "left", rule: "none", items: "one-line", total: "underline", meta: "inline", size: "s", foot: "center" },
  { key: "double_line", kh: "បន្ទាត់ពីរ", en: "Double line", font: "sans", head: "center", rule: "double", items: "table", total: "big", meta: "stack", size: "m", foot: "box" },
  { key: "express", kh: "រហ័ស", en: "Express", font: "narrow", head: "banner", rule: "dashed", items: "numbered", total: "inverted", meta: "inline", size: "s", foot: "barcode", upper: true },
  { key: "executive", kh: "នាយក", en: "Executive", font: "serif", head: "logo-left", rule: "double", items: "table", total: "boxed", meta: "grid", size: "m", foot: "box", upper: true },
  { key: "clean_grid", kh: "ក្រឡាស្អាត", en: "Clean grid", font: "sans", head: "left", rule: "solid", items: "table", total: "underline", meta: "grid", size: "s", foot: "center" },
  { key: "big_total", kh: "សរុបធំ", en: "Big total", font: "sans", head: "center", rule: "none", items: "one-line", total: "huge", meta: "stack", size: "m", foot: "center" },
  { key: "dotted_box", kh: "ចំណុច + ប្រអប់", en: "Dotted box", font: "mono", head: "boxed", rule: "dotted", items: "numbered", total: "boxed", meta: "grid", size: "m", foot: "barcode" },
  { key: "premium", kh: "ពិសេស", en: "Premium", font: "serif", head: "banner", rule: "solid", items: "two-line", total: "inverted", meta: "stack", size: "l", foot: "box" },
];

export const DEFAULT_RECEIPT = "classic";
export const receiptTemplate = (key) => RECEIPT_TEMPLATES.find((t) => t.key === key) || RECEIPT_TEMPLATES[0];
export const receiptClass = (t) =>
  ["rc", `rc-f-${t.font}`, `rc-h-${t.head}`, `rc-r-${t.rule}`, `rc-i-${t.items}`, `rc-t-${t.total}`, `rc-m-${t.meta}`, `rc-s-${t.size}`, `rc-ft-${t.foot}`, t.upper ? "rc-up" : ""].filter(Boolean).join(" ");
