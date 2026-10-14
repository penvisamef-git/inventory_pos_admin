// ============================================================
// Extra system themes, made from a few seed values (themes.js builds the full palettes).
// Shared by the admin web (themes.js) and the Cloud POS (cloudpos/theme.js).
// local_pos/src/theme.js keeps a copy of this list — and the API keeps the keys in
// inventory_pos_api/src/v1/admin/setup/setting/setting.model.js (UI_THEMES). Keep all three in step.
//
// p      main colour (white text must read well on it)
// a      accent colour (badges, highlights)
// font   Google font + weights          radius  corner scale (1 = Forest)
// look   soft (white rounded cards) · flat (sharp, bordered) · playful (dotted bg, bold) · dark (dark sidebar)
// family colour group for the filter in General settings
// ============================================================
export const COLOR_FAMILIES = [
  { key: "green", hex: "#1f9d55", kh: "បៃតង", en: "Green" },
  { key: "blue", hex: "#1d64d8", kh: "ខៀវ", en: "Blue" },
  { key: "purple", hex: "#7c3aed", kh: "ស្វាយ", en: "Purple" },
  { key: "pink", hex: "#db2777", kh: "ផ្កាឈូក", en: "Pink" },
  { key: "red", hex: "#dc2626", kh: "ក្រហម / ទឹកក្រូច", en: "Red / orange" },
  { key: "brown", hex: "#8a6243", kh: "ត្នោត / មាស", en: "Brown / gold" },
  { key: "gray", hex: "#3f4652", kh: "ប្រផេះ / ខ្មៅ", en: "Gray / black" },
];

export const SKIN_SEEDS = [
  { key: "emerald", kh: "មរកត", en: "Emerald", dkh: "បៃតងចាស់ ម៉ឺនុយងងឹត ពណ៌មាស", den: "Deep green, dark sidebar, gold", p: "#047857", a: "#d4a017", font: "DM Sans", w: "400;500;600;700;800", radius: 0.8, look: "dark", family: "green" },
  { key: "lagoon", kh: "បឹងទឹកថ្លា", en: "Lagoon", dkh: "ខៀវបៃតង ស្រស់ ជ្រុងមូល", den: "Fresh teal, soft rounded cards", p: "#0f8a80", a: "#f97316", font: "Outfit", w: "400;500;600;700;800", radius: 1, look: "soft", family: "green" },
  { key: "olive", kh: "អូលីវ", en: "Olive", dkh: "បៃតងអូលីវ ធម្មជាតិ ជ្រុងស្រួច", den: "Natural olive, sharp and calm", p: "#5a7429", a: "#d97706", font: "Work Sans", w: "400;500;600;700;800", radius: 0.55, look: "flat", family: "green" },
  { key: "jungle", kh: "ព្រៃព្រឹក្សា", en: "Jungle", dkh: "បៃតង-លឿង សប្បាយ សម្រាប់ក្មេង", den: "Playful green & yellow for kids", p: "#15803d", a: "#eab308", font: "Rubik", w: "400;500;600;700;800", radius: 1.25, look: "playful", family: "green" },
  { key: "sky", kh: "មេឃ", en: "Sky", dkh: "ខៀវមេឃ ស្រាល ជ្រុងមូលខ្លាំង", den: "Light sky blue, extra round", p: "#0277b6", a: "#f59e0b", font: "Poppins", w: "400;500;600;700;800", radius: 1.2, look: "soft", family: "blue" },
  { key: "arctic", kh: "ទឹកកក", en: "Arctic", dkh: "ខៀវទឹកកក ស្អាត បែបបច្ចេកវិទ្យា", den: "Icy cyan, clean tech look", p: "#0e7490", a: "#65a30d", font: "IBM Plex Sans", w: "400;500;600;700", radius: 0.5, look: "flat", family: "blue" },
  { key: "indigo", kh: "ខៀវឥណ្ឌិ", en: "Indigo", dkh: "ខៀវស្វាយ ទំនើប", den: "Modern indigo with pink", p: "#4f46e5", a: "#ec4899", font: "Inter", w: "400;500;600;700;800", radius: 0.75, look: "flat", family: "blue" },
  { key: "midnight", kh: "កណ្តាលអធ្រាត្រ", en: "Midnight", dkh: "ម៉ឺនុយខ្មៅ-ខៀវ ពណ៌ខៀវភ្លឺ", den: "Slate sidebar, bright cyan", p: "#2563eb", a: "#06b6d4", font: "Sora", w: "400;500;600;700;800", radius: 0.6, look: "dark", family: "blue" },
  { key: "royal", kh: "រាជវង្ស", en: "Royal", dkh: "ស្វាយចាស់ ម៉ឺនុយងងឹត មាស", den: "Royal purple, dark sidebar, gold", p: "#6d28d9", a: "#e0a82e", font: "Manrope", w: "400;500;600;700;800", radius: 0.85, look: "dark", family: "purple" },
  { key: "lavender", kh: "ឡាវេនឌ័រ", en: "Lavender", dkh: "ស្វាយស្រាល ទន់ៗ មូលខ្លាំង", den: "Soft lavender, very round", p: "#7c3aed", a: "#f472b6", font: "Quicksand", w: "400;500;600;700", radius: 1.45, look: "playful", family: "purple" },
  { key: "grape", kh: "ទំពាំងបាយជូ", en: "Grape", dkh: "ស្វាយទំពាំងបាយជូ ជាមួយបៃតង", den: "Grape purple with lime", p: "#86198f", a: "#22c55e", font: "Figtree", w: "400;500;600;700;800", radius: 1, look: "soft", family: "purple" },
  { key: "bubblegum", kh: "ស្ករកៅស៊ូ", en: "Bubblegum", dkh: "ផ្កាឈូកភ្លឺ ខៀវទឹកសមុទ្រ សប្បាយ", den: "Bright pink & aqua, bubbly", p: "#db2777", a: "#06b6d4", font: "Baloo 2", w: "400;500;600;700;800", radius: 1.5, look: "playful", family: "pink" },
  { key: "rose", kh: "ផ្កាកុលាប", en: "Rose", dkh: "ក្រហមផ្កាកុលាប ស្រស់ស្អាត", den: "Elegant rose red", p: "#e11d48", a: "#f59e0b", font: "Lexend", w: "400;500;600;700;800", radius: 1, look: "soft", family: "pink" },
  { key: "wine", kh: "ស្រាទំពាំង", en: "Wine", dkh: "ក្រហមស្រា ម៉ឺនុយងងឹត មាស", den: "Deep wine, dark sidebar, gold", p: "#9f1239", a: "#d6a840", font: "Manrope", w: "400;500;600;700;800", radius: 0.7, look: "dark", family: "pink" },
  { key: "coral", kh: "ផ្កាថ្មសមុទ្រ", en: "Coral", dkh: "ទឹកក្រូចក្រហម ខៀវបៃតង ទន់", den: "Warm coral with teal", p: "#e04f3f", a: "#0d9488", font: "Poppins", w: "400;500;600;700;800", radius: 1.25, look: "playful", family: "red" },
  { key: "cherry", kh: "ឈើរី", en: "Cherry", dkh: "ក្រហមឆ្អៅ ជ្រុងស្រួច បែបហាង", den: "Classic cherry red, sharp retail look", p: "#b91c1c", a: "#ca8a04", font: "Merriweather Sans", w: "400;500;600;700;800", radius: 0.6, look: "flat", family: "red" },
  { key: "sunset", kh: "ថ្ងៃលិច", en: "Sunset", dkh: "ទឹកក្រូច-ផ្កាឈូក កក់ក្តៅ", den: "Warm orange to pink", p: "#e2560c", a: "#db2777", font: "Outfit", w: "400;500;600;700;800", radius: 1.1, look: "soft", family: "red" },
  { key: "honey", kh: "ទឹកឃ្មុំ", en: "Honey", dkh: "លឿងទឹកឃ្មុំ ខៀវ រីករាយ", den: "Golden honey with blue, cheerful", p: "#b45309", a: "#0ea5e9", font: "Nunito", w: "400;500;600;700;800", radius: 1.3, look: "playful", family: "brown" },
  { key: "mocha", kh: "កាហ្វេ", en: "Mocha", dkh: "ត្នោតកាហ្វេ ក្រែម កក់ក្តៅ", den: "Coffee brown & cream, cosy", p: "#7a5236", a: "#d4a373", font: "DM Sans", w: "400;500;600;700;800", radius: 0.9, look: "soft", family: "brown" },
  { key: "charcoal", kh: "ធ្យូង", en: "Charcoal", dkh: "ខ្មៅ-ប្រផេះ ពណ៌លឿង ស្រួច", den: "Black & gray with amber, sharp", p: "#27272a", a: "#f59e0b", font: "Inter", w: "400;500;600;700;800", radius: 0.4, look: "flat", family: "gray" },
];
