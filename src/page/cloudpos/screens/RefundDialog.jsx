import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Minus, Plus, Printer, RotateCcw, X } from "lucide-react";
import { api } from "../api";
import { L, LANG, nm, usd, khr, qtyText, dateTimeText } from "../i18n";
import { r2, roundKhr } from "../cart";
import { printReceipt } from "./Receipt";

const lineName = (i) => (LANG === "en" ? i.name_en || i.name_kh : i.name_kh || i.name_en);
const unitName = (i) => (LANG === "en" ? i.unit_name_en || i.unit_code : i.unit_name_kh || i.unit_code);
const REASONS = [
  [L("ខុសទំហំ / ពណ៌", "Wrong size / colour")],
  [L("អតិថិជនប្តូរចិត្ត", "Customer changed mind")],
  [L("ទំនិញខូច", "Damaged item")],
  [L("អ្នកគិតលុយច្រឡំ", "Cashier mistake")],
];

// 80 mm refund slip
export function RefundPaper({ refund: rf, catalog }) {
  const wh = catalog?.warehouse || {};
  return (
    <div className="rc">
      <div className="rc-head">
        <b>{rf.kind === "void" ? L("វិក្កយបត្រលុបចោល", "VOID") : L("បង្កាន់ដៃសងប្រាក់", "REFUND")}</b>
        <span>{nm(wh)}</span>
      </div>
      <div className="rc-meta">
        <span>{L("លេខ", "No.")}: <b>{rf.refund_no}</b></span>
        <span>{L("វិក្កយបត្រ", "Invoice")}: {rf.invoice_no}</span>
        <span>{dateTimeText(rf.refunded_at)}</span>
        <span>{L("អ្នកគិតលុយ", "Cashier")}: {rf.cashier_name} · {L("អនុម័ត", "Approved")}: {rf.approved_by_name}</span>
      </div>
      <table className="rc-items">
        <tbody>
          {rf.items.map((i, k) => (
            <React.Fragment key={k}>
              <tr><td colSpan={2} className="rc-name">{lineName(i)}</td></tr>
              <tr><td>{qtyText(i.qty)} {unitName(i)}</td><td className="rc-r">−{usd(i.amount)}</td></tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div className="rc-sum">
        <div className="rc-total"><span>{L("សងវិញ", "REFUND")}</span><span>{usd(rf.total)}</span></div>
        {rf.payments.map((p, k) => <div key={k}><span>{LANG === "en" ? p.name_en : p.name_kh}</span><span>{p.currency === "KHR" ? khr(p.amount) : usd(p.amount)}</span></div>)}
      </div>
      <div className="rc-foot"><span>{L("មូលហេតុ", "Reason")}: {rf.reason}</span></div>
    </div>
  );
}

// Refund some items (or all = void) of an invoice. Money comes from the drawer of the open shift.
export default function RefundDialog({ sale, catalog, user, onClose, onDone }) {
  const sumLines = sale.items.reduce((t, i) => t + (i.line_total || 0), 0);
  const factor = sumLines > 0 ? sale.total / sumLines : 1;
  const left = sale.items.map((i) => Math.max(0, Math.round((i.qty - (i.refunded_qty || 0)) * 10000) / 10000));
  const [qty, setQty] = useState(() => left.map(() => 0));
  const [reason, setReason] = useState("");
  const methods = catalog.payment_methods || [];
  const firstPay = sale.payments?.[0];
  const [methodId, setMethodId] = useState(() => String((methods.find((m) => m.code === firstPay?.code) || methods.find((m) => m.type === "cash" && m.currency !== "KHR") || methods[0])?._id || ""));
  const [managers, setManagers] = useState([]);
  const [who, setWho] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [exchange, setExchange] = useState(false); // keep the money as credit for new items
  const slip = useRef(null);

  useEffect(() => {
    if (user.is_manager) return;
    api.users().then((u) => {
      const m = u.filter((x) => x.is_manager);
      setManagers(m);
      if (m.length === 1) setWho(String(m[0]._id));
    }).catch(() => {});
  }, [user.is_manager]);

  const amounts = sale.items.map((i, k) => r2(((i.line_total || 0) / i.qty) * qty[k] * factor));
  const all = left.every((l, k) => Math.abs(qty[k] - l) < 1e-9) && left.some((l) => l > 0);
  const total = useMemo(() => {
    const t = r2(amounts.reduce((a, b) => a + b, 0));
    return all ? r2(Math.max(0, sale.total - (sale.refunded_total || 0))) : t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qty]);
  const method = methods.find((m) => String(m._id) === methodId);
  const rate = sale.rate || catalog.rate?.rate || 4100;
  const step = Number(catalog.setting?.khr_rounding) || 100;
  const set = (k, v) => setQty((q) => q.map((x, n) => (n === k ? Math.max(0, Math.min(left[k], v)) : x)));

  const go = async () => {
    setError("");
    if (!(total > 0)) return setError(L("សូមជ្រើសទំនិញដែលត្រូវសង", "Choose what to refund"));
    if (!reason.trim()) return setError(L("សូមសរសេរមូលហេតុ", "Write the reason"));
    if (!user.is_manager && (!who || pin.length < 4)) return setError(L("ត្រូវការ PIN អ្នកគ្រប់គ្រងហាង", "A shop manager's PIN is needed"));
    setBusy(true);
    try {
      const r = await api.refundSale(sale.uuid, {
        ...(all ? { all: true } : { lines: qty.map((q, index) => ({ index, qty: q })).filter((l) => l.qty > 0) }),
        reason: reason.trim(),
        method_id: methodId,
        exchange,
        approver: user.is_manager ? null : { user_id: who, pin },
      });
      setDone(r);
      setTimeout(() => slip.current && printReceipt(slip.current), 200);
    } catch (e) {
      setError(e.message);
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="pos-back pos-back-top">
        <div className="pos-dialog pos-rcdlg" onMouseDown={(e) => e.stopPropagation()}>
          <div className="pos-dialog-head"><h3><RotateCcw size={20} /> {done.refund.kind === "void" ? L("បានលុបចោល", "Voided") : L("បានសងប្រាក់", "Refunded")}</h3></div>
          {done.refund.exchange ? (
            <div className="pos-change-big">{L("ឥណទានប្តូរទំនិញ", "Exchange credit")}: <b>{usd(done.refund.total)}</b> <small>{L("— កុំសងលុយ ស្កេនទំនិញថ្មី", "— no cash back, scan the new items")}</small></div>
          ) : (
            <div className="pos-change-big">{L("សងអតិថិជន", "Give back")}: <b>{done.refund.payments.map((p) => (p.currency === "KHR" ? khr(p.amount) : usd(p.amount))).join(" + ")}</b></div>
          )}
          <div className="pos-rc-preview" ref={slip}><RefundPaper refund={done.refund} catalog={catalog} /></div>
          <div className="pos-dialog-foot">
            <button type="button" className="pos-btn pos-btn-ghost" onClick={() => printReceipt(slip.current)}><Printer size={18} /> {L("បោះពុម្ព", "Print")}</button>
            <button type="button" className="pos-btn pos-btn-primary pos-btn-lg" onClick={() => onDone(done.sale, done.refund)}>{L("រួចរាល់", "Done")}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pos-back pos-back-top" onMouseDown={() => !busy && onClose()}>
      <div className="pos-dialog pos-refunddlg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pos-dialog-head">
          <h3><RotateCcw size={20} /> {L("សងប្រាក់", "Refund")} · {sale.invoice_no}</h3>
          <button type="button" className="pos-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="pos-dialog-body">
          <div className="pos-rf-top">
            <span className="pos-muted">{dateTimeText(sale.sold_at)} · {sale.cashier_name} · {usd(sale.total)}{sale.refunded_total ? ` · ${L("បានសងរួច", "already refunded")} ${usd(sale.refunded_total)}` : ""}</span>
            <button type="button" className={`pos-btn ${all ? "pos-btn-danger" : "pos-btn-ghost"}`} onClick={() => setQty(all ? left.map(() => 0) : [...left])}>
              {all ? L("ដកចេញទាំងអស់", "Clear") : sale.refunded_total ? L("សងទាំងអស់ដែលនៅសល់", "Refund all that is left") : L("លុបចោលទាំងមូល (Void)", "Void the whole invoice")}
            </button>
          </div>
          <div className="pos-rf-lines">
            {sale.items.map((i, k) => (
              <div key={k} className={`pos-rf-line ${left[k] <= 0 ? "done" : ""} ${qty[k] > 0 ? "on" : ""}`}>
                <span className="pos-rf-name">
                  <b>{lineName(i)}</b>
                  <small>{i.sku} · {qtyText(i.qty)} {unitName(i)} × {usd(i.price)}{i.refunded_qty ? ` · ${L("សងរួច", "refunded")} ${qtyText(i.refunded_qty)}` : ""}</small>
                </span>
                {left[k] > 0 ? (
                  <div className="pos-qty">
                    <button type="button" onClick={() => set(k, qty[k] - 1)} disabled={qty[k] <= 0}><Minus size={16} /></button>
                    <input value={qtyText(qty[k])} readOnly />
                    <button type="button" onClick={() => set(k, qty[k] + 1)} disabled={qty[k] >= left[k]}><Plus size={16} /></button>
                  </div>
                ) : (
                  <em className="pos-rf-tag">{L("សងរួច", "Refunded")}</em>
                )}
                <b className="pos-rf-amt">{qty[k] > 0 ? `−${usd(amounts[k])}` : ""}</b>
              </div>
            ))}
          </div>
          <div className="pos-rf-reason">
            <div className="pos-quick">
              {REASONS.map(([x]) => <button key={x} type="button" className={reason === x ? "on" : ""} onClick={() => setReason(x)}>{x}</button>)}
            </div>
            <input className="pos-ref" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder={L("មូលហេតុ (ចាំបាច់)", "Reason (required)")} />
          </div>
          <div className="pos-seg pos-rf-mode">
            <button type="button" className={!exchange ? "on" : ""} onClick={() => setExchange(false)}><RotateCcw size={16} /> {L("សងលុយ", "Money back")}</button>
            <button type="button" className={exchange ? "on in" : ""} onClick={() => setExchange(true)}><ArrowLeftRight size={16} /> {L("ប្តូរយកទំនិញផ្សេង", "Exchange for other items")}</button>
          </div>
          <div className="pos-rf-pay">
            <label style={exchange ? { visibility: "hidden" } : undefined}>
              <span>{L("សងតាម", "Give back by")}</span>
              <select value={methodId} onChange={(e) => setMethodId(e.target.value)}>
                {methods.map((m) => <option key={m._id} value={String(m._id)}>{nm(m)}</option>)}
              </select>
            </label>
            <div className="pos-rf-total">
              <span>{L("សងវិញ", "Refund")}</span>
              <b>{usd(total)}</b>
              {method?.currency === "KHR" && <small>{khr(roundKhr(total * rate, step))}</small>}
            </div>
          </div>
          {!user.is_manager && (
            <div className="pos-approve">
              <b>{L("ការអនុម័តដោយអ្នកគ្រប់គ្រងហាង", "Shop manager approval")}</b>
              <select value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="">{L("-- ជ្រើសរើស --", "-- Choose --")}</option>
                {managers.map((m) => <option key={m._id} value={String(m._id)}>{m.name}</option>)}
              </select>
              <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => /^\d*$/.test(e.target.value) && setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} placeholder="PIN" />
            </div>
          )}
          {error && <div className="pos-error">{error}</div>}
        </div>
        <div className="pos-dialog-foot">
          <button type="button" className="pos-btn pos-btn-ghost" onClick={onClose} disabled={busy}>{L("ត្រឡប់", "Back")}</button>
          <button type="button" className={`pos-btn pos-btn-lg ${exchange ? "pos-btn-primary" : "pos-btn-danger"}`} onClick={go} disabled={busy || !(total > 0)}>
            {busy ? "…" : exchange ? L(`ប្តូរ · ឥណទាន ${usd(total)}`, `Exchange · ${usd(total)} credit`) : all && !sale.refunded_total ? L(`លុបចោល · សង ${usd(total)}`, `Void · give back ${usd(total)}`) : L(`សង ${usd(total)}`, `Refund ${usd(total)}`)}
          </button>
        </div>
      </div>
    </div>
  );
}
