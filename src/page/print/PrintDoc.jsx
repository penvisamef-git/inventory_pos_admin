import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Printer, X } from "lucide-react";
import { adjustmentService, countService, openingService, receiveService, settingService, transferService } from "../../api/api.service";
import { isShopUser } from "../dashboard/stock/stockOptions";
import { LANG } from "../../i18n";
import "./print.style.css";

// Bilingual labels: printed documents show Khmer + English
const T = (kh, en) => (
  <>
    {kh}
    <small> {en}</small>
  </>
);
const name = (r) => (LANG === "en" ? r?.name_en || r?.name_kh : r?.name_kh) || "";
const qty = (n) => (n === null || n === undefined ? "" : Number(n).toLocaleString("en-US", { maximumFractionDigits: 4 }));
const usd = (v) => (v === null || v === undefined ? "" : `${v < 0 ? "−" : ""}$${Math.abs(Number(v)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const date = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { timeZone: "Asia/Phnom_Penh", day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const dateTime = (d) => (d ? new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Phnom_Penh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "");
const person = (u) => (u ? `${u.firstname || ""} ${u.lastname || ""}`.trim() || u.email : "");
const wh = (w) => (w ? `${w.code} · ${name(w)}` : "");

const STATE = {
  draft: ["សេចក្តីព្រាង", "Draft"],
  requested: ["ស្នើសុំ", "Requested"],
  posted: ["បាន Post", "Posted"],
  dispatched: ["កំពុងដឹក", "In transit"],
  received: ["បានទទួល", "Received"],
  cancelled: ["បានបោះបង់", "Cancelled"],
  counting: ["កំពុងរាប់", "Counting"],
  submitted: ["បានបញ្ជូន", "Submitted"],
};
const REASON = { damaged: "ខូចខាត / Damaged", expired: "ផុតកំណត់ / Expired", lost: "បាត់ / Lost", found: "រកឃើញ / Found", other: "ផ្សេងៗ / Other", transfer_shortage: "ខ្វះពេលផ្ទេរ / Transfer shortage", stock_count: "រាប់ស្តុក / Stock count" };

const TYPES = {
  transfer: { service: transferService, title: ["ប័ណ្ណផ្ទេរស្តុក", "Stock transfer"], sign: [["អ្នករៀបចំ", "Prepared by"], ["អ្នកដឹកជញ្ជូន", "Driver"], ["អ្នកទទួល", "Received by"]] },
  receive: { service: receiveService, title: ["ប័ណ្ណទទួលទំនិញ", "Goods receive note"], cost: true, sign: [["អ្នកទទួល", "Received by"], ["អ្នកត្រួតពិនិត្យ", "Checked by"], ["អ្នកផ្គត់ផ្គង់", "Supplier"]] },
  adjustment: { service: adjustmentService, title: ["ប័ណ្ណកែតម្រូវស្តុក", "Stock adjustment"], cost: true, sign: [["អ្នករៀបចំ", "Prepared by"], ["អ្នកអនុម័ត", "Approved by"]] },
  opening: { service: openingService, title: ["ស្តុកដើមគ្រា", "Opening stock"], cost: true, sign: [["អ្នករៀបចំ", "Prepared by"], ["អ្នកអនុម័ត", "Approved by"]] },
  count: { service: countService, title: ["ប័ណ្ណរាប់ស្តុក", "Stock count sheet"], sign: [["អ្នករាប់", "Counted by"], ["អ្នកត្រួតពិនិត្យ", "Checked by"], ["អ្នកអនុម័ត", "Approved by"]] },
};

// /print/:type/:id → A4 page, opens the print dialog (print or "Save as PDF")
function PrintDoc() {
  const { type, id } = useParams();
  const cfg = TYPES[type];
  const [doc, setDoc] = useState(null);
  const [company, setCompany] = useState(null);
  const [error, setError] = useState("");
  const cost = cfg?.cost && !isShopUser();

  useEffect(() => {
    if (!cfg) return;
    Promise.all([cfg.service.get(id), settingService.get().catch(() => ({ data: null }))])
      .then(([d, s]) => {
        setDoc(d.data);
        setCompany(s.data);
      })
      .catch((err) => setError(err.message));
  }, [cfg, id]);

  useEffect(() => {
    if (!doc) return undefined;
    document.title = `${doc.doc_no} · ${cfg.title[1]}`;
    const t = setTimeout(() => window.print(), 600); // after the logo / fonts load
    return () => clearTimeout(t);
  }, [doc, cfg]);

  if (!cfg) return <div className="prt-msg">Unknown document</div>;
  if (error) return <div className="prt-msg">{error}</div>;
  if (!doc) return <div className="prt-msg">…</div>;

  const st = STATE[doc.state] || [doc.state, doc.state];
  const isCount = type === "count";
  const blank = isCount && doc.state === "counting"; // blank sheet for counting on paper
  const lines = isCount ? doc.lines : doc.items;

  const info = [
    [T("កាលបរិច្ឆេទ", "Date"), date(doc.doc_date)],
    ...(type === "transfer"
      ? [
          [T("ពីឃ្លាំង", "From"), wh(doc.warehouse_id)],
          [T("ទៅហាង", "To"), wh(doc.to_warehouse_id)],
        ]
      : [[T("ឃ្លាំង / ហាង", "Warehouse"), wh(doc.warehouse_id)]]),
    ...(type === "receive" ? [[T("អ្នកផ្គត់ផ្គង់", "Supplier"), [doc.supplier_id?.name, doc.supplier_id?.phone].filter(Boolean).join(" · ")], [T("វិក្កយបត្រ", "Invoice no."), doc.supplier_invoice_no || doc.invoice_no || ""]] : []),
    ...(type === "adjustment" ? [[T("មូលហេតុ", "Reason"), REASON[doc.reason] || doc.reason]] : []),
    ...(isCount && doc.category_id ? [[T("ប្រភេទទំនិញ", "Category"), name(doc.category_id)]] : []),
    [T("បង្កើតដោយ", "Created by"), `${person(doc.created_by)} · ${dateTime(doc.created_date)}`],
    ...(doc.dispatched_at ? [[T("បញ្ជូនដោយ", "Dispatched"), `${person(doc.dispatched_by)} · ${dateTime(doc.dispatched_at)}`]] : []),
    ...(doc.received_at ? [[T("ទទួលដោយ", "Received"), `${person(doc.received_by)} · ${dateTime(doc.received_at)}`]] : []),
    ...(doc.submitted_at ? [[T("បញ្ជូនដោយ", "Submitted"), `${person(doc.submitted_by)} · ${dateTime(doc.submitted_at)}`]] : []),
    ...(doc.posted_at ? [[T("Post ដោយ", "Posted"), `${person(doc.posted_by)} · ${dateTime(doc.posted_at)}`]] : []),
    ...(doc.adjustment_id?.doc_no ? [[T("កែតម្រូវ", "Adjustment"), doc.adjustment_id.doc_no]] : []),
  ];

  const batchText = (i) =>
    i.batches?.length
      ? i.batches.map((b) => `${b.batch_no} (${date(b.expiry_date)}) ×${qty(b.qty)}`).join(", ")
      : i.batch_no
        ? `${i.batch_no}${i.expiry_date ? ` (${date(i.expiry_date)})` : ""}`
        : "";
  const unit = (i) => (LANG === "en" ? i.unit_name_en || i.unit_code : i.unit_name_kh || i.unit_code) || "";

  const totalQty = isCount ? null : lines.reduce((t, i) => t + Math.abs(i.base_qty ?? i.qty ?? 0), 0);

  return (
    <div className="prt-page">
      <div className="prt-tools">
        <button type="button" onClick={() => window.print()}>
          <Printer size={16} /> Print / PDF
        </button>
        <button type="button" onClick={() => window.close()}>
          <X size={16} /> Close
        </button>
      </div>

      <header className="prt-head">
        <div className="prt-company">
          {company?.logo?.url && <img src={company.logo.url} alt="" />}
          <div>
            <b>{company?.company_name_kh || company?.company_name_en || "Inventory POS"}</b>
            {company?.company_name_en && company?.company_name_kh && <span>{company.company_name_en}</span>}
            <small>{[company?.address, company?.phone, company?.email].filter(Boolean).join(" · ")}</small>
          </div>
        </div>
        <div className="prt-title">
          <h1>
            {cfg.title[0]}
            <span>{cfg.title[1]}</span>
          </h1>
          <b className="prt-no">{doc.doc_no}</b>
          <span className={`prt-state prt-${doc.state}`}>
            {st[0]} / {st[1]}
          </span>
        </div>
      </header>

      <section className="prt-info">
        {info.map(([k, v], i) => (
          <div key={i}>
            <span>{k}</span>
            <b>{v || "—"}</b>
          </div>
        ))}
      </section>

      <table className="prt-table">
        <thead>
          <tr>
            <th className="prt-n">#</th>
            <th>{T("ទំនិញ", "Item")}</th>
            <th>{T("Batch / ផុតកំណត់", "Batch / expiry")}</th>
            <th>{T("ឯកតា", "Unit")}</th>
            {isCount ? (
              blank ? (
                <th className="prt-r prt-box-h">{T("ចំនួនរាប់បាន", "Counted")}</th>
              ) : (
                <>
                  <th className="prt-r">{T("ប្រព័ន្ធ", "System")}</th>
                  <th className="prt-r">{T("រាប់បាន", "Counted")}</th>
                  <th className="prt-r">{T("ខុសគ្នា", "Difference")}</th>
                </>
              )
            ) : (
              <>
                <th className="prt-r">{T("ចំនួន", "Qty")}</th>
                {type === "transfer" && <th className="prt-r">{T("បានទទួល", "Received")}</th>}
                {cost && <th className="prt-r">{T("ថ្លៃដើម", "Unit cost")}</th>}
                {cost && <th className="prt-r">{T("សរុប", "Total")}</th>}
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {lines.map((i, n) => (
            <tr key={i._id || n}>
              <td className="prt-n">{n + 1}</td>
              <td>
                <b>{LANG === "en" ? i.name_en || i.name_kh : i.name_kh}</b>
                <code>{i.sku}</code>
                {i.note && !isCount && <em>{i.note}</em>}
              </td>
              <td className="prt-batch">{batchText(i)}</td>
              <td>{unit(i)}</td>
              {isCount ? (
                blank ? (
                  <td className="prt-box" />
                ) : (
                  <>
                    <td className="prt-r">{qty(i.expected_qty)}</td>
                    <td className="prt-r">{i.counted_qty === null || i.counted_qty === undefined ? "—" : qty(i.counted_qty)}</td>
                    <td className={`prt-r ${i.diff_qty > 0 ? "prt-up" : i.diff_qty < 0 ? "prt-down" : ""}`}>{i.diff_qty ? `${i.diff_qty > 0 ? "+" : ""}${qty(i.diff_qty)}` : i.diff_qty === 0 ? "0" : ""}</td>
                  </>
                )
              ) : (
                <>
                  <td className={`prt-r ${i.qty < 0 ? "prt-down" : ""}`}>
                    {qty(i.qty)}
                    {i.factor && i.factor !== 1 ? <small> (= {qty(i.base_qty)})</small> : null}
                  </td>
                  {type === "transfer" && <td className="prt-r">{qty(i.received_qty)}</td>}
                  {cost && <td className="prt-r">{usd(i.unit_cost)}</td>}
                  {cost && <td className="prt-r">{usd(i.line_total)}</td>}
                </>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>
              {T("ចំនួនជួរ", "Lines")}: {lines.length}
              {isCount && !blank && (
                <>
                  {" "}
                  · {T("ខុសគ្នា", "Differences")}: {doc.diff_lines} (+{qty(doc.diff_in_qty)} / −{qty(doc.diff_out_qty)})
                </>
              )}
            </td>
            {isCount ? (
              blank ? (
                <td />
              ) : (
                <td colSpan={3} className="prt-r">
                  {doc.diff_cost !== undefined && doc.diff_cost !== null && <b>{usd(doc.diff_cost)}</b>}
                </td>
              )
            ) : (
              <>
                <td className="prt-r">
                  <b>{qty(totalQty)}</b>
                </td>
                {type === "transfer" && <td className="prt-r">{doc.shortage_qty ? `${T("ខ្វះ", "Short")} ${qty(doc.shortage_qty)}` : ""}</td>}
                {cost && <td />}
                {cost && (
                  <td className="prt-r">
                    <b>{usd(doc.posted_cost ?? doc.total_cost)}</b>
                  </td>
                )}
              </>
            )}
          </tr>
        </tfoot>
      </table>

      {doc.note && (
        <p className="prt-note">
          <span>{T("កំណត់សម្គាល់", "Note")}:</span> {doc.note}
        </p>
      )}

      <section className="prt-sign">
        {cfg.sign.map(([kh, en]) => (
          <div key={en}>
            <span className="prt-line" />
            <b>{kh}</b>
            <small>{en}</small>
            <small className="prt-date">{T("ថ្ងៃទី", "Date")}: ____ / ____ / ________</small>
          </div>
        ))}
      </section>

      <footer className="prt-foot">
        {doc.doc_no} · {dateTime(new Date())}
      </footer>
    </div>
  );
}

export default PrintDoc;
