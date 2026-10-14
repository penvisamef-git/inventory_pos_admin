// Preview of the invoice maths on the screen (the POS server recalculates and is the one that counts).
// Same rules as local_pos_api/src/money.js.
import { applyPromotions } from "./promo";

export const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const roundKhr = (n, step = 100) => (step > 1 ? Math.round(n / step) * step : Math.round(n));

export function priceOf(line) {
  return line.variant.prices?.[String(line.unit._id)];
}

// category → [itself, parent …] for promotions on a parent category
const chainOf = (categories) => {
  const parent = new Map((categories || []).map((c) => [String(c._id), c.parent_id ? String(c.parent_id) : null]));
  return (id) => {
    const out = [];
    let cur = id ? String(id) : null;
    for (let k = 0; cur && k < 10; k++) {
      out.push(cur);
      cur = parent.get(cur) || null;
    }
    return out;
  };
};

// promo: { promotions, warehouse_id, has_customer, categories } (same rules as the POS server: promo.js)
export function totals(lines, discount, setting, rate, promo = {}) {
  const rows = lines.map((l) => {
    const price = priceOf(l) ?? 0;
    return { ...l, price, gross: r2(price * l.qty), allow: l.product.allow_discount !== false, taxable: l.product.is_taxable !== false, disc: 0, promo: 0 };
  });
  const subtotal = r2(rows.reduce((t, l) => t + l.gross, 0));
  let promoTotal = 0;
  let promotions = [];
  if (promo.promotions?.length && rows.length) {
    const r = applyPromotions(
      rows.map((l, k) => ({ key: k, product_id: l.product._id, variant_id: l.variant._id, category_id: l.product.category_id, brand_id: l.product.brand_id, qty: Number(l.qty) || 0, price: l.price, allow_discount: l.allow })),
      promo.promotions,
      { now: new Date(), warehouse_id: promo.warehouse_id, has_customer: !!promo.has_customer, categoryChain: chainOf(promo.categories) },
    );
    rows.forEach((l, k) => {
      l.promo = r2(Math.min(r.discounts[k] || 0, l.gross));
    });
    promoTotal = r2(rows.reduce((t, l) => t + l.promo, 0));
    promotions = r.applied;
  }
  const after = (l) => r2(l.gross - l.promo);
  const base = rows.filter((l) => l.allow).reduce((t, l) => t + after(l), 0);
  let discountTotal = 0;
  const v = Number(discount?.value) || 0;
  if (v > 0 && base > 0) discountTotal = discount.type === "percent" ? r2((base * Math.min(v, 100)) / 100) : r2(Math.min(v, base));
  let left = discountTotal;
  const dl = rows.filter((l) => l.allow);
  dl.forEach((l, i) => {
    l.disc = i === dl.length - 1 ? left : r2((discountTotal * after(l)) / base);
    left = r2(left - l.disc);
  });
  const net = r2(subtotal - promoTotal - discountTotal);
  const mode = setting?.tax_mode || "none";
  const tr = Number(setting?.tax_rate) || 0;
  const taxable = rows.filter((l) => l.taxable).reduce((t, l) => t + l.gross - l.promo - l.disc, 0);
  let tax = 0;
  let total = net;
  if (mode === "exclusive" && tr > 0) {
    tax = r2((taxable * tr) / 100);
    total = r2(net + tax);
  } else if (mode === "inclusive" && tr > 0) tax = r2((taxable * tr) / (100 + tr));
  const rateValue = Number(rate?.rate) || 4100;
  const step = Number(setting?.khr_rounding) || 100;
  const linePromo = {};
  rows.forEach((l) => {
    if (l.promo > 0) linePromo[l.key] = l.promo;
  });
  return { subtotal, promoTotal, promotions, linePromo, discountTotal, tax, mode, taxRate: tr, total, totalKhr: roundKhr(total * rateValue, step), rate: rateValue, step, count: rows.reduce((t, l) => t + l.qty, 0) };
}

// paid / remaining / change for the pay screen (same rules as the server)
export function payState(t, payments) {
  const paid = payments.reduce((s, p) => s + (p.method.currency === "KHR" ? (Number(p.amount) || 0) / t.rate : Number(p.amount) || 0), 0);
  const remaining = Math.max(0, r2(t.total - paid));
  const enough = paid + 0.005 >= t.total || paid * t.rate + 1 >= t.totalKhr;
  const change = Math.max(0, paid - t.total);
  const paidUsdCash = payments.some((p) => (p.method.type === "cash" || p.method.type === "credit") && p.method.currency !== "KHR");
  const giveUsd = paidUsdCash ? Math.floor(change + 0.0001) : 0;
  const giveKhr = roundKhr((change - giveUsd) * t.rate, t.step);
  return { paid: r2(paid), remaining, remainingKhr: enough ? 0 : roundKhr(t.totalKhr - paid * t.rate, t.step), enough, change: r2(change), giveUsd, giveKhr };
}
