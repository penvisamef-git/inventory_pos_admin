import React, { useEffect, useRef, useState } from "react";
import { Baby, Phone, Search, Star, UserPlus, UserRound, X } from "lucide-react";
import { api } from "../api";
import { L } from "../i18n";

// Customer on the sale (loyalty points): find by phone / name / child, or add a new one (works offline).
export default function CustomerDialog({ current, onPick, onClose }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(null); // new customer form
  const input = useRef(null);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) return setRows([]);
    let alive = true;
    const timer = setTimeout(() => {
      api
        .customers(t)
        .then((r) => alive && setRows(r || []))
        .catch((e) => alive && setError(e.message));
    }, 180);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q]);

  const startAdd = () => {
    const digits = q.replace(/\D/g, "");
    setAdding({ name: digits.length >= 6 ? "" : q.trim(), phone: digits.length >= 6 ? q.trim() : "", kid_name: "", kid_birthday: "", kid_gender: "" });
    setError("");
  };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const c = await api.addCustomer(adding);
      onPick(c);
    } catch (e) {
      if (e.status === 409 && e.data) onPick(e.data); // already a customer → use it
      else setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const set = (k) => (e) => setAdding((a) => ({ ...a, [k]: e.target.value }));

  return (
    <div className="pos-back" onMouseDown={() => !busy && onClose()}>
      <div className="pos-dialog pos-custdlg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pos-dialog-head">
          <h3><UserRound size={19} /> {adding ? L("អតិថិជនថ្មី", "New customer") : L("អតិថិជន", "Customer")}</h3>
          <button type="button" className="pos-icon" onClick={onClose} disabled={busy}><X size={20} /></button>
        </div>
        {!adding ? (
          <div className="pos-dialog-body">
            <label className="pos-cust-search">
              <Search size={18} />
              <input ref={input} autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={L("លេខទូរស័ព្ទ ឈ្មោះ ឬឈ្មោះកូន", "Phone, name or child's name")} />
            </label>
            {error && <div className="pos-error">{error}</div>}
            <div className="pos-cust-list">
              {rows.map((c) => (
                <button key={c._id} type="button" className={`pos-cust-row ${current?._id === c._id ? "on" : ""}`} onClick={() => onPick(c)}>
                  <span className="pos-avatar-sm">{(c.name || "?").slice(0, 1)}</span>
                  <span className="pos-cust-main">
                    <b>{c.name}{c.not_sent && <em className="pos-cust-new">{L("ថ្មី", "new")}</em>}</b>
                    <small><Phone size={12} /> {c.phone}{c.kid_name ? <> · <Baby size={12} /> {c.kid_name}</> : null}</small>
                  </span>
                  <span className="pos-cust-pts"><Star size={13} /> {c.points}</span>
                </button>
              ))}
              {q.trim().length >= 2 && !rows.length && <p className="pos-muted">{L("រកមិនឃើញ — បន្ថែមជាអតិថិជនថ្មី", "Not found — add as a new customer")}</p>}
              {q.trim().length < 2 && <p className="pos-muted">{L("វាយយ៉ាងតិច 2 អក្សរ ឬ 3 លេខ", "Type at least 2 letters or 3 digits")}</p>}
            </div>
          </div>
        ) : (
          <div className="pos-dialog-body pos-cust-form">
            <label><span>{L("លេខទូរស័ព្ទ", "Phone")} *</span><input autoFocus={!adding.phone} inputMode="tel" value={adding.phone} onChange={set("phone")} placeholder="012 345 678" /></label>
            <label><span>{L("ឈ្មោះ (ឪពុក / ម្តាយ)", "Name (parent)")} *</span><input autoFocus={!!adding.phone} value={adding.name} onChange={set("name")} /></label>
            <label><span>{L("ឈ្មោះកូន", "Child's name")}</span><input value={adding.kid_name} onChange={set("kid_name")} /></label>
            <label><span>{L("ថ្ងៃកំណើតកូន", "Child's birthday")}</span><input type="date" value={adding.kid_birthday} onChange={set("kid_birthday")} /></label>
            <div className="pos-cust-gender">
              {[["boy", L("ប្រុស", "Boy")], ["girl", L("ស្រី", "Girl")]].map(([k, label]) => (
                <button key={k} type="button" className={adding.kid_gender === k ? "on" : ""} onClick={() => setAdding((a) => ({ ...a, kid_gender: a.kid_gender === k ? "" : k }))}>{label}</button>
              ))}
            </div>
            {error && <div className="pos-error">{error}</div>}
          </div>
        )}
        <div className="pos-dialog-foot">
          {adding ? (
            <>
              <button type="button" className="pos-btn pos-btn-ghost" onClick={() => setAdding(null)} disabled={busy}>{L("ត្រឡប់", "Back")}</button>
              <button type="button" className="pos-btn pos-btn-primary pos-btn-lg" onClick={save} disabled={busy || !adding.name.trim() || adding.phone.replace(/\D/g, "").length < 8}>{busy ? "…" : L("រក្សាទុក ហើយជ្រើស", "Save and use")}</button>
            </>
          ) : (
            <>
              {current && <button type="button" className="pos-btn pos-btn-ghost" onClick={() => onPick(null)}>{L("ដកអតិថិជនចេញ", "Remove customer")}</button>}
              <button type="button" className="pos-btn pos-btn-primary pos-btn-lg" onClick={startAdd}><UserPlus size={18} /> {L("អតិថិជនថ្មី", "New customer")}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
