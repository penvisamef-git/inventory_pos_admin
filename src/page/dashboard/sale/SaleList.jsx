import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Percent, RotateCcw, ShieldAlert } from "lucide-react";
import { saleService } from "../../../api/api.service";
import { L } from "../../../i18n";
import SaleDetail from "./SaleDetail";
import { usd, num, nm, dtText } from "./saleUtil";

// Invoices received from the POS (newest first) — open one to check it
export default function SaleList({ params, tick, cost, portal }) {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [flag, setFlag] = useState("");
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(null);
  const seq = useRef(0);
  const key = JSON.stringify({ ...params, q: query || undefined, flag: flag || undefined });

  useEffect(() => setPage(1), [key]);
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const n = ++seq.current;
    setLoading(true);
    const p = { ...JSON.parse(key), page, limit: 30 };
    const apply = (x) => n === seq.current && setRes(x);
    saleService
      .list(p, { onFresh: apply })
      .then((x) => {
        apply(x);
        if (page < (x.pagination?.totalPages || 1)) saleService.list({ ...p, page: page + 1 }, { prefetch: true });
      })
      .catch(() => n === seq.current && setRes({ data: [], summary: null }))
      .finally(() => n === seq.current && setLoading(false));
  }, [key, page, tick]);

  const rows = res?.data || [];
  const s = res?.summary;
  const pages = res?.pagination?.totalPages || 1;
  const showCost = cost && s?.profit !== undefined;

  return (
    <>
      <div className="sl-sumbar">
        <div><span>{L("វិក្កយបត្រ", "Invoices")}</span><b>{s ? num(s.count, 0) : "…"}</b></div>
        <div><span>{L("លក់សរុប", "Sales")}</span><b>{s ? usd(s.total) : "…"}</b></div>
        <div><span>{L("មធ្យម", "Average")}</span><b>{s ? usd(s.average) : "…"}</b></div>
        <div><span>{L("បញ្ចុះតម្លៃ", "Discounts")}</span><b>{s ? usd(s.discount_total) : "…"}</b></div>
        {showCost && <div><span>{L("ចំណេញ", "Profit")}</span><b className="sl-pos">{usd(s.profit)}</b></div>}
        <label className="sl-search">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L("លេខវិក្កយបត្រ / កូដទំនិញ / អ្នកគិតលុយ", "Invoice no. / item code / cashier")} />
        </label>
        <div className="sl-flags">
          <button type="button" className={flag === "discount" ? "on" : ""} onClick={() => setFlag(flag === "discount" ? "" : "discount")}><Percent size={14} /> {L("មានបញ្ចុះ", "Discounted")}</button>
          <button type="button" className={flag === "override" ? "on" : ""} onClick={() => setFlag(flag === "override" ? "" : "override")}><ShieldAlert size={14} /> {L("លក់ពេលអស់ស្តុក", "Out-of-stock sales")}</button>
          <button type="button" className={flag === "refunded" ? "on" : ""} onClick={() => setFlag(flag === "refunded" ? "" : "refunded")}><RotateCcw size={14} /> {L("មានការសងប្រាក់", "Refunded")}</button>
        </div>
      </div>

      <div className="md-card">
        {rows.length ? (
          <div className="md-table-scroll">
            <table className="md-table sl-table sl-clickable">
              <thead>
                <tr>
                  <th>{L("វិក្កយបត្រ", "Invoice")}</th>
                  <th>{L("ពេលវេលា", "Time")}</th>
                  {!portal && <th>{L("ហាង", "Shop")}</th>}
                  <th>POS</th>
                  <th>{L("អ្នកគិតលុយ", "Cashier")}</th>
                  <th className="sl-num">{L("ទំនិញ", "Items")}</th>
                  <th>{L("បង់ដោយ", "Paid by")}</th>
                  <th className="sl-num">{L("បញ្ចុះ", "Discount")}</th>
                  <th className="sl-num">{L("សរុប", "Total")}</th>
                  {showCost && <th className="sl-num">{L("ចំណេញ", "Profit")}</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x._id} onClick={() => setOpen(x._id)}>
                    <td>
                      <b className="sl-inv">{x.invoice_no}</b>
                      {x.stock_override_by && <ShieldAlert size={14} className="sl-ico-warn" title={L("លក់ពេលអស់ស្តុក", "Sold out of stock")} />}
                      {x.refunded_total > 0 && <span className={`sl-rf ${x.refund_status === "full" ? "full" : ""}`}>{x.refund_status === "full" ? L("សងទាំងអស់", "Refunded") : `−${usd(x.refunded_total)}`}</span>}
                    </td>
                    <td className="sl-muted">{dtText(x.sold_at)}</td>
                    {!portal && <td>{x.warehouse_id?.code}</td>}
                    <td>{x.device_id?.code}</td>
                    <td>{x.cashier_name || "-"}</td>
                    <td className="sl-num">{num(x.item_qty)} <small className="sl-muted">({x.item_count})</small></td>
                    <td><span className="sl-pays">{(x.payments || []).map((p, k) => <em key={k} className={`sl-pay sl-pay-${p.type}`}>{nm(p) || p.code}</em>)}</span></td>
                    <td className="sl-num">{x.discount_total ? <span className="sl-disc">−{usd(x.discount_total)}</span> : ""}</td>
                    <td className="sl-num"><b>{usd(x.total)}</b></td>
                    {showCost && <td className={`sl-num ${x.profit < 0 ? "sl-neg" : ""}`}>{x.profit === undefined ? "-" : usd(x.profit)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="md-empty">{loading || !res ? L("កំពុងផ្ទុក...", "Loading...") : L("មិនមានវិក្កយបត្រ", "No invoices")}</div>
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
      {open && <SaleDetail id={open} cost={cost} onClose={() => setOpen(null)} />}
    </>
  );
}
