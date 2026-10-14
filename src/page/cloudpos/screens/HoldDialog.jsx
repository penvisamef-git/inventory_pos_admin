import React, { useEffect, useState } from "react";
import { HandCoins, PauseCircle, Play, Plus, Trash2, X } from "lucide-react";
import { api } from "../api";
import { L, usd, khr, timeText, dateText, qtyText } from "../i18n";
import ManagerPin from "../parts/ManagerPin";

// Hold the current cart: an optional name so the cashier knows whose cart it is when the customer comes back.
// Layaway: the customer pays a deposit now (cash into the drawer) and the rest when they take the goods.
export function HoldNameDialog({ count, total, customer, onClose, onHold }) {
  const [label, setLabel] = useState("");
  const [lay, setLay] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    if (lay) {
      if (!(Number(amount) > 0)) return setError(L("សូមវាយប្រាក់កក់", "Type the deposit"));
      if (!customer && !label.trim()) return setError(L("កក់ប្រាក់: សូមជ្រើសអតិថិជន ឬសរសេរឈ្មោះ + លេខទូរស័ព្ទ", "Layaway: choose the customer or write a name + phone"));
    }
    setBusy(true);
    await onHold(label.trim(), lay ? { amount: Number(amount), currency } : null);
    setBusy(false);
  };
  return (
    <div className="pos-back" onMouseDown={() => !busy && onClose()}>
      <div className="pos-dialog pos-holddlg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pos-dialog-head"><h3><PauseCircle size={20} /> {L("រក្សាទុកកន្ត្រក", "Hold this cart")}</h3><button type="button" className="pos-icon" onClick={onClose}><X size={20} /></button></div>
        <div className="pos-dialog-body">
          <p className="pos-muted">{L(`${qtyText(count)} ទំនិញ · ${usd(total)} — អតិថិជនទៅរកទំនិញបន្ថែម? រក្សាទុកសិន ហើយលក់អតិថិជនបន្ទាប់។`, `${qtyText(count)} items · ${usd(total)} — customer still shopping? Hold it and serve the next one.`)}</p>
          <input
            className="pos-ref"
            autoFocus
            value={label}
            maxLength={60}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder={customer ? `${customer.name} ${customer.phone}` : L("ឈ្មោះ / សម្គាល់អតិថិជន (មិនចាំបាច់)", "Customer name / note (optional)")}
          />
          {!lay && (
            <div className="pos-quick">
              {[L("អាវក្រហម", "Red shirt"), L("មានកូនតូច", "With baby"), L("ម្តាយ + កូន", "Mom + kid")].map((x) => (
                <button key={x} type="button" onClick={() => setLabel(x)}>{x}</button>
              ))}
            </div>
          )}
          <label className={`pos-lay-toggle ${lay ? "on" : ""}`}>
            <input type="checkbox" checked={lay} onChange={(e) => setLay(e.target.checked)} />
            <HandCoins size={17} />
            <span><b>{L("កក់ប្រាក់ (Layaway)", "Layaway (deposit)")}</b><small>{L("អតិថិជនបង់ខ្លះឥឡូវ ហើយយកទំនិញពេលបង់គ្រប់", "The customer pays part now and takes the goods when it is paid in full")}</small></span>
          </label>
          {lay && (
            <div className="pos-cash-amt">
              <input inputMode="decimal" value={amount} onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && setAmount(e.target.value)} placeholder={currency === "KHR" ? "0 ៛" : "$0.00"} />
              <div className="pos-seg small">
                <button type="button" className={currency === "USD" ? "on" : ""} onClick={() => setCurrency("USD")}>$</button>
                <button type="button" className={currency === "KHR" ? "on" : ""} onClick={() => setCurrency("KHR")}>៛</button>
              </div>
              <div className="pos-quick">
                {[0.2, 0.3, 0.5].map((f) => {
                  const v = Math.ceil(total * f);
                  return <button key={f} type="button" onClick={() => { setCurrency("USD"); setAmount(String(v)); }}>{Math.round(f * 100)}% · {usd(v)}</button>;
                })}
              </div>
            </div>
          )}
          {error && <div className="pos-error">{error}</div>}
        </div>
        <div className="pos-dialog-foot">
          <button type="button" className="pos-btn pos-btn-ghost" onClick={onClose} disabled={busy}>{L("ត្រឡប់", "Back")}</button>
          <button type="button" className="pos-btn pos-btn-primary pos-btn-lg" onClick={save} disabled={busy}>
            {lay ? <HandCoins size={18} /> : <PauseCircle size={18} />} {busy ? "…" : lay ? L("ទទួលប្រាក់កក់ ហើយរក្សាទុក", "Take deposit and hold") : L("រក្សាទុក (Enter)", "Hold (Enter)")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Held carts and layaways: resume one (it goes back into the cart), add a deposit, or delete it.
export default function HoldList({ user, cartHasItems, onClose, onResume }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [approver, setApprover] = useState(null);
  const [giveBack, setGiveBack] = useState(true);
  const [more, setMore] = useState(null); // { id, amount, currency }
  const [busy, setBusy] = useState(false);
  const load = () => api.holds().then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const remove = async (h) => {
    setError("");
    setBusy(true);
    try {
      await api.unhold(h._id, h.deposit_usd > 0 ? { approver: user?.is_manager ? null : approver, give_back: giveBack } : undefined);
      setConfirmDel(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const addDeposit = async () => {
    if (!(Number(more?.amount) > 0)) return;
    setError("");
    setBusy(true);
    try {
      await api.holdDeposit(more.id, { amount: Number(more.amount), currency: more.currency });
      setMore(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="pos-back" onMouseDown={onClose}>
      <div className="pos-dialog pos-histdlg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pos-dialog-head"><h3><PauseCircle size={20} /> {L("កន្ត្រករក្សាទុក និងការកក់", "Held carts and layaways")}</h3><button type="button" className="pos-icon" onClick={onClose}><X size={20} /></button></div>
        <div className="pos-dialog-body">
          {cartHasItems && <p className="pos-hold-note">{L("កន្ត្រកបច្ចុប្បន្ននឹងត្រូវរក្សាទុកដោយស្វ័យប្រវត្តិ ពេលបន្តកន្ត្រកផ្សេង។", "The cart on screen is held automatically when you resume another one.")}</p>}
          {error && <div className="pos-error">{error}</div>}
          {!rows && !error && <p className="pos-muted">{L("កំពុងផ្ទុក...", "Loading...")}</p>}
          {rows && !rows.length && <p className="pos-muted">{L("មិនមានកន្ត្រករក្សាទុក", "No held carts")}</p>}
          <div className="pos-hist">
            {(rows || []).map((h) => {
              const lay = h.deposit_usd > 0;
              return (
                <div key={h._id} className={`pos-hold-wrap ${lay ? "lay" : ""}`}>
                  <div className="pos-hold-row">
                    <span className="pos-hold-no">#{h.hold_no}</span>
                    <span className="pos-hold-main">
                      <b>{h.label || L("អតិថិជន", "Customer")}{lay && <em className="pos-lay-tag"><HandCoins size={12} /> {L("កក់", "Layaway")}</em>}</b>
                      <small>{lay ? dateText(h.created_date) : timeText(h.created_date)} · {h.user_name} · {qtyText(h.items.reduce((t, i) => t + i.qty, 0))} {L("ទំនិញ", "items")}{h.customer_phone ? ` · ${h.customer_phone}` : ""}{h.discount ? ` · ${L("បញ្ចុះ", "discount")} ${h.discount.type === "percent" ? `${h.discount.value}%` : usd(h.discount.value)}` : ""}</small>
                      {lay && <small className="pos-lay-dep">{L("បានកក់", "Paid")} {usd(h.deposit_usd)} · {L("នៅខ្វះប្រហែល", "Left about")} {usd(Math.max(0, h.total - h.deposit_usd))}</small>}
                    </span>
                    <b className="pos-hold-total">{usd(h.total)}</b>
                    {confirmDel === h._id ? (
                      <>
                        <button type="button" className="pos-btn pos-btn-danger" disabled={busy} onClick={() => remove(h)}>{L("លុប", "Delete")}</button>
                        <button type="button" className="pos-btn pos-btn-ghost" onClick={() => setConfirmDel(null)}>{L("ទេ", "No")}</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="pos-icon" title={L("លុប", "Delete")} onClick={() => { setConfirmDel(h._id); setGiveBack(true); }}><Trash2 size={17} /></button>
                        {lay && <button type="button" className="pos-icon" title={L("កក់បន្ថែម", "Add deposit")} onClick={() => setMore({ id: h._id, amount: "", currency: "USD" })}><Plus size={17} /></button>}
                        <button type="button" className="pos-btn pos-btn-primary" onClick={() => onResume(h)}><Play size={16} /> {lay ? L("បង់នៅសល់", "Pay the rest") : L("បន្តលក់", "Resume")}</button>
                      </>
                    )}
                  </div>
                  {confirmDel === h._id && lay && (
                    <div className="pos-lay-cancel">
                      <label><input type="radio" checked={giveBack} onChange={() => setGiveBack(true)} /> {L(`សងប្រាក់កក់ ${usd(h.deposit_usd)} ពីថតលុយ`, `Give the ${usd(h.deposit_usd)} deposit back from the drawer`)}</label>
                      <label><input type="radio" checked={!giveBack} onChange={() => setGiveBack(false)} /> {L("ហាងទុកប្រាក់កក់ (អតិថិជនបោះបង់)", "Shop keeps the deposit (customer gave up)")}</label>
                      {!user?.is_manager && <ManagerPin value={approver} onChange={setApprover} onEnter={() => remove(h)} />}
                    </div>
                  )}
                  {more?.id === h._id && (
                    <div className="pos-lay-more">
                      <input autoFocus inputMode="decimal" value={more.amount} onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && setMore({ ...more, amount: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addDeposit()} placeholder={more.currency === "KHR" ? "0 ៛" : "$0.00"} />
                      <div className="pos-seg small">
                        <button type="button" className={more.currency === "USD" ? "on" : ""} onClick={() => setMore({ ...more, currency: "USD" })}>$</button>
                        <button type="button" className={more.currency === "KHR" ? "on" : ""} onClick={() => setMore({ ...more, currency: "KHR" })}>៛</button>
                      </div>
                      <button type="button" className="pos-btn pos-btn-primary" disabled={busy || !(Number(more.amount) > 0)} onClick={addDeposit}>{L("ទទួលប្រាក់កក់", "Take deposit")}</button>
                      <button type="button" className="pos-btn pos-btn-ghost" onClick={() => setMore(null)}>{L("បោះបង់", "Cancel")}</button>
                    </div>
                  )}
                  {lay && h.deposits?.length > 0 && (
                    <div className="pos-lay-deps">
                      {h.deposits.map((d, k) => <span key={k}>{dateText(d.at)} · {d.currency === "KHR" ? khr(d.amount) : usd(d.amount)}</span>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
