import React, { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Wallet, X } from "lucide-react";
import { api } from "../api";
import { L, usd, khr, timeText } from "../i18n";
import ManagerPin from "../parts/ManagerPin";

// Money in / out of the drawer that is not a sale: expenses (ice, delivery, repair …), cash taken to the safe,
// small change brought in. Out needs a shop manager. Everything shows in the shift report (Z) and the admin web.
const KINDS = {
  out: [
    ["expense", L("ចំណាយ", "Expense")],
    ["safe_drop", L("ដាក់ទូដែក / ប្រគល់", "To the safe")],
    ["other", L("ផ្សេងៗ", "Other")],
  ],
  in: [
    ["float", L("លុយអាប់បន្ថែម", "Change / float")],
    ["other", L("ផ្សេងៗ", "Other")],
  ],
};
const IDEAS = { expense: [L("ទឹកកក", "Ice"), L("ដឹកជញ្ជូន", "Delivery"), L("សម្ភារៈហាង", "Shop supplies"), L("ជួសជុល", "Repair"), L("ម្ហូប", "Food")] };
export const KIND_NAME = {
  expense: L("ចំណាយ", "Expense"),
  safe_drop: L("ដាក់ទូដែក", "To the safe"),
  float: L("លុយអាប់បន្ថែម", "Change / float"),
  deposit: L("ប្រាក់កក់", "Layaway deposit"),
  deposit_back: L("សងប្រាក់កក់", "Deposit back"),
  deposit_kept: L("ហាងទុកប្រាក់កក់", "Deposit kept"),
  exchange_cash: L("សងប្រាក់ (ប្តូរ)", "Exchange paid in cash"),
  other: L("ផ្សេងៗ", "Other"),
};

export default function CashDialog({ user, onClose, onSaved }) {
  const [type, setType] = useState("out");
  const [kind, setKind] = useState("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [note, setNote] = useState("");
  const [approver, setApprover] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shift, setShift] = useState(null);
  useEffect(() => {
    api.shift().then(setShift).catch(() => {});
  }, []);
  const pick = (t) => {
    setType(t);
    setKind(KINDS[t][0][0]);
    setError("");
  };
  const save = async () => {
    setError("");
    if (!(Number(amount) > 0)) return setError(L("សូមវាយចំនួន", "Type the amount"));
    if (!note.trim()) return setError(L("សូមសរសេរសម្រាប់អ្វី", "Write what it is for"));
    setBusy(true);
    try {
      const r = await api.cashMove({ type, kind, amount: Number(amount), currency, note: note.trim(), approver: type === "out" && !user.is_manager ? approver : null });
      setShift(r.shift);
      setAmount("");
      setNote("");
      onSaved && onSaved(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const moves = (shift?.cash_moves || []).slice().reverse();
  const tt = shift?.totals;
  return (
    <div className="pos-back" onMouseDown={() => !busy && onClose()}>
      <div className="pos-dialog pos-cashdlg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pos-dialog-head"><h3><Wallet size={20} /> {L("ដាក់ / ដកលុយក្នុងថត", "Cash in / out")}</h3><button type="button" className="pos-icon" onClick={onClose}><X size={20} /></button></div>
        <div className="pos-dialog-body">
          <div className="pos-seg">
            <button type="button" className={type === "out" ? "on out" : ""} onClick={() => pick("out")}><ArrowUpFromLine size={17} /> {L("ដកចេញ", "Cash out")}</button>
            <button type="button" className={type === "in" ? "on in" : ""} onClick={() => pick("in")}><ArrowDownToLine size={17} /> {L("ដាក់ចូល", "Cash in")}</button>
          </div>
          <div className="pos-quick">
            {KINDS[type].map(([k, label]) => <button key={k} type="button" className={kind === k ? "on" : ""} onClick={() => setKind(k)}>{label}</button>)}
          </div>
          <div className="pos-cash-amt">
            <input autoFocus inputMode="decimal" value={amount} onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && setAmount(e.target.value)} placeholder={currency === "KHR" ? "0 ៛" : "$0.00"} />
            <div className="pos-seg small">
              <button type="button" className={currency === "USD" ? "on" : ""} onClick={() => setCurrency("USD")}>$</button>
              <button type="button" className={currency === "KHR" ? "on" : ""} onClick={() => setCurrency("KHR")}>៛</button>
            </div>
          </div>
          {IDEAS[kind] && <div className="pos-quick">{IDEAS[kind].map((x) => <button key={x} type="button" onClick={() => setNote(x)}>{x}</button>)}</div>}
          <input className="pos-ref" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder={L("សម្រាប់អ្វី (ចាំបាច់)", "What for (required)")} />
          {type === "out" && !user.is_manager && <ManagerPin value={approver} onChange={setApprover} onEnter={save} />}
          {error && <div className="pos-error">{error}</div>}
          {tt && (
            <p className="pos-muted pos-cash-now">
              {L("ក្នុងថតគួរមាន", "Drawer should have")}: <b>{usd(tt.expected_usd)}</b> + <b>{khr(tt.expected_khr)}</b>
            </p>
          )}
          {moves.length > 0 && (
            <div className="pos-cash-list">
              {moves.map((m) => (
                <div key={m.uuid} className={m.type}>
                  <span>{timeText(m.at)} · {KIND_NAME[m.kind] || m.kind}<small>{m.note}{m.approved_by_name ? ` · ✓ ${m.approved_by_name}` : ""}</small></span>
                  <b>{m.type === "out" ? "−" : "+"}{m.currency === "KHR" ? khr(m.amount) : usd(m.amount)}</b>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="pos-dialog-foot">
          <button type="button" className="pos-btn pos-btn-ghost" onClick={onClose} disabled={busy}>{L("បិទ", "Close")}</button>
          <button type="button" className={`pos-btn pos-btn-lg ${type === "out" ? "pos-btn-danger" : "pos-btn-primary"}`} onClick={save} disabled={busy}>
            {busy ? "…" : type === "out" ? L("ដកលុយចេញ", "Take cash out") : L("ដាក់លុយចូល", "Put cash in")}
          </button>
        </div>
      </div>
    </div>
  );
}
