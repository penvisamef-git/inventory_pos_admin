import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Banknote, CreditCard, Landmark, QrCode, Star, Trash2, X } from "lucide-react";
import { api } from "../api";
import { L, nm, usd, khr } from "../i18n";
import { payState, roundKhr } from "../cart";
import Keypad from "../parts/Keypad";
import { buildKhqr, md5 } from "../khqr";

const ICON = { cash: Banknote, qr: QrCode, card: CreditCard, bank: Landmark };
const isKhr = (m) => m.currency === "KHR";

// Pay: pick a method, type / tap the amount, add more methods to split; cash may be more (change), QR / card not.
const POINTS = { _id: "points", code: "points", name_kh: "ពិន្ទុ", name_en: "Points", type: "points", currency: "USD" };

const DEPOSIT = { _id: "deposit", code: "deposit", name_kh: "ប្រាក់កក់", name_en: "Deposit", type: "credit", currency: "USD" };
const EXCHANGE = { _id: "exchange", code: "exchange", name_kh: "ប្តូរទំនិញ", name_en: "Exchange credit", type: "credit", currency: "USD" };

export default function PayDialog({ catalog, totals: t, lines, discount, customer, layaway, credit, stockApprover, onClose, onDone, onState }) {
  const methods = catalog.payment_methods || [];
  const [method, setMethod] = useState(methods[0] || null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [paid, setPaid] = useState([]); // [{ method, amount, reference }]
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // loyalty points as money (customer on the sale)
  const st0 = catalog.setting || {};
  const pv = Number(st0.point_value_usd ?? 0.01);
  const minPts = Number(st0.min_redeem_points ?? 100);
  const canPoints = !!customer && st0.loyalty_enabled !== false && pv > 0 && (customer.points || 0) >= minPts;
  const maxPts = canPoints ? Math.max(0, Math.min(customer.points, Math.floor(t.total / pv + 1e-9))) : 0;
  const [usePts, setUsePts] = useState(0);
  const ptsUsd = Math.round(usePts * pv * 100) / 100;
  // money already in the shop: points, layaway deposit, exchange credit
  const pts = [
    ...(layaway?.deposit > 0 ? [{ method: DEPOSIT, amount: layaway.deposit, reference: `#${layaway.hold_no}` }] : []),
    ...(credit?.amount > 0 ? [{ method: EXCHANGE, amount: credit.amount, reference: credit.refund_no }] : []),
    ...(usePts > 0 ? [{ method: POINTS, amount: ptsUsd, reference: `${usePts} pts` }] : []),
  ];

  const current = method && Number(amount) > 0 ? [{ method, amount: Number(amount), reference }] : [];
  const all = [...paid, ...current];
  const st = payState(t, [...pts, ...all]);
  const before = payState(t, [...pts, ...paid]);

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
    if (method.requires_reference && !reference.trim() && !method.khqr) return setError(L("សូមបញ្ចូលលេខយោង", "Type the reference no."));
    setPaid([...paid, ...current.map((p) => (p.method.khqr && !p.reference ? { ...p, reference: dyn ? `KHQR ${dyn.md5.slice(0, 10)}` : "KHQR" } : p))]);
    setAmount("");
    setReference("");
  };

  // ── Bakong KHQR: a QR with the amount; the cloud checks the payment, then the sale finishes by itself
  const kq = method?.khqr && before.remaining > 0 ? method.khqr : null;
  // QR can't ask more than what is still due (no change for QR)
  const kqAmount = kq ? (Number(amount) > 0 ? Math.min(Number(amount), dueIn(method)) : dueIn(method)) : 0;
  const [dyn, setDyn] = useState(null); // { text, md5, image, amount, until, status }
  const busyRef = useRef(false);
  useEffect(() => {
    if (!kq || !(kqAmount > 0)) return setDyn(null);
    let live = true;
    const timer = setTimeout(async () => {
      const text = buildKhqr({ account: kq.account, name: kq.name, city: kq.city, currency: kq.currency, amount: kqAmount, bill: `S${Date.now().toString(36).toUpperCase()}`, store: catalog.warehouse?.code || "", terminal: catalog.device?.code || "", minutes: 15 });
      const image = await QRCode.toDataURL(text, { margin: 1, width: 360, errorCorrectionLevel: "M" });
      if (live) setDyn({ text, md5: md5(text), image, amount: kqAmount, until: Date.now() + 15 * 60000, status: "wait" });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kq?.account, kqAmount, method?._id]);
  useEffect(() => {
    if (!dyn || dyn.status !== "wait") return undefined;
    let stop = false;
    const tick = async () => {
      if (stop || busyRef.current) return;
      if (Date.now() > dyn.until) return setDyn((d) => (d && d.md5 === dyn.md5 ? { ...d, status: "expired" } : d));
      const r = await api.khqrCheck(dyn.md5).catch(() => null);
      if (stop) return;
      if (r && r.ready === false) return setDyn((d) => (d && d.md5 === dyn.md5 ? { ...d, status: "manual" } : d));
      if (r?.paid) {
        setDyn((d) => (d && d.md5 === dyn.md5 ? { ...d, status: "paid" } : d));
        const ref = `KHQR ${String(r.hash || dyn.md5).slice(0, 10)}`;
        const line = { method, amount: dyn.amount, reference: ref };
        // part payment by KHQR → keep it in the paid list, the rest is paid another way
        const due = isKhr(method) ? before.remaining * t.rate : before.remaining;
        if (dyn.amount < due - (isKhr(method) ? t.step || 100 : 0.005)) {
          setPaid((list) => [...list, line]);
          setAmount("");
          setReference("");
          return undefined;
        }
        return finish([...paid, line]);
      }
      timer = setTimeout(tick, 3000);
    };
    let timer = setTimeout(tick, 2500);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dyn?.md5, dyn?.status]);

  const finish = async (forced) => {
    setError("");
    // KHQR shown: no reference to type — the QR's md5 is the reference
    const ref = reference.trim() || (dyn ? `KHQR ${dyn.md5.slice(0, 10)}` : "");
    const list = Array.isArray(forced) ? forced : all.length ? all.map((p) => (p === current[0] ? { ...p, reference: ref } : p)) : method && before.remaining > 0 ? [{ method, amount: dueIn(method), reference: ref }] : [];
    if (!Array.isArray(forced) && method?.type !== "cash" && method?.requires_reference && current.length && !ref) return setError(L("សូមបញ្ចូលលេខយោង", "Type the reference no."));
    if (busyRef.current) return undefined;
    busyRef.current = true;
    setBusy(true);
    try {
      const sale = await api.sell({
        items: lines.map((l) => ({ variant_id: l.variant._id, unit_id: l.unit._id, qty: l.qty })),
        discount: discount ? { type: discount.type, value: discount.value } : null,
        approver: discount?.approver || null,
        stock_approver: stockApprover ? { user_id: stockApprover.user_id, pin: stockApprover.pin } : null,
        payments: list.map((p) => ({ method_id: p.method._id, amount: p.amount, reference: p.reference })),
        customer_id: customer?._id || null,
        redeem_points: usePts || 0,
        hold_id: layaway?.id || null,
        exchange_refund_id: credit?.uuid || null,
      });
      onDone(sale);
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  // the customer display follows what is paid / the change
  const payKey = `${method?._id}|${amount}|${usePts}|${st.paid}|${st.change}|${st.remaining}|${st.enough}|${dyn?.md5}|${dyn?.status}`;
  useEffect(() => {
    if (!onState) return undefined;
    // QR of this method (uploaded in the admin) → the customer scans it on the display
    const qrDue = method && !st.enough ? (Number(amount) > 0 ? Number(amount) : dueIn(method)) : 0;
    const qr = dyn && dyn.status !== "expired"
      ? { image: dyn.image, name: "KHQR", amount: dyn.amount, khr: kq?.currency === "KHR", dynamic: true, paid: dyn.status === "paid" }
      : method?.qr_image && !st.enough ? { image: method.qr_image, name: nm(method), amount: qrDue, khr: isKhr(method) } : null;
    const timer = setTimeout(() => onState({ qr, method: method ? nm(method) : "", paid: st.paid, remaining: st.remaining, remaining_khr: st.remainingKhr, enough: st.enough, change: st.change, give_usd: st.giveUsd, give_khr: st.giveKhr }), 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payKey]);
  // "exact" when nothing typed = pay the rest with the chosen method
  const canFinish = st.enough || (!current.length && method && before.remaining > 0 && (!method.requires_reference || reference.trim() || dyn));
  const ptsBox = canPoints && (
    <div className={`pos-pts ${usePts ? "on" : ""}`}>
      <div>
        <b><Star size={15} /> {customer.name}</b>
        <small>{L(`មាន ${customer.points} ពិន្ទុ = ${usd(customer.points * pv)}`, `${customer.points} points = ${usd(customer.points * pv)}`)}</small>
      </div>
      {usePts ? (
        <div className="pos-pts-use">
          <input inputMode="numeric" value={usePts} onChange={(e) => setUsePts(Math.min(maxPts, Math.max(0, Math.trunc(Number(e.target.value.replace(/\D/g, "")) || 0))))} />
          <span>= {usd(ptsUsd)}</span>
          <button type="button" className="pos-x" onClick={() => setUsePts(0)}><X size={14} /></button>
        </div>
      ) : (
        <button type="button" className="pos-btn pos-btn-ghost" disabled={maxPts < minPts} onClick={() => setUsePts(maxPts)}>
          {L(`ប្រើពិន្ទុ (${usd(maxPts * pv)})`, `Use points (${usd(maxPts * pv)})`)}
        </button>
      )}
      {usePts > 0 && usePts < minPts && <small className="pos-error">{L(`យ៉ាងតិច ${minPts} ពិន្ទុ`, `At least ${minPts} points`)}</small>}
    </div>
  );

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
            {pts.filter((p) => p.method.type === "credit").map((p) => (
              <div key={p.method.code} className="pos-pts on pos-credit-pay">
                <div>
                  <b>{nm(p.method)}</b>
                  <small>{p.reference}</small>
                </div>
                <b>−{usd(p.amount)}</b>
              </div>
            ))}
            {ptsBox}
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
                {dyn && (
                  <div className={`pos-pay-qr pos-khqr ${dyn.status}`}>
                    <img src={dyn.image} alt="KHQR" />
                    <span>
                      <b>KHQR · {kq?.currency === "KHR" ? khr(dyn.amount) : usd(dyn.amount)}</b>
                      {dyn.status === "wait" && L("កំពុងរង់ចាំការបង់ប្រាក់… បង់រួច នឹងបញ្ចប់ដោយស្វ័យប្រវត្តិ", "Waiting for the payment… the sale finishes by itself once paid")}
                      {dyn.status === "paid" && L("បានទទួលប្រាក់ ✓", "Paid ✓")}
                      {dyn.status === "manual" && L("មិនទាន់ភ្ជាប់ Bakong — សូមពិនិត្យការបង់ ហើយចុច បញ្ចប់", "Bakong check is off — check the payment, then press Complete")}
                      {dyn.status === "expired" && L("QR ផុតកំណត់ — ប្តូរចំនួន ឬជ្រើសវិធីម្តងទៀត", "QR expired — change the amount or pick the method again")}
                    </span>
                  </div>
                )}
                {!dyn && method.qr_image && (
                  <div className="pos-pay-qr">
                    <img src={method.qr_image} alt="QR" />
                    <span>{L("QR នេះកំពុងបង្ហាញលើអេក្រង់អតិថិជន — ឱ្យអតិថិជនស្កេនបង់", "This QR is on the customer display — ask the customer to scan and pay")}</span>
                  </div>
                )}
                {!dyn && (method.requires_reference || method.type !== "cash") && (
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
          <button type="button" className="pos-btn pos-btn-primary pos-btn-lg" onClick={() => finish()} disabled={busy || !canFinish || (usePts > 0 && usePts < minPts)}>
            {busy ? "…" : st.enough ? L("បញ្ចប់ការលក់", "Complete sale") : L(`បង់គ្រប់ដោយ ${method ? nm(method) : ""}`, `Pay all with ${method ? nm(method) : ""}`)}
          </button>
        </div>
      </div>
    </div>
  );
}
