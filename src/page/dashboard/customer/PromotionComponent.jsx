import React, { useEffect, useMemo, useState } from "react";
import MasterDataPage, { dateTimeText } from "../master_data/MasterDataPage";
import { brandService, categoryService, productService, promotionService, warehouseService } from "../../../api/api.service";
import Auth from "../../util/auth";
import { ACCESS, canAccess } from "../../util/permission";
import { nameKh } from "../setup/setupOptions";
import { L } from "../../../i18n";
import "./customer.style.css";

// Promotions: the POS applies them by itself (offline too) — engine cloudpos/promo.js = local_pos/src/promo.js.
export const PROMO_TYPES = [
  { value: "percent", label: L("បញ្ចុះ % លើទំនិញ", "% off items") },
  { value: "amount_off", label: L("បញ្ចុះ $ ក្នុងមួយដុំ", "$ off each item") },
  { value: "buy_x_get_y", label: L("ទិញ X ថែម Y", "Buy X get Y") },
  { value: "bundle", label: L("ឈុតទំនិញ តម្លៃពិសេស", "Bundle at a fixed price") },
  { value: "bill_percent", label: L("បញ្ចុះ % លើវិក្កយបត្រ", "% off the bill") },
  { value: "bill_amount", label: L("បញ្ចុះ $ លើវិក្កយបត្រ", "$ off the bill") },
];
const SCOPES = [
  { value: "all", label: L("ទំនិញទាំងអស់", "All items") },
  { value: "category", label: L("តាមប្រភេទ", "Categories") },
  { value: "brand", label: L("តាមម៉ាក", "Brands") },
  { value: "product", label: L("ទំនិញជាក់លាក់", "Products") },
];
const DAYS = [L("អា", "Sun"), L("ច", "Mon"), L("អ", "Tue"), L("ពុ", "Wed"), L("ព្រ", "Thu"), L("សុ", "Fri"), L("ស", "Sat")].map((label, k) => ({ value: String(k), label }));
const ITEM = ["percent", "amount_off", "buy_x_get_y"];
const BILL = ["bill_percent", "bill_amount"];
const typeLabel = (t) => PROMO_TYPES.find((x) => x.value === t)?.label || t;

function stateOf(r) {
  const now = Date.now();
  if (!r.status) return ["off", L("បិទ", "Off")];
  if (r.end_at && new Date(r.end_at).getTime() < now) return ["ended", L("ផុតកំណត់", "Ended")];
  if (r.start_at && new Date(r.start_at).getTime() > now) return ["upcoming", L("មកដល់", "Upcoming")];
  return ["active", L("កំពុងដំណើរការ", "Running")];
}
function ruleText(r) {
  if (r.type === "percent") return `${r.value}%`;
  if (r.type === "amount_off") return `−$${r.value}`;
  if (r.type === "buy_x_get_y") return r.get_percent >= 100 ? L(`ទិញ ${r.buy_qty} ថែម ${r.get_qty}`, `Buy ${r.buy_qty} get ${r.get_qty} free`) : L(`ទិញ ${r.buy_qty} ទី ${r.get_qty} បញ្ចុះ ${r.get_percent}%`, `Buy ${r.buy_qty}, ${r.get_qty} at ${r.get_percent}% off`);
  if (r.type === "bundle") return `${(r.bundle_items || []).length} ${L("មុខ", "items")} = $${r.bundle_price}`;
  return `${r.type === "bill_percent" ? `${r.value}%` : `−$${r.value}`}${r.min_amount ? L(` ពេលទិញ ≥ $${r.min_amount}`, ` from $${r.min_amount}`) : ""}`;
}

export default function PromotionComponent() {
  const canEdit = canAccess(new Auth().getClientLogin() || {}, ACCESS.PRODUCT);
  const [opts, setOpts] = useState({ shops: [], categories: [], brands: [], products: [] });
  useEffect(() => {
    Promise.all([
      warehouseService.all({ type: "shop" }).catch(() => ({ data: [] })),
      categoryService.all().catch(() => ({ data: [] })),
      brandService.all().catch(() => ({ data: [] })),
      productService.list({ limit: 200, status: true }).catch(() => ({ data: [] })),
    ]).then(([w, c, b, p]) =>
      setOpts({
        shops: (w.data || []).filter((x) => x.type === "shop").map((x) => ({ value: x._id, label: `${x.code} · ${nameKh(x)}` })),
        categories: (c.data || []).map((x) => ({ value: x._id, label: L(x.name_kh, x.name_en || x.name_kh) })),
        brands: (b.data || []).map((x) => ({ value: x._id, label: L(x.name_kh, x.name_en || x.name_kh) })),
        products: (p.data || []).map((x) => ({ value: x._id, label: `${x.code} · ${L(x.name_kh, x.name_en || x.name_kh)}` })),
      }),
    );
  }, []);

  const fields = useMemo(
    () => [
      { key: "name_kh", label: L("ឈ្មោះ (ខ្មែរ) — បង្ហាញលើវិក្កយបត្រ", "Name (Khmer) — shown on the receipt"), required: true, placeholder: L("ទិញ 2 ថែម 1", "Buy 2 get 1") },
      { key: "name_en", label: L("ឈ្មោះ (អង់គ្លេស)", "Name (English)") },
      { key: "type", label: L("ប្រភេទ", "Type"), type: "select", required: true, noEmpty: true, default: "percent", options: PROMO_TYPES },
      { key: "value", label: L("តម្លៃបញ្ចុះ (% ឬ $)", "Discount (% or $)"), type: "number", showIf: (f) => ["percent", "amount_off", ...BILL].includes(f.type) },
      { key: "buy_qty", label: L("ទិញ (X)", "Buy (X)"), type: "number", step: "1", default: 2, showIf: (f) => f.type === "buy_x_get_y" },
      { key: "get_qty", label: L("ថែម (Y)", "Get (Y)"), type: "number", step: "1", default: 1, showIf: (f) => f.type === "buy_x_get_y" },
      { key: "get_percent", label: L("បញ្ចុះលើ Y (%) — 100 = ឥតគិតថ្លៃ", "Off on Y (%) — 100 = free"), type: "number", step: "1", default: 100, showIf: (f) => f.type === "buy_x_get_y" },
      {
        key: "bundle_items",
        label: L("ទំនិញក្នុងឈុត", "Bundle items"),
        type: "rows",
        full: true,
        showIf: (f) => f.type === "bundle",
        columns: [
          { key: "product_id", label: L("ទំនិញ", "Product"), type: "select", options: () => opts.products, width: "3fr" },
          { key: "qty", label: L("ចំនួន", "Qty"), type: "number", width: "1fr" },
        ],
        newRow: () => ({ product_id: "", qty: 1 }),
      },
      { key: "bundle_price", label: L("តម្លៃឈុត ($)", "Bundle price ($)"), type: "number", showIf: (f) => f.type === "bundle" },
      { key: "scope", label: L("អនុវត្តលើ", "Applies to"), type: "select", noEmpty: true, default: "all", options: SCOPES, showIf: (f) => ITEM.includes(f.type) },
      { key: "category_ids", label: L("ប្រភេទ (រួមទាំងប្រភេទរង)", "Categories (with sub-categories)"), type: "multiselect", options: () => opts.categories, showIf: (f) => ITEM.includes(f.type) && f.scope === "category" },
      { key: "brand_ids", label: L("ម៉ាក", "Brands"), type: "multiselect", options: () => opts.brands, showIf: (f) => ITEM.includes(f.type) && f.scope === "brand" },
      { key: "product_ids", label: L("ទំនិញ", "Products"), type: "multiselect", options: () => opts.products, showIf: (f) => ITEM.includes(f.type) && f.scope === "product" },
      { key: "min_qty", label: L("ចំនួនទំនិញយ៉ាងតិច", "At least this many items"), type: "number", step: "1", showIf: (f) => ["percent", "amount_off"].includes(f.type) },
      { key: "min_amount", label: L("វិក្កយបត្រយ៉ាងតិច ($)", "Bill at least ($)"), type: "number", showIf: (f) => BILL.includes(f.type) },
      { key: "start_at", label: L("ចាប់ពី", "From"), type: "datetime" },
      { key: "end_at", label: L("ដល់", "Until"), type: "datetime" },
      { key: "days", label: L("ថ្ងៃក្នុងសប្តាហ៍ (ទទេ = រាល់ថ្ងៃ)", "Days of the week (none = every day)"), type: "multiselect", options: DAYS },
      { key: "time_from", label: L("ម៉ោងពី (Happy hour)", "Happy hour from"), type: "time" },
      { key: "time_to", label: L("ដល់ម៉ោង", "until"), type: "time" },
      { key: "warehouse_ids", label: L("ហាង (ទទេ = គ្រប់ហាង)", "Shops (none = every shop)"), type: "multiselect", options: () => opts.shops },
      { key: "member_only", label: L("សម្រាប់តែអតិថិជនមានឈ្មោះ (សមាជិក)", "Members only (a customer on the sale)"), type: "checkbox", full: true },
      { key: "priority", label: L("អាទិភាព (ធំ = មុន)", "Priority (higher first)"), type: "number", step: "1" },
      { key: "note", label: L("កំណត់សម្គាល់", "Note"), type: "textarea", full: true },
    ],
    [opts],
  );
  const columns = [
    { key: "name", label: L("ប្រូម៉ូសិន", "Promotion"), render: (r) => <><b>{L(r.name_kh, r.name_en || r.name_kh)}</b><span className="md-sub">{r.code}{r.member_only ? ` · ${L("សមាជិក", "members")}` : ""}</span></> },
    { key: "type", label: L("ប្រភេទ", "Type"), render: (r) => <><span className="pr-type">{typeLabel(r.type)}</span><span className="md-sub">{ruleText(r)}</span></> },
    {
      key: "when",
      label: L("ពេលវេលា", "When"),
      render: (r) => (
        <>
          {r.start_at || r.end_at ? `${r.start_at ? dateTimeText(r.start_at).slice(0, 10) : "…"} → ${r.end_at ? dateTimeText(r.end_at).slice(0, 10) : "…"}` : L("ជានិច្ច", "Always")}
          <span className="md-sub">{[r.days?.length ? r.days.map((d) => DAYS[d]?.label).join(" ") : "", r.time_from ? `${r.time_from}–${r.time_to}` : ""].filter(Boolean).join(" · ")}</span>
        </>
      ),
    },
    { key: "shops", label: L("ហាង", "Shops"), render: (r) => (r.warehouse_ids?.length ? r.warehouse_ids.map((w) => w.code).join(", ") : L("គ្រប់ហាង", "All")) },
    { key: "status", label: L("ស្ថានភាព", "Status"), render: (r) => { const [k, t] = stateOf(r); return <span className={`pr-state ${k}`}>{t}</span>; } },
  ];
  // populated ids → plain ids for the form
  const service = useMemo(
    () => ({
      ...promotionService,
      list: async (params, o) => {
        const r = await promotionService.list(params, o);
        return { ...r, data: (r.data || []).map((x) => ({ ...x, days: (x.days || []).map(String), bundle_items: (x.bundle_items || []).map((i) => ({ product_id: i.product_id?._id || i.product_id || "", qty: i.qty })) })) };
      },
      create: (d) => promotionService.create({ ...d, days: (d.days || []).map(Number) }),
      update: (id, d) => promotionService.update(id, { ...d, days: d.days ? d.days.map(Number) : undefined }),
    }),
    [],
  );

  return (
    <MasterDataPage
      title={L("ប្រូម៉ូសិន", "Promotions")}
      service={service}
      fields={fields}
      columns={columns}
      searchKeys={["name_kh", "name_en", "code"]}
      filters={[
        { key: "state", label: L("-- ទាំងអស់ --", "-- All --"), options: [{ value: "active", label: L("កំពុងដំណើរការ", "Running") }, { value: "upcoming", label: L("មកដល់", "Upcoming") }, { value: "ended", label: L("ផុតកំណត់", "Ended") }, { value: "off", label: L("បិទ", "Off") }] },
        { key: "type", label: L("-- ប្រភេទទាំងអស់ --", "-- All types --"), options: PROMO_TYPES },
      ]}
      canEdit={canEdit}
      getName={(r) => `${r.name_kh} (${r.code})`}
      wide
    />
  );
}
