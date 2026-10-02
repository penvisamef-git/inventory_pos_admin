import React, { useRef, useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, X, ChevronLeft, ChevronRight, ChevronDown, RefreshCw, ScanBarcode, Upload } from "lucide-react";
import { attributeService, brandService, categoryService, productService, unitService } from "../../../api/api.service";
import { imageCell, statusCell } from "../master_data/MasterDataPage";
import ProductEditor from "./ProductEditor";
import ProductImport from "./ProductImport";
import { canEditProduct, flattenTree, nameKh, nameOther } from "./productOptions";
import { L } from "../../../i18n";
import "../master_data/masterdata.style.css";
import "../master_data/masterdata.theme.css";
import "./product.style.css";
import useUrlQuery from "../../util/useUrlQuery";
import Select from "../../util/Select"; // searchable <select>

const PAGE_SIZES = [10, 20, 50];
const valueName = (v) => L(v?.name_kh || v?.name_en, v?.name_en || v?.name_kh);

// "1 កញ្ចប់ = 4"
const unitsText = (row) => {
  const base = row.base_unit_id;
  return (
    <>
      <b>{base ? nameKh(base) : "-"}</b>
      {(row.units || []).map((u) => (
        <span key={u.unit_id?._id} className="md-sub">
          1 {nameKh(u.unit_id)} = {u.factor} {base ? nameKh(base) : ""}
        </span>
      ))}
    </>
  );
};

function ProductComponent() {
  const canEdit = canEditProduct();

  // ---------- lookups ----------
  const [lookups, setLookups] = useState({ categories: [], brands: [], units: [], attributes: [] });
  const loadLookups = useCallback(async () => {
    const [tree, brands, units, attributes] = await Promise.all([
      categoryService.tree().catch(() => ({ data: [] })),
      brandService.all().catch(() => ({ data: [] })),
      unitService.all().catch(() => ({ data: [] })),
      attributeService.all().catch(() => ({ data: [] })),
    ]);
    setLookups({
      categories: flattenTree(tree.data || []).map((o) => ({ value: o.value, label: o.label, depth: o.depth })),
      brands: brands.data || [],
      units: units.data || [],
      attributes: attributes.data || [],
    });
  }, []);
  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  // ---------- list ----------
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZES[0]);
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  useUrlQuery(setKeyword); // ?q= from the global search
  const [filters, setFilters] = useState({ category_id: "", brand_id: "", track_batch: "" });
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [notice, setNotice] = useState(null);
  const [open, setOpen] = useState({}); // expanded rows → variants
  const [editor, setEditor] = useState(null); // { id } | { id: null }
  const [importing, setImporting] = useState(false); // Excel import dialog
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const filterKey = JSON.stringify(filters);
  // cached pages (api.client.js): last copy at once, quiet refresh, next page pre-loaded
  const loadSeq = useRef(0);
  const loadData = useCallback(async () => {
    const seq = ++loadSeq.current;
    const apply = (res) => {
      if (seq !== loadSeq.current) return;
      setRows(res.data || []);
      setPagination(res.pagination || { total: 0, totalPages: 1 });
    };
    setLoading(true);
    setListError("");
    try {
      const f = JSON.parse(filterKey);
      const params = {
        page,
        limit,
        sort: "sort_order",
        order: "asc",
        q: search || undefined,
        category_id: f.category_id || undefined,
        brand_id: f.brand_id || undefined,
        track_batch: f.track_batch || undefined,
      };
      const res = await productService.list(params, { onFresh: apply });
      apply(res);
      if (page < (res.pagination?.totalPages || 1)) productService.list({ ...params, page: page + 1 }, { prefetch: true });
    } catch (err) {
      setListError(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, filterKey]);
  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setSearch(keyword.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [keyword]);
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  // expand → load variants once
  const toggleRow = async (row) => {
    if (open[row._id]) return setOpen((o) => ({ ...o, [row._id]: null }));
    setOpen((o) => ({ ...o, [row._id]: "loading" }));
    try {
      const res = await productService.get(row._id);
      setOpen((o) => ({ ...o, [row._id]: res.data.variants || [] }));
    } catch (err) {
      setOpen((o) => ({ ...o, [row._id]: null }));
      setNotice({ type: "error", text: err.message });
    }
  };

  const setFilter = (key, value) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      const res = await productService.remove(deleting._id);
      setNotice({ type: "success", text: res.message });
      setDeleting(null);
      if (rows.length === 1 && page > 1) setPage(page - 1);
      else await loadData();
    } catch (err) {
      setNotice({ type: "error", text: err.message });
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const totalPages = Math.max(pagination.totalPages || 1, 1);
  const startIndex = (page - 1) * limit;
  const colSpan = 10;

  // current default price of the base unit (min – max over variants)
  const priceCell = (row) => {
    const r = row.price_range;
    if (!r) return <span className="pc-missing">{L("គ្មានតម្លៃ", "No price")}</span>;
    const usd = (v) => `$${Number(v).toFixed(2)}`;
    const missing = row.variant_count - r.count;
    return (
      <>
        <b>{r.min === r.max ? usd(r.min) : `${usd(r.min)} – ${usd(r.max)}`}</b>
        {missing > 0 && <span className="md-sub pc-missing">{L(`${missing} គ្មានតម្លៃ`, `${missing} missing`)}</span>}
      </>
    );
  };

  const variantsCell = (row) => {
    const isOpen = !!open[row._id];
    return (
      <button type="button" className={`pr-variant-btn ${isOpen ? "open" : ""}`} onClick={() => toggleRow(row)}>
        {(row.attribute_ids || []).length ? L(`${row.variant_count} ប្រភេទរង`, `${row.variant_count} variants`) : L("ធម្មតា", "Simple")}
        <ChevronDown size={14} />
      </button>
    );
  };

  const flags = (row) => (
    <div className="pr-flags">
      {row.track_batch && <span className="md-badge md-badge-gold">{L("Batch / ផុតកំណត់", "Batch / expiry")}</span>}
      {row.track_stock === false && <span className="md-badge md-badge-shop">{L("សេវា", "Service")}</span>}
      {row.is_taxable === false && <span className="md-badge md-badge-off">{L("គ្មាន VAT", "No VAT")}</span>}
    </div>
  );

  const categoryOptions = useMemo(() => lookups.categories, [lookups.categories]);

  return (
    <div className="md-page">
      {notice && <div className={`md-notice md-notice-${notice.type}`}>{notice.text}</div>}

      <div className="md-toolbar pr-toolbar">
        <div className="md-toolbar-left">
          <div className="md-search">
            <Search size={16} />
            <input type="text" placeholder={L("ស្វែងរក ឈ្មោះ កូដ SKU បាកូដ...", "Search name, code, SKU, barcode...")} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            {keyword ? (
              <button type="button" onClick={() => setKeyword("")} aria-label="Clear search">
                <X size={14} />
              </button>
            ) : (
              <ScanBarcode size={16} className="pr-scan" />
            )}
          </div>
          <Select className="md-filter" value={filters.category_id} onChange={(e) => setFilter("category_id", e.target.value)}>
            <option value="">{L("-- ប្រភេទទាំងអស់ --", "-- All categories --")}</option>
            {categoryOptions.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
          <Select className="md-filter" value={filters.brand_id} onChange={(e) => setFilter("brand_id", e.target.value)}>
            <option value="">{L("-- ម៉ាកទាំងអស់ --", "-- All brands --")}</option>
            {lookups.brands.map((b) => (
              <option key={b._id} value={b._id}>{nameKh(b)}</option>
            ))}
          </Select>
          <Select className="md-filter" value={filters.track_batch} onChange={(e) => setFilter("track_batch", e.target.value)}>
            <option value="">{L("-- Batch: ទាំងអស់ --", "-- Batch: all --")}</option>
            <option value="true">{L("មាន Batch / ផុតកំណត់", "With batch / expiry")}</option>
            <option value="false">{L("គ្មាន Batch", "No batch")}</option>
          </Select>
        </div>
        <div className="md-toolbar-actions">
          <button type="button" className="md-btn md-btn-ghost" onClick={loadData} disabled={loading} title={L("ផ្ទុកឡើងវិញ", "Reload")}>
            <RefreshCw size={16} className={loading ? "md-spin" : ""} />
          </button>
          {canEdit && (
            <button type="button" className="md-btn md-btn-ghost" onClick={() => setImporting(true)} title={L("នាំចូល / នាំចេញ Excel", "Excel import / export")}>
              <Upload size={16} />
              Excel
            </button>
          )}
          {canEdit && (
            <button type="button" className="md-btn md-btn-primary" onClick={() => setEditor({ id: null })}>
              <Plus size={16} />
              {L("បង្កើតទំនិញ", "Add product")}
            </button>
          )}
        </div>
      </div>

      <div className="md-card">
        <div className="md-table-scroll">
          <table className="md-table pr-table">
            <thead>
              <tr>
                <th className="md-col-no">{L("ល.រ", "No.")}</th>
                <th>{L("រូប", "Image")}</th>
                <th>{L("ទំនិញ", "Product")}</th>
                <th>{L("កូដ", "Code")}</th>
                <th>{L("ម៉ាក", "Brand")}</th>
                <th>{L("ឯកតា", "Unit")}</th>
                <th>{L("តម្លៃលក់", "Price")}</th>
                <th>{L("ប្រភេទរង", "Variants")}</th>
                <th>{L("ស្ថានភាព", "Status")}</th>
                <th className="md-col-actions">{L("សកម្មភាព", "Activity")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && (
                <tr><td colSpan={colSpan} className="md-empty">{L("កំពុងផ្ទុកទិន្នន័យ...", "Loading data...")}</td></tr>
              )}
              {!loading && listError && (
                <tr><td colSpan={colSpan} className="md-empty md-empty-error">{listError}</td></tr>
              )}
              {!loading && !listError && rows.length === 0 && (
                <tr><td colSpan={colSpan} className="md-empty">{search ? L("រកមិនឃើញទិន្នន័យដែលត្រូវនឹងការស្វែងរក", "Nothing matches your search") : L("មិនទាន់មានទិន្នន័យ", "No data yet")}</td></tr>
              )}
              {rows.map((row, i) => {
                const variants = open[row._id];
                return (
                  <React.Fragment key={row._id}>
                    <tr className={variants ? "pr-open" : ""}>
                      <td className="md-col-no">{startIndex + i + 1}</td>
                      <td>{imageCell(row.image)}</td>
                      <td>
                        <b>{nameKh(row)}</b>
                        {nameOther(row) && <span className="md-sub">{nameOther(row)}</span>}
                        <span className="md-sub pr-cat">{row.category_id ? nameKh(row.category_id) : ""}</span>
                        {flags(row)}
                      </td>
                      <td><span className="md-code">{row.code}</span></td>
                      <td>{row.brand_id ? nameKh(row.brand_id) : <span className="md-sub">-</span>}</td>
                      <td>{unitsText(row)}</td>
                      <td>{priceCell(row)}</td>
                      <td>{variantsCell(row)}</td>
                      <td>{statusCell(row)}</td>
                      <td className="md-col-actions">
                        {canEdit && (
                          <>
                            <button type="button" className="md-icon-btn" onClick={() => setEditor({ id: row._id })} title={L("កែប្រែ", "Edit")}>
                              <Pencil size={15} />
                            </button>
                            <button type="button" className="md-icon-btn md-icon-btn-danger" onClick={() => setDeleting(row)} title={L("លុប", "Delete")}>
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                    {variants && (
                      <tr className="pr-variants-row">
                        <td colSpan={colSpan}>
                          {variants === "loading" ? (
                            <span className="md-sub">{L("កំពុងផ្ទុក...", "Loading...")}</span>
                          ) : (
                            <div className="pr-variants">
                              {variants.map((v) => (
                                <div key={v._id} className={`pr-variant ${v.status === false ? "off" : ""}`}>
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
                                  <span className="md-code">{v.code}</span>
                                  <span className="pr-barcode">
                                    {v.barcode || <em>{L("គ្មានបាកូដ", "no barcode")}</em>}
                                    {(v.unit_barcodes || []).map((u) => (
                                      <small key={u.barcode}>
                                        {nameKh(u.unit_id)}: {u.barcode}
                                      </small>
                                    ))}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="md-pagination">
          <div className="md-page-size">
            {L("បង្ហាញ", "Show")}
            <Select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </Select>
            {L("/ សរុប", "/ total")} {pagination.total || 0}
          </div>
          <div className="md-pager">
            <button type="button" className="md-icon-btn" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)} aria-label="Previous page">
              <ChevronLeft size={16} />
            </button>
            <span>{L("ទំព័រ", "Page")} {page} / {totalPages}</span>
            <button type="button" className="md-icon-btn" disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)} aria-label="Next page">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {editor && (
        <ProductEditor
          productId={editor.id}
          lookups={lookups}
          onClose={() => setEditor(null)}
          onSaved={(message) => {
            setEditor(null);
            setOpen({});
            setNotice({ type: "success", text: message });
            loadData();
          }}
        />
      )}

      {importing && (
        <ProductImport
          onClose={() => setImporting(false)}
          onDone={(message) => {
            setOpen({});
            setNotice({ type: "success", text: message });
            loadData();
          }}
        />
      )}

      {deleting && (
        <div className="md-modal-backdrop" onMouseDown={() => !busy && setDeleting(null)}>
          <div className="md-modal md-modal-sm" onMouseDown={(e) => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>{L("លុបទំនិញ", "Delete product")}</h3>
            </div>
            <div className="md-modal-body">
              <p>
                {L("តើអ្នកពិតជាចង់លុប", "Do you really want to delete")} <strong>{nameKh(deleting)} ({deleting.code})</strong>{" "}
                {L(`និងប្រភេទរងទាំង ${deleting.variant_count} មែនទេ?`, `and its ${deleting.variant_count} variant(s)?`)}
              </p>
            </div>
            <div className="md-modal-footer">
              <button type="button" className="md-btn md-btn-ghost" onClick={() => setDeleting(null)} disabled={busy}>{L("បោះបង់", "Cancel")}</button>
              <button type="button" className="md-btn md-btn-danger" onClick={confirmDelete} disabled={busy}>{busy ? L("កំពុងលុប...", "Deleting...") : L("លុប", "Delete")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductComponent;
