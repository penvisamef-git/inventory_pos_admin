import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { saleService } from "../../../api/api.service";
import { L } from "../../../i18n";
import { usd, khr, nm, dtText, timeText } from "./saleUtil";

const signed = (v, fmt) => (Math.abs(v || 0) < 0.005 ? fmt(0) : `${v > 0 ? "+" : "−"}${fmt(Math.abs(v))}`);

// Cash drawer shifts sent by the POS: float, sales, expected vs counted cash at closing
export default function ShiftList({ params, tick, portal }) {
  const [flag, setFlag] = useState("");
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(null);
  const seq = useRef(0);
  const key = JSON.stringify({ ...params, flag: flag || undefined });
  useEffect(() => setPage(1), [key]);
  useEffect(() => {
    const n = ++seq.current;
    setLoading(true);
    saleService
      .shifts({ ...JSON.parse(key), page, limit: 30 })
      .then((x) => n === seq.current && setRes(x))
      .catch(() => n === seq.current && setRes({ data: [] }))
      .finally(() => n === seq.current && setLoading(false));
  }, [key, page, tick]);
  const rows = res?.data || [];
  const s = res?.summary;
  const pages = res?.pagination?.totalPages || 1;

  return (
    <>
      <div className="sl-sumbar">
        <div><span>{L("វេន", "Shifts")}</span><b>{s ? s.count : "…"}</b></div>
        <div><span>{L("កំពុងបើក", "Open now")}</span><b>{s ? s.open : "…"}</b></div>
        <div><span>{L("លក់ (វេនបានបិទ)", "Sales (closed)")}</span><b>{s ? usd(s.sales_total) : "…"}</b></div>
        <div><span>{L("ខ្វះ", "Short")}</span><b className={s?.short ? "sl-neg" : ""}>{s ? s.short : "…"}</b></div>
        <div><span>{L("លម្អៀងសរុប", "Total difference")}</span><b className={s && s.diff_total_usd < -0.004 ? "sl-neg" : ""}>{s ? signed(s.diff_total_usd, usd) : "…"}</b></div>
        <div className="sl-flags">
          <button type="button" className={flag === "diff" ? "on" : ""} onClick={() => setFlag(flag === "diff" ? "" : "diff")}><AlertTriangle size={14} /> {L("មានលម្អៀង", "With a difference")}</button>
        </div>
      </div>
      <div className="md-card">
        {rows.length ? (
          <div className="md-table-scroll">
            <table className="md-table sl-table sl-clickable">
              <thead>
                <tr>
                  <th>{L("វេន", "Shift")}</th>
                  {!portal && <th>{L("ហាង", "Shop")}</th>}
                  <th>POS</th>
                  <th>{L("បើក", "Opened")}</th>
                  <th>{L("បិទ", "Closed")}</th>
                  <th className="sl-num">{L("វិក្កយបត្រ", "Invoices")}</th>
                  <th className="sl-num">{L("លក់", "Sales")}</th>
                  <th className="sl-num">{L("លុយគួរមាន", "Expected cash")}</th>
                  <th className="sl-num">{L("រាប់បាន", "Counted")}</th>
                  <th className="sl-num">{L("លម្អៀង", "Difference")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => {
                  const r = x.report || {};
                  const d = r.diff_total_usd;
                  return (
                    <tr key={x._id} onClick={() => setOpen(x)}>
                      <td><b>{x.shift_no}</b></td>
                      {!portal && <td>{x.warehouse_id?.code}</td>}
                      <td>{x.device_id?.code}</td>
                      <td><span className="sl-two"><b>{dtText(x.opened_at)}</b><small>{x.opened_by_name}</small></span></td>
                      <td>{x.state === "closed" ? <span className="sl-two"><b>{timeText(x.closed_at)}</b><small>{x.closed_by_name}</small></span> : <span className="md-badge md-badge-on">{L("កំពុងបើក", "Open")}</span>}</td>
                      <td className="sl-num">{x.state === "closed" ? r.invoice_count : "-"}</td>
                      <td className="sl-num">{x.state === "closed" ? <b>{usd(r.sales_total)}</b> : "-"}</td>
                      <td className="sl-num">{x.state === "closed" ? <span className="sl-two r"><span>{usd(r.expected_usd)}</span><small>{khr(r.expected_khr)}</small></span> : "-"}</td>
                      <td className="sl-num">{x.state === "closed" ? <span className="sl-two r"><span>{usd(x.counted_usd)}</span><small>{khr(x.counted_khr)}</small></span> : "-"}</td>
                      <td className="sl-num">{x.state === "closed" ? <span className={`sl-diff ${d < -0.004 ? "short" : d > 0.004 ? "over" : "ok"}`}>{signed(d, usd)}</span> : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="md-empty">{loading || !res ? L("កំពុងផ្ទុក...", "Loading...") : L("មិនមានវេន", "No shifts")}</div>
        )}
        <div className="md-pagination">
          <span className="md-sub">{L("សរុប", "Total")} {s?.count ?? 0}</span>
          <div className="md-pager">
            <button type="button" className="md-icon-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button>
            <span>{L("ទំព័រ", "Page")} {page} / {pages}</span>
            <button type="button" className="md-icon-btn" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {open && (
        <div className="md-modal-backdrop" onMouseDown={() => setOpen(null)}>
          <div className="md-modal md-modal-sm" onMouseDown={(e) => e.stopPropagation()}>
            <div className="md-modal-header"><h3>{open.shift_no}</h3></div>
            <div className="md-modal-body sl-shift">
              <div className="sl-meta">
                <div><span>{L("ហាង / POS", "Shop / POS")}</span><b>{open.warehouse_id?.code} · {open.device_id?.code} {nm(open.warehouse_id) ? `· ${nm(open.warehouse_id)}` : ""}</b></div>
                <div><span>{L("បើក", "Opened")}</span><b>{dtText(open.opened_at)} · {open.opened_by_name}</b></div>
                <div><span>{L("ប្រាក់ដើម", "Float")}</span><b>{usd(open.opening_usd)} + {khr(open.opening_khr)}</b></div>
                {open.state === "closed" && <div><span>{L("បិទ", "Closed")}</span><b>{dtText(open.closed_at)} · {open.closed_by_name}</b></div>}
              </div>
              {open.state === "closed" && open.report && (
                <>
                  <div className="sl-totals">
                    <div><span>{L("វិក្កយបត្រ", "Invoices")}</span><span>{open.report.invoice_count}</span></div>
                    <div><span>{L("លក់សរុប", "Sales")}</span><span>{usd(open.report.sales_total)}</span></div>
                    <div><span>{L("បញ្ចុះតម្លៃ", "Discounts")}</span><span>{usd(open.report.discount_total)}</span></div>
                    {(open.report.methods || []).map((m) => <div key={m.code}><span>{nm(m)} ({m.count})</span><span>{m.currency === "KHR" ? khr(m.amount) : usd(m.amount)}</span></div>)}
                    <div><span>{L("លុយគួរមាន", "Expected cash")}</span><span>{usd(open.report.expected_usd)} + {khr(open.report.expected_khr)}</span></div>
                    <div><span>{L("រាប់បាន", "Counted")}</span><span>{usd(open.counted_usd)} + {khr(open.counted_khr)}</span></div>
                    <div className="sl-grand"><span>{L("លម្អៀង", "Difference")}</span><span className={`sl-diff ${open.report.diff_total_usd < -0.004 ? "short" : open.report.diff_total_usd > 0.004 ? "over" : "ok"}`}>{signed(open.report.diff_usd, usd)} {signed(open.report.diff_khr, khr)}</span></div>
                  </div>
                  {open.note && <p className="sl-muted">{open.note}</p>}
                </>
              )}
              {open.state !== "closed" && <p className="sl-muted">{L("វេននេះនៅបើក — លទ្ធផលនឹងមកពេល POS បិទវេន។", "This shift is still open — the totals arrive when the POS closes it.")}</p>}
            </div>
            <div className="md-modal-footer"><button type="button" className="md-btn md-btn-ghost" onClick={() => setOpen(null)}>{L("បិទ", "Close")}</button></div>
          </div>
        </div>
      )}
    </>
  );
}
