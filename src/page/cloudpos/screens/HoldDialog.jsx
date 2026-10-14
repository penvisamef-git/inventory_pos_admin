import React, { useEffect, useState } from "react";
import { PauseCircle, Play, Trash2, X } from "lucide-react";
import { api } from "../api";
import { L, usd, timeText, qtyText } from "../i18n";

// Hold the current cart: an optional name so the cashier knows whose cart it is when the customer comes back.
export function HoldNameDialog({ count, total, onClose, onHold }) {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    await onHold(label.trim());
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
            placeholder={L("ឈ្មោះ / សម្គាល់អតិថិជន (មិនចាំបាច់)", "Customer name / note (optional)")}
          />
          <div className="pos-quick">
            {[L("អាវក្រហម", "Red shirt"), L("មានកូនតូច", "With baby"), L("ម្តាយ + កូន", "Mom + kid")].map((x) => (
              <button key={x} type="button" onClick={() => setLabel(x)}>{x}</button>
            ))}
          </div>
        </div>
        <div className="pos-dialog-foot">
          <button type="button" className="pos-btn pos-btn-ghost" onClick={onClose} disabled={busy}>{L("ត្រឡប់", "Back")}</button>
          <button type="button" className="pos-btn pos-btn-primary pos-btn-lg" onClick={save} disabled={busy}><PauseCircle size={18} /> {busy ? "…" : L("រក្សាទុក (Enter)", "Hold (Enter)")}</button>
        </div>
      </div>
    </div>
  );
}

// Held carts: resume one (it goes back into the cart) or delete it.
export default function HoldList({ cartHasItems, onClose, onResume }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const load = () => api.holds().then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const remove = async (h) => {
    try {
      await api.unhold(h._id);
      setConfirmDel(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <div className="pos-back" onMouseDown={onClose}>
      <div className="pos-dialog pos-histdlg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pos-dialog-head"><h3><PauseCircle size={20} /> {L("កន្ត្រកដែលរក្សាទុក", "Held carts")}</h3><button type="button" className="pos-icon" onClick={onClose}><X size={20} /></button></div>
        <div className="pos-dialog-body">
          {cartHasItems && <p className="pos-hold-note">{L("កន្ត្រកបច្ចុប្បន្ននឹងត្រូវរក្សាទុកដោយស្វ័យប្រវត្តិ ពេលបន្តកន្ត្រកផ្សេង។", "The cart on screen is held automatically when you resume another one.")}</p>}
          {error && <div className="pos-error">{error}</div>}
          {!rows && !error && <p className="pos-muted">{L("កំពុងផ្ទុក...", "Loading...")}</p>}
          {rows && !rows.length && <p className="pos-muted">{L("មិនមានកន្ត្រករក្សាទុក", "No held carts")}</p>}
          <div className="pos-hist">
            {(rows || []).map((h) => (
              <div key={h._id} className="pos-hold-row">
                <span className="pos-hold-no">#{h.hold_no}</span>
                <span className="pos-hold-main">
                  <b>{h.label || L("អតិថិជន", "Customer")}</b>
                  <small>{timeText(h.created_date)} · {h.user_name} · {qtyText(h.items.reduce((t, i) => t + i.qty, 0))} {L("ទំនិញ", "items")}{h.discount ? ` · ${L("បញ្ចុះ", "discount")} ${h.discount.type === "percent" ? `${h.discount.value}%` : usd(h.discount.value)}` : ""}</small>
                </span>
                <b className="pos-hold-total">{usd(h.total)}</b>
                {confirmDel === h._id ? (
                  <>
                    <button type="button" className="pos-btn pos-btn-danger" onClick={() => remove(h)}>{L("លុប", "Delete")}</button>
                    <button type="button" className="pos-btn pos-btn-ghost" onClick={() => setConfirmDel(null)}>{L("ទេ", "No")}</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="pos-icon" title={L("លុប", "Delete")} onClick={() => setConfirmDel(h._id)}><Trash2 size={17} /></button>
                    <button type="button" className="pos-btn pos-btn-primary" onClick={() => onResume(h)}><Play size={16} /> {L("បន្តលក់", "Resume")}</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
