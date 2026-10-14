import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, Eye, HandCoins, Search, X } from "lucide-react";
import { payableService } from "../../../api/api.service";
import Auth from "../../util/auth";
import { ACCESS, canAccess } from "../../util/permission";
import { exportExcel } from "../../util/excel";
import { L } from "../../../i18n";
import "../master_data/masterdata.style.css";
import "../master_data/masterdata.theme.css";
import "./supplierdebt.style.css";

// What we owe each supplier: posted goods receives − payments. Oldest bill is paid first; a bill is late
// after the supplier's payment terms (days). Pay: admin / central manager / accountant · void a payment: admin.
const usd = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Phnom_Penh" }) : "-");
const today = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const METHODS = [
  ["bank", L("ធនាគារ", "Bank")],
  ["cash", L("សាច់ប្រាក់", "Cash")],
  ["cheque", L("មូលប្បទានបត្រ", "Cheque")],
  ["other", L("ផ្សេងៗ", "Other")],
];
const methodName = (m) => METHODS.find((x) => x[0] === m)?.[1] || m;
const who = (u) => (u ? `${u.firstname || ""} ${u.lastname || ""}`.trim() || u.email : "");

function DebtDetail({ supplierId, isAdmin, onClose, onChanged }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [pay, setPay] = useState({ amount: "", paid_at: today(), method: "bank", reference: "", note: "" });
  const [busy, setBusy] = useState(false);
  const load = () => payableService.get(supplierId).then((r) => setD(r.data)).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await payableService.pay({ supplier_id: supplierId, ...pay, amount: Number(pay.amount), paid_at: `${pay.paid_at}T12:00:00+07:00` });
      setPay({ amount: "", paid_at: today(), method: "bank", reference: "", note: "" });
      await load();
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const voidIt = async (p) => {
    const reason = window.prompt(L(`មូលហេតុលុបចោល ${p.doc_no}?`, `Reason to void ${p.doc_no}?`));
    if (!reason || !reason.trim()) return;
    try {
      await payableService.voidPayment(p._id, reason.trim());
      await load();
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <div className="md-modal-backdrop" onMouseDown={onClose}>
      <div className="md-modal sd-detail" onMouseDown={(e) => e.stopPropagation()}>
        <div className="md-modal-header">
          <h3>{d ? `${d.supplier.name} · ${d.supplier.code}` : "…"}</h3>
          <button type="button" className="md-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="md-modal-body">
          {error && <div className="md-form-error">{error}</div>}
          {d && (
            <>
              <div className="sd-tiles">
                <div><span>{L("ទិញសរុប", "Billed")}</span><b>{usd(d.billed)}</b></div>
                <div><span>{L("បានបង់", "Paid")}</span><b>{usd(d.paid)}</b></div>
                <div className="due"><span>{L("នៅជំពាក់", "We owe")}</span><b>{usd(d.balance)}</b></div>
                <div className={d.overdue > 0 ? "late" : ""}><span>{L("ហួសកំណត់", "Overdue")}</span><b>{usd(d.overdue)}</b></div>
              </div>
              <p className="sd-line">{L("រយៈពេលបង់", "Payment terms")}: {d.supplier.payment_term_days || 0} {L("ថ្ងៃ", "days")}{d.supplier.phone ? ` · 📞 ${d.supplier.phone}` : ""}{d.supplier.contact_name ? ` · ${d.supplier.contact_name}` : ""}</p>
              {d.balance > 0.004 && (
                <div className="sd-pay">
                  <input type="number" step="0.01" min="0" placeholder={L("ចំនួន ($)", "Amount ($)")} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                  <button type="button" className="md-btn md-btn-ghost" onClick={() => setPay({ ...pay, amount: String(d.balance) })}>{L("ទាំងអស់", "All")} {usd(d.balance)}</button>
                  <input type="date" value={pay.paid_at} max={today()} onChange={(e) => setPay({ ...pay, paid_at: e.target.value })} />
                  <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                    {METHODS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                  <input placeholder={L("លេខយោង", "Reference")} value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
                  <input placeholder={L("កំណត់សម្គាល់", "Note")} value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} />
                  <button type="button" className="md-btn md-btn-primary" disabled={busy || !(Number(pay.amount) > 0)} onClick={save}><HandCoins size={15} /> {busy ? "…" : L("កត់ត្រាការបង់", "Record payment")}</button>
                </div>
              )}
              <div className="sd-cols">
                <section>
                  <h4>{L("វិក្កយបត្រទិញ (ទទួលទំនិញ)", "Bills (goods receives)")}</h4>
                  <table className="md-table sd-table">
                    <thead>
                      <tr><th>{L("ឯកសារ", "Doc")}</th><th>{L("កំណត់បង់", "Due")}</th><th className="r">{L("ចំនួន", "Bill")}</th><th className="r">{L("នៅខ្វះ", "Left")}</th></tr>
                    </thead>
                    <tbody>
                      {d.bills.map((b) => (
                        <tr key={b._id} className={b.overdue ? "late" : b.due <= 0 ? "done" : ""}>
                          <td><b>{b.doc_no}</b><span className="md-sub">{day(b.posted_at || b.doc_date)}{b.supplier_invoice_no ? ` · ${b.supplier_invoice_no}` : ""}</span></td>
                          <td>{day(b.due_date)}{b.overdue && <span className="md-sub late">{b.days_late} {L("ថ្ងៃហួស", "days late")}</span>}</td>
                          <td className="r">{usd(b.bill)}</td>
                          <td className="r"><b>{b.due > 0 ? usd(b.due) : "✓"}</b></td>
                        </tr>
                      ))}
                      {!d.bills.length && <tr><td colSpan={4} className="md-empty">{L("មិនទាន់មាន", "Nothing yet")}</td></tr>}
                    </tbody>
                  </table>
                </section>
                <section>
                  <h4>{L("ការបង់ប្រាក់", "Payments")}</h4>
                  <table className="md-table sd-table">
                    <tbody>
                      {d.payments.map((p) => (
                        <tr key={p._id} className={p.voided ? "void" : ""}>
                          <td><b>{p.doc_no}</b><span className="md-sub">{day(p.paid_at)} · {methodName(p.method)}{p.reference ? ` · ${p.reference}` : ""}</span>{p.note && <span className="md-sub">{p.note}</span>}{p.voided && <span className="md-sub late">{L("លុបចោល", "Voided")}: {p.void_reason} ({who(p.voided_by)})</span>}</td>
                          <td className="r"><b>{usd(p.amount)}</b><span className="md-sub">{who(p.created_by)}</span></td>
                          <td className="r">{isAdmin && !p.voided && <button type="button" className="md-btn md-btn-ghost sd-void" onClick={() => voidIt(p)}>{L("លុបចោល", "Void")}</button>}</td>
                        </tr>
                      ))}
                      {!d.payments.length && <tr><td className="md-empty">{L("មិនទាន់មាន", "Nothing yet")}</td></tr>}
                    </tbody>
                  </table>
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SupplierDebtComponent() {
  const login = new Auth().getClientLogin() || {};
  const isAdmin = canAccess(login, ACCESS.ADMIN);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(true);
  const [res, setRes] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [tick, setTick] = useState(0);
  const seq = useRef(0);
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const n = ++seq.current;
    payableService
      .list({ ...(query ? { q: query } : {}), ...(open ? { open: 1 } : {}) })
      .then((r) => n === seq.current && setRes(r))
      .catch((e) => n === seq.current && setRes({ data: [], error: e.message }));
  }, [query, open, tick]);
  const rows = res?.data || [];
  const t = res?.totals;
  const download = () =>
    exportExcel(`supplier-debts-${today()}.xlsx`, "Supplier debts", [
      { label: L("អ្នកផ្គត់ផ្គង់", "Supplier"), value: (r) => r.supplier.name, width: 30 },
      { label: L("កូដ", "Code"), value: (r) => r.supplier.code, width: 14 },
      { label: L("ទិញសរុប ($)", "Billed ($)"), value: (r) => r.billed, type: "number", total: t?.billed },
      { label: L("បានបង់ ($)", "Paid ($)"), value: (r) => r.paid, type: "number", total: t?.paid },
      { label: L("នៅជំពាក់ ($)", "We owe ($)"), value: (r) => r.balance, type: "number", total: t?.balance },
      { label: L("ហួសកំណត់ ($)", "Overdue ($)"), value: (r) => r.overdue, type: "number", total: t?.overdue },
      { label: L("ថ្ងៃហួសច្រើនបំផុត", "Most days late"), value: (r) => r.max_days_late, type: "number" },
      { label: L("បង់ចុងក្រោយ", "Last paid"), value: (r) => (r.last_paid_at ? day(r.last_paid_at) : ""), width: 14 },
    ], rows, { totals: { label: L("សរុប", "Total") } });

  return (
    <div className="md-page sd-page">
      <div className="sd-sum">
        <div className="due"><span>{L("នៅជំពាក់អ្នកផ្គត់ផ្គង់", "We owe suppliers")}</span><b>{t ? usd(t.balance) : "…"}</b><small>{t ? `${t.suppliers_owed} ${L("អ្នកផ្គត់ផ្គង់", "suppliers")}` : ""}</small></div>
        <div className={t?.overdue > 0 ? "late" : ""}><span><AlertTriangle size={14} /> {L("ហួសកំណត់", "Overdue")}</span><b>{t ? usd(t.overdue) : "…"}</b></div>
        <div><span>{L("បានបង់", "Paid")}</span><b>{t ? usd(t.paid) : "…"}</b></div>
      </div>
      <div className="md-toolbar">
        <div className="md-toolbar-left">
          <label className="md-search">
            <Search size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L("ស្វែងរកអ្នកផ្គត់ផ្គង់", "Search supplier")} />
          </label>
          <label className="sd-check"><input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> {L("តែអ្នកដែលយើងនៅជំពាក់", "Only suppliers we owe")}</label>
        </div>
        <button type="button" className="md-btn md-btn-ghost" disabled={!rows.length} onClick={download}><Download size={15} /> Excel</button>
      </div>
      <div className="md-card">
        {res?.error ? (
          <div className="md-empty">{res.error}</div>
        ) : rows.length ? (
          <div className="md-table-scroll">
            <table className="md-table sd-table sd-click">
              <thead>
                <tr>
                  <th>{L("អ្នកផ្គត់ផ្គង់", "Supplier")}</th>
                  <th className="r">{L("ទិញសរុប", "Billed")}</th>
                  <th className="r">{L("បានបង់", "Paid")}</th>
                  <th className="r">{L("នៅជំពាក់", "We owe")}</th>
                  <th className="r">{L("ហួសកំណត់", "Overdue")}</th>
                  <th>{L("បង់ចុងក្រោយ", "Last paid")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.supplier._id} onClick={() => setViewing(r.supplier._id)}>
                    <td><b>{r.supplier.name}</b><span className="md-sub">{r.supplier.code} · {r.supplier.payment_term_days || 0} {L("ថ្ងៃ", "days")}{r.open_bills ? ` · ${r.open_bills} ${L("វិក្កយបត្រមិនទាន់បង់", "open bills")}` : ""}</span></td>
                    <td className="r">{usd(r.billed)}</td>
                    <td className="r">{usd(r.paid)}</td>
                    <td className="r"><b>{usd(r.balance)}</b></td>
                    <td className={`r ${r.overdue > 0 ? "late" : ""}`}>{r.overdue > 0 ? <>{usd(r.overdue)}<span className="md-sub">{r.max_days_late} {L("ថ្ងៃ", "days")}</span></> : "-"}</td>
                    <td>{day(r.last_paid_at)}</td>
                    <td className="r"><Eye size={16} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="md-empty">{!res ? L("កំពុងផ្ទុក...", "Loading...") : L("មិនជំពាក់អ្នកណាទេ 🎉", "We owe nobody 🎉")}</div>
        )}
      </div>
      {viewing && <DebtDetail supplierId={viewing} isAdmin={isAdmin} onClose={() => setViewing(null)} onChanged={() => setTick((n) => n + 1)} />}
    </div>
  );
}
