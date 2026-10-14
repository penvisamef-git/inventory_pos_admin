import React, { useEffect, useRef, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Printer, X } from "lucide-react";
import { api } from "../api";
import { L, LANG, usd, khr, qtyText, timeText, dateTimeText } from "../i18n";

const ymd = (d) => new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10); // Phnom Penh day
const shiftDay = (date, n) => ymd(new Date(Date.parse(`${date}T12:00:00+07:00`) + n * 86400000));
const dayName = (date, long) => new Date(`${date}T12:00:00+07:00`).toLocaleDateString(LANG === "en" ? "en-GB" : "km-KH", long ? { weekday: "long", day: "numeric", month: "long", year: "numeric" } : { weekday: "short", day: "numeric" });
const name2 = (o, kh = "name_kh", en = "name_en") => (LANG === "en" ? o[en] || o[kh] : o[kh] || o[en]) || "";

// Sales of one day: a cashier sees their own sales; a shop manager sees everyone (or picks one person).
export default function Report({ user, catalog, onClose, printSlip }) {
  const today = ymd(new Date());
  const [date, setDate] = useState(today);
  const [who, setWho] = useState("");
  const [staff, setStaff] = useState([]);
  const [r, setR] = useState(null);
  const [error, setError] = useState("");
  const slip = useRef(null);

  useEffect(() => {
    if (user.is_manager) api.users().then(setStaff).catch(() => {});
  }, [user.is_manager]);
  useEffect(() => {
    setError("");
    api.report({ date, ...(who ? { user_id: who } : {}) }).then(setR).catch((e) => setError(e.message));
  }, [date, who]);

  const maxHour = Math.max(1, ...(r?.hours || []).map((h) => h.total));
  const maxDay = Math.max(1, ...(r?.days || []).map((d) => d.total));
  const maxItem = Math.max(1, ...(r?.top_items || []).map((i) => i.total));
  const whoName = r?.scope === "own" ? user.name : who ? staff.find((s) => String(s._id) === who)?.name || "" : L("បុគ្គលិកទាំងអស់", "All staff");
  // hours from the first to the last sale (at least 8:00–20:00)
  const hours = [];
  if (r) {
    const hs = r.hours.map((h) => h.hour);
    for (let h = Math.min(8, ...hs); h <= Math.max(20, ...hs); h++) hours.push(r.hours.find((x) => x.hour === h) || { hour: h, total: 0, count: 0 });
  }

  return (
    <div className="pos-back" onMouseDown={onClose}>
      <div className="pos-dialog rp" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pos-dialog-head">
          <h3><BarChart3 size={20} /> {user.is_manager ? L("របាយការណ៍លក់", "Sales report") : L("របាយការណ៍លក់របស់ខ្ញុំ", "My sales report")}</h3>
          <div className="rp-tools">
            {user.is_manager && (
              <select value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="">{L("បុគ្គលិកទាំងអស់", "All staff")}</option>
                {staff.map((s) => <option key={s._id} value={String(s._id)}>{s.name}</option>)}
              </select>
            )}
            <div className="rp-date">
              <button type="button" onClick={() => setDate(shiftDay(date, -1))}><ChevronLeft size={18} /></button>
              <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
              <button type="button" onClick={() => setDate(shiftDay(date, 1))} disabled={date >= today}><ChevronRight size={18} /></button>
            </div>
            {date !== today && <button type="button" className="pos-btn pos-btn-ghost" onClick={() => setDate(today)}>{L("ថ្ងៃនេះ", "Today")}</button>}
            <button type="button" className="pos-btn pos-btn-ghost" onClick={() => slip.current && printSlip(slip.current)} disabled={!r}><Printer size={17} /> {L("បោះពុម្ព", "Print")}</button>
            <button type="button" className="pos-icon" onClick={onClose}><X size={20} /></button>
          </div>
        </div>

        <div className="pos-dialog-body rp-body">
          {error && <div className="pos-error">{error}</div>}
          {!r && !error && <p className="pos-muted">{L("កំពុងផ្ទុក...", "Loading...")}</p>}
          {r && (
            <>
              <div className="rp-title">
                <b>{dayName(r.date, true)}</b>
                <span>{whoName}{r.first_at ? ` · ${timeText(r.first_at)} – ${timeText(r.last_at)}` : ""}</span>
              </div>

              <div className="rp-kpis">
                <div className="rp-kpi rp-kpi-main"><span>{L("លក់សរុប", "Sales")}</span><b>{usd(r.sales_total)}</b><small>{r.refund_count ? `${L("សង", "refunds")} −${usd(r.refund_total)} · ${L("សុទ្ធ", "net")} ${usd(r.net_total)}` : khr(r.sales_total_khr)}</small></div>
                <div className="rp-kpi"><span>{L("វិក្កយបត្រ", "Invoices")}</span><b>{r.invoice_count}</b><small>{L("មធ្យម", "avg.")} {usd(r.average)}</small></div>
                <div className="rp-kpi"><span>{L("ទំនិញលក់", "Items sold")}</span><b>{qtyText(r.items_qty)}</b><small>{r.top_items.length ? `${r.top_items.length}+ ${L("មុខ", "kinds")}` : "—"}</small></div>
                <div className="rp-kpi"><span>{L("បញ្ចុះតម្លៃ", "Discounts")}</span><b>{usd(r.discount_total)}</b><small>{r.discount_count} {L("វិក្កយបត្រ", "invoices")}</small></div>
              </div>

              {!r.invoice_count ? (
                <div className="rp-empty">{L("មិនមានការលក់នៅថ្ងៃនេះទេ", "No sales on this day")}</div>
              ) : (
                <div className="rp-grid">
                  <section className="rp-card">
                    <h4>{L("តាមម៉ោង", "By hour")}</h4>
                    <div className="rp-hours">
                      {hours.map((h) => (
                        <div key={h.hour} title={`${h.hour}:00 · ${h.count} · ${usd(h.total)}`}>
                          <i style={{ height: `${(h.total / maxHour) * 100}%` }} className={h.total ? "" : "zero"} />
                          <span>{h.hour}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rp-card">
                    <h4>{L("វិធីបង់ប្រាក់", "Payments")}</h4>
                    <div className="rp-bars">
                      {r.methods.map((m) => (
                        <div key={m.code}>
                          <span>{name2(m)} <small>({m.count})</small></span>
                          <b>{usd(m.amount_usd)}</b>
                          <i><em style={{ width: `${r.sales_total ? (m.amount_usd / r.sales_total) * 100 : 0}%` }} /></i>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rp-card">
                    <h4>{L("ទំនិញលក់ដាច់", "Top items")}</h4>
                    <div className="rp-bars">
                      {r.top_items.map((i, k) => (
                        <div key={k}>
                          <span>{name2(i)} <small>× {qtyText(i.qty)} {name2(i, "unit_name_kh", "unit_name_en")}</small></span>
                          <b>{usd(i.total)}</b>
                          <i><em style={{ width: `${(i.total / maxItem) * 100}%` }} /></i>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rp-card">
                    <h4>{L("៧ ថ្ងៃចុងក្រោយ", "Last 7 days")}</h4>
                    <div className="rp-days">
                      {r.days.map((d) => (
                        <button key={d.date} type="button" className={d.date === r.date ? "on" : ""} onClick={() => setDate(d.date)} title={`${d.count} · ${usd(d.total)}`}>
                          <small>{d.total ? usd(d.total) : ""}</small>
                          <i style={{ height: `${(d.total / maxDay) * 100}%` }} />
                          <span>{dayName(d.date)}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="rp-card">
                    <h4>{L("វេន", "Shifts")}</h4>
                    <div className="rp-table">
                      {r.shifts.map((s) => (
                        <div key={s._id}>
                          <span><b>{s.shift_no}</b><small>{timeText(s.opened_at)}{s.closed_at ? ` – ${timeText(s.closed_at)}` : ` · ${L("កំពុងបើក", "open")}`}{s.opened_by_name ? ` · ${s.opened_by_name}` : ""}</small></span>
                          <span>{s.count}</span>
                          <b>{usd(s.total)}</b>
                        </div>
                      ))}
                    </div>
                  </section>

                  {r.cashiers.length > 0 && (
                    <section className="rp-card">
                      <h4>{L("តាមអ្នកគិតលុយ", "By cashier")}</h4>
                      <div className="rp-table">
                        {r.cashiers.map((c) => (
                          <button key={c._id} type="button" onClick={() => setWho(String(c._id))}>
                            <span><b>{c.name}</b></span>
                            <span>{c.count}</span>
                            <b>{usd(c.total)}</b>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* 80 mm slip for the printer (hidden) */}
        {r && (
          <div className="rp-slip" aria-hidden>
            <div className="rc" ref={slip}>
              <div className="rc-head">
                <b>{L("របាយការណ៍លក់ប្រចាំថ្ងៃ", "Daily sales report")}</b>
                <span>{name2(catalog.warehouse || {})} · {catalog.device?.code}</span>
                <span>{r.date} · {whoName}</span>
              </div>
              <div className="rc-sum">
                <div><span>{L("វិក្កយបត្រ", "Invoices")}</span><span>{r.invoice_count}</span></div>
                <div><span>{L("ទំនិញលក់", "Items sold")}</span><span>{qtyText(r.items_qty)}</span></div>
                <div><span>{L("បញ្ចុះតម្លៃ", "Discounts")}</span><span>{usd(r.discount_total)}</span></div>
                {r.tax_total > 0 && <div><span>{L("ពន្ធ", "Tax")}</span><span>{usd(r.tax_total)}</span></div>}
                <div className="rc-total"><span>{L("លក់សរុប", "Sales")}</span><span>{usd(r.sales_total)}</span></div>
                {r.refund_count > 0 && <div><span>{L("សងប្រាក់", "Refunds")} ({r.refund_count})</span><span>−{usd(r.refund_total)}</span></div>}
                {r.refund_count > 0 && <div><span>{L("លក់សុទ្ធ", "Net sales")}</span><span>{usd(r.net_total)}</span></div>}
              </div>
              <div className="rc-pay">
                {r.methods.map((m) => <div key={m.code}><span>{name2(m)} ({m.count})</span><span>{usd(m.amount_usd)}</span></div>)}
              </div>
              {r.cashiers.length > 0 && <div className="rc-pay">{r.cashiers.map((c) => <div key={c._id}><span>{c.name} ({c.count})</span><span>{usd(c.total)}</span></div>)}</div>}
              <div className="rc-pay">
                {r.top_items.slice(0, 5).map((i, k) => <div key={k}><span>{name2(i)} × {qtyText(i.qty)}</span><span>{usd(i.total)}</span></div>)}
              </div>
              <div className="rc-foot"><span>{L("បោះពុម្ព", "Printed")} {dateTimeText(new Date())} · {user.name}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
