import React, { useState } from "react";
import { LogOut, Wallet } from "lucide-react";
import { api } from "../api";
import { L, usd, khr } from "../i18n";

// Start of the day: count the cash float in the drawer (USD + KHR), then sell.
export default function OpenShift({ status, user, onOpened, onLogout }) {
  const [usdAmount, setUsd] = useState("");
  const [khrAmount, setKhr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const open = async () => {
    setBusy(true);
    setError("");
    try {
      await api.openShift({ opening_usd: Number(usdAmount) || 0, opening_khr: Number(khrAmount) || 0 });
      onOpened();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const num = (set) => (e) => /^\d*\.?\d*$/.test(e.target.value) && set(e.target.value);

  return (
    <div className="pos-center pos-bg">
      <div className="pos-card pos-shift">
        <div className="pos-pair-icon"><Wallet size={28} /></div>
        <h1>{L("បើកវេន", "Open the shift")}</h1>
        <p className="pos-muted">{user.name} · {status.device?.code} · {status.warehouse?.name_kh}</p>
        <p>{L("រាប់ប្រាក់ក្នុងថតលុយពេលចាប់ផ្តើម (ប្រាក់អាប់)", "Count the cash in the drawer at the start (change float)")}</p>
        <div className="pos-shift-fields">
          <label>
            <span>USD</span>
            <input inputMode="decimal" value={usdAmount} onChange={num(setUsd)} placeholder="0.00" autoFocus />
          </label>
          <label>
            <span>KHR ៛</span>
            <input inputMode="numeric" value={khrAmount} onChange={num(setKhr)} placeholder="0" />
          </label>
        </div>
        <p className="pos-muted">{L("សរុប", "Total")}: {usd(usdAmount)} + {khr(khrAmount)}</p>
        {error && <div className="pos-error">{error}</div>}
        <button type="button" className="pos-btn pos-btn-primary pos-btn-lg" onClick={open} disabled={busy}>{busy ? "…" : L("បើកវេន ហើយចាប់ផ្តើមលក់", "Open shift and start selling")}</button>
        <button type="button" className="pos-link" onClick={onLogout}><LogOut size={15} /> {L("ចាកចេញ", "Log out")}</button>
      </div>
    </div>
  );
}
