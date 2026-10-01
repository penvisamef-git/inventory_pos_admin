import React from "react";
import { adjustmentService } from "../../../api/api.service";
import StockDocPage, { STATE_OPTIONS } from "./StockDocPage";
import { REASONS, canManageStock, isShopUser, labelOf, nameKh, usd } from "./stockOptions";
import { L } from "../../../i18n";
import { usePortal } from "../../portal/portalContext";
import SendTelegramButton from "../telegram/SendTelegram";

const MANUAL = REASONS.filter((r) => !r.system);
const dirOf = (reason) => REASONS.find((r) => r.value === reason)?.dir || "out";
const lineIn = (f, l) => (dirOf(f.reason) === "in" ? true : dirOf(f.reason) === "both" ? Number(l.qty) > 0 : false);

// Shop manager drafts for own shop → admin / central manager posts (agreed)
function AdjustmentComponent() {
  const portal = usePortal();
  const manage = canManageStock();
  const shop = isShopUser();
  const config = {
    toolbarExtra: () => <SendTelegramButton reports={["pending_work"]} warehouseIds={portal ? [portal._id] : []} />,
    service: adjustmentService,
    docLabel: L("កែតម្រូវស្តុក", "Stock adjustment"),
    createLabel: L("កែតម្រូវស្តុក", "New adjustment"),
    canCreate: manage || shop,
    defaults: (ctx) => ({ warehouse_id: shop ? ctx.warehouses[0]?._id || "" : "", reason: "damaged" }),
    portalDefaults: (w) => ({ warehouse_id: w._id }),
    Header: ({ form, set, ctx, disabled, portal }) => (
      <>
        <div className="md-field" hidden={!!portal}>
          <label>{L("ឃ្លាំង", "Warehouse")}<span className="md-required">*</span></label>
          <select className="pe-input" value={form.warehouse_id || ""} onChange={(e) => set({ warehouse_id: e.target.value })} disabled={disabled}>
            <option value="">{L("-- ជ្រើសរើស --", "-- Choose --")}</option>
            {ctx.warehouses.map((w) => (
              <option key={w._id} value={w._id}>{nameKh(w)} ({w.code})</option>
            ))}
          </select>
        </div>
        <div className="md-field">
          <label>{L("មូលហេតុ", "Reason")}<span className="md-required">*</span></label>
          <select className="pe-input" value={form.reason} onChange={(e) => set({ reason: e.target.value })} disabled={disabled}>
            {MANUAL.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <p className="sd-hint">
          {dirOf(form.reason) === "out"
            ? L("ចំនួនដែលបញ្ចូលនឹងត្រូវដកចេញពីស្តុក (ដកតាម Batch ដែលជិតផុតកំណត់មុន)", "Quantities are taken OUT of stock (nearest-expiry batch first)")
            : dirOf(form.reason) === "in"
              ? L("ចំនួនដែលបញ្ចូលនឹងត្រូវបន្ថែមចូលស្តុក (ថ្លៃដើមទទេ = ថ្លៃមធ្យម)", "Quantities are ADDED to stock (empty cost = average cost)")
              : L("+ ចំនួន = បន្ថែម · − ចំនួន = ដកចេញ", "+ qty = add · − qty = take out")}
          {!manage && ` · ${L("ត្រូវការការអនុម័តពីឃ្លាំងកណ្តាល", "needs approval from central")}`}
        </p>
      </>
    ),
    validate: (f) => (!f.warehouse_id ? L("សូមជ្រើសរើសឃ្លាំង", "Choose a warehouse") : null),
    payload: (f) => ({ warehouse_id: f.warehouse_id, reason: f.reason }),
    signed: (f) => f.reason === "other",
    cost: (f) => (dirOf(f.reason) === "out" ? "none" : "optional"),
    batchIn: (f, l) => lineIn(f, l),
    batchOut: (f, l) => !lineIn(f, l),
    stockFrom: (f) => f.warehouse_id || null,
    checkStock: (f, l) => !lineIn(f, l),
    saveLabel: () => (manage ? null : L("រក្សាទុក (រង់ចាំអនុម័ត)", "Save (waits for approval)")),
    columns: [
      { label: L("ឃ្លាំង", "Warehouse"), render: (d) => d.warehouse_id?.code },
      { label: L("មូលហេតុ", "Reason"), render: (d) => <span className={`md-badge ${d.reason === "transfer_shortage" ? "md-badge-danger" : "md-badge-shop"}`}>{labelOf(REASONS, d.reason)}</span> },
      { label: L("ជួរ", "Lines"), render: (d) => d.items.length },
      ...(shop ? [] : [{ label: L("តម្លៃ", "Value"), render: (d) => (d.posted_cost !== null && d.posted_cost !== undefined ? usd(d.posted_cost) : <span className="md-sub">-</span>) }]),
    ],
    filters: [
      { key: "state", label: L("-- ស្ថានភាពទាំងអស់ --", "-- All status --"), options: STATE_OPTIONS(["draft", "posted", "cancelled"]) },
      { key: "reason", label: L("-- មូលហេតុទាំងអស់ --", "-- All reasons --"), options: REASONS },
      { key: "warehouse_id", label: L("-- ឃ្លាំងទាំងអស់ --", "-- All warehouses --"), options: (ctx) => ctx.warehouses.map((w) => ({ value: w._id, label: w.code })) },
    ],
    canEdit: (d) => d.state === "draft" && d.reason !== "transfer_shortage" && (manage || shop),
    canPost: (d) => manage && d.state === "draft",
    hasPost: true,
    postOnSave: () => manage,
    info: (d) => [
      [L("ឃ្លាំង", "Warehouse"), `${nameKh(d.warehouse_id)} (${d.warehouse_id?.code})`],
      [L("មូលហេតុ", "Reason"), labelOf(REASONS, d.reason)],
      ...(d.transfer_id ? [[L("ពីការផ្ទេរ", "From transfer"), d.transfer_id.doc_no]] : []),
    ],
  };
  return <StockDocPage config={config} />;
}

export default AdjustmentComponent;
