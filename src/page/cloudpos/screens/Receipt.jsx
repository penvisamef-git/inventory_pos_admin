import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Printer, RotateCcw, X } from "lucide-react";
import { L, LANG, nm, usd, khr, qtyText, dateTimeText } from "../i18n";
import { receiptClass, receiptTemplate } from "../receiptTemplates";
import "./receipt.css";

const lineName = (i) => (LANG === "en" ? i.name_en || i.name_kh : i.name_kh || i.name_en);
const unitName = (i) => (LANG === "en" ? i.unit_name_en || i.unit_code : i.unit_name_kh || i.unit_code) || "";

// Code 39 bars (wide = 1) for the invoice number — footer of the "barcode" styles
const C39 = {
  0: "000110100", 1: "100100001", 2: "001100001", 3: "101100000", 4: "000110001", 5: "100110000", 6: "001110000", 7: "000100101", 8: "100100100", 9: "001100100",
  A: "100001001", B: "001001001", C: "101001000", D: "000011001", E: "100011000", F: "001011000", G: "000001101", H: "100001100", I: "001001100", J: "000011100",
  K: "100000011", L: "001000011", M: "101000010", N: "000010011", O: "100010010", P: "001010010", Q: "000000111", R: "100000110", S: "001000110", T: "000010110",
  U: "110000001", V: "011000001", W: "111000000", X: "010010001", Y: "110010000", Z: "011010000", "-": "010000101", ".": "110000100", " ": "011000100", "*": "010010100",
};
function Bars({ text }) {
  const chars = `*${String(text || "").toUpperCase().replace(/[^0-9A-Z. -]/g, "-")}*`.split("");
  const out = [];
  chars.forEach((c, k) => {
    C39[c].split("").forEach((w, j) => out.push({ bar: j % 2 === 0, w: w === "1" ? 3 : 1 }));
    if (k < chars.length - 1) out.push({ bar: false, w: 1 });
  });
  const unit = Math.max(0.5, Math.min(1.4, 240 / out.reduce((t, x) => t + x.w, 0)));
  return (
    <div className="rc-bars" aria-hidden="true">
      {out.map((x, k) => <i key={k} style={{ width: `${x.w * unit}px`, background: x.bar ? "#000" : "transparent" }} />)}
    </div>
  );
}

// 80 mm receipt in the style chosen in the admin (setting.receipt_template — 24 styles, receiptTemplates.js).
// The paper copy is drawn into #print-root and printed with the browser (window.print).
export function ReceiptPaper({ sale: s, catalog, template }) {
  const st = catalog?.setting || {};
  const wh = catalog?.warehouse || {};
  const t = receiptTemplate(template || st.receipt_template);
  const company = (LANG === "en" ? st.company_name_en || st.company_name_kh : st.company_name_kh || st.company_name_en) || nm(wh);
  const lineTotal = (i) => i.qty * i.price;
  return (
    <div className={receiptClass(t)}>
      <div className="rc-head">
        {st.logo && <img src={st.logo} alt="" />}
        <b>{company}</b>
        {company !== nm(wh) && <span>{nm(wh)}</span>}
        {(wh.address || st.address) && <span>{wh.address || st.address}</span>}
        {(wh.phone || st.phone) && <span>{L("ទូរស័ព្ទ", "Tel")}: {wh.phone || st.phone}</span>}
        {st.vat_no && <span>VAT: {st.vat_no}</span>}
        {st.receipt_header && <span className="rc-note">{st.receipt_header}</span>}
      </div>
      <div className="rc-meta">
        <span>{L("វិក្កយបត្រ", "Invoice")}: <b>{s.invoice_no}</b></span>
        <span>{dateTimeText(s.sold_at)}</span>
        <span>{L("អ្នកគិតលុយ", "Cashier")}: {s.cashier_name}</span>
        {t.meta === "grid" && <span>{L("ទំនិញ", "Items")}: {s.items.length}</span>}
      </div>
      <div className="rc-itemswrap">
        <table className="rc-items">
          {t.items === "table" && (
            <thead>
              <tr>
                <th className="rc-th">{L("ទំនិញ", "Item")}</th>
                <th className="rc-th rc-r">{L("ចំនួន", "Qty")}</th>
                <th className="rc-th rc-r">{L("តម្លៃ", "Price")}</th>
                <th className="rc-th rc-r">{L("សរុប", "Amount")}</th>
              </tr>
            </thead>
          )}
          <tbody>
            {s.items.map((i, k) =>
              t.items === "table" ? (
                <tr key={k}>
                  <td><b>{lineName(i)}</b></td>
                  <td className="rc-r">{qtyText(i.qty)}</td>
                  <td className="rc-r">{usd(i.price)}</td>
                  <td className="rc-r">{usd(lineTotal(i))}</td>
                </tr>
              ) : t.items === "one-line" ? (
                <tr key={k}>
                  <td>
                    <b>{lineName(i)}</b>
                    <span className="rc-sub">{qtyText(i.qty)} {unitName(i)} × {usd(i.price)}</span>
                  </td>
                  <td className="rc-r"><b>{usd(lineTotal(i))}</b></td>
                </tr>
              ) : t.items === "numbered" ? (
                <tr key={k}>
                  <td className="rc-no">{k + 1}.</td>
                  <td>
                    <b>{lineName(i)}</b>
                    <span className="rc-sub">{qtyText(i.qty)} {unitName(i)} × {usd(i.price)}</span>
                  </td>
                  <td className="rc-r">{usd(lineTotal(i))}</td>
                </tr>
              ) : (
                <React.Fragment key={k}>
                  <tr><td colSpan={2} className="rc-name">{lineName(i)}</td></tr>
                  <tr>
                    <td>{qtyText(i.qty)} {unitName(i)} × {usd(i.price)}</td>
                    <td className="rc-r">{usd(lineTotal(i))}</td>
                  </tr>
                </React.Fragment>
              ),
            )}
          </tbody>
        </table>
      </div>
      <div className="rc-sum">
        <div><span>{L("សរុបរង", "Subtotal")}</span><span>{usd(s.subtotal)}</span></div>
        {s.discount_total > 0 && <div><span>{L("បញ្ចុះតម្លៃ", "Discount")}{s.discount_type === "percent" ? ` ${s.discount_value}%` : ""}</span><span>−{usd(s.discount_total)}</span></div>}
        {s.tax_mode !== "none" && s.tax_amount > 0 && <div><span>{s.tax_name} {s.tax_rate}%{s.tax_mode === "inclusive" ? ` (${L("រួម", "incl.")})` : ""}</span><span>{usd(s.tax_amount)}</span></div>}
        <div className="rc-total"><span>{L("សរុប", "TOTAL")}</span><span>{usd(s.total)}</span></div>
        <div className="rc-khr"><span>{L("ជារៀល", "In riel")}</span><span>{khr(s.total_khr)}</span></div>
      </div>
      <div className="rc-pay">
        {s.payments.map((p, k) => (
          <div key={k}><span>{LANG === "en" ? p.name_en : p.name_kh}{p.reference ? ` (${p.reference})` : ""}</span><span>{p.currency === "KHR" ? khr(p.amount) : usd(p.amount)}</span></div>
        ))}
        {s.change_usd > 0 && (
          <div><span>{L("ប្រាក់អាប់", "Change")}</span><span>{[s.change_give_usd ? usd(s.change_give_usd) : "", s.change_give_khr ? khr(s.change_give_khr) : ""].filter(Boolean).join(" + ") || usd(s.change_usd)}</span></div>
        )}
      </div>
      <div className="rc-foot">
        <span>1$ = {khr(s.rate)}</span>
        {st.receipt_footer && <b>{st.receipt_footer}</b>}
        {t.foot === "barcode" && (
          <>
            <Bars text={s.invoice_no} />
            <span className="rc-bars-text">{s.invoice_no}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function printReceipt(node) {
  const root = document.getElementById("print-root");
  if (!root) return;
  root.innerHTML = "";
  root.appendChild(node.cloneNode(true));
  setTimeout(() => window.print(), 50);
}

// After a sale (and for reprints): the receipt on screen + Print
export default function Receipt({ sale, catalog, onClose, autoPrint, onRefund }) {
  const ref = React.useRef(null);
  useEffect(() => {
    if (!autoPrint) return undefined;
    const t = setTimeout(() => ref.current && printReceipt(ref.current), 150);
    return () => clearTimeout(t);
  }, [autoPrint]);
  useEffect(() => {
    const h = (e) => (e.key === "Enter" || e.key === "Escape") && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return createPortal(
    <div className="pos-back" onMouseDown={onClose}>
      <div className="pos-dialog pos-rcdlg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pos-dialog-head">
          <h3>{autoPrint ? <><CheckCircle2 size={20} className="pos-ok" /> {L("បានលក់", "Sale complete")}</> : sale.invoice_no}</h3>
          <button type="button" className="pos-icon" onClick={onClose}><X size={20} /></button>
        </div>
        {autoPrint && sale.change_usd > 0 && (
          <div className="pos-change-big">
            {L("អាប់", "Give change")}: <b>{[sale.change_give_usd ? usd(sale.change_give_usd) : "", sale.change_give_khr ? khr(sale.change_give_khr) : ""].filter(Boolean).join(" + ")}</b>
          </div>
        )}
        {sale.refunded_total > 0 && (
          <div className="pos-rf-note"><RotateCcw size={15} /> {sale.refund_status === "full" ? L("បានសងទាំងអស់", "Fully refunded") : L("បានសងខ្លះ", "Partly refunded")} · −{usd(sale.refunded_total)}</div>
        )}
        <div className="pos-rc-preview" ref={ref}>
          <ReceiptPaper sale={sale} catalog={catalog} />
        </div>
        <div className="pos-dialog-foot">
          <button type="button" className="pos-btn pos-btn-ghost" onClick={() => printReceipt(ref.current)}><Printer size={18} /> {L("បោះពុម្ព", "Print")}</button>
          {onRefund && sale.state === "paid" && sale.refund_status !== "full" && (
            <button type="button" className="pos-btn pos-btn-ghost pos-btn-warn" onClick={onRefund}><RotateCcw size={18} /> {sale.refunded_total ? L("សងបន្ថែម", "Refund more") : L("សង / លុបចោល", "Refund / void")}</button>
          )}
          <button type="button" className="pos-btn pos-btn-primary pos-btn-lg" onClick={onClose} autoFocus>{autoPrint ? L("លក់បន្ទាប់ (Enter)", "Next sale (Enter)") : L("បិទ", "Close")}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
