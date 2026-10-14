import React, { useEffect, useRef, useState } from "react";
import { Download, PackageX, Snail } from "lucide-react";
import { saleService } from "../../../api/api.service";
import { L } from "../../../i18n";
import { exportExcel } from "../../util/excel";
import { usd, num, nm, dateText } from "./saleUtil";

const DAYS = [30, 60, 90, 180];

// What sits on the shelf: dead (no sale in N days) and slow (more than 2×N days of stock at the current pace)
export default function SlowStock({ warehouseId, tick, cost, portal }) {
  const [days, setDays] = useState(60);
  const [kind, setKind] = useState("");
  const [res, setRes] = useState(null);
  const seq = useRef(0);
  useEffect(() => {
    const n = ++seq.current;
    setRes(null);
    saleService
      .slowStock({ days, ...(warehouseId ? { warehouse_id: warehouseId } : {}) })
      .then((x) => n === seq.current && setRes(x))
      .catch((e) => n === seq.current && setRes({ data: [], error: e?.response?.data?.message || e.message }));
  }, [days, warehouseId, tick]);
  const all = res?.data || [];
  const rows = kind ? all.filter((r) => r.status === kind) : all;
  const s = res?.summary;
  const download = () =>
    exportExcel(`slow-stock-${days}d.xlsx`, "Slow stock", [
      { label: L("ស្ថានភាព", "Status"), value: (r) => (r.status === "dead" ? L("មិនលក់", "Dead") : L("លក់យឺត", "Slow")), width: 12 },
      { label: L("ហាង", "Shop"), value: (r) => r.warehouse?.code || "", width: 10 },
      { label: "SKU", value: (r) => r.sku, width: 22 },
      { label: L("ទំនិញ", "Item"), value: (r) => nm(r), width: 40 },
      { label: L("ក្នុងស្តុក", "In stock"), value: (r) => r.qty, type: "number" },
      { label: L(`លក់ ${days} ថ្ងៃ`, `Sold ${days} days`), value: (r) => r.sold_qty, type: "number" },
      { label: L("លក់ចុងក្រោយ", "Last sold"), value: (r) => (r.last_sold_at ? dateText(r.last_sold_at) : ""), width: 14 },
      { label: L("ថ្ងៃគ្រប់គ្រាន់", "Days of stock"), value: (r) => r.days_of_cover ?? "", type: "number" },
      ...(cost ? [{ label: L("តម្លៃស្តុក ($)", "Stock value ($)"), value: (r) => r.value, type: "number" }] : []),
    ], rows);

  return (
    <>
      <div className="sl-sumbar">
        <button type="button" className={`sl-kind ${kind === "dead" ? "on" : ""}`} onClick={() => setKind(kind === "dead" ? "" : "dead")}>
          <span><PackageX size={14} /> {L("មិនលក់សោះ", "Dead (no sale)")}</span>
          <b>{s ? num(s.dead, 0) : "…"}{cost && s ? <small> · {usd(s.dead_value)}</small> : null}</b>
        </button>
        <button type="button" className={`sl-kind ${kind === "slow" ? "on" : ""}`} onClick={() => setKind(kind === "slow" ? "" : "slow")}>
          <span><Snail size={14} /> {L("លក់យឺត", "Slow")}</span>
          <b>{s ? num(s.slow, 0) : "…"}{cost && s ? <small> · {usd(s.slow_value)}</small> : null}</b>
        </button>
        <div className="sl-flags">
          {DAYS.map((d) => (
            <button key={d} type="button" className={days === d ? "on" : ""} onClick={() => setDays(d)}>{d} {L("ថ្ងៃ", "days")}</button>
          ))}
          <button type="button" className="md-btn md-btn-ghost" disabled={!rows.length} onClick={download}><Download size={15} /> Excel</button>
        </div>
      </div>
      <p className="sl-note">{L(`មិនលក់ = គ្មានការលក់ក្នុង ${days} ថ្ងៃ · លក់យឺត = ស្តុកគ្រប់លក់លើស ${days * 2} ថ្ងៃ (តាមល្បឿនលក់បច្ចុប្បន្ន)`, `Dead = no sale in ${days} days · Slow = enough stock for more than ${days * 2} days at the current pace`)}</p>
      <div className="md-card">
        {res?.error ? (
          <div className="md-empty">{res.error}</div>
        ) : rows.length ? (
          <div className="md-table-scroll">
            <table className="md-table sl-table">
              <thead>
                <tr>
                  <th>{L("ទំនិញ", "Item")}</th>
                  {!portal && <th>{L("ហាង", "Shop")}</th>}
                  <th className="sl-num">{L("ក្នុងស្តុក", "In stock")}</th>
                  <th className="sl-num">{L(`លក់ ${days} ថ្ងៃ`, `Sold (${days}d)`)}</th>
                  <th>{L("លក់ចុងក្រោយ", "Last sold")}</th>
                  <th className="sl-num">{L("ថ្ងៃគ្រប់គ្រាន់", "Days of stock")}</th>
                  {cost && <th className="sl-num">{L("តម្លៃស្តុក", "Stock value")}</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.warehouse?._id}-${r.variant_id}`}>
                    <td>
                      <span className={`ss-dot ${r.status}`} />
                      <b>{nm(r)}</b>
                      <span className="md-sub">{r.sku}</span>
                    </td>
                    {!portal && <td>{r.warehouse?.code}</td>}
                    <td className="sl-num"><b>{num(r.qty)}</b></td>
                    <td className="sl-num">{num(r.sold_qty)}</td>
                    <td className="sl-muted">{r.last_sold_at ? `${dateText(r.last_sold_at)} (${r.days_since_sale} ${L("ថ្ងៃ", "d")})` : L("មិនដែលលក់", "Never")}</td>
                    <td className="sl-num">{r.days_of_cover ?? "∞"}</td>
                    {cost && <td className="sl-num">{usd(r.value)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="md-empty">{!res ? L("កំពុងផ្ទុក...", "Loading...") : L("ល្អណាស់ — គ្មានទំនិញជាប់ស្តុក", "All good — nothing stuck on the shelf")}</div>
        )}
      </div>
    </>
  );
}
