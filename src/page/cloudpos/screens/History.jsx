import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CloudOff, CloudUpload, Check, RotateCw, Trash2, X } from "lucide-react";
import { api } from "../api";
import { L, usd, timeText, dateTimeText } from "../i18n";

// Remove an invoice the cloud will never take — reason + shop manager (their login, or their PIN)
function DiscardDialog({ sale, user, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [managers, setManagers] = useState([]);
  const [who, setWho] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (user.is_manager) return;
    api.users().then((u) => {
      const m = u.filter((x) => x.is_manager);
      setManagers(m);
      if (m.length === 1) setWho(String(m[0]._id));
    }).catch(() => {});
  }, [user.is_manager]);
  const go = async () => {
    if (!reason.trim()) return setError(L("សូមសរសេរមូលហេតុ", "Write the reason"));
    if (!user.is_manager && (!who || pin.length < 4)) return setError(L("ត្រូវការ PIN អ្នកគ្រប់គ្រងហាង", "A shop manager's PIN is needed"));
    setBusy(true);
    setError("");
    try {
      await api.discardSale(sale.uuid, { reason: reason.trim(), approver: user.is_manager ? null : { user_id: who, pin } });
      onDone();
    } catch (e) {
      setError(e.message);
      setPin("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="pos-back pos-back-top" onMouseDown={() => !busy && onClose()}>
      <div className="pos-dialog pos-stockdlg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pos-dialog-head"><h3><Trash2 size={19} /> {L("ដកវិក្កយបត្រចេញ", "Remove invoice")} · {sale.invoice_no}</h3><button type="button" className="pos-icon" onClick={onClose}><X size={20} /></button></div>
        <div className="pos-dialog-body">
          <div className="pos-hist-err"><AlertTriangle size={16} /> {sale.sync_error}</div>
          <p className="pos-muted">{L(`${usd(sale.total)} · វិក្កយបត្រនេះនឹងមិនផ្ញើទៅ Cloud ទៀតទេ ហើយមិនរាប់ក្នុងសរុប/របាយការណ៍។ ធ្វើតែពេលប្រាកដថាវាផ្ញើមិនបានជាដាច់ខាត (ឧ. លក់សាកល្បង ឬមកពី POS ផ្សេង)។`, `${usd(sale.total)} · This invoice will never be sent to the cloud and is left out of totals and reports. Only do this when it can never be sent (e.g. a test sale, or made on another POS).`)}</p>
          <input className="pos-ref" autoFocus value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder={L("មូលហេតុ (ចាំបាច់)", "Reason (required)")} />
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
          <button type="button" className="pos-btn pos-btn-danger pos-btn-lg" onClick={go} disabled={busy}>{busy ? "…" : L("ដកចេញ", "Remove")}</button>
        </div>
      </div>
    </div>
  );
}

// Invoices of this shift (newest first) — open one to see / reprint the receipt.
// "Problems": invoices the cloud refused (any shift) → see why, try again, or remove (manager).
export default function History({ shiftId, user, startOnProblems, problemCount = 0, onClose, onOpen, onChanged }) {
  const [tab, setTab] = useState(startOnProblems ? "problem" : "shift");
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [discard, setDiscard] = useState(null);
  const load = useCallback(() => {
    setRows(null);
    setError("");
    const p = tab === "problem" ? { problem: "true", limit: 200 } : { shift_id: shiftId || "", limit: 200 };
    api.sales(p).then(setRows).catch((e) => setError(e.message));
  }, [tab, shiftId]);
  useEffect(() => {
    load();
  }, [load]);

  const retry = async (s) => {
    setBusy(s.uuid);
    setNote("");
    try {
      await api.retrySale(s.uuid);
      setNote(L(`បានផ្ញើ ${s.invoice_no}`, `${s.invoice_no} sent`));
    } catch (e) {
      setNote(`${s.invoice_no}: ${e.message}`);
    } finally {
      setBusy("");
      load();
      onChanged?.();
    }
  };

  const list = (rows || []).filter((s) => !q || s.invoice_no.toLowerCase().includes(q.toLowerCase()));
  const total = list.filter((s) => s.state !== "discarded").reduce((t, s) => t + s.total, 0);
  return (
    <div className="pos-back" onMouseDown={onClose}>
      <div className="pos-dialog pos-histdlg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pos-dialog-head">
          <div className="pos-hist-tabs">
            <button type="button" className={tab === "shift" ? "on" : ""} onClick={() => setTab("shift")}>{L("វិក្កយបត្រក្នុងវេននេះ", "This shift")}</button>
            <button type="button" className={`${tab === "problem" ? "on" : ""} ${problemCount ? "warn" : ""}`} onClick={() => setTab("problem")}>
              <CloudOff size={15} /> {L("ផ្ញើមិនបាន", "Not sent")}{problemCount ? <em>{problemCount}</em> : ""}
            </button>
          </div>
          <button type="button" className="pos-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="pos-dialog-body">
          {tab === "shift" && <input className="pos-ref" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L("ស្វែងរកលេខវិក្កយបត្រ", "Search invoice no.")} autoFocus />}
          {tab === "problem" && (
            <p className="pos-muted">{L("Cloud មិនទទួលវិក្កយបត្រទាំងនេះ។ មើលមូលហេតុ → កែនៅ Admin (ឧ. ទំនិញត្រូវបានលុប) ហើយចុច ព្យាយាមម្តងទៀត។ បើផ្ញើមិនបានជាដាច់ខាត អ្នកគ្រប់គ្រងអាចដកចេញ។", "The cloud refused these invoices. Read the reason → fix it in the admin web (e.g. an item was deleted), then Try again. If it can never be sent, a shop manager can remove it.")}</p>
          )}
          {note && <div className="pos-hist-note">{note}</div>}
          {error && <div className="pos-error">{error}</div>}
          {!rows && !error && <p className="pos-muted">{L("កំពុងផ្ទុក...", "Loading...")}</p>}
          <div className="pos-hist">
            {list.map((s) =>
              tab === "problem" ? (
                <div key={s.uuid} className="pos-hist-prob">
                  <div className="pos-hist-prob-top">
                    <span><b>{s.invoice_no}</b><small>{dateTimeText(s.sold_at)} · {s.cashier_name} · {s.shift_no}</small></span>
                    <b>{usd(s.total)}</b>
                  </div>
                  <div className="pos-hist-err"><AlertTriangle size={15} /> {s.sync_error}</div>
                  <div className="pos-hist-acts">
                    <button type="button" className="pos-btn pos-btn-ghost" onClick={() => onOpen(s)}>{L("មើល", "View")}</button>
                    <button type="button" className="pos-btn pos-btn-ghost" onClick={() => retry(s)} disabled={!!busy}><RotateCw size={15} className={busy === s.uuid ? "pos-spin" : ""} /> {L("ព្យាយាមម្តងទៀត", "Try again")}</button>
                    <button type="button" className="pos-btn pos-btn-danger" onClick={() => setDiscard(s)} disabled={!!busy}><Trash2 size={15} /> {L("ដកចេញ", "Remove")}</button>
                  </div>
                </div>
              ) : (
                <button key={s.uuid} type="button" onClick={() => onOpen(s)} className={s.state === "discarded" ? "is-discarded" : ""}>
                  <span><b>{s.invoice_no}</b><small>{timeText(s.sold_at)} · {s.cashier_name} · {s.items.length} {L("មុខ", "items")}</small></span>
                  <span className="pos-hist-r">
                    <b>{usd(s.total)}</b>
                    {s.refunded_total > 0 && s.state !== "discarded" && <small className="rf">{s.refund_status === "full" ? L("សងទាំងអស់", "Refunded") : L("សងខ្លះ", "Part refunded")} −{usd(s.refunded_total)}</small>}
                    {s.state === "discarded" ? (
                      <small className="err" title={s.discard_reason}><Trash2 size={13} /> {L("បានដកចេញ", "Removed")}</small>
                    ) : (
                      <small className={s.synced ? "ok" : s.sync_error ? "err" : ""} title={s.sync_error || ""}>
                        {s.synced ? <><Check size={13} /> {L("បានផ្ញើ", "Sent")}</> : s.sync_error ? <><CloudOff size={13} /> {L("មានបញ្ហា", "Problem")}</> : <><CloudUpload size={13} /> {L("រង់ចាំផ្ញើ", "Waiting")}</>}
                      </small>
                    )}
                  </span>
                </button>
              ),
            )}
            {rows && !list.length && <p className="pos-muted">{tab === "problem" ? L("គ្មានបញ្ហា — វិក្កយបត្រទាំងអស់ផ្ញើបាន", "No problems — every invoice was sent") : L("មិនទាន់មានវិក្កយបត្រ", "No invoices yet")}</p>}
          </div>
        </div>
        {tab === "shift" && (
          <div className="pos-dialog-foot pos-hist-foot">
            <span>{list.length} {L("វិក្កយបត្រ", "invoices")} · <b>{usd(total)}</b></span>
          </div>
        )}
      </div>
      {discard && (
        <DiscardDialog
          sale={discard}
          user={user}
          onClose={() => setDiscard(null)}
          onDone={() => {
            setNote(L(`បានដក ${discard.invoice_no}`, `${discard.invoice_no} removed`));
            setDiscard(null);
            load();
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}
