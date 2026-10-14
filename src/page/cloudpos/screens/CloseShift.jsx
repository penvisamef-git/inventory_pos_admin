import React, { useEffect, useRef, useState } from "react";
import { Printer, X } from "lucide-react";
import { api } from "../api";
import { L, LANG, nm, usd, khr, dateTimeText } from "../i18n";

// End of shift: count the drawer (USD + KHR) → expected vs counted → close → print the shift report (Z).
export default function CloseShift({ catalog, onClose, onClosed, printZ }) {
  const [shift, setShift] = useState(null);
  const [cUsd, setUsd] = useState("");
  const [cKhr, setKhr] = useState("");
  const [note, setNote] = useState("");
  const [closed, setClosed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const zRef = useRef(null);

  useEffect(() => {
    api.shift().then(setShift).catch((e) => setError(e.message));
  }, []);
  const t = shift?.totals;
  const num = (set) => (e) => /^\d*\.?\d*$/.test(e.target.value) && set(e.target.value);
  const diffUsd = t ? (Number(cUsd) || 0) - t.expected_usd : 0;
  const diffKhr = t ? (Number(cKhr) || 0) - t.expected_khr : 0;

  const close = async () => {
    setBusy(true);
    setError("");
    try {
      const s = await api.closeShift({ counted_usd: Number(cUsd) || 0, counted_khr: Number(cKhr) || 0, note });
      setClosed(s);
      setTimeout(() => zRef.current && printZ(zRef.current), 200);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const r = closed?.report;
  return (
    <div className="pos-back" onMouseDown={() => !busy && !closed && onClose()}>
      <div className="pos-dialog pos-closedlg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pos-dialog-head">
          <h3>{closed ? L("វេនបានបិទ", "Shift closed") : L("បិទវេន", "Close shift")} · {shift?.shift_no}</h3>
          {!closed && <button type="button" className="pos-icon" onClick={onClose}><X size={20} /></button>}
        </div>
        {!shift && !error && <p className="pos-muted pos-dialog-body">{L("កំពុងផ្ទុក...", "Loading...")}</p>}
        {t && !closed && (
          <div className="pos-dialog-body">
            <div className="pos-zgrid">
              <div><span>{L("វិក្កយបត្រ", "Invoices")}</span><b>{t.invoice_count}</b></div>
              <div><span>{L("លក់សរុប", "Sales")}</span><b>{usd(t.sales_total)}</b></div>
              <div><span>{L("បញ្ចុះតម្លៃ", "Discounts")}</span><b>{usd(t.discount_total)}</b></div>
              {t.refund_count > 0 && <div><span>{L("សងប្រាក់", "Refunds")} ({t.refund_count})</span><b className="pos-neg">−{usd(t.refund_total)}</b></div>}
            </div>
            <div className="pos-zmethods">
              {t.methods.map((m) => (
                <div key={m.code}><span>{LANG === "en" ? m.name_en : m.name_kh} ({m.count})</span><b>{m.currency === "KHR" ? khr(m.amount) : usd(m.amount)}</b></div>
              ))}
            </div>
            <p>{L("រាប់ប្រាក់ក្នុងថតលុយឥឡូវ", "Count the cash in the drawer now")}</p>
            <div className="pos-shift-fields">
              <label><span>USD · {L("គួរមាន", "expected")} {usd(t.expected_usd)}</span><input inputMode="decimal" value={cUsd} onChange={num(setUsd)} placeholder="0.00" autoFocus /></label>
              <label><span>KHR · {L("គួរមាន", "expected")} {khr(t.expected_khr)}</span><input inputMode="numeric" value={cKhr} onChange={num(setKhr)} placeholder="0" /></label>
            </div>
            {(cUsd !== "" || cKhr !== "") && (
              <p className={Math.abs(diffUsd) < 0.005 && diffKhr === 0 ? "pos-ok" : "pos-warn"}>
                {L("លម្អៀង", "Difference")}: {diffUsd >= 0 ? "+" : "−"}{usd(Math.abs(diffUsd))} · {diffKhr >= 0 ? "+" : "−"}{khr(Math.abs(diffKhr))}
              </p>
            )}
            <input className="pos-ref" value={note} onChange={(e) => setNote(e.target.value)} placeholder={L("កំណត់សម្គាល់ (បើមាន)", "Note (optional)")} />
            {error && <div className="pos-error">{error}</div>}
          </div>
        )}
        {closed && (
          <div className="pos-dialog-body">
            <div className="pos-rc-preview" ref={zRef}>
              <div className="rc">
                <div className="rc-head"><b>{L("របាយការណ៍បិទវេន", "Shift report (Z)")}</b><span>{nm(catalog.warehouse)} · {catalog.device?.code}</span><span>{closed.shift_no}</span></div>
                <div className="rc-meta">
                  <span>{L("បើក", "Opened")}: {dateTimeText(closed.opened_at)} · {closed.opened_by_name}</span>
                  <span>{L("បិទ", "Closed")}: {dateTimeText(closed.closed_at)} · {closed.closed_by_name}</span>
                </div>
                <div className="rc-sum">
                  <div><span>{L("វិក្កយបត្រ", "Invoices")}</span><span>{r.invoice_count}</span></div>
                  <div><span>{L("លក់សរុប", "Sales")}</span><span>{usd(r.sales_total)}</span></div>
                  <div><span>{L("បញ្ចុះតម្លៃ", "Discounts")}</span><span>{usd(r.discount_total)}</span></div>
                  {r.refund_count > 0 && <div><span>{L("សងប្រាក់", "Refunds")} ({r.refund_count})</span><span>−{usd(r.refund_total)}</span></div>}
                  {r.refund_count > 0 && <div><span>{L("លក់សុទ្ធ", "Net sales")}</span><span>{usd(r.net_total)}</span></div>}
                  {r.tax_total > 0 && <div><span>{L("ពន្ធ", "Tax")}</span><span>{usd(r.tax_total)}</span></div>}
                </div>
                <div className="rc-pay">
                  {r.methods.map((m) => <div key={m.code}><span>{LANG === "en" ? m.name_en : m.name_kh} ({m.count})</span><span>{m.currency === "KHR" ? khr(m.amount) : usd(m.amount)}</span></div>)}
                  {(r.refund_methods || []).map((m) => <div key={`rf-${m.code}`}><span>{L("សង", "Refund")} {LANG === "en" ? m.name_en : m.name_kh} ({m.count})</span><span>−{m.currency === "KHR" ? khr(m.amount) : usd(m.amount)}</span></div>)}
                </div>
                <div className="rc-sum">
                  <div><span>{L("ប្រាក់ដើម", "Float")}</span><span>{usd(closed.opening_usd)} + {khr(closed.opening_khr)}</span></div>
                  <div><span>{L("គួរមាន", "Expected")}</span><span>{usd(r.expected_usd)} + {khr(r.expected_khr)}</span></div>
                  <div><span>{L("រាប់បាន", "Counted")}</span><span>{usd(r.counted_usd)} + {khr(r.counted_khr)}</span></div>
                  <div className="rc-total"><span>{L("លម្អៀង", "Difference")}</span><span>{r.diff_usd >= 0 ? "+" : "−"}{usd(Math.abs(r.diff_usd))} {r.diff_khr >= 0 ? "+" : "−"}{khr(Math.abs(r.diff_khr))}</span></div>
                </div>
                {closed.note && <div className="rc-foot"><span>{closed.note}</span></div>}
              </div>
            </div>
          </div>
        )}
        <div className="pos-dialog-foot">
          {!closed ? (
            <>
              <button type="button" className="pos-btn pos-btn-ghost" onClick={onClose} disabled={busy}>{L("ត្រឡប់", "Back")}</button>
              <button type="button" className="pos-btn pos-btn-danger pos-btn-lg" onClick={close} disabled={busy || !t || (cUsd === "" && cKhr === "")}>{busy ? "…" : L("បិទវេន", "Close shift")}</button>
            </>
          ) : (
            <>
              <button type="button" className="pos-btn pos-btn-ghost" onClick={() => printZ(zRef.current)}><Printer size={18} /> {L("បោះពុម្ពម្តងទៀត", "Print again")}</button>
              <button type="button" className="pos-btn pos-btn-primary pos-btn-lg" onClick={onClosed}>{L("រួចរាល់ — ចាកចេញ", "Done — log out")}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
