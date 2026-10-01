import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, CalendarClock } from "lucide-react";
import { stockService, warehouseService } from "../../../api/api.service";
import { OptionChips, dateOnly, qtyText, valueName } from "./stockOptions";
import { L } from "../../../i18n";
import { usePortal } from "../../portal/portalContext";
import SendTelegramButton from "../telegram/SendTelegram";
import "../master_data/masterdata.style.css";
import "../master_data/masterdata.theme.css";
import "../product/product.style.css";
import "./stock.style.css";

// Batches expiring within N days (default: Setting.expiry_alert_days), nearest first
function ExpiryComponent() {
  const portal = usePortal();
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState(portal?._id || "");
  useEffect(() => {
    if (portal) setWarehouseId(portal._id);
  }, [portal]);
  const [days, setDays] = useState("");
  const [rows, setRows] = useState([]);
  const [usedDays, setUsedDays] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    warehouseService.all().then((r) => setWarehouses(r.data || [])).catch(() => {});
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await stockService.expiry({ warehouse_id: warehouseId || undefined, days: days || undefined });
      setRows(r.data || []);
      setUsedDays(r.days);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [warehouseId, days]);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <div className="md-page">
      <div className="md-toolbar">
        <div className="md-toolbar-left">
          <select className="md-filter" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} hidden={!!portal}>
            <option value="">{L("-- គ្រប់ឃ្លាំង --", "-- All warehouses --")}</option>
            {warehouses.map((w) => (
              <option key={w._id} value={w._id}>{w.code}</option>
            ))}
          </select>
          <select className="md-filter" value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="">{L(`ក្នុង ${usedDays ?? "…"} ថ្ងៃ (ការកំណត់)`, `Within ${usedDays ?? "…"} days (setting)`)}</option>
            {[30, 60, 90, 180, 365].map((d) => (
              <option key={d} value={d}>{L(`ក្នុង ${d} ថ្ងៃ`, `Within ${d} days`)}</option>
            ))}
          </select>
        </div>
        <div className="md-toolbar-actions">
          <SendTelegramButton key={`${warehouseId}|${days}`} reports={["near_expiry"]} warehouseIds={warehouseId ? [warehouseId] : []} days={days || undefined} />
          <button type="button" className="md-btn md-btn-ghost" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? "md-spin" : ""} /></button>
        </div>
      </div>
      <div className="md-card">
        <div className="md-table-scroll">
          <table className="md-table">
            <thead>
              <tr>
                <th>{L("ផុតកំណត់", "Expiry")}</th>
                <th>{L("នៅសល់", "Days left")}</th>
                <th>{L("ទំនិញ", "Item")}</th>
                <th>Batch</th>
                <th>{L("ឃ្លាំង", "Warehouse")}</th>
                <th className="sb-num">{L("ចំនួន", "Qty")}</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && <tr><td colSpan={6} className="md-empty">{loading ? L("កំពុងផ្ទុក...", "Loading...") : L("គ្មាន Batch ជិតផុតកំណត់ 🎉", "No batches close to expiry 🎉")}</td></tr>}
              {rows.map((r) => (
                <tr key={r._id}>
                  <td><b>{dateOnly(r.expiry_date)}</b></td>
                  <td>
                    <span className={`md-badge ${r.expired ? "md-badge-danger" : r.days_left <= 30 ? "md-badge-gold" : "md-badge-shop"}`}>
                      <CalendarClock size={12} /> {r.expired ? L("ផុតកំណត់ហើយ", "Expired") : L(`${r.days_left} ថ្ងៃ`, `${r.days_left} days`)}
                    </span>
                  </td>
                  <td>
                    <b className="sd-item">{valueName(r.variant_id)}</b>
                    <span className="sd-item-sub">
                      <span className="md-code">{r.variant_id?.code}</span>
                      <OptionChips options={r.variant_id?.options} />
                    </span>
                  </td>
                  <td><span className="sd-batch-tag">{r.batch_id?.batch_no}</span></td>
                  <td>{r.warehouse_id?.code}</td>
                  <td className="sb-num"><b>{qtyText(r.qty)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ExpiryComponent;
