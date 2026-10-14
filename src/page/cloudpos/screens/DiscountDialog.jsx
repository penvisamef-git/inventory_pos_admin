import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "../api";
import { L, usd } from "../i18n";

// Bill discount (amount or %). A cashier needs a shop manager to approve with their PIN (checked when the sale is saved).
export default function DiscountDialog({ user, current, subtotal, onClose, onApply }) {
  const [type, setType] = useState(current?.type || "percent");
  const [value, setValue] = useState(current ? String(current.value) : "");
  const [managers, setManagers] = useState([]);
  const [approver, setApprover] = useState(current?.approver?.user_id || "");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user.is_manager) api.users().then((u) => setManagers(u.filter((x) => x.is_manager))).catch(() => {});
  }, [user.is_manager]);
  useEffect(() => {
    if (managers.length === 1 && !approver) setApprover(managers[0]._id);
  }, [managers, approver]);

  const v = Number(value) || 0;
  const amount = type === "percent" ? (subtotal * Math.min(v, 100)) / 100 : Math.min(v, subtotal);
  const apply = () => {
    if (!(v > 0)) return setError(L("សូមបញ្ចូលចំនួន", "Type an amount"));
    if (type === "percent" && v > 100) return setError(L("មិនអាចលើស 100%", "Not more than 100%"));
    if (!user.is_manager && (!approver || pin.length < 4)) return setError(L("ត្រូវការ PIN អ្នកគ្រប់គ្រងហាង", "A shop manager's PIN is needed"));
    onApply({ type, value: v, approver: user.is_manager ? null : { user_id: approver, pin } });
  };
  const presets = type === "percent" ? [5, 10, 15, 20] : [0.5, 1, 2, 5];

  return (
    <div className="pos-back" onMouseDown={onClose}>
      <div className="pos-dialog pos-discdlg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pos-dialog-head"><h3>{L("បញ្ចុះតម្លៃលើវិក្កយបត្រ", "Discount on the bill")}</h3><button type="button" className="pos-icon" onClick={onClose}><X size={20} /></button></div>
        <div className="pos-dialog-body">
          <div className="pos-seg">
            <button type="button" className={type === "percent" ? "on" : ""} onClick={() => setType("percent")}>%</button>
            <button type="button" className={type === "amount" ? "on" : ""} onClick={() => setType("amount")}>$</button>
          </div>
          <input className="pos-big-input" inputMode="decimal" autoFocus value={value} onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && setValue(e.target.value)} placeholder="0" />
          <div className="pos-quick">
            {presets.map((p) => <button key={p} type="button" onClick={() => setValue(String(p))}>{type === "percent" ? `${p}%` : usd(p)}</button>)}
          </div>
          <p className="pos-muted">{L("បញ្ចុះ", "Discount")}: <b>{usd(amount)}</b> {L("លើទំនិញដែលអនុញ្ញាតបញ្ចុះតម្លៃ", "on items that allow discount")}</p>
          {!user.is_manager && (
            <div className="pos-approve">
              <b>{L("ការអនុម័តដោយអ្នកគ្រប់គ្រងហាង", "Shop manager approval")}</b>
              {!managers.length && <span className="pos-muted">{L("មិនមានអ្នកគ្រប់គ្រងមាន PIN នៅ POS នេះ", "No shop manager with a PIN on this POS")}</span>}
              {managers.length > 0 && (
                <>
                  <select value={approver} onChange={(e) => setApprover(e.target.value)}>
                    <option value="">{L("-- ជ្រើសរើស --", "-- Choose --")}</option>
                    {managers.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                  </select>
                  <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => /^\d*$/.test(e.target.value) && setPin(e.target.value)} placeholder="PIN" />
                </>
              )}
            </div>
          )}
          {error && <div className="pos-error">{error}</div>}
        </div>
        <div className="pos-dialog-foot">
          {current && <button type="button" className="pos-btn pos-btn-ghost" onClick={() => onApply(null)}>{L("ដកការបញ្ចុះ", "Remove discount")}</button>}
          <button type="button" className="pos-btn pos-btn-primary" onClick={apply}>{L("អនុវត្ត", "Apply")}</button>
        </div>
      </div>
    </div>
  );
}
