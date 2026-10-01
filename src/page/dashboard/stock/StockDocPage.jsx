import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, X, Eye, Pencil, CheckCircle2, Ban, RefreshCw, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { stockService, variantService, warehouseService } from "../../../api/api.service";
import { dateTimeText } from "../master_data/MasterDataPage";
import VariantPicker from "./VariantPicker";
import { OptionChips, STATE, dateOnly, isShopUser, nameKh, qtyText, stateBadge, toDateInput, unitLabel, usd, userName } from "./stockOptions";
import { L } from "../../../i18n";
import { usePortal } from "../../portal/portalContext";
import "../master_data/masterdata.style.css";
import "../master_data/masterdata.theme.css";
import "../product/product.style.css";
import "./stock.style.css";

const PAGE_SIZES = [10, 20, 50];
let lineSeq = 0;
const newKey = () => `l${++lineSeq}`;

// a picked variant (from /product/variant) → editor line
export const lineFromVariant = (v, extra = {}) => {
  const p = v.product_id || {};
  const units = [
    { unit_id: String(p.base_unit_id?._id || p.base_unit_id), code: p.base_unit_id?.code, name_kh: p.base_unit_id?.name_kh, name_en: p.base_unit_id?.name_en, factor: 1 },
    ...(p.units || []).map((u) => ({ unit_id: String(u.unit_id?._id || u.unit_id), code: u.unit_id?.code, name_kh: u.unit_id?.name_kh, name_en: u.unit_id?.name_en, factor: u.factor })),
  ];
  return {
    key: newKey(),
    variant_id: String(v._id),
    sku: v.code,
    product_name: nameKh(p),
    options: v.options || [],
    track_batch: !!p.track_batch,
    units,
    unit_id: units[0].unit_id,
    qty: "",
    unit_cost: "",
    batch_no: "",
    expiry_date: "",
    batch_id: "",
    note: "",
    ...extra,
  };
};

/**
 * List + editor + detail for a stock document (opening, goods receive, adjustment, transfer).
 * config:
 *   service              list / get / create / update / cancel / post
 *   docLabel             "Goods receive"
 *   canCreate            boolean
 *   defaults(ctx)        new document header values
 *   Header({ form, set, ctx, disabled, editing })   header inputs
 *   validate(form)       → message | null
 *   payload(form)        header part of the request body (items are added here)
 *   cost(form)           "required" | "optional" | "none" — cost column
 *   batchIn(form, line)  → true when this line needs batch no + expiry
 *   batchOut(form, line) → true when this line may pick a batch (else FEFO)
 *   signed(form)         qty may be negative
 *   stockFrom(form)      warehouse id → show on-hand + batches of that warehouse
 *   columns              [{ label, render(doc) }] list columns after the number / date
 *   filters              [{ key, label, options }]
 *   canEdit(doc) / canPost(doc) / hasPost
 *   actions(doc, api)    extra row buttons; api = { reload, notify, view }
 *   ViewExtra({ doc })   extra block in the detail view
 *   toolbarExtra(api)    extra toolbar buttons (Excel import …)
 */
function StockDocPage({ config }) {
  const shopUser = isShopUser();
  const portal = usePortal(); // Shop portal → only this warehouse
  const [ctx, setCtx] = useState({ warehouses: [] });
  useEffect(() => {
    warehouseService.all().then((r) => setCtx((c) => ({ ...c, warehouses: r.data || [] }))).catch(() => {});
    if (config.loadCtx) config.loadCtx().then((extra) => setCtx((c) => ({ ...c, ...extra }))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- list ----------------
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZES[0]);
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [notice, setNotice] = useState(null);
  const filterKey = JSON.stringify(filters);

  const loadData = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const res = await config.service.list({ page, limit, q: search || undefined, sort: "created_date", order: "desc", ...JSON.parse(filterKey), ...(portal ? { warehouse_id: portal._id } : {}) });
      setRows(res.data || []);
      setPagination(res.pagination || { total: 0, totalPages: 1 });
    } catch (err) {
      setListError(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [config.service, page, limit, search, filterKey, portal]);
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
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);
  const notify = (type, text) => setNotice({ type, text });

  // ---------------- editor ----------------
  const [editor, setEditor] = useState(null); // { id, form }
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [avail, setAvail] = useState({});

  const openCreate = (preset) => {
    setFormError("");
    setEditor({ id: null, form: { doc_date: toDateInput(new Date()), note: "", items: [], ...config.defaults(ctx), ...(portal && config.portalDefaults ? config.portalDefaults(portal, ctx) : {}), ...(preset || {}) } });
  };

  const openEdit = async (doc) => {
    setFormError("");
    try {
      const full = (await config.service.get(doc._id)).data;
      const ids = [...new Set(full.items.map((i) => String(i.variant_id)))];
      const vs = ids.length ? (await variantService.list({ ids: ids.join(","), limit: 300 })).data || [] : [];
      const byId = new Map(vs.map((v) => [String(v._id), v]));
      const items = full.items.map((i) => {
        const v = byId.get(String(i.variant_id));
        const base = v ? lineFromVariant(v) : { key: newKey(), variant_id: String(i.variant_id), sku: i.sku, product_name: i.name_kh, options: [], units: [{ unit_id: String(i.unit_id), code: i.unit_code, name_kh: i.unit_name_kh, name_en: i.unit_name_en, factor: i.factor }], track_batch: i.track_batch };
        return {
          ...base,
          unit_id: String(i.unit_id),
          qty: config.signed?.(full) ? String(i.qty) : String(Math.abs(i.qty)),
          unit_cost: i.unit_cost ?? "",
          batch_no: i.batch_no || "",
          expiry_date: toDateInput(i.expiry_date),
          batch_id: i.batch_id ? String(i.batch_id) : "",
          note: i.note || "",
        };
      });
      const header = {};
      Object.entries(full).forEach(([k, v]) => {
        if (k === "items") return;
        header[k] = v && typeof v === "object" && v._id ? String(v._id) : v;
      });
      setEditor({ id: full._id, doc: full, form: { ...header, doc_date: toDateInput(full.doc_date), items } });
    } catch (err) {
      notify("error", err.message);
    }
  };

  const form = editor?.form;
  const setForm = (patch) => setEditor((e) => ({ ...e, form: { ...e.form, ...(typeof patch === "function" ? patch(e.form) : patch) } }));
  const setLine = (key, patch) => setForm((f) => ({ items: f.items.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  const removeLine = (key) => setForm((f) => ({ items: f.items.filter((l) => l.key !== key) }));
  const addVariant = (v) =>
    setForm((f) => {
      // same variant again (no batch) → +1 instead of a new line
      const same = f.items.find((l) => l.variant_id === String(v._id) && !l.track_batch);
      if (same) return { items: f.items.map((l) => (l === same ? { ...l, qty: String((Number(l.qty) || 0) + 1) } : l)) };
      return { items: [...f.items, lineFromVariant(v, { qty: "1" })] };
    });

  // on hand in the source warehouse
  const stockWh = form && config.stockFrom ? config.stockFrom(form) : null;
  const variantKey = form ? form.items.map((l) => l.variant_id).join(",") : "";
  useEffect(() => {
    if (!stockWh || !variantKey) return setAvail({});
    let alive = true;
    stockService
      .availability(stockWh, [...new Set(variantKey.split(","))])
      .then((r) => alive && setAvail(r.data || {}))
      .catch(() => alive && setAvail({}));
    return () => {
      alive = false;
    };
  }, [stockWh, variantKey]);

  const costMode = form ? (shopUser ? "none" : config.cost?.(form) || "none") : "none";
  const anyBatchIn = form ? form.items.some((l) => l.track_batch && config.batchIn?.(form, l)) : false;
  const anyBatchOut = form ? form.items.some((l) => l.track_batch && config.batchOut?.(form, l)) : false;

  const save = async (andPost) => {
    setFormError("");
    const err = config.validate?.(form);
    if (err) return setFormError(err);
    if (!form.items.length) return setFormError(L("សូមបន្ថែមទំនិញយ៉ាងហោចណាស់ ១", "Add at least 1 item"));
    const bad = form.items.find((l) => !(Number(l.qty) > 0) && !(config.signed?.(form) && Number(l.qty) !== 0 && Number.isFinite(Number(l.qty))));
    if (bad) return setFormError(L(`ចំនួនមិនត្រឹមត្រូវ (${bad.sku})`, `Invalid quantity (${bad.sku})`));
    setSaving(true);
    try {
      const body = {
        ...config.payload(form),
        doc_date: form.doc_date || undefined,
        note: form.note,
        items: form.items.map((l) => ({
          variant_id: l.variant_id,
          unit_id: l.unit_id,
          qty: Number(l.qty),
          unit_cost: costMode === "none" || l.unit_cost === "" ? undefined : Number(l.unit_cost),
          batch_no: l.track_batch && config.batchIn?.(form, l) ? l.batch_no : undefined,
          expiry_date: l.track_batch && config.batchIn?.(form, l) ? l.expiry_date || undefined : undefined,
          batch_id: l.track_batch && config.batchOut?.(form, l) && l.batch_id ? l.batch_id : undefined,
          note: l.note,
        })),
      };
      const res = editor.id ? await config.service.update(editor.id, body) : await config.service.create(body);
      let msg = res.message;
      if (andPost) msg = (await config.service.post(res.data._id)).message;
      notify("success", msg);
      setEditor(null);
      if (!editor.id) setPage(1);
      loadData();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ---------------- detail / confirm ----------------
  const [view, setView] = useState(null);
  const openView = async (doc) => {
    try {
      setView((await config.service.get(doc._id)).data);
    } catch (err) {
      notify("error", err.message);
    }
  };
  const [confirm, setConfirm] = useState(null); // { title, text, run }
  const runConfirm = async () => {
    setSaving(true);
    try {
      const res = await confirm.run();
      notify("success", res.message);
      setConfirm(null);
      setView(null);
      loadData();
    } catch (err) {
      notify("error", err.message);
      setConfirm(null);
    } finally {
      setSaving(false);
    }
  };
  const api = { reload: loadData, notify, view: openView, openCreate, setConfirm, ctx };

  const totalPages = Math.max(pagination.totalPages || 1, 1);
  const colSpan = (config.columns?.length || 0) + 4;
  const editorTotals = useMemo(() => {
    if (!form) return { qty: 0, cost: 0 };
    return form.items.reduce(
      (t, l) => {
        const u = l.units.find((x) => x.unit_id === l.unit_id) || { factor: 1 };
        return { qty: t.qty + Math.abs(Number(l.qty) || 0) * u.factor, cost: t.cost + Math.abs(Number(l.qty) || 0) * (Number(l.unit_cost) || 0) };
      },
      { qty: 0, cost: 0 },
    );
  }, [form]);

  return (
    <div className="md-page">
      {notice && <div className={`md-notice md-notice-${notice.type}`}>{notice.text}</div>}

      <div className="md-toolbar">
        <div className="md-toolbar-left">
          <div className="md-search">
            <Search size={16} />
            <input placeholder={L("ស្វែងរកលេខឯកសារ / SKU...", "Search number / SKU...")} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            {keyword && (
              <button type="button" onClick={() => setKeyword("")}>
                <X size={14} />
              </button>
            )}
          </div>
          {(config.filters || []).filter((flt) => !(portal && flt.key === "warehouse_id")).map((flt) => (
            <select
              key={flt.key}
              className="md-filter"
              value={filters[flt.key] || ""}
              onChange={(e) => {
                setPage(1);
                setFilters((f) => ({ ...f, [flt.key]: e.target.value || undefined }));
              }}
            >
              <option value="">{flt.label}</option>
              {(typeof flt.options === "function" ? flt.options(ctx) : flt.options).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ))}
        </div>
        <div className="md-toolbar-actions">
          <button type="button" className="md-btn md-btn-ghost" onClick={loadData} disabled={loading} title={L("ផ្ទុកឡើងវិញ", "Reload")}>
            <RefreshCw size={16} className={loading ? "md-spin" : ""} />
          </button>
          {config.toolbarExtra && config.toolbarExtra(api)}
          {config.canCreate && (
            <button type="button" className="md-btn md-btn-primary" onClick={() => openCreate()}>
              <Plus size={16} />
              {config.createLabel || L("បង្កើតថ្មី", "New")}
            </button>
          )}
        </div>
      </div>

      <div className="md-card">
        <div className="md-table-scroll">
          <table className="md-table">
            <thead>
              <tr>
                <th>{L("លេខ", "No.")}</th>
                <th>{L("កាលបរិច្ឆេទ", "Date")}</th>
                {(config.columns || []).map((c) => (
                  <th key={c.label}>{c.label}</th>
                ))}
                <th>{L("ស្ថានភាព", "Status")}</th>
                <th className="md-col-actions">{L("សកម្មភាព", "Activity")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && !rows.length && <tr><td colSpan={colSpan} className="md-empty">{L("កំពុងផ្ទុកទិន្នន័យ...", "Loading data...")}</td></tr>}
              {!loading && listError && <tr><td colSpan={colSpan} className="md-empty md-empty-error">{listError}</td></tr>}
              {!loading && !listError && !rows.length && <tr><td colSpan={colSpan} className="md-empty">{L("មិនទាន់មានទិន្នន័យ", "No data yet")}</td></tr>}
              {rows.map((d) => (
                <tr key={d._id}>
                  <td>
                    <button type="button" className="sd-no" onClick={() => openView(d)}>{d.doc_no}</button>
                  </td>
                  <td>{dateOnly(d.doc_date)}</td>
                  {(config.columns || []).map((c) => (
                    <td key={c.label}>{c.render(d)}</td>
                  ))}
                  <td>{stateBadge(d.state)}</td>
                  <td className="md-col-actions">
                    {config.actions && config.actions(d, api)}
                    {config.hasPost && config.canPost(d) && (
                      <button type="button" className="md-icon-btn sd-ok" title={L("Post ចូលស្តុក", "Post to stock")} onClick={() => setConfirm({ title: L("Post ចូលស្តុក", "Post to stock"), text: L(`Post ${d.doc_no}? បន្ទាប់ពី Post មិនអាចកែបានទៀតទេ។`, `Post ${d.doc_no}? It cannot be changed after posting.`), run: () => config.service.post(d._id) })}>
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                    {config.canEdit(d) && (
                      <button type="button" className="md-icon-btn" title={L("កែប្រែ", "Edit")} onClick={() => openEdit(d)}>
                        <Pencil size={15} />
                      </button>
                    )}
                    {config.canEdit(d) && (
                      <button type="button" className="md-icon-btn md-icon-btn-danger" title={L("បោះបង់", "Cancel")} onClick={() => setConfirm({ title: L("បោះបង់ឯកសារ", "Cancel document"), text: L(`បោះបង់ ${d.doc_no}?`, `Cancel ${d.doc_no}?`), danger: true, run: () => config.service.cancel(d._id) })}>
                        <Ban size={15} />
                      </button>
                    )}
                    <button type="button" className="md-icon-btn" title={L("មើល", "View")} onClick={() => openView(d)}>
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md-pagination">
          <div className="md-page-size">
            {L("បង្ហាញ", "Show")}
            <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            {L("/ សរុប", "/ total")} {pagination.total || 0}
          </div>
          <div className="md-pager">
            <button type="button" className="md-icon-btn" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button>
            <span>{L("ទំព័រ", "Page")} {page} / {totalPages}</span>
            <button type="button" className="md-icon-btn" disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {/* ================= Editor ================= */}
      {editor && (
        <div className="md-modal-backdrop" onMouseDown={() => !saving && setEditor(null)}>
          <div className="md-modal pe-modal sd-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>{editor.id ? `${L("កែប្រែ", "Edit")} ${editor.doc?.doc_no}` : `${config.docLabel} ${L("ថ្មី", "— new")}`}</h3>
              <button type="button" className="md-icon-btn" onClick={() => setEditor(null)} disabled={saving}><X size={18} /></button>
            </div>
            <div className="md-modal-body pe-body">
              <section className="pe-section">
                <div className="sd-header">
                  <config.Header form={form} set={setForm} ctx={ctx} disabled={saving} editing={!!editor.id} portal={portal} />
                  <div className="md-field">
                    <label>{L("កាលបរិច្ឆេទ", "Date")}</label>
                    <input type="date" className="pe-input" value={form.doc_date || ""} onChange={(e) => setForm({ doc_date: e.target.value })} disabled={saving} />
                  </div>
                  <div className="md-field sd-note">
                    <label>{L("កំណត់សម្គាល់", "Note")}</label>
                    <input className="pe-input" value={form.note || ""} onChange={(e) => setForm({ note: e.target.value })} disabled={saving} />
                  </div>
                </div>
              </section>

              <section className="pe-section">
                <VariantPicker onPick={addVariant} disabled={saving} autoFocus={!editor.id} />
                <div className="md-table-scroll pe-variants sd-lines">
                  <table className="md-table">
                    <thead>
                      <tr>
                        <th>{L("ទំនិញ", "Item")}</th>
                        {stockWh && <th>{L("មានក្នុងស្តុក", "On hand")}</th>}
                        <th>{L("ឯកតា", "Unit")}</th>
                        <th>{L("ចំនួន", "Qty")}</th>
                        {costMode !== "none" && <th>{L("ថ្លៃដើម / ឯកតា", "Cost / unit")} {costMode === "required" ? "*" : ""}</th>}
                        {anyBatchIn && <th>{L("លេខ Batch", "Batch no")}</th>}
                        {anyBatchIn && <th>{L("ផុតកំណត់", "Expiry")}</th>}
                        {anyBatchOut && <th>Batch</th>}
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {!form.items.length && (
                        <tr><td colSpan={9} className="md-empty">{L("ស្កេនបាកូដ ឬស្វែងរកទំនិញខាងលើ ដើម្បីបន្ថែម", "Scan a barcode or search above to add items")}</td></tr>
                      )}
                      {form.items.map((l) => {
                        const u = l.units.find((x) => x.unit_id === l.unit_id) || l.units[0];
                        const a = avail[l.variant_id];
                        const base = l.units[0];
                        const bIn = l.track_batch && config.batchIn?.(form, l);
                        const bOut = l.track_batch && config.batchOut?.(form, l);
                        const need = Math.abs(Number(l.qty) || 0) * (u?.factor || 1);
                        const short = a && config.checkStock?.(form, l) && need > a.qty;
                        return (
                          <tr key={l.key}>
                            <td>
                              <b className="sd-item">{l.product_name}</b>
                              <span className="sd-item-sub">
                                <span className="md-code">{l.sku}</span>
                                <OptionChips options={l.options} />
                              </span>
                            </td>
                            {stockWh && (
                              <td className={short ? "sd-short" : ""}>
                                {a ? `${qtyText(a.qty)} ${unitLabel(base.code, base.name_kh, base.name_en)}` : "…"}
                              </td>
                            )}
                            <td>
                              <select className="pe-input sd-unit" value={l.unit_id} onChange={(e) => setLine(l.key, { unit_id: e.target.value })} disabled={saving}>
                                {l.units.map((x) => (
                                  <option key={x.unit_id} value={x.unit_id}>
                                    {unitLabel(x.code, x.name_kh, x.name_en)}{x.factor !== 1 ? ` (${x.factor})` : ""}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input className="pe-input pe-num" type="number" step="any" value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value })} disabled={saving} />
                              {u && u.factor !== 1 && Number(l.qty) ? <span className="sd-base">= {qtyText(Number(l.qty) * u.factor)} {unitLabel(base.code, base.name_kh, base.name_en)}</span> : null}
                            </td>
                            {costMode !== "none" && (
                              <td>
                                <input className="pe-input pe-num" type="number" min="0" step="0.01" value={l.unit_cost} placeholder={costMode === "optional" ? L("មធ្យម", "avg") : "0.00"} onChange={(e) => setLine(l.key, { unit_cost: e.target.value })} disabled={saving} />
                              </td>
                            )}
                            {anyBatchIn && <td>{bIn ? <input className="pe-input sd-batch" value={l.batch_no} placeholder="F2405" onChange={(e) => setLine(l.key, { batch_no: e.target.value.toUpperCase() })} disabled={saving} /> : <span className="md-sub">—</span>}</td>}
                            {anyBatchIn && <td>{bIn ? <input className="pe-input sd-date" type="date" value={l.expiry_date} onChange={(e) => setLine(l.key, { expiry_date: e.target.value })} disabled={saving} /> : <span className="md-sub">—</span>}</td>}
                            {anyBatchOut && (
                              <td>
                                {bOut ? (
                                  <select className="pe-input sd-batch-sel" value={l.batch_id} onChange={(e) => setLine(l.key, { batch_id: e.target.value })} disabled={saving}>
                                    <option value="">{L("ស្វ័យប្រវត្តិ (FEFO)", "Auto (FEFO)")}</option>
                                    {(a?.batches || []).map((b) => (
                                      <option key={b.batch_id} value={b.batch_id}>
                                        {b.batch_no} · {dateOnly(b.expiry_date)} · {qtyText(b.qty)}{b.expired ? ` · ${L("ផុតកំណត់", "expired")}` : ""}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="md-sub">—</span>
                                )}
                              </td>
                            )}
                            <td>
                              <button type="button" className="md-icon-btn md-icon-btn-danger" onClick={() => removeLine(l.key)} disabled={saving}><Trash2 size={14} /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="sd-totals">
                  <span>{L(`${form.items.length} ជួរ`, `${form.items.length} line(s)`)}</span>
                  {costMode !== "none" && editorTotals.cost > 0 && <b>{L("សរុប", "Total")} {usd(editorTotals.cost)}</b>}
                </div>
              </section>
              {formError && <div className="md-form-error">{formError}</div>}
            </div>
            <div className="md-modal-footer">
              <button type="button" className="md-btn md-btn-ghost" onClick={() => setEditor(null)} disabled={saving}>{L("បោះបង់", "Cancel")}</button>
              <button type="button" className={`md-btn ${config.hasPost && config.postOnSave?.() ? "md-btn-ghost" : "md-btn-primary"}`} onClick={() => save(false)} disabled={saving}>
                {saving ? L("កំពុងរក្សាទុក...", "Saving...") : config.saveLabel?.(form, editor) || L("រក្សាទុក (សេចក្តីព្រាង)", "Save draft")}
              </button>
              {config.hasPost && config.postOnSave?.() && (
                <button type="button" className="md-btn md-btn-primary" onClick={() => save(true)} disabled={saving}>
                  <CheckCircle2 size={15} />
                  {L("រក្សាទុក និង Post", "Save & post")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= Detail ================= */}
      {view && (
        <div className="md-modal-backdrop" onMouseDown={() => setView(null)}>
          <div className="md-modal pe-modal sd-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>
                {config.docLabel} {view.doc_no} {stateBadge(view.state)}
              </h3>
              <button type="button" className="md-icon-btn" onClick={() => setView(null)}><X size={18} /></button>
            </div>
            <div className="md-modal-body pe-body">
              <section className="pe-section sd-info">
                {(config.info ? config.info(view) : []).map(([k, v]) => (
                  <div key={k}>
                    <span>{k}</span>
                    <b>{v}</b>
                  </div>
                ))}
                <div><span>{L("កាលបរិច្ឆេទ", "Date")}</span><b>{dateOnly(view.doc_date)}</b></div>
                <div><span>{L("បង្កើតដោយ", "Created by")}</span><b>{userName(view.created_by)} · {dateTimeText(view.created_date)}</b></div>
                {view.posted_at && <div><span>{L("Post ដោយ", "Posted by")}</span><b>{userName(view.posted_by)} · {dateTimeText(view.posted_at)}</b></div>}
                {view.note && <div className="sd-info-full"><span>{L("កំណត់សម្គាល់", "Note")}</span><b>{view.note}</b></div>}
              </section>
              {config.ViewExtra && <config.ViewExtra doc={view} />}
              <section className="pe-section">
                <div className="md-table-scroll pe-variants">
                  <table className="md-table">
                    <thead>
                      <tr>
                        <th>{L("ទំនិញ", "Item")}</th>
                        <th>{L("ចំនួន", "Qty")}</th>
                        {config.viewColumns?.map((c) => <th key={c.label}>{c.label}</th>)}
                        <th>Batch</th>
                        {!shopUser && <th>{L("ថ្លៃដើម", "Cost")}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {view.items.map((i) => (
                        <tr key={i._id}>
                          <td>
                            <b className="sd-item">{L(i.name_kh, i.name_en || i.name_kh)}</b>
                            <span className="md-code">{i.sku}</span>
                            {i.note && <span className="md-sub">{i.note}</span>}
                          </td>
                          <td>
                            <b className={i.qty < 0 ? "sd-neg" : ""}>{qtyText(i.qty)}</b> {unitLabel(i.unit_code, i.unit_name_kh, i.unit_name_en)}
                            {i.factor !== 1 && <span className="sd-base">= {qtyText(i.base_qty)}</span>}
                          </td>
                          {config.viewColumns?.map((c) => <td key={c.label}>{c.render(i, view)}</td>)}
                          <td>
                            {i.batches?.length
                              ? i.batches.map((b) => (
                                  <span key={b.batch_id} className="sd-batch-tag">
                                    {b.batch_no} · {dateOnly(b.expiry_date)} · {qtyText(b.qty)}
                                  </span>
                                ))
                              : i.batch_no
                                ? <span className="sd-batch-tag">{i.batch_no} · {dateOnly(i.expiry_date)}</span>
                                : <span className="md-sub">—</span>}
                          </td>
                          {!shopUser && <td>{i.line_total !== null && i.line_total !== undefined ? usd(i.line_total) : <span className="md-sub">{L("មធ្យម", "avg")}</span>}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!shopUser && (view.posted_cost !== null && view.posted_cost !== undefined) && (
                  <div className="sd-totals"><span /><b>{L("តម្លៃស្តុក", "Stock value")} {usd(view.posted_cost)}</b></div>
                )}
              </section>
            </div>
            <div className="md-modal-footer">
              {config.viewActions && config.viewActions(view, api)}
              <button type="button" className="md-btn md-btn-ghost" onClick={() => setView(null)}>{L("បិទ", "Close")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= Confirm ================= */}
      {confirm && (
        <div className="md-modal-backdrop" onMouseDown={() => !saving && setConfirm(null)}>
          <div className="md-modal md-modal-sm" onMouseDown={(e) => e.stopPropagation()}>
            <div className="md-modal-header"><h3>{confirm.title}</h3></div>
            <div className="md-modal-body"><p>{confirm.text}</p></div>
            <div className="md-modal-footer">
              <button type="button" className="md-btn md-btn-ghost" onClick={() => setConfirm(null)} disabled={saving}>{L("ទេ", "No")}</button>
              <button type="button" className={`md-btn ${confirm.danger ? "md-btn-danger" : "md-btn-primary"}`} onClick={runConfirm} disabled={saving}>
                {saving ? "…" : L("បាទ / ចាស", "Yes")}
              </button>
            </div>
          </div>
        </div>
      )}
      {config.Extra && <config.Extra api={api} />}
    </div>
  );
}

export const STATE_OPTIONS = (keys) => keys.map((k) => ({ value: k, label: STATE[k].label }));
export default StockDocPage;
