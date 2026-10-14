import React, { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { saleService } from "../../../api/api.service";
import { L } from "../../../i18n";
import { exportExcel } from "../../util/excel";
import { usd, num, pct, nm } from "./saleUtil";

const GROUPS = [
  ["product", L("ទំនិញ", "Product")],
  ["variant", L("ទំហំ / ពណ៌ (SKU)", "SKU")],
  ["category", L("ប្រភេទ", "Category")],
  ["brand", L("ម៉ាក", "Brand")],
  ["supplier", L("អ្នកផ្គត់ផ្គង់", "Supplier")],
];
const SORTS = [
  ["profit", L("ចំណេញ", "Profit")],
  ["sales", L("លក់", "Sales")],
  ["margin", L("% ចំណេញ", "Margin")],
  ["qty", L("ចំនួន", "Qty")],
];

// Profit by product / SKU / category / brand / supplier (sales − cost, refunds taken out) + Excel
export default function ProfitReport({ params, tick }) {
  const [group, setGroup] = useState("product");
  const [sort, setSort] = useState("profit");
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const key = JSON.stringify({ ...params, group, sort });
  useEffect(() => {
    const n = ++seq.current;
    setLoading(true);
    saleService
      .profit(JSON.parse(key))
      .then((x) => n === seq.current && setRes(x))
      .catch((e) => n === seq.current && setRes({ data: [], error: e?.response?.data?.message || e.message }))
      .finally(() => n === seq.current && setLoading(false));
  }, [key, tick]);
  const rows = res?.data || [];
  const t = res?.totals;
  const groupLabel = GROUPS.find((g) => g[0] === group)?.[1];
  const download = () =>
    exportExcel(
      `profit-${group}-${params.from}_${params.to}.xlsx`,
      "Profit",
      [
        { label: groupLabel, value: (r) => nm(r), width: 34 },
        { label: L("កូដ", "Code"), value: (r) => r.code || "", width: 16 },
        { label: L("ចំនួនលក់", "Qty sold"), value: (r) => r.qty, type: "number", total: t?.qty },
        { label: L("ត្រឡប់", "Returned"), value: (r) => r.returned_qty, type: "number" },
        { label: L("លក់ ($)", "Sales ($)"), value: (r) => r.sales, type: "number", total: t?.sales },
        { label: L("ដើម ($)", "Cost ($)"), value: (r) => r.cost, type: "number", total: t?.cost },
        { label: L("ចំណេញ ($)", "Profit ($)"), value: (r) => r.profit, type: "number", total: t?.profit },
        { label: L("% ចំណេញ", "Margin %"), value: (r) => r.margin, type: "number", total: t?.margin },
        { label: L("វិក្កយបត្រ", "Invoices"), value: (r) => r.invoices, type: "number" },
      ],
      rows,
      { totals: { label: L("សរុប", "Total") } },
    );

  return (
    <>
      <div className="sl-sumbar">
        <div><span>{L("លក់ (ដកសងប្រាក់)", "Sales (less refunds)")}</span><b>{t ? usd(t.sales) : "…"}</b></div>
        <div><span>{L("ដើម", "Cost")}</span><b>{t ? usd(t.cost) : "…"}</b></div>
        <div><span>{L("ចំណេញ", "Profit")}</span><b className={t?.profit < 0 ? "sl-neg" : "sl-pos"}>{t ? usd(t.profit) : "…"}</b></div>
        <div><span>{L("% ចំណេញ", "Margin")}</span><b>{t ? pct(t.margin) : "…"}</b></div>
        <div className="sl-flags">
          {GROUPS.map(([k, label]) => (
            <button key={k} type="button" className={group === k ? "on" : ""} onClick={() => setGroup(k)}>{label}</button>
          ))}
        </div>
        <div className="sl-flags">
          {SORTS.map(([k, label]) => (
            <button key={k} type="button" className={sort === k ? "on" : ""} onClick={() => setSort(k)}>↓ {label}</button>
          ))}
          <button type="button" className="md-btn md-btn-ghost" disabled={!rows.length} onClick={download}><Download size={15} /> Excel</button>
        </div>
      </div>
      <div className="md-card">
        {res?.error ? (
          <div className="md-empty">{res.error}</div>
        ) : rows.length ? (
          <div className="md-table-scroll">
            <table className="md-table sl-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{groupLabel}</th>
                  <th className="sl-num">{L("ចំនួនលក់", "Qty sold")}</th>
                  <th className="sl-num">{L("លក់", "Sales")}</th>
                  <th className="sl-num">{L("ដើម", "Cost")}</th>
                  <th className="sl-num">{L("ចំណេញ", "Profit")}</th>
                  <th className="sl-num">%</th>
                  <th className="sl-num">{L("វិក្កយបត្រ", "Invoices")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key}>
                    <td className="sl-muted">{i + 1}</td>
                    <td>
                      <b>{nm(r)}</b>
                      {r.code && <span className="md-sub">{r.code}{group !== "variant" && r.items > 1 ? ` · ${r.items} SKU` : ""}</span>}
                    </td>
                    <td className="sl-num">{num(r.qty)}{r.returned_qty > 0 && <small className="sl-muted"> (−{num(r.returned_qty)})</small>}</td>
                    <td className="sl-num">{usd(r.sales)}</td>
                    <td className="sl-num sl-muted">{usd(r.cost)}</td>
                    <td className={`sl-num ${r.profit < 0 ? "sl-neg" : "sl-pos"}`}><b>{usd(r.profit)}</b></td>
                    <td className="sl-num"><span className={`pr-margin ${r.margin < 15 ? "low" : r.margin >= 40 ? "high" : ""}`}>{pct(r.margin)}</span></td>
                    <td className="sl-num">{num(r.invoices, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="md-empty">{loading || !res ? L("កំពុងផ្ទុក...", "Loading...") : L("គ្មានការលក់ក្នុងរយៈពេលនេះ", "No sales in this period")}</div>
        )}
      </div>
    </>
  );
}
