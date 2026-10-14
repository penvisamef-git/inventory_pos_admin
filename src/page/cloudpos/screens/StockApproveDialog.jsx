import React, { useEffect, useState } from "react";
import { PackageX, X } from "lucide-react";
import { api } from "../api";
import { L, qtyText } from "../i18n";

// Item with 0 or less stock (or more than the stock): a shop manager types their PIN to allow selling it.
export default function StockApproveDialog({ items, onClose, onApproved }) {
  const [managers, setManagers] = useState([]);
  const [who, setWho] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.users().then((u) => {
      const m = u.filter((x) => x.is_manager);
      setManagers(m);
      if (m.length === 1) setWho(String(m[0]._id));
    }).catch((e) => setError(e.message));
  }, []);

  const approve = async () => {
    if (!who || pin.length < 4) return setError(L("ជ្រើសអ្នកគ្រប់គ្រង ហើយវាយ PIN", "Choose the manager and type the PIN"));
    setBusy(true);
    setError("");
    try {
      const a = await api.approve(who, pin);
      onApproved({ user_id: who, pin, name: a.name });
    } catch (e) {
      setError(e.message);
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pos-back" onMouseDown={() => !busy && onClose()}>
      <div className="pos-dialog pos-stockdlg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pos-dialog-head"><h3><PackageX size={20} /> {L("ទំនិញអស់ស្តុក", "Out of stock")}</h3><button type="button" className="pos-icon" onClick={onClose}><X size={20} /></button></div>
        <div className="pos-dialog-body">
          <div className="pos-stock-items">
            {items.map((i) => (
              <div key={i.key}>
                <span><b>{i.name}</b><small>{i.option}</small></span>
                <span className="pos-stock-nums">
                  <small>{L("ស្តុក", "Stock")}</small><b className={i.stock <= 0 ? "neg" : ""}>{qtyText(i.stock)}</b>
                  <small>{L("លក់", "Selling")}</small><b>{qtyText(i.need)}</b>
                </span>
              </div>
            ))}
          </div>
          <p className="pos-muted">{L("ស្តុកក្នុងប្រព័ន្ធមិនគ្រប់។ បើទំនិញពិតជាមាននៅលើធ្នើ អ្នកគ្រប់គ្រងហាងអាចអនុញ្ញាតឱ្យលក់។", "The system stock is not enough. If the item is really on the shelf, a shop manager can allow the sale.")}</p>
          <div className="pos-approve">
            <b>{L("ការអនុម័តដោយអ្នកគ្រប់គ្រងហាង", "Shop manager approval")}</b>
            {!managers.length && !error && <span className="pos-muted">{L("មិនមានអ្នកគ្រប់គ្រងមាន PIN នៅ POS នេះ", "No shop manager with a PIN on this POS")}</span>}
            {managers.length > 0 && (
              <>
                <select value={who} onChange={(e) => setWho(e.target.value)}>
                  <option value="">{L("-- ជ្រើសរើស --", "-- Choose --")}</option>
                  {managers.map((m) => <option key={m._id} value={String(m._id)}>{m.name}</option>)}
                </select>
                <input type="password" inputMode="numeric" maxLength={6} autoFocus value={pin} onChange={(e) => /^\d*$/.test(e.target.value) && setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && approve()} placeholder="PIN" />
              </>
            )}
          </div>
          {error && <div className="pos-error">{error}</div>}
        </div>
        <div className="pos-dialog-foot">
          <button type="button" className="pos-btn pos-btn-ghost" onClick={onClose} disabled={busy}>{L("កុំលក់", "Don't sell")}</button>
          <button type="button" className="pos-btn pos-btn-primary pos-btn-lg" onClick={approve} disabled={busy || !managers.length}>{busy ? "…" : L("អនុញ្ញាតឱ្យលក់", "Allow the sale")}</button>
        </div>
      </div>
    </div>
  );
}
