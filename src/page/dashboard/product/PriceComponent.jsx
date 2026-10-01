import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X, Pencil, Save, History, Trash2, CalendarClock, Store, Tag, ChevronLeft, ChevronRight } from "lucide-react";
import { categoryService, priceService, productService, warehouseService } from "../../../api/api.service";
import { dateTimeText, imageCell } from "../master_data/MasterDataPage";
import { canEditProduct, flattenTree, nameKh, nameOther } from "./productOptions";
import { L } from "../../../i18n";
import "../master_data/masterdata.style.css";
import "../master_data/masterdata.theme.css";
import "./product.style.css";

const usd = (v) => (v === null || v === undefined ? "-" : `$${Number(v).toFixed(2)}`);
const valueName = (v) => L(v?.name_kh || v?.name_en, v?.name_en || v?.name_kh);
const unitName = (u) => L(u.unit_name_kh || u.unit_name_en, u.unit_name_en || u.unit_name_kh);
const rangeText = (r) => (!r ? null : r.min === r.max ? usd(r.min) : `${usd(r.min)} – ${usd(r.max)}`);
const cellKey = (variantId, unitId) => `${variantId}|${unitId}`;
const dateText = (d) => (d ? dateTimeText(d).slice(0, 10) : "");

// datetime-local value → ISO (empty = now)
const toIso = (v) => (v ? new Date(v).toISOString() : null);

function PriceComponent() {
  const canEdit = canEditProduct();

  // ---------- left: products ----------
  const [categories, setCategories] = useState([]);
  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [pPage, setPPage] = useState(1);
  const [pPages, setPPages] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    categoryService.tree().then((r) => setCategories(flattenTree(r.data || []))).catch(() => {});
    warehouseService
      .all()
      .then((r) => setShops((r.data || []).filter((w) => w.type === "shop")))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setPPage(1);
      setSearch(keyword.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [keyword]);

  const loadProducts = useCallback(async () => {
    try {
      const res = await productService.list({ page: pPage, limit: 12, sort: "sort_order", order: "asc", q: search || undefined, category_id: categoryId || undefined });
      setProducts(res.data || []);
      setPPages(Math.max(res.pagination?.totalPages || 1, 1));
      setSelected((cur) => cur || res.data?.[0] || null);
    } catch {
      setProducts([]);
    }
  }, [pPage, search, categoryId]);
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // ---------- right: price grid ----------
  const [mode, setMode] = useState(""); // "" = default price, or shop id
  const [grid, setGrid] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({}); // cellKey → string
  const [startAt, setStartAt] = useState(""); // "" = now
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState(null); // { variant, unit, rows }

  const loadGrid = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      const res = await priceService.current({ product_id: selected._id, warehouse_id: mode || undefined, limit: 200 });
      setGrid(res.data || []);
    } catch (err) {
      setError(err.message);
      setGrid([]);
    } finally {
      setLoading(false);
    }
  }, [selected, mode]);
  useEffect(() => {
    loadGrid();
    setEditing(false);
  }, [loadGrid]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const units = grid[0]?.units || [];
  const shopOf = (u) => u.shops.find((s) => s.warehouse_id === mode);
  // value shown / edited for the current mode
  const currentOf = (u) => (mode ? shopOf(u)?.price ?? null : u.default?.price ?? null);
  const nextOf = (u) => (mode ? shopOf(u)?.next : u.default_next);

  const startEdit = () => {
    const d = {};
    grid.forEach((v) => v.units.forEach((u) => (d[cellKey(v.variant_id, u.unit_id)] = currentOf(u) === null ? "" : String(currentOf(u)))));
    setDraft(d);
    setStartAt("");
    setEditing(true);
  };

  const changes = useMemo(() => {
    if (!editing) return [];
    const out = [];
    grid.forEach((v) =>
      v.units.forEach((u) => {
        const raw = (draft[cellKey(v.variant_id, u.unit_id)] ?? "").trim();
        const before = currentOf(u);
        if (raw === "") {
          // shop: empty = back to default (only when an override exists)
          if (mode && before !== null) out.push({ variant_id: v.variant_id, unit_id: u.unit_id, warehouse_id: mode, price: null });
          return;
        }
        const n = Number(raw);
        if (before === null || Math.abs(n - before) > 0.00001) out.push({ variant_id: v.variant_id, unit_id: u.unit_id, warehouse_id: mode || null, price: n });
      }),
    );
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, grid, editing, mode]);

  const fillColumn = (unitId, value) =>
    setDraft((d) => {
      const n = { ...d };
      grid.forEach((v) => (n[cellKey(v.variant_id, unitId)] = value));
      return n;
    });

  const save = async () => {
    const bad = changes.find((c) => c.price !== null && !(Number.isFinite(c.price) && c.price >= 0));
    if (bad) return setNotice({ type: "error", text: L("តម្លៃមិនត្រឹមត្រូវ!", "Invalid price!") });
    if (!changes.length) return setEditing(false);
    setSaving(true);
    try {
      const res = await priceService.bulk({ effective_from: toIso(startAt), items: changes });
      setNotice({ type: "success", text: res.message });
      setEditing(false);
      await loadGrid();
      loadProducts();
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (v, u) => {
    setHistory({ variant: v, unit: u, rows: null });
    try {
      const res = await priceService.history({ variant_id: v.variant_id, unit_id: u.unit_id, warehouse_id: mode || "default", sort: "effective_from", order: "desc", limit: 50 });
      setHistory({ variant: v, unit: u, rows: res.data || [] });
    } catch (err) {
      setHistory(null);
      setNotice({ type: "error", text: err.message });
    }
  };

  const removeUpcoming = async (row) => {
    try {
      const res = await priceService.remove(row._id);
      setNotice({ type: "success", text: res.message });
      await openHistory(history.variant, history.unit);
      loadGrid();
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    }
  };

  const shopName = mode ? nameKh(shops.find((s) => s._id === mode)) : "";

  // ---------- cell ----------
  const renderCell = (v, u) => {
    const k = cellKey(v.variant_id, u.unit_id);
    const cur = currentOf(u);
    const next = nextOf(u);
    if (editing) {
      return (
        <input
          className={`pe-input pc-input ${changes.some((c) => c.variant_id === v.variant_id && c.unit_id === u.unit_id) ? "changed" : ""}`}
          type="number"
          min="0"
          step="0.01"
          value={draft[k] ?? ""}
          placeholder={mode ? `${L("លំនាំដើម", "Default")} ${usd(u.default?.price)}` : "0.00"}
          onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
        />
      );
    }
    return (
      <button type="button" className="pc-cell" onClick={() => openHistory(v, u)} title={L("មើលប្រវត្តិ", "View history")}>
        {mode ? (
          cur !== null ? (
            <>
              <b>{usd(cur)}</b>
              <span className="pc-src shop">{L("តម្លៃហាង", "Shop price")}</span>
            </>
          ) : (
            <>
              <b className="pc-muted">{usd(u.default?.price)}</b>
              <span className="pc-src">{L("លំនាំដើម", "Default")}</span>
            </>
          )
        ) : cur !== null ? (
          <b>{usd(cur)}</b>
        ) : (
          <span className="pc-missing">{L("គ្មានតម្លៃ", "No price")}</span>
        )}
        {next && (
          <span className="pc-next">
            <CalendarClock size={12} />
            {next.price === null ? L("លំនាំដើម", "Default") : usd(next.price)} · {dateText(next.effective_from)}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="md-page pc-page">
      {notice && <div className={`md-notice md-notice-${notice.type}`}>{notice.text}</div>}

      <div className="pc-layout">
        {/* ===== Products ===== */}
        <div className="md-card pc-products">
          <div className="pc-products-head">
            <div className="md-search">
              <Search size={16} />
              <input placeholder={L("ស្វែងរកទំនិញ / SKU...", "Search product / SKU...")} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
              {keyword && (
                <button type="button" onClick={() => setKeyword("")}>
                  <X size={14} />
                </button>
              )}
            </div>
            <select className="md-filter" value={categoryId} onChange={(e) => { setPPage(1); setCategoryId(e.target.value); }}>
              <option value="">{L("-- ប្រភេទទាំងអស់ --", "-- All categories --")}</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="pc-product-list">
            {products.map((p) => {
              const missing = p.price_range ? p.variant_count - p.price_range.count : p.variant_count;
              return (
                <button key={p._id} type="button" className={`pc-product ${selected?._id === p._id ? "on" : ""}`} onClick={() => setSelected(p)}>
                  {imageCell(p.image)}
                  <span className="pc-product-text">
                    <b>{nameKh(p)}</b>
                    <small>{p.code} · {L(`${p.variant_count} ប្រភេទរង`, `${p.variant_count} variants`)}</small>
                  </span>
                  <span className="pc-product-price">
                    {rangeText(p.price_range) || <span className="pc-missing">{L("គ្មានតម្លៃ", "No price")}</span>}
                    {missing > 0 && p.price_range && <small className="pc-missing">{L(`${missing} គ្មានតម្លៃ`, `${missing} missing`)}</small>}
                  </span>
                </button>
              );
            })}
            {!products.length && <div className="md-empty">{L("មិនទាន់មានទិន្នន័យ", "No data yet")}</div>}
          </div>
          <div className="md-pagination">
            <span className="md-sub">{L("ទំព័រ", "Page")} {pPage} / {pPages}</span>
            <div className="md-pager">
              <button type="button" className="md-icon-btn" disabled={pPage <= 1} onClick={() => setPPage(pPage - 1)}>
                <ChevronLeft size={16} />
              </button>
              <button type="button" className="md-icon-btn" disabled={pPage >= pPages} onClick={() => setPPage(pPage + 1)}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* ===== Grid ===== */}
        <div className="md-card pc-grid-card">
          {!selected ? (
            <div className="md-empty">{L("ជ្រើសរើសទំនិញ", "Choose a product")}</div>
          ) : (
            <>
              <div className="pc-grid-head">
                <div>
                  <h3>{nameKh(selected)}</h3>
                  <span className="md-sub">{nameOther(selected)} · {selected.code}</span>
                </div>
                <div className="pc-modes">
                  <button type="button" className={`pc-mode ${mode === "" ? "on" : ""}`} onClick={() => setMode("")} disabled={editing}>
                    <Tag size={14} />
                    {L("តម្លៃលំនាំដើម", "Default price")}
                  </button>
                  {shops.map((s) => (
                    <button key={s._id} type="button" className={`pc-mode ${mode === s._id ? "on" : ""}`} onClick={() => setMode(s._id)} disabled={editing}>
                      <Store size={14} />
                      {s.code}
                    </button>
                  ))}
                </div>
              </div>

              <p className="pc-hint">
                {mode
                  ? L(`តម្លៃពិសេសសម្រាប់ ${shopName}។ ទុកទទេ = ប្រើតម្លៃលំនាំដើម`, `Special price for ${shopName}. Empty = use the default price`)
                  : L("តម្លៃលក់សម្រាប់គ្រប់ហាង (USD)។ ចុចលើតម្លៃដើម្បីមើលប្រវត្តិ", "Sale price for every shop (USD). Click a price to see its history")}
              </p>

              {error && <div className="md-form-error">{error}</div>}

              <div className="md-table-scroll pc-table-wrap">
                <table className="md-table pc-table">
                  <thead>
                    <tr>
                      <th>{L("ប្រភេទរង", "Variant")}</th>
                      {units.map((u) => (
                        <th key={u.unit_id}>
                          <span className="pc-unit">
                            {unitName(u)}
                            {!u.is_base && <small> = {u.factor} {unitName(units[0])}</small>}
                          </span>
                          {editing && (
                            <input
                              className="pe-input pc-fill"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder={L("ដាក់ទាំងអស់", "Fill all")}
                              onChange={(e) => fillColumn(u.unit_id, e.target.value)}
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading && !grid.length && (
                      <tr><td colSpan={units.length + 1} className="md-empty">{L("កំពុងផ្ទុក...", "Loading...")}</td></tr>
                    )}
                    {grid.map((v) => (
                      <tr key={v.variant_id} className={v.status === false ? "pe-off" : ""}>
                        <td>
                          <div className="md-values">
                            {v.options.length ? (
                              v.options.map((o) => (
                                <span key={o.attribute_id} className="md-value">
                                  {o.color_hex && <i style={{ background: o.color_hex }} />}
                                  {valueName(o)}
                                </span>
                              ))
                            ) : (
                              <span className="md-value">{L("ធម្មតា", "Default")}</span>
                            )}
                          </div>
                          <span className="md-code pc-sku">{v.code}</span>
                        </td>
                        {v.units.map((u) => (
                          <td key={u.unit_id}>{renderCell(v, u)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {canEdit && (
                <div className="pc-actions">
                  {editing ? (
                    <>
                      <label className="pc-start">
                        <CalendarClock size={15} />
                        {L("ចាប់ផ្តើមប្រើ", "Starts")}
                        <input type="datetime-local" className="pe-input" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
                        {!startAt && <span className="pc-by">{L("ទុកទទេ = ឥឡូវនេះ", "empty = now")}</span>}
                      </label>
                      <span className="pc-count">{L(`${changes.length} កែប្រែ`, `${changes.length} change(s)`)}</span>
                      <button type="button" className="md-btn md-btn-ghost" onClick={() => setEditing(false)} disabled={saving}>{L("បោះបង់", "Cancel")}</button>
                      <button type="button" className="md-btn md-btn-primary" onClick={save} disabled={saving || !changes.length}>
                        <Save size={15} />
                        {saving ? L("កំពុងរក្សាទុក...", "Saving...") : L("រក្សាទុកតម្លៃ", "Save prices")}
                      </button>
                    </>
                  ) : (
                    <button type="button" className="md-btn md-btn-primary" onClick={startEdit} disabled={loading || !grid.length}>
                      <Pencil size={15} />
                      {mode ? L(`កែតម្លៃ ${shops.find((s) => s._id === mode)?.code}`, `Edit ${shops.find((s) => s._id === mode)?.code} prices`) : L("កែតម្លៃ", "Edit prices")}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ===== History ===== */}
      {history && (
        <div className="md-modal-backdrop" onMouseDown={() => setHistory(null)}>
          <div className="md-modal md-modal-wide" onMouseDown={(e) => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>
                <History size={17} style={{ verticalAlign: "-3px", marginRight: 6 }} />
                {L("ប្រវត្តិតម្លៃ", "Price history")} · {history.variant.code} · {unitName(history.unit)} {mode ? `· ${shopName}` : ""}
              </h3>
              <button type="button" className="md-icon-btn" onClick={() => setHistory(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="md-modal-body">
              {!history.rows ? (
                <div className="md-empty">{L("កំពុងផ្ទុក...", "Loading...")}</div>
              ) : !history.rows.length ? (
                <div className="md-empty">{L("មិនទាន់មានតម្លៃ", "No price yet")}</div>
              ) : (
                <table className="md-table">
                  <thead>
                    <tr>
                      <th>{L("តម្លៃ", "Price")}</th>
                      <th>{L("ចាប់ពី", "From")}</th>
                      <th>{L("ដល់", "To")}</th>
                      <th>{L("ស្ថានភាព", "State")}</th>
                      <th>{L("ដោយ", "By")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {history.rows.map((r) => (
                      <tr key={r._id}>
                        <td><b>{r.price === null ? L("លំនាំដើម", "Default") : usd(r.price)}</b></td>
                        <td>{dateTimeText(r.effective_from)}</td>
                        <td>{r.effective_to ? dateTimeText(r.effective_to) : "—"}</td>
                        <td>
                          <span className={`md-badge ${r.state === "current" ? "md-badge-on" : r.state === "upcoming" ? "md-badge-gold" : "md-badge-off"}`}>
                            {r.state === "current" ? L("កំពុងប្រើ", "Current") : r.state === "upcoming" ? L("នឹងប្រើ", "Upcoming") : L("ចាស់", "Past")}
                          </span>
                        </td>
                        <td><span className="pc-by">{r.created_by ? `${r.created_by.firstname || ""} ${r.created_by.lastname || ""}`.trim() || r.created_by.email : "-"}</span></td>
                        <td>
                          {canEdit && r.state === "upcoming" && (
                            <button type="button" className="md-icon-btn md-icon-btn-danger" onClick={() => removeUpcoming(r)} title={L("លុប", "Delete")}>
                              <Trash2 size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PriceComponent;
