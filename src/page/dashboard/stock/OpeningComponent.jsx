import React, { useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { readSheet } from "read-excel-file/browser";
import writeExcelFile from "write-excel-file/browser";
import { openingService, variantService } from "../../../api/api.service";
import StockDocPage, { STATE_OPTIONS } from "./StockDocPage";
import { canManageStock, nameKh, qtyText, usd } from "./stockOptions";
import { L } from "../../../i18n";

const COLS = ["SKU", "Name", "Unit", "Qty", "Unit cost (USD)", "Batch no", "Expiry (YYYY-MM-DD)"];

// Excel: one sheet, header row = COLS. Template lists every active SKU with its base unit.
async function downloadTemplate() {
  const rows = [];
  for (let page = 1; page < 50; page++) {
    const res = await variantService.list({ page, limit: 200, status: "true", sort: "code", order: "asc" });
    rows.push(...(res.data || []));
    if (page >= (res.pagination?.totalPages || 1)) break;
  }
  const header = COLS.map((c) => ({ value: c, fontWeight: "bold", backgroundColor: "#E7F3EC" }));
  const data = rows.map((v) => [v.code, `${v.name_en || v.name_kh}`, v.product_id?.base_unit_id?.code || "", null, null, v.product_id?.track_batch ? "" : null, v.product_id?.track_batch ? "" : null]);
  await writeExcelFile([header, ...data], { columns: [{ width: 26 }, { width: 44 }, { width: 8 }, { width: 8 }, { width: 14 }, { width: 14 }, { width: 18 }] }).toFile("opening-stock-template.xlsx");
}

function ImportDialog({ api, onClose }) {
  const fileRef = useRef(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const readFile = async (file) => {
    setError("");
    try {
      const data = await readSheet(file);
      const head = (data[0] || []).map((h) => String(h || "").trim().toLowerCase());
      const col = (name) => head.findIndex((h) => h.startsWith(name.toLowerCase()));
      const c = { sku: col("sku"), unit: col("unit"), qty: col("qty"), cost: col("unit cost"), batch: col("batch"), exp: col("expiry") };
      if (c.sku < 0 || c.qty < 0) throw new Error(L("រកមិនឃើញជួរឈរ SKU / Qty — សូមប្រើ Template", "SKU / Qty columns not found — please use the template"));
      const items = data
        .slice(1)
        .filter((r) => r[c.sku] && Number(r[c.qty]) > 0)
        .map((r) => {
          const exp = c.exp >= 0 ? r[c.exp] : null;
          return {
            sku: String(r[c.sku]).trim(),
            unit: c.unit >= 0 && r[c.unit] ? String(r[c.unit]).trim() : undefined,
            qty: Number(r[c.qty]),
            unit_cost: c.cost >= 0 && r[c.cost] !== null && r[c.cost] !== "" ? Number(r[c.cost]) : undefined,
            batch_no: c.batch >= 0 && r[c.batch] ? String(r[c.batch]).trim() : undefined,
            expiry_date: exp ? (exp instanceof Date ? exp.toISOString().slice(0, 10) : String(exp).trim()) : undefined,
          };
        });
      if (!items.length) throw new Error(L("មិនមានជួរដែលមានចំនួន > 0", "No rows with qty > 0"));
      setRows(items);
    } catch (err) {
      setRows(null);
      setError(err.message);
    }
  };

  const create = async () => {
    if (!warehouseId) return setError(L("សូមជ្រើសរើសឃ្លាំង", "Choose a warehouse"));
    setBusy(true);
    setError("");
    try {
      const res = await openingService.create({ warehouse_id: warehouseId, items: rows, note: L("នាំចូលពី Excel", "Imported from Excel") });
      api.notify("success", res.message);
      api.reload();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const total = rows ? rows.reduce((t, r) => t + r.qty * (r.unit_cost || 0), 0) : 0;
  return (
    <div className="md-modal-backdrop" onMouseDown={() => !busy && onClose()}>
      <div className="md-modal md-modal-wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="md-modal-header">
          <h3>{L("នាំចូលស្តុកដើមគ្រាពី Excel", "Import opening stock from Excel")}</h3>
          <button type="button" className="md-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="md-modal-body">
          <ol className="sd-steps">
            <li>{L("ទាញយក Template (មាន SKU ទាំងអស់)", "Download the template (all SKUs listed)")} <button type="button" className="md-btn md-btn-ghost" onClick={() => downloadTemplate().catch((e) => setError(e.message))}><Download size={15} />Template .xlsx</button></li>
            <li>{L("បំពេញ Qty, ថ្លៃដើម, Batch និងថ្ងៃផុតកំណត់ (ទំនិញ Batch)។ ជួរដែល Qty ទទេនឹងរំលង។", "Fill Qty, unit cost, and batch + expiry for batch items. Rows without Qty are skipped.")}</li>
            <li>{L("ជ្រើសឃ្លាំង និងឯកសារ → បង្កើតជាសេចក្តីព្រាង → ពិនិត្យ → Post", "Choose the warehouse and the file → a draft is created → review → Post")}</li>
          </ol>
          <div className="md-fields md-fields-grid">
            <div className="md-field">
              <label>{L("ឃ្លាំង", "Warehouse")}<span className="md-required">*</span></label>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">{L("-- ជ្រើសរើស --", "-- Choose --")}</option>
                {api.ctx.warehouses.map((w) => (
                  <option key={w._id} value={w._id}>{nameKh(w)} ({w.code})</option>
                ))}
              </select>
            </div>
            <div className="md-field">
              <label>{L("ឯកសារ Excel", "Excel file")}<span className="md-required">*</span></label>
              <input ref={fileRef} type="file" hidden accept=".xlsx" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
              <button type="button" className="md-btn md-btn-ghost" onClick={() => fileRef.current?.click()}><Upload size={15} />{L("ជ្រើសរើសឯកសារ .xlsx", "Choose .xlsx file")}</button>
            </div>
          </div>
          {rows && (
            <div className="sd-import-sum">
              <b>{L(`${rows.length} ជួរ`, `${rows.length} rows`)}</b> · {L("ចំនួនសរុប", "total qty")} {qtyText(rows.reduce((t, r) => t + r.qty, 0))} · {L("តម្លៃ", "value")} {usd(total)}
              <span className="md-sub">{rows.slice(0, 4).map((r) => r.sku).join(", ")}{rows.length > 4 ? " …" : ""}</span>
            </div>
          )}
          {error && <div className="md-form-error">{error}</div>}
        </div>
        <div className="md-modal-footer">
          <button type="button" className="md-btn md-btn-ghost" onClick={onClose} disabled={busy}>{L("បោះបង់", "Cancel")}</button>
          <button type="button" className="md-btn md-btn-primary" onClick={create} disabled={busy || !rows}>{busy ? "…" : L("បង្កើតសេចក្តីព្រាង", "Create draft")}</button>
        </div>
      </div>
    </div>
  );
}

function OpeningComponent() {
  const manage = canManageStock();
  const [importing, setImporting] = useState(null);
  const config = {
    service: openingService,
    docLabel: L("ស្តុកដើមគ្រា", "Opening stock"),
    createLabel: L("បញ្ចូលស្តុកដើមគ្រា", "New opening stock"),
    canCreate: manage,
    defaults: () => ({ warehouse_id: "" }),
    Header: ({ form, set, ctx, disabled }) => (
      <div className="md-field">
        <label>{L("ឃ្លាំង", "Warehouse")}<span className="md-required">*</span></label>
        <select className="pe-input" value={form.warehouse_id || ""} onChange={(e) => set({ warehouse_id: e.target.value })} disabled={disabled}>
          <option value="">{L("-- ជ្រើសរើស --", "-- Choose --")}</option>
          {ctx.warehouses.map((w) => (
            <option key={w._id} value={w._id}>{nameKh(w)} ({w.code})</option>
          ))}
        </select>
      </div>
    ),
    validate: (f) => (!f.warehouse_id ? L("សូមជ្រើសរើសឃ្លាំង", "Choose a warehouse") : null),
    payload: (f) => ({ warehouse_id: f.warehouse_id }),
    cost: () => "required",
    batchIn: () => true,
    columns: [
      { label: L("ឃ្លាំង", "Warehouse"), render: (d) => `${nameKh(d.warehouse_id)} (${d.warehouse_id?.code})` },
      { label: L("ជួរ", "Lines"), render: (d) => d.items.length },
      { label: L("តម្លៃ", "Value"), render: (d) => usd(d.total_cost) },
    ],
    filters: [{ key: "state", label: L("-- ស្ថានភាពទាំងអស់ --", "-- All status --"), options: STATE_OPTIONS(["draft", "posted", "cancelled"]) }],
    canEdit: (d) => manage && d.state === "draft",
    canPost: (d) => manage && d.state === "draft",
    hasPost: true,
    postOnSave: () => manage,
    info: (d) => [[L("ឃ្លាំង", "Warehouse"), `${nameKh(d.warehouse_id)} (${d.warehouse_id?.code})`]],
    toolbarExtra: (api) =>
      manage && (
        <button type="button" className="md-btn md-btn-ghost" onClick={() => setImporting(api)}>
          <Upload size={16} />
          {L("នាំចូល Excel", "Import Excel")}
        </button>
      ),
  };
  return (
    <>
      <StockDocPage config={config} />
      {importing && <ImportDialog api={importing} onClose={() => setImporting(null)} />}
    </>
  );
}

export default OpeningComponent;
