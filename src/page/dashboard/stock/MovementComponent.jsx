import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { stockService, warehouseService } from "../../../api/api.service";
import { MovementTable } from "./MovementDrawer";
import { MOVE_TYPES, isShopUser } from "./stockOptions";
import { L } from "../../../i18n";
import { usePortal } from "../../portal/portalContext";
import "../master_data/masterdata.style.css";
import "../master_data/masterdata.theme.css";
import "../product/product.style.css";
import "./stock.style.css";

// Whole stock ledger with filters
function MovementComponent() {
  const shop = isShopUser();
  const portal = usePortal();
  const [warehouses, setWarehouses] = useState([]);
  const [f, setF] = useState({ warehouse_id: portal?._id || "", type: "", from: "", to: "" });
  useEffect(() => {
    if (portal) setF((x) => ({ ...x, warehouse_id: portal._id }));
  }, [portal]);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    warehouseService.all().then((r) => setWarehouses(r.data || [])).catch(() => {});
  }, []);
  const key = JSON.stringify(f);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = JSON.parse(key);
      const r = await stockService.movement({
        page,
        limit: 30,
        sort: "movement_date",
        order: "desc",
        warehouse_id: q.warehouse_id || undefined,
        type: q.type || undefined,
        from: q.from ? new Date(`${q.from}T00:00:00+07:00`).toISOString() : undefined,
        to: q.to ? new Date(`${q.to}T23:59:59+07:00`).toISOString() : undefined,
      });
      setRows(r.data || []);
      setPages(Math.max(r.pagination?.totalPages || 1, 1));
      setTotal(r.pagination?.total || 0);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, key]);
  useEffect(() => {
    load();
  }, [load]);
  const set = (k, v) => {
    setPage(1);
    setF((x) => ({ ...x, [k]: v }));
  };
  return (
    <div className="md-page">
      <div className="md-toolbar">
        <div className="md-toolbar-left">
          <select className="md-filter" value={f.warehouse_id} onChange={(e) => set("warehouse_id", e.target.value)} hidden={!!portal}>
            <option value="">{L("-- គ្រប់ឃ្លាំង --", "-- All warehouses --")}</option>
            {warehouses.map((w) => (
              <option key={w._id} value={w._id}>{w.code}</option>
            ))}
          </select>
          <select className="md-filter" value={f.type} onChange={(e) => set("type", e.target.value)}>
            <option value="">{L("-- គ្រប់ប្រភេទ --", "-- All types --")}</option>
            {Object.entries(MOVE_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <input type="date" className="md-filter" value={f.from} onChange={(e) => set("from", e.target.value)} />
          <input type="date" className="md-filter" value={f.to} onChange={(e) => set("to", e.target.value)} />
        </div>
        <div className="md-toolbar-actions">
          <button type="button" className="md-btn md-btn-ghost" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? "md-spin" : ""} /></button>
        </div>
      </div>
      <div className="md-card">
        {rows.length ? <MovementTable rows={rows} shop={shop} showItem showWarehouse={!portal} /> : <div className="md-empty">{loading ? L("កំពុងផ្ទុក...", "Loading...") : L("មិនមានទិន្នន័យ", "No data")}</div>}
        <div className="md-pagination">
          <span className="md-sub">{L("សរុប", "Total")} {total}</span>
          <div className="md-pager">
            <button type="button" className="md-icon-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button>
            <span>{L("ទំព័រ", "Page")} {page} / {pages}</span>
            <button type="button" className="md-icon-btn" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MovementComponent;
