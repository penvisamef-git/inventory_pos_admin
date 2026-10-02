import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ImagePlus,
  Image as ImageIcon,
} from "lucide-react";
import { uploadService } from "../../../api/api.service";
import "./masterdata.style.css";
import "./masterdata.theme.css";

import { L } from "../../../i18n";
import useUrlQuery from "../../util/useUrlQuery";
import Select from "../../util/Select"; // searchable <select>
const PAGE_SIZES = [10, 20, 50];

// Date → "YYYY-MM-DDTHH:mm" in the browser's time zone (for <input type="datetime-local">)
function toLocalInput(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "01/10/2026 14:30" (Cambodia time)
export const dateTimeText = (value) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        timeZone: "Asia/Phnom_Penh",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "-";

// ---------------- Image picker (one image) ----------------
function ImagePicker({ value, onChange, disabled }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (value instanceof File) {
      const url = URL.createObjectURL(value);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(value?.url || "");
    return undefined;
  }, [value]);

  return (
    <div className="md-image-picker">
      {preview ? (
        <img className="md-image-preview" src={preview} alt="" />
      ) : (
        <div className="md-image-preview">
          <ImageIcon size={28} />
        </div>
      )}
      <div className="md-image-actions">
        <input
          ref={inputRef}
          className="md-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChange(file);
            e.target.value = "";
          }}
          disabled={disabled}
        />
        <button type="button" className="md-btn md-btn-ghost" onClick={() => inputRef.current?.click()} disabled={disabled}>
          <ImagePlus size={16} />
          {preview ? L("ប្តូររូបភាព", "Change image") : L("ជ្រើសរើសរូបភាព", "Choose image")}
        </button>
        {preview && (
          <button type="button" className="md-btn md-btn-ghost" onClick={() => onChange(null)} disabled={disabled}>
            <X size={14} />
            {L("ដករូបភាពចេញ", "Remove image")}
          </button>
        )}
        <span>{L("jpg, png, webp · អតិបរមា 4MB", "jpg, png, webp · max 4MB")}</span>
      </div>
    </div>
  );
}

// ---------------- Sizes editor: [{ label, price }] ----------------
function SizesEditor({ value, onChange, disabled }) {
  const rows = Array.isArray(value) && value.length ? value : [{ label: "", price: "" }];
  const update = (i, key, v) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));

  return (
    <div className="md-sizes">
      {rows.map((row, i) => (
        <div className="md-size-row" key={i}>
          <input placeholder={L("ទំហំ ឧ. S", "Size e.g. S")} value={row.label} onChange={(e) => update(i, "label", e.target.value)} disabled={disabled} />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder={L("តម្លៃ $", "Price $")}
            value={row.price}
            onChange={(e) => update(i, "price", e.target.value)}
            disabled={disabled}
          />
          <button
            type="button"
            className="md-icon-btn md-icon-btn-danger"
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
            disabled={disabled || rows.length === 1}
            title={L("លុប", "Delete")}
          >
            <X size={15} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="md-btn md-btn-ghost"
        style={{ width: "fit-content" }}
        onClick={() => onChange([...rows, { label: "", price: "" }])}
        disabled={disabled}
      >
        <Plus size={14} />
        {L("បន្ថែមទំហំ", "Add size")}
      </button>
    </div>
  );
}

// ---------------- Rows editor: [{ ...row }] with typed columns ----------------
// field: { type: "rows", columns: [{ key, label, placeholder, type: "text" | "color" | "number" | "time", width }], newRow: () => ({}) }
function RowsEditor({ field, value, onChange, disabled }) {
  const rows = Array.isArray(value) ? value : [];
  const cols = field.columns || [];
  const update = (i, key, v) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const template = cols.map((c) => c.width || "1fr").join(" ") + " 64px";

  return (
    <div className="md-rows">
      {rows.length > 0 && (
        <div className="md-rows-head" style={{ gridTemplateColumns: template }}>
          {cols.map((c) => (
            <span key={c.key}>{c.label}</span>
          ))}
          <span />
        </div>
      )}
      {rows.map((row, i) => (
        <div className="md-rows-row" key={row._id || i} style={{ gridTemplateColumns: template }}>
          {cols.map((c) =>
            c.type === "color" ? (
              <label key={c.key} className="md-rows-color">
                <input
                  type="color"
                  value={row[c.key] || "#ffffff"}
                  onChange={(e) => update(i, c.key, e.target.value.toUpperCase())}
                  disabled={disabled}
                />
                <input
                  type="text"
                  placeholder="#RRGGBB"
                  value={row[c.key] || ""}
                  onChange={(e) => update(i, c.key, e.target.value)}
                  disabled={disabled}
                />
              </label>
            ) : (
              <input
                key={c.key}
                type={c.type === "number" ? "number" : c.type === "time" ? "time" : "text"}
                placeholder={c.placeholder || c.label}
                value={row[c.key] ?? ""}
                onChange={(e) => update(i, c.key, e.target.value)}
                disabled={disabled}
              />
            ),
          )}
          <div className="md-rows-actions">
            <button type="button" className="md-icon-btn" onClick={() => move(i, -1)} disabled={disabled || i === 0} title="↑">
              <ChevronLeft size={14} style={{ transform: "rotate(90deg)" }} />
            </button>
            <button
              type="button"
              className="md-icon-btn md-icon-btn-danger"
              onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
              disabled={disabled}
              title={L("លុប", "Delete")}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="md-btn md-btn-ghost"
        style={{ width: "fit-content" }}
        onClick={() => onChange([...rows, field.newRow ? field.newRow(rows) : {}])}
        disabled={disabled}
      >
        <Plus size={14} />
        {field.addLabel || L("បន្ថែមជួរ", "Add row")}
      </button>
    </div>
  );
}

/**
 * Shared list + create/edit/delete page for inventory_pos_api resources.
 *
 * props:
 *   title      - Khmer name of the record, used in buttons and messages
 *   service    - resource from api.service.js (list, create, update, remove)
 *   fields     - form fields: { key, label, type: "text" | "email" | "tel" | "password" | "number" | "time" | "textarea"
 *                  | "select" | "multiselect" | "checkbox" | "image" | "sizes", required, options, placeholder, default,
 *                  createOnly (hidden when editing), full (spans the whole row in wide forms),
 *                  showIf(form) (only shown/sent when true), folder (image upload folder),
 *                  options can also be a function (form) => options (e.g. sections of the chosen category) }
 *   columns    - table columns: { key, label, render?(row) }
 *   searchKeys - fields searched by the keyword box (sent as q_key)
 *   filters    - optional selects in the toolbar: { key, label, options: [{ value, label }] } → sent as list params
 *   listParams - optional fixed list params (e.g. { sort: "sort_order", order: "asc" })
 *   sendAsForm - send create/update as FormData (files included) instead of JSON
 *   canEdit    - false hides create / edit / delete (view only)
 *   onSaved    - optional callback after create/update/delete (e.g. reload select options)
 *   getName    - optional (row) => text shown in the delete confirmation (default: row.name)
 *   extraActions - optional (row, reload) => extra buttons rendered in the actions column
 *   canDelete  - optional (row) => false hides the delete button for that row
 *   canEditRow - optional (row) => false hides the edit button for that row (e.g. locked history)
 *   field type "datetime" → <input type="datetime-local">, sent to the API as an ISO date
 *   hideStatus - hide the active / inactive switch
 *   wide       - wider two-column form (for records with many fields)
 */
function MasterDataPage({
  title,
  service,
  fields,
  columns,
  searchKeys,
  filters = [],
  listParams,
  sendAsForm,
  canEdit = true,
  onSaved,
  getName,
  extraActions,
  canDelete,
  canEditRow,
  hideStatus,
  wide,
}) {
  const emptyForm = () =>
    fields.reduce(
      (acc, f) => {
        if (f.default !== undefined) acc[f.key] = f.default;
        else if (f.type === "checkbox") acc[f.key] = false;
        else if (f.type === "image") acc[f.key] = null;
        else if (f.type === "sizes") acc[f.key] = [{ label: "", price: "" }];
        else if (f.type === "multiselect") acc[f.key] = [];
        else if (f.type === "rows") acc[f.key] = [];
        else acc[f.key] = "";
        return acc;
      },
      { status: true },
    );

  // ---------------- List state ----------------
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZES[0]);
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  useUrlQuery(setKeyword); // ?q= from the global search
  const [filterValues, setFilterValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [notice, setNotice] = useState(null);

  // ---------------- Form state ----------------
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const listParamsKey = JSON.stringify(listParams || {});
  const filterKey = JSON.stringify(filterValues);

  // Pages are cached (api.client.js): a page seen in the last 5 min shows at once, then refreshes quietly;
  // the next page is loaded in the background so "next" is instant.
  const loadSeq = useRef(0);
  const loadData = useCallback(async () => {
    const seq = ++loadSeq.current;
    const apply = (res) => {
      if (seq !== loadSeq.current) return; // an older answer — the user already moved on
      setRows(res.data || []);
      setPagination(res.pagination || { total: 0, totalPages: 1 });
    };
    const params = {
      ...JSON.parse(listParamsKey),
      ...JSON.parse(filterKey),
      page,
      limit,
      q: search,
      q_key: search ? searchKeys : undefined,
    };
    setLoading(true);
    setListError("");
    try {
      const res = await service.list(params, { onFresh: apply });
      apply(res);
      if (page < (res.pagination?.totalPages || 1)) service.list({ ...params, page: page + 1 }, { prefetch: true });
    } catch (err) {
      setListError(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [service, page, limit, search, searchKeys, listParamsKey, filterKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Debounce the search box
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setSearch(keyword.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [keyword]);

  // ---------------- Actions ----------------
  const openCreate = () => {
    setEditing(null);
    const base = emptyForm();
    // pre-select the filtered value (e.g. current category) in a new record
    filters.forEach((flt) => {
      if (filterValues[flt.key] && base[flt.key] === "") base[flt.key] = filterValues[flt.key];
    });
    setForm(base);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (row) => {
    const values = fields.reduce((acc, f) => {
      const value = row[f.key];
      if (f.type === "checkbox") acc[f.key] = !!value;
      else if (f.type === "multiselect")
        acc[f.key] = Array.isArray(value) ? value.map((v) => String(v && typeof v === "object" ? v._id : v)) : [];
      else if (f.type === "image") acc[f.key] = value?.url ? value : null;
      else if (f.type === "sizes")
        acc[f.key] = Array.isArray(value) && value.length ? value.map((s) => ({ ...s })) : [{ label: "", price: "" }];
      else if (f.type === "date") acc[f.key] = value ? String(value).slice(0, 10) : "";
      else if (f.type === "datetime") acc[f.key] = value ? toLocalInput(value) : "";
      else if (f.type === "rows") acc[f.key] = Array.isArray(value) ? value.map((r) => ({ ...r })) : [];
      // populated references come back as objects
      else acc[f.key] = value && typeof value === "object" ? value._id : value ?? "";
      return acc;
    }, {});
    setEditing(row);
    setForm({ ...values, status: row.status !== false });
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isVisible = (f) => !(editing && f.createOnly) && (!f.showIf || f.showIf(form));

  // Build the request body from the form
  const buildPayload = async () => {
    const payload = { status: form.status };

    for (const f of fields) {
      if (!isVisible(f)) continue;
      let value = form[f.key];

      if (f.type === "select" && !value) value = null; // the API can't store "" as an ObjectId
      if (f.type === "number") value = value === "" || value === null ? null : Number(value);
      if (f.type === "datetime") value = value ? new Date(value).toISOString() : null;
      if (f.type === "rows") {
        // drop rows where every column is empty; numbers → Number
        value = (value || [])
          .filter((r) => (f.columns || []).some((c) => String(r[c.key] ?? "").trim() !== ""))
          .map((r, i) => {
            const out = { ...r, sort_order: i };
            (f.columns || []).forEach((c) => {
              if (c.type === "number") out[c.key] = r[c.key] === "" ? null : Number(r[c.key]);
              else if (typeof r[c.key] === "string") out[c.key] = r[c.key].trim() || (c.type === "color" ? null : "");
            });
            return out;
          });
      }
      if (f.type === "sizes") {
        value = (value || [])
          .filter((s) => String(s.label).trim() || s.price !== "")
          .map((s) => ({ label: String(s.label).trim(), price: Number(s.price) }));
      }
      if (f.type === "image") {
        // unchanged image → don't send it
        if (editing && value && !(value instanceof File) && value.url === editing[f.key]?.url) continue;
        // new file, JSON mode → upload first, then save the returned image object
        if (value instanceof File && !sendAsForm) {
          const fd = new FormData();
          fd.append("files", value);
          fd.append("folder", f.folder || "others");
          const res = await uploadService.upload(fd);
          value = res.data?.[0] || null;
        }
        // removed
        if (!value) {
          if (!editing || !editing[f.key]) continue;
          value = null;
        }
      }
      payload[f.key] = value;
    }

    if (hideStatus) delete payload.status;
    if (!sendAsForm) return payload;

    // FormData: files as files, objects/arrays as JSON text, null as ""
    const fd = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value instanceof File) fd.append(key, value);
      else if (value === null || value === undefined) fd.append(key, "");
      else if (typeof value === "object") fd.append(key, JSON.stringify(value));
      else fd.append(key, String(value));
    });
    return fd;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const missing = fields.filter(isVisible).find((f) => {
      if (!f.required || f.type === "checkbox") return false;
      if (f.type === "image") return !form[f.key];
      if (f.type === "sizes") return !(form[f.key] || []).some((s) => String(s.label).trim() && s.price !== "");
      if (f.type === "multiselect") return !(form[f.key] || []).length;
      if (f.type === "rows") return !(form[f.key] || []).length;
      return !String(form[f.key] ?? "").trim();
    });
    if (missing) {
      setFormError(L(`សូមបញ្ចូល ${missing.label}`, `Please enter ${missing.label}`));
      return;
    }

    setSaving(true);
    try {
      const payload = await buildPayload();
      const res = editing ? await service.update(editing._id, payload) : await service.create(payload);
      setNotice({ type: "success", text: res.message || L("បានរក្សាទុក!", "Saved!") });
      setModalOpen(false);
      if (!editing) setPage(1);
      await loadData();
      onSaved && onSaved();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await service.remove(deleting._id);
      setNotice({ type: "success", text: res.message || L("បានលុប!", "Deleted!") });
      setDeleting(null);
      // step back a page when the last row of a page is removed
      if (rows.length === 1 && page > 1) setPage(page - 1);
      else await loadData();
      onSaved && onSaved();
    } catch (err) {
      setNotice({ type: "error", text: err.message });
      setDeleting(null);
    } finally {
      setSaving(false);
    }
  };

  // ---------------- Render helpers ----------------
  const totalPages = Math.max(pagination.totalPages || 1, 1);
  const startIndex = (page - 1) * limit;

  const renderField = (f) => {
    const common = {
      id: f.key,
      name: f.key,
      value: form[f.key] ?? "",
      onChange: (e) => handleChange(f.key, e.target.value),
      disabled: saving,
    };

    if (f.type === "textarea") {
      return <textarea rows={3} placeholder={f.placeholder} {...common} />;
    }

    if (f.type === "select") {
      const all = typeof f.options === "function" ? f.options(form) : f.options || [];
      const options = all.filter((opt) => !editing || opt.value !== editing._id);
      return (
        <Select {...common}>
          {!f.noEmpty && <option value="">{f.placeholder || L("-- ជ្រើសរើស --", "-- Choose --")}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      );
    }

    if (f.type === "checkbox") {
      return (
        <label className="md-switch">
          <input
            type="checkbox"
            checked={!!form[f.key]}
            onChange={(e) => handleChange(f.key, e.target.checked)}
            disabled={saving}
          />
          <span className="md-switch-track" />
          {form[f.key] ? f.onLabel || L("បាទ/ចាស", "Yes") : f.offLabel || L("ទេ", "No")}
        </label>
      );
    }

    if (f.type === "image") {
      return <ImagePicker value={form[f.key]} onChange={(v) => handleChange(f.key, v)} disabled={saving} />;
    }

    if (f.type === "multiselect") {
      const all = typeof f.options === "function" ? f.options(form) : f.options || [];
      const selected = form[f.key] || [];
      const toggle = (v) =>
        handleChange(f.key, selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
      return (
        <div className="md-chips">
          {all.length === 0 && <span className="md-chips-empty">{f.emptyText || L("មិនទាន់មានជម្រើស", "No options yet")}</span>}
          {all.map((opt) => {
            const on = selected.includes(String(opt.value));
            return (
              <button
                key={opt.value}
                type="button"
                className={`md-chip ${on ? "on" : ""}`}
                onClick={() => toggle(String(opt.value))}
                disabled={saving}
                aria-pressed={on}
              >
                <span className="md-chip-box">{on ? "✓" : ""}</span>
                {opt.label}
              </button>
            );
          })}
        </div>
      );
    }

    if (f.type === "rows") {
      return <RowsEditor field={f} value={form[f.key]} onChange={(v) => handleChange(f.key, v)} disabled={saving} />;
    }

    if (f.type === "sizes") {
      return <SizesEditor value={form[f.key]} onChange={(v) => handleChange(f.key, v)} disabled={saving} />;
    }

    if (f.type === "number") {
      return <input type="number" min="0" step={f.step || "0.01"} placeholder={f.placeholder} {...common} />;
    }

    if (f.type === "time") {
      return <input type="time" {...common} />;
    }

    const inputType =
      f.type === "datetime" ? "datetime-local" : ["email", "tel", "password", "date"].includes(f.type) ? f.type : "text";
    return (
      <input
        type={inputType}
        placeholder={f.placeholder}
        autoComplete={inputType === "password" ? "new-password" : "off"}
        {...common}
      />
    );
  };

  const visibleFields = fields.filter(isVisible);
  const colSpan = columns.length + 2;

  return (
    <div className="md-page">
      {notice && <div className={`md-notice md-notice-${notice.type}`}>{notice.text}</div>}

      {/* ===== Toolbar ===== */}
      <div className="md-toolbar">
        <div className="md-toolbar-left">
          <div className="md-search">
            <Search size={16} />
            <input type="text" placeholder={L("ស្វែងរក...", "Search...")} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            {keyword && (
              <button type="button" onClick={() => setKeyword("")} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>

          {filters.map((flt) => (
            <Select
              key={flt.key}
              className="md-filter"
              value={filterValues[flt.key] || ""}
              onChange={(e) => {
                setPage(1);
                setFilterValues((prev) => ({ ...prev, [flt.key]: e.target.value }));
              }}
              title={flt.label}
            >
              <option value="">{flt.label}</option>
              {(flt.options || []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          ))}
        </div>

        <div className="md-toolbar-actions">
          <button type="button" className="md-btn md-btn-ghost" onClick={loadData} disabled={loading} title={L("ផ្ទុកឡើងវិញ", "Reload")}>
            <RefreshCw size={16} className={loading ? "md-spin" : ""} />
          </button>
          {canEdit && (
            <button type="button" className="md-btn md-btn-primary" onClick={openCreate}>
              <Plus size={16} />
              {L(`បង្កើត${title}`, "Add new")}
            </button>
          )}
        </div>
      </div>

      {/* ===== Table ===== */}
      <div className="md-card">
        <div className="md-table-scroll">
          <table className="md-table">
            <thead>
              <tr>
                <th className="md-col-no">{L("ល.រ", "No.")}</th>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th className="md-col-actions">{L("សកម្មភាព", "Activity")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="md-empty">
                    {L("កំពុងផ្ទុកទិន្នន័យ...", "Loading data...")}
                  </td>
                </tr>
              )}

              {!loading && listError && (
                <tr>
                  <td colSpan={colSpan} className="md-empty md-empty-error">
                    {listError}
                  </td>
                </tr>
              )}

              {!loading && !listError && rows.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="md-empty">
                    {search ? L("រកមិនឃើញទិន្នន័យដែលត្រូវនឹងការស្វែងរក", "Nothing matches your search") : L("មិនទាន់មានទិន្នន័យ", "No data yet")}
                  </td>
                </tr>
              )}

              {rows.map((row, i) => (
                <tr key={row._id}>
                  <td className="md-col-no">{startIndex + i + 1}</td>
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(row) : row[c.key] || "-"}</td>
                  ))}
                  <td className="md-col-actions">
                    {extraActions && extraActions(row, loadData)}
                    {canEdit && (!canEditRow || canEditRow(row)) && (
                      <button type="button" className="md-icon-btn" onClick={() => openEdit(row)} title={L("កែប្រែ", "Edit")}>
                        <Pencil size={15} />
                      </button>
                    )}
                    {canEdit && (!canDelete || canDelete(row)) && (
                      <button
                        type="button"
                        className="md-icon-btn md-icon-btn-danger"
                        onClick={() => setDeleting(row)}
                        title={L("លុប", "Delete")}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ===== Pagination ===== */}
        <div className="md-pagination">
          <div className="md-page-size">
            {L("បង្ហាញ", "Show")}
            <Select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
            {L("/ សរុប", "/ total")} {pagination.total || 0}
          </div>

          <div className="md-pager">
            <button
              type="button"
              className="md-icon-btn"
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              {L("ទំព័រ", "Page")} {page} / {totalPages}
            </span>
            <button
              type="button"
              className="md-icon-btn"
              disabled={page >= totalPages || loading}
              onClick={() => setPage(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ===== Create / Edit modal ===== */}
      {modalOpen && (
        <div className="md-modal-backdrop" onMouseDown={closeModal}>
          <form
            className={`md-modal ${wide ? "md-modal-wide" : ""}`}
            onSubmit={handleSubmit}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="md-modal-header">
              <h3>{editing ? L(`កែប្រែ${title}`, `Edit — ${title}`) : L(`បង្កើត${title}ថ្មី`, `New — ${title}`)}</h3>
              <button type="button" className="md-icon-btn" onClick={closeModal} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="md-modal-body">
              <div className={wide ? "md-fields md-fields-grid" : "md-fields"}>
                {visibleFields.map((f) => (
                  <div
                    key={f.key}
                    className={`md-field ${
                      f.full || ["textarea", "image", "sizes", "multiselect"].includes(f.type) ? "md-field-full" : ""
                    }`}
                  >
                    <label htmlFor={f.key}>
                      {f.label}
                      {f.required && <span className="md-required">*</span>}
                    </label>
                    {renderField(f)}
                    {f.hint && <span className="md-sub">{f.hint}</span>}
                  </div>
                ))}
              </div>

              {!hideStatus && (
                <label className="md-switch">
                  <input
                    type="checkbox"
                    checked={!!form.status}
                    onChange={(e) => handleChange("status", e.target.checked)}
                    disabled={saving}
                  />
                  <span className="md-switch-track" />
                  {form.status ? L("សកម្ម (ប្រើប្រាស់)", "Active (in use)") : L("អសកម្ម (លាក់)", "Inactive (hidden)")}
                </label>
              )}

              {formError && <div className="md-form-error">{formError}</div>}
            </div>

            <div className="md-modal-footer">
              <button type="button" className="md-btn md-btn-ghost" onClick={closeModal} disabled={saving}>
                {L("បោះបង់", "Cancel")}
              </button>
              <button type="submit" className="md-btn md-btn-primary" disabled={saving}>
                {saving ? L("កំពុងរក្សាទុក...", "Saving...") : L("រក្សាទុក", "Save")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===== Delete confirm ===== */}
      {deleting && (
        <div className="md-modal-backdrop" onMouseDown={() => !saving && setDeleting(null)}>
          <div className="md-modal md-modal-sm" onMouseDown={(e) => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>{L("លុប", "Delete")}{title}</h3>
            </div>
            <div className="md-modal-body">
              <p>
                {L("តើអ្នកពិតជាចង់លុប", "Do you really want to delete")} <strong>{getName ? getName(deleting) : deleting.name}</strong> {L("មែនទេ?", "?")}
              </p>
            </div>
            <div className="md-modal-footer">
              <button type="button" className="md-btn md-btn-ghost" onClick={() => setDeleting(null)} disabled={saving}>
                {L("បោះបង់", "Cancel")}
              </button>
              <button type="button" className="md-btn md-btn-danger" onClick={confirmDelete} disabled={saving}>
                {saving ? L("កំពុងលុប...", "Deleting...") : L("លុប", "Delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Small helpers for table cells
export const imageCell = (image, wide) =>
  image?.url ? (
    <img className={`md-thumb ${wide ? "md-thumb-wide" : ""}`} src={image.url} alt="" loading="lazy" />
  ) : (
    <span className={`md-thumb ${wide ? "md-thumb-wide" : ""}`}>
      <ImageIcon size={18} />
    </span>
  );

export const statusCell = (row) => (
  <span className={`md-badge ${row.status !== false ? "md-badge-on" : "md-badge-off"}`}>
    {row.status !== false ? L("សកម្ម", "Active") : L("អសកម្ម", "Inactive")}
  </span>
);

export const money = (v) => `$${Number(v || 0).toFixed(2)}`;

export default MasterDataPage;
