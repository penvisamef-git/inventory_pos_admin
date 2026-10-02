import React, { useEffect, useState } from "react";
import { Printer, RotateCcw, ShieldAlert, X } from "lucide-react";
import { saleService } from "../../../api/api.service";
import { L } from "../../../i18n";
import { usd, khr, num, nm, dtText } from "./saleUtil";

const unitName = (i) => L(i.unit_name_kh || i.unit_name_en || i.unit_code, i.unit_name_en || i.unit_name_kh || i.unit_code);

// One invoice: lines (with cost / profit for central roles), payments, change, approvals, shift
export default function SaleDetail({ id, cost, onClose }) {
  const [s, setS] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    saleService.get(id).then((r) => setS(r.data)).catch((e) => setError(e.message || "Error"));
  }, [id]);
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  const showCost = cost && s && s.cost_total !== undefined && s.cost_total !== null;

  return (
    <div className="md-modal-backdrop" onMouseDown={onClose}>
      <div className="md-modal sl-detail" onMouseDown={(e) => e.stopPropagation()}>
        <div className="md-modal-header">
          <h3>{s ? s.invoice_no : L("វិក្កយបត្រ", "Invoice")}{s?.state === "void" && <span className="md-badge md-badge-off">{L("បានលុប", "Void")}</span>}</h3>
          <div className="sl-detail-tools">
            {s && <button type="button" className="md-btn md-btn-ghost" onClick={() => window.print()}><Printer size={16} /> {L("បោះពុម្ព", "Print")}</button>}
            <button type="button" className="md-icon-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div className="md-modal-body">
          {error && <div className="md-empty">{error}</div>}
          {!s && !error && <div className="md-empty">{L("កំពុងផ្ទុក...", "Loading...")}</div>}
          {s && (
            <div className="sl-print">
              <div className="sl-meta">
                <div><span>{L("ពេលលក់", "Sold at")}</span><b>{dtText(s.sold_at)}</b></div>
                <div><span>{L("ហាង", "Shop")}</span><b>{s.warehouse_id?.code} · {nm(s.warehouse_id)}</b></div>
                <div><span>POS</span><b>{s.device_id?.code} · {s.device_id?.name}</b></div>
                <div><span>{L("អ្នកគិតលុយ", "Cashier")}</span><b>{s.cashier_name || "-"}</b></div>
                <div><span>{L("វេន", "Shift")}</span><b>{s.shift_no || "-"}{s.shift && <small> · {s.shift.state === "closed" ? L("បានបិទ", "closed") : L("កំពុងបើក", "open")}</small>}</b></div>
                <div><span>{L("ទទួលនៅ Cloud", "Received")}</span><b>{dtText(s.received_at)}</b></div>
              </div>
              {(s.discount_by_name || s.stock_override_by_name) && (
                <div className="sl-approvals">
                  {s.discount_by_name && <span>{L("បញ្ចុះតម្លៃអនុម័តដោយ", "Discount approved by")} <b>{s.discount_by_name}</b></span>}
                  {s.stock_override_by_name && (
                    <span className="warn">
                      <ShieldAlert size={14} /> {L("លក់ពេលអស់ស្តុក អនុញ្ញាតដោយ", "Sold out of stock, allowed by")} <b>{s.stock_override_by_name}</b>
                      {s.stock_override_items?.length > 0 && ` (${s.stock_override_items.map((x) => `${x.sku}: ${L("ស្តុក", "stock")} ${num(x.stock)}, ${L("លក់", "sold")} ${num(x.qty)}`).join(" · ")})`}
                    </span>
                  )}
                </div>
              )}

              <div className="md-table-scroll">
                <table className="md-table sl-table">
                  <thead>
                    <tr>
                      <th>{L("ទំនិញ", "Item")}</th>
                      <th className="sl-num">{L("ចំនួន", "Qty")}</th>
                      <th className="sl-num">{L("តម្លៃ", "Price")}</th>
                      <th className="sl-num">{L("បញ្ចុះ", "Discount")}</th>
                      <th className="sl-num">{L("សរុប", "Total")}</th>
                      {showCost && <th className="sl-num">{L("ថ្លៃដើម", "Cost")}</th>}
                      {showCost && <th className="sl-num">{L("ចំណេញ", "Profit")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {s.items.map((i, k) => (
                      <tr key={k}>
                        <td><b>{nm(i)}</b> <small className="md-code">{i.sku}</small>{i.refunded_qty > 0 && <span className="sl-rf">{L("សង", "refunded")} {num(i.refunded_qty, 3)}</span>}</td>
                        <td className="sl-num">{num(i.qty, 3)} {unitName(i)}{i.factor > 1 && <small className="sl-muted"> ({num(i.base_qty)})</small>}</td>
                        <td className="sl-num">{usd(i.price)}</td>
                        <td className="sl-num">{i.discount ? <span className="sl-disc">−{usd(i.discount)}</span> : ""}</td>
                        <td className="sl-num"><b>{usd(i.line_total)}</b></td>
                        {showCost && <td className="sl-num">{i.cost_total === null || i.cost_total === undefined ? "-" : usd(i.cost_total)}</td>}
                        {showCost && <td className={`sl-num ${i.line_total - (i.cost_total || 0) < 0 ? "sl-neg" : ""}`}>{i.cost_total === null || i.cost_total === undefined ? "-" : usd(i.line_total - i.cost_total)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="sl-detail-foot">
                <div className="sl-pay-box">
                  <h5>{L("ការបង់ប្រាក់", "Payments")}</h5>
                  {s.payments.map((p, k) => (
                    <div key={k}>
                      <span>{nm(p) || p.code}{p.reference ? <small> · {p.reference}</small> : ""}</span>
                      <b>{p.currency === "KHR" ? khr(p.amount) : usd(p.amount)}</b>
                    </div>
                  ))}
                  {s.change_usd > 0.004 && (
                    <div className="sl-change-row">
                      <span>{L("ប្រាក់អាប់", "Change")}</span>
                      <b>{s.change_give_usd || s.change_give_khr ? `${s.change_give_usd ? usd(s.change_give_usd) : ""}${s.change_give_usd && s.change_give_khr ? " + " : ""}${s.change_give_khr ? khr(s.change_give_khr) : ""}` : usd(s.change_usd)}</b>
                    </div>
                  )}
                </div>
                <div className="sl-totals">
                  <div><span>{L("សរុបរង", "Subtotal")}</span><span>{usd(s.subtotal)}</span></div>
                  {s.discount_total > 0 && <div><span>{L("បញ្ចុះតម្លៃ", "Discount")}</span><span className="sl-disc">−{usd(s.discount_total)}</span></div>}
                  {s.tax_amount > 0 && <div><span>{L("ពន្ធ", "Tax")} {s.tax_rate}%{s.tax_mode === "inclusive" ? ` (${L("រួមក្នុងតម្លៃ", "incl.")})` : ""}</span><span>{usd(s.tax_amount)}</span></div>}
                  <div className="sl-grand"><span>{L("សរុប", "Total")}</span><span><b>{usd(s.total)}</b><small>{khr(s.total_khr)} · 1$ = {khr(s.rate)}</small></span></div>
                  {showCost && (
                    <div className="sl-profit-row"><span>{L("ថ្លៃដើម / ចំណេញ", "Cost / profit")}</span><span>{usd(s.cost_total)} · <b>{usd(s.profit)}</b></span></div>
                  )}
                </div>
              </div>
              {s.refunds?.length > 0 && (
                <div className="sl-refunds">
                  <h5><RotateCcw size={15} /> {L("ការសងប្រាក់", "Refunds")} · −{usd(s.refunded_total)}</h5>
                  {s.refunds.map((rf) => (
                    <div key={rf._id} className="sl-refund-row">
                      <span>
                        <b>{rf.refund_no}</b> {rf.kind === "void" && <em className="sl-rf full">VOID</em>}
                        <small>{dtText(rf.refunded_at)} · {rf.cashier_name} · {L("អនុម័ត", "approved by")} {rf.approved_by_name} · {rf.reason}</small>
                        <small>{rf.items.map((i) => `${i.sku} × ${num(i.qty, 3)}`).join(" · ")} · {rf.payments.map((p) => nm(p) || p.code).join(", ")}</small>
                      </span>
                      <b className="sl-neg">−{usd(rf.total)}</b>
                    </div>
                  ))}
                </div>
              )}
              {s.note && <p className="sl-muted">{s.note}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
