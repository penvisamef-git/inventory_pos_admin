import React, { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Package, RotateCcw, ShieldAlert } from "lucide-react";
import { saleService } from "../../../api/api.service";
import { L } from "../../../i18n";
import { usd, khr, num, pct, nm, dayLabel, timeText } from "./saleUtil";

const WEEKDAYS = [null, L("ច", "Mon"), L("អ", "Tue"), L("ព", "Wed"), L("ព្រ", "Thu"), L("សុ", "Fri"), L("ស", "Sat"), L("អា", "Sun")];

// one horizontal bar list: label, value, bar (share of the biggest)
function Bars({ rows, value = (r) => r.total, label, sub, right, onPick, empty }) {
  const max = Math.max(1e-9, ...rows.map(value));
  if (!rows.length) return <div className="sl-empty-sm">{empty || L("គ្មានទិន្នន័យ", "No data")}</div>;
  return (
    <div className="sl-bars">
      {rows.map((r, k) => (
        <button key={k} type="button" className="sl-bar" onClick={onPick ? () => onPick(r) : undefined} disabled={!onPick}>
          <span className="sl-bar-label">{label(r)}{sub && <small>{sub(r)}</small>}</span>
          <span className="sl-bar-right">{right ? right(r) : usd(value(r))}</span>
          <i><em style={{ width: `${Math.max(0, (value(r) / max) * 100)}%` }} /></i>
        </button>
      ))}
    </div>
  );
}

function Change({ now, before }) {
  if (!before) return <small className="sl-change">{L("គ្មានទិន្នន័យមុន", "no earlier data")}</small>;
  const d = ((now - before) / before) * 100;
  const up = d >= 0;
  return (
    <small className={`sl-change ${up ? "up" : "down"}`}>
      {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {pct(Math.abs(d))} {L("ធៀបមុន", "vs before")}
    </small>
  );
}

export default function SaleReport({ params, tick, cost, portal, onPick, onOpenInvoices }) {
  const [r, setR] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [allItems, setAllItems] = useState(false);
  const seq = useRef(0);
  const key = JSON.stringify(params);

  useEffect(() => {
    const n = ++seq.current;
    setLoading(true);
    setError("");
    const apply = (x) => n === seq.current && setR(x.data);
    saleService
      .report(JSON.parse(key), { onFresh: apply })
      .then(apply)
      .catch((e) => n === seq.current && setError(e.message || "Error"))
      .finally(() => n === seq.current && setLoading(false));
  }, [key, tick]);

  if (error) return <div className="md-card sl-msg">{error}</div>;
  if (!r) return <div className="md-card sl-msg">{L("កំពុងផ្ទុក...", "Loading...")}</div>;
  const k = r.kpi;
  const showCost = cost && k.profit !== undefined;
  const maxDay = Math.max(1e-9, ...r.by_day.map((d) => d.total));
  const hours = [];
  if (r.by_hour.length) {
    const hs = r.by_hour.map((h) => h.hour);
    for (let h = Math.min(7, ...hs); h <= Math.max(21, ...hs); h++) hours.push(r.by_hour.find((x) => x.hour === h) || { hour: h, total: 0, count: 0 });
  }
  const maxHour = Math.max(1e-9, ...hours.map((h) => h.total));
  const manyDays = r.by_day.length > 1;

  return (
    <div className={`sl-report ${loading ? "is-loading" : ""}`}>
      {/* ---------- KPIs ---------- */}
      <div className="sl-kpis">
        <div className="sl-kpi sl-kpi-hero">
          <span>{L("លក់សរុប", "Sales")}</span>
          <b>{usd(k.total)}</b>
          <small>{k.refund_count ? `${L("សុទ្ធ", "Net")} ${usd(k.net_total)} · ${L("សង", "refunds")} −${usd(k.refund_total)}` : khr(k.total_khr)}</small>
          <Change now={k.total} before={k.prev.total} />
        </div>
        <button type="button" className="sl-kpi" onClick={onOpenInvoices}>
          <span>{L("វិក្កយបត្រ", "Invoices")}</span>
          <b>{num(k.count, 0)}</b>
          <small>{L("មធ្យម", "avg.")} {usd(k.average)}</small>
          <Change now={k.count} before={k.prev.count} />
        </button>
        <div className="sl-kpi">
          <span>{L("ទំនិញលក់", "Items sold")}</span>
          <b>{num(k.item_qty)}</b>
          <small>{k.count ? `${num(k.item_qty / k.count, 1)} ${L("ក្នុងមួយវិក្កយបត្រ", "per invoice")}` : "—"}</small>
        </div>
        <div className="sl-kpi">
          <span>{L("បញ្ចុះតម្លៃ", "Discounts")}</span>
          <b>{usd(k.discount_total)}</b>
          <small>{k.discount_count} {L("វិក្កយបត្រ", "invoices")}{k.subtotal ? ` · ${pct((k.discount_total / k.subtotal) * 100)}` : ""}</small>
          {k.override_count > 0 && <small className="sl-warn"><ShieldAlert size={13} /> {k.override_count} {L("លក់ពេលអស់ស្តុក", "sold out of stock")}</small>}
          {k.refund_count > 0 && <small className="sl-warn sl-refund"><RotateCcw size={13} /> {k.refund_count} {L("សងប្រាក់", "refunds")}{k.void_count ? ` (${k.void_count} void)` : ""} · −{usd(k.refund_total)}</small>}
        </div>
        {showCost && (
          <div className="sl-kpi sl-kpi-profit">
            <span>{L("ប្រាក់ចំណេញដុល", "Gross profit")}</span>
            <b>{usd(k.profit)}</b>
            <small>{L("ថ្លៃដើម", "Cost")} {usd(k.cost_total)} · {L("អត្រា", "margin")} {pct(k.margin)}</small>
            <Change now={k.profit} before={k.prev.profit} />
          </div>
        )}
      </div>
      <p className="sl-note">
        {r.range.from === r.range.to ? dayLabel(r.range.from, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : `${dayLabel(r.range.from)} – ${dayLabel(r.range.to, { day: "numeric", month: "short", year: "numeric" })}`}
        {k.first_at && ` · ${L("លក់ដំបូង", "first sale")} ${timeText(k.first_at)}, ${L("ចុងក្រោយ", "last")} ${timeText(k.last_at)}`}
        {` · ${L("ធៀបនឹង", "compared with")} ${dayLabel(k.prev.from)}${k.prev.from !== k.prev.to ? ` – ${dayLabel(k.prev.to)}` : ""}`}
        {k.tax_total > 0 && ` · ${L("ពន្ធ", "tax")} ${usd(k.tax_total)}`}
      </p>

      {!k.count ? (
        <div className="md-card sl-msg">{L("មិនមានការលក់ក្នុងរយៈពេលនេះ", "No sales in this period")}</div>
      ) : (
        <>
          {/* ---------- by day / by hour ---------- */}
          <div className="sl-grid">
            <section className="md-card sl-card sl-span2">
              <h4>{manyDays ? L("លក់តាមថ្ងៃ", "Sales by day") : L("លក់តាមម៉ោង", "Sales by hour")}</h4>
              {manyDays ? (
                <div className="sl-cols" style={{ "--n": r.by_day.length }}>
                  {r.by_day.map((d) => (
                    <div key={d.date} className="sl-col" title={`${d.date} · ${d.count} · ${usd(d.total)}${d.profit !== undefined ? ` · ${L("ចំណេញ", "profit")} ${usd(d.profit)}` : ""}`}>
                      <i style={{ height: `${(d.total / maxDay) * 100}%` }} className={d.total ? "" : "zero"}>{d.profit !== undefined && d.total > 0 && <em style={{ height: `${Math.max(0, (d.profit / d.total) * 100)}%` }} />}</i>
                      <span>{r.by_day.length <= 16 || new Date(`${d.date}T12:00:00Z`).getUTCDate() % 5 === 1 ? dayLabel(d.date, r.by_day.length <= 8 ? { weekday: "short", day: "numeric" } : { day: "numeric" }) : ""}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sl-cols" style={{ "--n": hours.length }}>
                  {hours.map((h) => (
                    <div key={h.hour} className="sl-col" title={`${h.hour}:00 · ${h.count} · ${usd(h.total)}`}>
                      <i style={{ height: `${(h.total / maxHour) * 100}%` }} className={h.total ? "" : "zero"} />
                      <span>{h.hour}</span>
                    </div>
                  ))}
                </div>
              )}
              {manyDays && showCost && <div className="sl-legend"><span><i /> {L("លក់", "Sales")}</span><span><i className="p" /> {L("ចំណេញ", "Profit")}</span></div>}
            </section>
            {manyDays && (
              <section className="md-card sl-card">
                <h4>{L("ម៉ោងលក់ដាច់", "Busy hours")}</h4>
                <Bars rows={[...r.by_hour].sort((a, b) => b.total - a.total).slice(0, 6)} label={(h) => `${String(h.hour).padStart(2, "0")}:00 – ${String(h.hour + 1).padStart(2, "0")}:00`} sub={(h) => ` · ${h.count}`} />
                {r.by_weekday.length > 1 && (
                  <>
                    <h4 className="sl-h4b">{L("តាមថ្ងៃក្នុងសប្តាហ៍", "By weekday")}</h4>
                    <Bars rows={r.by_weekday} label={(d) => WEEKDAYS[d.day]} sub={(d) => ` · ${d.count}`} />
                  </>
                )}
              </section>
            )}

            {!portal && r.by_shop.length > 0 && (
              <section className="md-card sl-card">
                <h4>{L("តាមហាង", "By shop")}</h4>
                <Bars rows={r.by_shop} label={(x) => x.warehouse?.code || "-"} sub={(x) => ` ${nm(x.warehouse)} · ${x.count}`} right={(x) => <>{usd(x.total)}{x.profit !== undefined && <small>{usd(x.profit)}</small>}</>} onPick={(x) => onPick("warehouse_id", String(x._id))} />
              </section>
            )}
            <section className="md-card sl-card">
              <h4>{L("តាមអ្នកគិតលុយ", "By cashier")}</h4>
              <Bars rows={r.by_cashier} label={(x) => x.name} sub={(x) => ` · ${x.count}`} onPick={(x) => x._id && onPick("cashier_id", String(x._id))} />
            </section>
            <section className="md-card sl-card">
              <h4>{L("តាមម៉ាស៊ីន POS", "By POS")}</h4>
              <Bars rows={r.by_device} label={(x) => x.device?.code || "-"} sub={(x) => ` ${x.device?.name || ""} · ${x.count}`} onPick={(x) => onPick("device_id", String(x._id))} />
            </section>
            <section className="md-card sl-card">
              <h4>{L("វិធីបង់ប្រាក់", "Payments")} <small>{L("(ដកប្រាក់អាប់ចេញ)", "(after change)")}</small></h4>
              <Bars rows={r.methods} value={(m) => m.net_usd} label={(m) => nm(m)} sub={(m) => ` · ${m.count}`} right={(m) => <>{usd(m.net_usd)}{m.currency === "KHR" && <small>{L("ទទួល", "received")} {khr(m.amount)}</small>}</>} />
            </section>
            <section className="md-card sl-card">
              <h4>{L("តាមប្រភេទទំនិញ", "By category")}</h4>
              <Bars rows={r.categories} label={(c) => nm(c.category) || L("គ្មានប្រភេទ", "No category")} sub={(c) => ` · ${num(c.qty)}`} right={(c) => <>{usd(c.total)}{c.profit !== undefined && <small>{usd(c.profit)}</small>}</>} />
            </section>
          </div>

          {/* ---------- top items ---------- */}
          <section className="md-card sl-card">
            <h4>{L("ទំនិញលក់ដាច់ជាងគេ", "Best-selling items")}</h4>
            <div className="md-table-scroll">
              <table className="md-table sl-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{L("ទំនិញ", "Item")}</th>
                    <th className="sl-num">{L("ចំនួន", "Qty")}</th>
                    <th className="sl-num">{L("វិក្កយបត្រ", "Invoices")}</th>
                    <th className="sl-num">{L("លក់", "Sales")}</th>
                    {showCost && <th className="sl-num">{L("ថ្លៃដើម", "Cost")}</th>}
                    {showCost && <th className="sl-num">{L("ចំណេញ", "Profit")}</th>}
                    {showCost && <th className="sl-num">%</th>}
                  </tr>
                </thead>
                <tbody>
                  {r.top_items.slice(0, allItems ? 30 : 10).map((i, n) => (
                    <tr key={i.variant_id}>
                      <td className="sl-rank">{n + 1}</td>
                      <td>
                        <span className="sl-item">
                          {i.product?.image ? <img src={i.product.image} alt="" /> : <span className="sl-noimg"><Package size={15} /></span>}
                          <span><b>{nm(i.product) || nm(i)}</b><small className="md-code">{i.sku}</small></span>
                        </span>
                      </td>
                      <td className="sl-num">{num(i.qty)}</td>
                      <td className="sl-num">{i.invoices}</td>
                      <td className="sl-num"><b>{usd(i.total)}</b></td>
                      {showCost && <td className="sl-num">{usd(i.cost)}</td>}
                      {showCost && <td className={`sl-num ${i.profit < 0 ? "sl-neg" : ""}`}>{usd(i.profit)}</td>}
                      {showCost && <td className="sl-num sl-muted">{i.total ? pct((i.profit / i.total) * 100) : "-"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {r.top_items.length > 10 && (
              <button type="button" className="sl-more" onClick={() => setAllItems(!allItems)}>
                {allItems ? L("បង្ហាញតិច", "Show less") : L(`បង្ហាញទាំង ${r.top_items.length}`, `Show all ${r.top_items.length}`)}
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
