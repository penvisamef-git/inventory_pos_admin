import React, { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, Landmark, QrCode, Trash2, X } from "lucide-react";
import { api } from "../api";
import { L, nm, usd, khr } from "../i18n";
import { payState, roundKhr } from "../cart";
import Keypad from "../parts/Keypad";

const ICON = { cash: Banknote, qr: QrCode, card: CreditCard, bank: Landmark };
const isKhr = (m) => m.currency === "KHR";

// Pay: pick a method, type / tap the amount, add more methods to split; cash may be more (change), QR / card not.
export default function PayDialog({ catalog, totals: t, lines, discount, stockApprover, onClose, onDone, onState }) {
  const methods = catalog.payment_methods || [];
  const [method, setMethod] = useState(methods[0] || null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [paid, setPaid] = useState([]); // [{ method, amount, reference }]
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const current = method && Number(amount) > 0 ? [{ method, amount: Number(amount), reference }] : [];
  const all = [...paid, ...current];
  const st = payState(t, all);
  const before = payState(t, paid);

  // what is still due in the chosen currency
  const dueIn = (m) => (isKhr(m) ? roundKhr(before.remaining * t.rate, t.step) : before.remaining);
  const quick = useMemo(() => {
    if (!method) return [];
    const due = dueIn(method);
    if (isKhr(method)) {
      const ups = [1000, 5000, 10000, 50000, 100000].map((n) => Math.ceil(due / n) * n).filter((v) => v > due);
      return [due, ...[...new Set(ups)]].slice(0, 5);
    }
    const ups = [1, 5, 10, 20, 50, 100].map((n) => Math.ceil(due / n) * n).filter((v) => v > due);
    return [due, ...[...new Set(ups)]].slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, paid.length, t.total]);

  const pick = (m) => {
    setMethod(m);
    setAmount("");
    setReference("");
    setError("");
  };
  const addSplit = () => {
    if (!current.length) return;
    if (method.requires_reference && !reference.trim()) return setError(L("សូមបញ្ចូលលេខយោង", "Type the reference no."));
    setPaid([...paid, ...current]);
    setAmount("");
    setReference("");
  };

  const finish = async () => {
    setError("");
    const list = all.length ? all : method ? [{ method, amount: dueIn(method), reference }] : [];
    if (method?.type !== "cash" && method?.requires_reference && current.length && !reference.trim()) return setError(L("សូមបញ្ចូលលេខយោង", "Type the reference no."));
    setBusy(true);
    try {
      const sale = await api.sell({
        items: lines.map((l) => ({ variant_id: l.variant._id, unit_id: l.unit._id, qty: l.qty })),
        discount: discount ? { type: discount.type, value: discount.value } : null,
        approver: discount?.approver || null,
        stock_approver: stockApprover ? { user_id: stockApprover.user_id, pin: stockApprover.pin } : null,
        payments: list.map((p) => ({ method_id: p.method._id, amount: p.amount, reference: p.reference })),
      });
      onDone(sale);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  // the customer display follows what is paid / the change
  const payKey = `${method?._id}|${amount}|${st.paid}|${st.change}|${st.remaining}|${st.enough}`;
  useEffect(() => {
    if (!onState) return undefined;
    // QR of this method (uploaded in the admin) → the customer scans it on the display
    const qrDue = method && !st.enough ? (Number(amount) > 0 ? Number(amount) : dueIn(method)) : 0;
    const qr = method?.qr_image && !st.enough ? { image: method.qr_image, name: nm(method), amount: qrDue, khr: isKhr(method) } : null;
    const timer = setTimeout(() => onState({ qr, method: method ? nm(method) : "", paid: st.paid, remaining: st.remaining, remaining_khr: st.remainingKhr, enough: st.enough, change: st.change, give_usd: st.giveUsd, give_khr: st.giveKhr }), 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payKey]);
  // "exact" when nothing typed = pay the rest with the chosen method
  const canFinish = st.enough || (!current.length && method && before.remaining > 0 && (!method.requires_reference || reference.trim()));

  return (
    <div className="pos-back" onMouseDown={() => !busy && onClose()}>
      <div className="pos-dialog pos-paydlg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pos-dialog-head">
          <h3>{L("គិតលុយ", "Payment")}</h3>
          <button type="button" className="pos-icon" onClick={onClose} disabled={busy}><X size={20} /></button>
        </div>
        <div className="pos-pay">
          <div className="pos-pay-left">
            <div className="pos-pay-total">
              <span>{L("ត្រូវបង់", "To pay")}</span>
              <b>{usd(t.total)}</b>
              <small>{khr(t.totalKhr)} · 1$ = {khr(t.rate)}</small>
            </div>
            <div className="pos-methods">
              {methods.map((m) => {
                const Icon = ICON[m.type] || Banknote;
                return (
                  <button key={m._id} type="button" className={method?._id === m._id ? "on" : ""} onClick={() => pick(m)}>
                    <Icon size={20} />
                    <span>{nm(m)}</span>
                  </button>
                );
              })}
            </div>
            {paid.length > 0 && (
              <div className="pos-paid-list">
                {paid.map((p, i) => (
                  <div key={i}>
                    <span>{nm(p.method)}{p.reference ? ` · ${p.reference}` : ""}</span>
                    <b>{isKhr(p.method) ? khr(p.amount) : usd(p.amount)}</b>
                    <button type="button" className="pos-x" onClick={() => setPaid(paid.filter((_, k) => k !== i))}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className={`pos-pay-state ${st.enough ? "ok" : ""}`}>
              {st.enough ? (
                <>
                  <span>{L("ប្រាក់អាប់", "Change")}</span>
                  <b>{usd(st.change)}</b>
                  <small>
                    {st.change > 0
                      ? `${L("អាប់", "Give")}: ${st.giveUsd ? usd(st.giveUsd) + (st.giveKhr ? " + " : "") : ""}${st.giveKhr || !st.giveUsd ? khr(st.giveKhr) : ""}`
                      : L("គ្រប់ចំនួន", "Exact")}
                  </small>
                </>
              ) : (
                <>
                  <span>{L("នៅខ្វះ", "Still to pay")}</span>
                  <b>{usd(st.remaining)}</b>
                  <small>{khr(st.remainingKhr)}</small>
                </>
              )}
            </div>
          </div>

          <div className="pos-pay-right">
            {method && (
              <>
                <label className="pos-amount">
                  <span>{nm(method)} ({isKhr(method) ? "៛" : "$"})</span>
                  <input value={amount} readOnly placeholder={isKhr(method) ? String(dueIn(method)) : dueIn(method).toFixed(2)} />
                </label>
                <div className="pos-quick">
                  {quick.map((v) => (
                    <button key={v} type="button" onClick={() => setAmount(String(v))}>{isKhr(method) ? khr(v) : usd(v)}</button>
                  ))}
                </div>
                {method.qr_image && (
                  <div className="pos-pay-qr">
                    <img src={method.qr_image} alt="QR" />
                    <span>{L("QR នេះកំពុងបង្ហាញលើអេក្រង់អតិថិជន — ឱ្យអតិថិជនស្កេនបង់", "This QR is on the customer display — ask the customer to scan and pay")}</span>
                  </div>
                )}
                {(method.requires_reference || method.type !== "cash") && (
                  <input className="pos-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method.requires_reference ? L("លេខយោង (ចាំបាច់)", "Reference no. (required)") : L("លេខយោង", "Reference no.")} />
                )}
                <Keypad value={amount} onChange={setAmount} dot={!isKhr(method)} max={isKhr(method) ? 9 : 9} />
                <button type="button" className="pos-btn pos-btn-ghost" onClick={addSplit} disabled={!current.length || st.enough}>+ {L("បង់ផ្នែក ហើយបន្ថែមវិធីផ្សេង", "Pay part, add another method")}</button>
              </>
            )}
          </div>
        </div>
        {error && <div className="pos-error">{error}</div>}
        <div className="pos-dialog-foot">
          <button type="button" className="pos-btn pos-btn-ghost" onClick={onClose} disabled={busy}>{L("ត្រឡប់", "Back")}</button>
          <button type="button" className="pos-btn pos-btn-primary pos-btn-lg" onClick={finish} disabled={busy || !canFinish}>
            {busy ? "…" : st.enough ? L("បញ្ចប់ការលក់", "Complete sale") : L(`បង់គ្រប់ដោយ ${method ? nm(method) : ""}`, `Pay all with ${method ? nm(method) : ""}`)}
          </button>
        </div>
      </div>
    </div>
  );
}
