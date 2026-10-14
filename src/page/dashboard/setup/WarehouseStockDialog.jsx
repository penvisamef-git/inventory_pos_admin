import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Boxes, CalendarClock, ChevronLeft, ChevronRight, MinusCircle, PackageCheck, PackageX, Search, Store, Truck, Warehouse, X } from "lucide-react";
import { shopService, stockService } from "../../../api/api.service";
import { WAREHOUSE_TYPE_OPTIONS, labelOf, nameKh, nameOther } from "./setupOptions";
import { L } from "../../../i18n";

// Warehouse / shop → what is inside: totals, low / out / below 0, expiring batches, transfers, and the item list.
const num = (v) => Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 4 });
const usd = (v) => `${Number(v) < 0 ? "−" : ""}$${Math.abs(Number(v || 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateText = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { timeZone: "Asia/Phnom_Penh" }) : "-");
const optText = (o) => (o || []).map((x) => L(x.name_kh, x.name_en || x.name_kh)).join(" / ");

export default function WarehouseStockDialog({ warehouse, onClose }) {
  const isShop = warehouse.type === "shop";
  const [sum, setSum] = useState(null);
  const [tab, setTab] = useState("in_stock");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    shopService.summary(warehouse._id).then((r) => setSum(r.data)).catch(() => setSum(false));
  }, [warehouse._id]);
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setSearch(q.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    let alive = true;
    setList(null);
    setError("");
    const req =
      tab === "expiry"
        ? stockService.expiry({ warehouse_id: warehouse._id }).then((r) => ({ kind: "expiry", data: (r.data || []).filter((x) => !search || `${x.variant_id?.code} ${x.variant_id?.name_kh} ${x.variant_id?.name_en}`.toLowerCase().includes(search.toLowerCase())) }))
        : stockService.balance({ warehouse_id: warehouse._id, only: tab, q: search || undefined, page, limit: 15 }).then((r) => ({ kind: "stock", data: r.data || [], pagination: r.pagination, summary: r.summary }));
    req.then((r) => alive && setList(r)).catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [warehouse._id, tab, search, page]);

  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const st = sum?.stock;
  const tiles = [
    { key: "in_stock", icon: PackageCheck, label: L("ទំនិញមានស្តុក", "Items in stock"), n: st?.skus ?? warehouse.stock?.skus, sub: st ? `${L("សរុប", "Total")} ${num(st.qty)}` : "", tone: "ok" },
    ...(isShop ? [{ key: "low", icon: AlertTriangle, label: L("ស្តុកទាប", "Low stock"), n: st?.low, tone: "warn" }] : []),
    { key: "out", icon: PackageX, label: L("អស់ស្តុក", "Out of stock"), n: st?.out, tone: "bad" },
    { key: "negative", icon: MinusCircle, label: L("ក្រោម 0", "Below 0"), n: st?.negative ?? warehouse.stock?.negative, tone: "bad" },
    { key: "expiry", icon: CalendarClock, label: L(`ជិតផុតកំណត់ (${sum?.expiry?.alert_days || 30} ថ្ងៃ)`, `Expiring (${sum?.expiry?.alert_days || 30} days)`), n: sum?.expiry?.count, sub: sum?.expiry?.expired ? `${sum.expiry.expired} ${L("ផុតហើយ", "expired")}` : "", tone: "warn" },
  ];
  const Icon = isShop ? Store : Warehouse;
  const pages = list?.pagination?.totalPages || 1;

  return (
    <div className="md-modal-backdrop" onMouseDown={onClose}>
      <div className="md-modal wsd" onMouseDown={(e) => e.stopPropagation()}>
        <div className="md-modal-header wsd-head">
          <span className={`wh-card-icon wsd-icon ${warehouse.type}`}><Icon size={26} strokeWidth={1.8} /></span>
          <div className="wsd-title">
            <h3>{nameKh(warehouse)} <span className="md-code">{warehouse.code}</span></h3>
            <span className="md-sub">
              <span className={`md-badge md-badge-${warehouse.type}`}>{labelOf(WAREHOUSE_TYPE_OPTIONS, warehouse.type)}</span> {nameOther(warehouse)}
            </span>
          </div>
          <button type="button" className="md-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="md-modal-body wsd-body">
          <div className="wsd-tiles">
            {tiles.map((t) => (
              <button key={t.key} type="button" className={`wsd-tile ${t.n ? t.tone : "zero"} ${tab === t.key ? "on" : ""}`} onClick={() => { setPage(1); setTab(t.key); }}>
                <t.icon size={17} />
                <strong>{t.n === undefined || t.n === null ? (sum === false ? "-" : "…") : num(t.n)}</strong>
                <span>{t.label}</span>
                {t.sub && <small>{t.sub}</small>}
              </button>
            ))}
            {st?.value !== undefined && (
              <div className="wsd-tile money">
                <Boxes size={17} />
                <strong>{usd(st.value)}</strong>
                <span>{L("តម្លៃស្តុក (ថ្លៃដើម)", "Stock value (cost)")}</span>
              </div>
            )}
          </div>

          {sum && (sum.transfers?.incoming > 0 || sum.transfers?.requested > 0 || sum.transfers?.outgoing_pending > 0 || sum.adjustments?.drafts > 0) && (
            <div className="wsd-notes">
              {sum.transfers.incoming > 0 && <Link to="/stock/transfer"><Truck size={14} /> {L(`ផ្ទេរ ${sum.transfers.incoming} កំពុងមក — រង់ចាំទទួល`, `${sum.transfers.incoming} transfer(s) on the way — to receive`)}</Link>}
              {sum.transfers.requested > 0 && <Link to="/stock/transfer"><Truck size={14} /> {L(`ស្នើសុំ ${sum.transfers.requested}`, `${sum.transfers.requested} requested`)}</Link>}
              {sum.transfers.outgoing_pending > 0 && <Link to="/stock/transfer"><Truck size={14} /> {L(`ផ្ទេរចេញ ${sum.transfers.outgoing_pending} មិនទាន់បញ្ជូន`, `${sum.transfers.outgoing_pending} to send`)}</Link>}
              {sum.adjustments?.drafts > 0 && <Link to="/stock/adjustment">{L(`កែស្តុក (ព្រាង) ${sum.adjustments.drafts}`, `${sum.adjustments.drafts} adjustment draft(s)`)}</Link>}
            </div>
          )}

          <div className="wsd-bar">
            <div className="md-search">
              <Search size={16} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L("ស្វែងរកទំនិញ / SKU / បាកូដ", "Search item / SKU / barcode")} />
            </div>
            <div className="wsd-tabs">
              {tiles.map((t) => (
                <button key={t.key} type="button" className={tab === t.key ? "on" : ""} onClick={() => { setPage(1); setTab(t.key); }}>{t.label}</button>
              ))}
            </div>
          </div>

          {error && <div className="md-empty md-empty-error">{error}</div>}
          {!error && !list && <div className="md-empty">{L("កំពុងផ្ទុក...", "Loading...")}</div>}
          {list && !list.data.length && <div className="md-empty">{L("គ្មានទំនិញ", "No items")}</div>}

          {list?.kind === "stock" && list.data.length > 0 && (
            <div className="md-table-scroll">
              <table className="md-table wsd-table">
                <thead>
                  <tr>
                    <th>{L("ទំនិញ", "Item")}</th>
                    <th className="wsd-r">{L("ចំនួន", "Qty")}</th>
                    {isShop && <th className="wsd-r">{L("អប្បបរមា", "Min")}</th>}
                    {list.data[0]?.warehouses?.[0]?.total_value !== undefined && <th className="wsd-r">{L("តម្លៃ", "Value")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((r) => {
                    const w = r.warehouses?.[0] || {};
                    return (
                      <tr key={r.variant_id}>
                        <td>
                          <b>{L(r.name_kh || r.product?.name_kh, r.name_en || r.product?.name_en || r.name_kh)}</b>
                          <span className="md-sub">{r.sku}{optText(r.options) ? ` · ${optText(r.options)}` : ""}</span>
                        </td>
                        <td className={`wsd-r wsd-qty ${w.qty < 0 ? "neg" : w.low ? "low" : w.qty === 0 ? "zero" : ""}`}>
                          {num(w.qty)} <small>{L(r.product?.base_unit?.name_kh, r.product?.base_unit?.name_en || r.product?.base_unit?.name_kh) || ""}</small>
                        </td>
                        {isShop && <td className="wsd-r">{r.min_stock ? num(r.min_stock) : "-"}</td>}
                        {w.total_value !== undefined && <td className="wsd-r">{usd(w.total_value)}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {list?.kind === "expiry" && list.data.length > 0 && (
            <div className="md-table-scroll">
              <table className="md-table wsd-table">
                <thead>
                  <tr>
                    <th>{L("ទំនិញ", "Item")}</th>
                    <th>{L("ឡូត៍", "Batch")}</th>
                    <th>{L("ផុតកំណត់", "Expiry")}</th>
                    <th className="wsd-r">{L("ចំនួន", "Qty")}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((r) => (
                    <tr key={r._id}>
                      <td>
                        <b>{L(r.variant_id?.name_kh, r.variant_id?.name_en || r.variant_id?.name_kh)}</b>
                        <span className="md-sub">{r.variant_id?.code}</span>
                      </td>
                      <td>{r.batch_id?.batch_no || "-"}</td>
                      <td>
                        {dateText(r.expiry_date)}{" "}
                        <span className={`hm-days ${r.days_left <= 0 ? "bad" : r.days_left <= 7 ? "warn" : ""}`}>{r.days_left <= 0 ? L("ផុតហើយ", "Expired") : L(`${r.days_left} ថ្ងៃ`, `${r.days_left} d`)}</span>
                      </td>
                      <td className="wsd-r">{num(r.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {list?.kind === "stock" && pages > 1 && (
            <div className="wsd-pager">
              <button type="button" className="md-icon-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button>
              <span>{page} / {pages} · {L("សរុប", "total")} {list.pagination.total}</span>
              <button type="button" className="md-icon-btn" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button>
            </div>
          )}
        </div>

        <div className="md-modal-footer wsd-foot">
          <Link to="/stock/movement" className="md-btn md-btn-ghost">{L("ចលនាស្តុក", "Stock movements")}</Link>
          <Link to="/stock/balance" className="md-btn md-btn-ghost">{L("ស្តុកទាំងអស់", "Stock on hand")}</Link>
          {isShop && (
            <Link to={`/shop/${warehouse.code}`} className="md-btn md-btn-primary">{L("ផ្ទាំងហាង", "Shop dashboard")} <ArrowRight size={15} /></Link>
          )}
        </div>
      </div>
    </div>
  );
}
