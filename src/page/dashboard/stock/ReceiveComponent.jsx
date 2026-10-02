import React from "react";
import { receiveService, supplierService } from "../../../api/api.service";
import StockDocPage, { STATE_OPTIONS } from "./StockDocPage";
import { canManageStock, nameKh, usd } from "./stockOptions";
import { L } from "../../../i18n";
import Select from "../../util/Select"; // searchable <select>

// Goods from a supplier into the central warehouse (agreed: central only)
function ReceiveComponent() {
  const manage = canManageStock();
  const config = {
    service: receiveService,
    printType: "receive",
    docLabel: L("ទទួលទំនិញ", "Goods receive"),
    createLabel: L("ទទួលទំនិញថ្មី", "New goods receive"),
    canCreate: manage,
    loadCtx: async () => ({ suppliers: (await supplierService.all()).data || [] }),
    defaults: (ctx) => ({ warehouse_id: ctx.warehouses.find((w) => w.type === "central")?._id || "", supplier_id: "", supplier_invoice_no: "" }),
    Header: ({ form, set, ctx, disabled }) => (
      <>
        <div className="md-field">
          <label>{L("ឃ្លាំងកណ្តាល", "Central warehouse")}<span className="md-required">*</span></label>
          <Select className="pe-input" value={form.warehouse_id || ""} onChange={(e) => set({ warehouse_id: e.target.value })} disabled={disabled}>
            {ctx.warehouses.filter((w) => w.type === "central").map((w) => (
              <option key={w._id} value={w._id}>{nameKh(w)} ({w.code})</option>
            ))}
          </Select>
        </div>
        <div className="md-field">
          <label>{L("អ្នកផ្គត់ផ្គង់", "Supplier")}<span className="md-required">*</span></label>
          <Select className="pe-input" value={form.supplier_id || ""} onChange={(e) => set({ supplier_id: e.target.value })} disabled={disabled}>
            <option value="">{L("-- ជ្រើសរើស --", "-- Choose --")}</option>
            {(ctx.suppliers || []).map((s) => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </Select>
        </div>
        <div className="md-field">
          <label>{L("លេខវិក្កយបត្រអ្នកផ្គត់ផ្គង់", "Supplier invoice no")}</label>
          <input className="pe-input" value={form.supplier_invoice_no || ""} onChange={(e) => set({ supplier_invoice_no: e.target.value })} disabled={disabled} />
        </div>
      </>
    ),
    validate: (f) => (!f.warehouse_id ? L("សូមជ្រើសរើសឃ្លាំង", "Choose a warehouse") : !f.supplier_id ? L("សូមជ្រើសរើសអ្នកផ្គត់ផ្គង់", "Choose a supplier") : null),
    payload: (f) => ({ warehouse_id: f.warehouse_id, supplier_id: f.supplier_id, supplier_invoice_no: f.supplier_invoice_no }),
    cost: () => "required",
    batchIn: () => true,
    columns: [
      { label: L("អ្នកផ្គត់ផ្គង់", "Supplier"), render: (d) => d.supplier_id?.name || "-" },
      { label: L("វិក្កយបត្រ", "Invoice"), render: (d) => d.supplier_invoice_no || <span className="md-sub">-</span> },
      { label: L("ជួរ", "Lines"), render: (d) => d.items.length },
      { label: L("សរុប", "Total"), render: (d) => <b>{usd(d.total_cost)}</b> },
    ],
    filters: [
      { key: "state", label: L("-- ស្ថានភាពទាំងអស់ --", "-- All status --"), options: STATE_OPTIONS(["draft", "posted", "cancelled"]) },
      { key: "supplier_id", label: L("-- អ្នកផ្គត់ផ្គង់ទាំងអស់ --", "-- All suppliers --"), options: (ctx) => (ctx.suppliers || []).map((s) => ({ value: s._id, label: s.name })) },
    ],
    canEdit: (d) => manage && d.state === "draft",
    canPost: (d) => manage && d.state === "draft",
    hasPost: true,
    postOnSave: () => manage,
    info: (d) => [
      [L("ឃ្លាំង", "Warehouse"), `${nameKh(d.warehouse_id)} (${d.warehouse_id?.code})`],
      [L("អ្នកផ្គត់ផ្គង់", "Supplier"), d.supplier_id?.name || "-"],
      [L("វិក្កយបត្រ", "Invoice"), d.supplier_invoice_no || "-"],
      [L("សរុប", "Total"), usd(d.total_cost)],
    ],
  };
  return <StockDocPage config={config} />;
}

export default ReceiveComponent;
