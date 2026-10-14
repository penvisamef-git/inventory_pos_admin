// Preview of the invoice maths on the screen (the POS server recalculates and is the one that counts).
// Same rules as local_pos_api/src/money.js.
export const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const roundKhr = (n, step = 100) => (step > 1 ? Math.round(n / step) * step : Math.round(n));

export function priceOf(line) {
  return line.variant.prices?.[String(line.unit._id)];
}

export function totals(lines, discount, setting, rate) {
  const rows = lines.map((l) => {
    const price = priceOf(l) ?? 0;
    return { ...l, price, gross: r2(price * l.qty), allow: l.product.allow_discount !== false, taxable: l.product.is_taxable !== false, disc: 0 };
  });
  const subtotal = r2(rows.reduce((t, l) => t + l.gross, 0));
  const base = rows.filter((l) => l.allow).reduce((t, l) => t + l.gross, 0);
  let discountTotal = 0;
  const v = Number(discount?.value) || 0;
  if (v > 0 && base > 0) discountTotal = discount.type === "percent" ? r2((base * Math.min(v, 100)) / 100) : r2(Math.min(v, base));
  let left = discountTotal;
  const dl = rows.filter((l) => l.allow);
  dl.forEach((l, i) => {
    l.disc = i === dl.length - 1 ? left : r2((discountTotal * l.gross) / base);
    left = r2(left - l.disc);
  });
  const net = r2(subtotal - discountTotal);
  const mode = setting?.tax_mode || "none";
  const tr = Number(setting?.tax_rate) || 0;
  const taxable = rows.filter((l) => l.taxable).reduce((t, l) => t + l.gross - l.disc, 0);
  let tax = 0;
  let total = net;
  if (mode === "exclusive" && tr > 0) {
    tax = r2((taxable * tr) / 100);
    total = r2(net + tax);
  } else if (mode === "inclusive" && tr > 0) tax = r2((taxable * tr) / (100 + tr));
  const rateValue = Number(rate?.rate) || 4100;
  const step = Number(setting?.khr_rounding) || 100;
  return { subtotal, discountTotal, tax, mode, taxRate: tr, total, totalKhr: roundKhr(total * rateValue, step), rate: rateValue, step, count: rows.reduce((t, l) => t + l.qty, 0) };
}

// paid / remaining / change for the pay screen (same rules as the server)
export function payState(t, payments) {
  const paid = payments.reduce((s, p) => s + (p.method.currency === "KHR" ? (Number(p.amount) || 0) / t.rate : Number(p.amount) || 0), 0);
  const remaining = Math.max(0, r2(t.total - paid));
  const enough = paid + 0.005 >= t.total || paid * t.rate + 1 >= t.totalKhr;
  const change = Math.max(0, paid - t.total);
  const paidUsdCash = payments.some((p) => p.method.type === "cash" && p.method.currency !== "KHR");
  const giveUsd = paidUsdCash ? Math.floor(change + 0.0001) : 0;
  const giveKhr = roundKhr((change - giveUsd) * t.rate, t.step);
  return { paid: r2(paid), remaining, remainingKhr: enough ? 0 : roundKhr(t.totalKhr - paid * t.rate, t.step), enough, change: r2(change), giveUsd, giveKhr };
}
