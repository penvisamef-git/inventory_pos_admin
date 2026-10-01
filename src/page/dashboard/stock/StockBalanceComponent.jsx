import React, { useCallback, useEffect, useState } from "react";
import { Search, X, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, History } from "lucide-react";
import { categoryService, stockService } from "../../../api/api.service";
import { imageCell } from "../master_data/MasterDataPage";
import { flattenTree } from "../product/productOptions";
import MovementDrawer from "./MovementDrawer";
import { OptionChips, isShopUser, nameKh, qtyText, unitLabel, usd } from "./stockOptions";
import { L } from "../../../i18n";
import { usePortal } from "../../portal/portalContext";
import SendTelegramButton from "../telegram/SendTelegram";
import "../master_data/masterdata.style.css";
import "../master_data/masterdata.theme.css";
import "../product/product.style.css";
import "./stock.style.css";

const ONLY = [
  { value: "in_stock", label: L("មានស្តុក", "In stock") },
  { value: "low", label: L("ស្តុកទាប", "Low stock") },
  { value: "out", label: L("អស់ស្តុក", "Out of stock") },
  { value: "negative", label: L("ស្តុកអវិជ្ជមាន", "Negative") },
];

// Stock on hand per variant × warehouse (all warehouses side by side, or one warehouse with cost)
function StockBalanceComponent() {
  const shop = isShopUser();
  const portal = usePortal();
  const [categories, setCategories] = useState([]);
  const [warehouseList, setWarehouseList] = useState([]);
  const [warehouseId, setWarehouseId] = useState(portal?._id || "");
  useEffect(() => {
    if (portal) {
      setPage(1);
      setWarehouseId(portal._id);
    }
  }, [portal]);
  const [categoryId, setCategoryId] = useState("");
  const [only, setOnly] = useState("");
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [res, setRes] = useState({ data: [], warehouses: [], summary: {}, pagination: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ledger, setLedger] = useState(null);

  useEffect(() => {
    categoryService.tree().then((r) => setCategories(flattenTree(r.data || []))).catch(() => {});
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setSearch(keyword.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [keyword]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await stockService.balance({ page, limit: 20, q: search || undefined, warehouse_id: warehouseId || undefined, category_id: categoryId || undefined, only: only || undefined, with_price: warehouseId ? "true" : undefined });
      setRes(r);
      if (!warehouseId) setWarehouseList(r.warehouses || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, warehouseId, categoryId, only]);
  useEffect(() => {
    load();
  }, [load]);

  const whs = res.warehouses || [];
  const single = whs.length === 1;
  const s = res.summary || {};
  const totalPages = Math.max(res.pagination?.totalPages || 1, 1);

  return (
    <div className="md-page">
      <div className="sb-cards">
        <div className="sb-card"><span>{L("ទំនិញ (SKU)", "Items (SKU)")}</span><b>{qtyText(s.variants)}</b></div>
        <div className="sb-card"><span>{L("ចំនួនសរុប", "Total qty")}</span><b>{qtyText(s.total_qty)}</b></div>
        {!shop && <div className="sb-card sb-green"><span>{L("តម្លៃស្តុក (ថ្លៃដើម)", "Stock value (cost)")}</span><b>{usd(s.total_value)}</b></div>}
        <button type="button" className={`sb-card sb-warn ${only === "low" ? "on" : ""}`} onClick={() => { setPage(1); setOnly(only === "low" ? "" : "low"); }}>
          <span><AlertTriangle size={14} /> {L("ស្តុកទាប (ហាង)", "Low stock (shops)")}</span>
          <b>{qtyText(s.low)}</b>
        </button>
        <button type="button" className={`sb-card sb-danger ${only === "negative" ? "on" : ""}`} onClick={() => { setPage(1); setOnly(only === "negative" ? "" : "negative"); }}>
          <span>{L("ស្តុកអវិជ្ជមាន", "Negative")}</span>
          <b>{qtyText(s.negative)}</b>
        </button>
      </div>

      <div className="md-toolbar">
        <div className="md-toolbar-left">
          <div className="md-search">
            <Search size={16} />
            <input placeholder={L("ស្វែងរក SKU / បាកូដ / ឈ្មោះ...", "Search SKU / barcode / name...")} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            {keyword && <button type="button" onClick={() => setKeyword("")}><X size={14} /></button>}
          </div>
          {warehouseList.length > 1 && !portal && (
            <select className="md-filter" value={warehouseId} onChange={(e) => { setPage(1); setWarehouseId(e.target.value); }}>
              <option value="">{L("-- គ្រប់ឃ្លាំង --", "-- All warehouses --")}</option>
              {warehouseList.map((w) => (
                <option key={w._id} value={w._id}>{nameKh(w)} ({w.code})</option>
              ))}
            </select>
          )}
          <select className="md-filter" value={categoryId} onChange={(e) => { setPage(1); setCategoryId(e.target.value); }}>
            <option value="">{L("-- ប្រភេទទាំងអស់ --", "-- All categories --")}</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select className="md-filter" value={only} onChange={(e) => { setPage(1); setOnly(e.target.value); }}>
            <option value="">{L("-- ទាំងអស់ --", "-- All --")}</option>
            {ONLY.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="md-toolbar-actions">
          <SendTelegramButton
            key={`${warehouseId}|${categoryId}|${only}`}
            reports={only === "" || only === "in_stock" ? ["stock_summary"] : ["low_stock"]}
            warehouseIds={warehouseId ? [warehouseId] : []}
            categoryId={categoryId}
            categoryName={categories.find((c) => c.value === categoryId)?.label?.replace(/^[\s—–-]+/, "")}
          />
          <button type="button" className="md-btn md-btn-ghost" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? "md-spin" : ""} /></button>
        </div>
      </div>

      <div className="md-card">
        <div className="md-table-scroll">
          <table className="md-table sb-table">
            <thead>
              <tr>
                <th>{L("ទំនិញ", "Item")}</th>
                <th>{L("អប្បបរមា", "Min")}</th>
                {whs.map((w) => (
                  <th key={w._id} className="sb-num">{w.code}</th>
                ))}
                {!single && <th className="sb-num">{L("សរុប", "Total")}</th>}
                {single && <th className="sb-num">{L("តម្លៃលក់", "Sale price")}</th>}
                {!shop && single && <th className="sb-num">{L("ថ្លៃមធ្យម", "Avg cost")}</th>}
                {!shop && <th className="sb-num">{L("តម្លៃ", "Value")}</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {error && <tr><td colSpan={whs.length + 5} className="md-empty md-empty-error">{error}</td></tr>}
              {!error && !loading && !res.data.length && <tr><td colSpan={whs.length + 5} className="md-empty">{L("មិនមានទិន្នន័យ", "No data")}</td></tr>}
              {res.data.map((r) => (
                <tr key={r.variant_id}>
                  <td>
                    <div className="sb-item">
                      {imageCell(r.product.image)}
                      <div>
                        <b>{nameKh(r.product)}</b>
                        <span className="sd-item-sub">
                          <span className="md-code">{r.sku}</span>
                          <OptionChips options={r.options} />
                          {r.product.track_batch && <span className="md-badge md-badge-gold">Batch</span>}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td><span className="sb-min">{r.min_stock || "-"}</span></td>
                  {r.warehouses.map((w) => (
                    <td key={w.warehouse_id} className={`sb-num ${w.qty < 0 ? "sb-neg" : w.low ? "sb-low" : w.qty === 0 ? "sb-zero" : ""}`}>
                      <button type="button" className="sb-qty" onClick={() => setLedger({ row: r, warehouse: w })} title={L("មើលចលនាស្តុក", "View movements")}>
                        {qtyText(w.qty)}
                      </button>
                    </td>
                  ))}
                  {!single && <td className="sb-num"><b>{qtyText(r.total_qty)}</b></td>}
                  {single && (
                    <td className="sb-num">
                      {r.price === null || r.price === undefined ? <span className="pc-missing">-</span> : <b>{usd(r.price)}</b>}
                      {r.price_source === "shop" && <span className="sb-min"> · {L("ហាង", "shop")}</span>}
                    </td>
                  )}
                  {!shop && single && <td className="sb-num">{usd(r.warehouses[0]?.avg_cost, 4)}</td>}
                  {!shop && <td className="sb-num">{usd(r.total_value)}</td>}
                  <td><span className="sb-min">{unitLabel(r.product.base_unit?.code, r.product.base_unit?.name_kh, r.product.base_unit?.name_en)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md-pagination">
          <span className="md-sub">
            <History size={13} /> {L("ចុចលើចំនួន ដើម្បីមើលចលនាស្តុក", "Click a quantity to see its movements")}
          </span>
          <div className="md-pager">
            <button type="button" className="md-icon-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button>
            <span>{L("ទំព័រ", "Page")} {page} / {totalPages}</span>
            <button type="button" className="md-icon-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
      {ledger && <MovementDrawer row={ledger.row} warehouse={ledger.warehouse} onClose={() => setLedger(null)} />}
    </div>
  );
}

export default StockBalanceComponent;
