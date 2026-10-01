import React, { useState } from "react";
import { Truck, PackageCheck, X, ArrowRight } from "lucide-react";
import { transferService } from "../../../api/api.service";
import { dateTimeText } from "../master_data/MasterDataPage";
import StockDocPage, { STATE_OPTIONS } from "./StockDocPage";
import { canManageStock, isShopUser, myWarehouseIds, nameKh, qtyText, unitLabel, usd, userName } from "./stockOptions";
import { L } from "../../../i18n";
import { usePortal } from "../../portal/portalContext";
import SendTelegramButton from "../telegram/SendTelegram";

const route = (d) => (
  <span className="sd-route">
    <b>{d.warehouse_id?.code}</b>
    <ArrowRight size={14} />
    <b>{d.to_warehouse_id?.code}</b>
  </span>
);

// Shop manager confirms what arrived; less than sent = shortage → written off at once (agreed)
function ReceiveDialog({ doc, api, onClose }) {
  const [qty, setQty] = useState(() => Object.fromEntries(doc.items.map((i) => [i._id, String(i.qty)])));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shortLines = doc.items.filter((i) => Number(qty[i._id]) < i.qty);
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await transferService.receive(doc._id, { items: doc.items.map((i) => ({ _id: i._id, received_qty: Number(qty[i._id]) })), note });
      api.notify("success", res.message);
      api.reload();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="md-modal-backdrop" onMouseDown={() => !busy && onClose()}>
      <div className="md-modal md-modal-wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="md-modal-header">
          <h3>{L("ទទួលទំនិញផ្ទេរ", "Receive transfer")} {doc.doc_no} {route(doc)}</h3>
          <button type="button" className="md-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="md-modal-body">
          <p className="sd-hint">{L("រាប់ទំនិញដែលបានមកដល់។ ចំនួនខ្វះនឹងត្រូវកត់ត្រាជាការខាតបង់ភ្លាមៗ។", "Count what arrived. Any shortage is recorded as a loss right away.")}</p>
          <div className="md-table-scroll pe-variants">
            <table className="md-table">
              <thead>
                <tr>
                  <th>{L("ទំនិញ", "Item")}</th>
                  <th>{L("បានបញ្ជូន", "Sent")}</th>
                  <th>{L("បានទទួល", "Received")}</th>
                </tr>
              </thead>
              <tbody>
                {doc.items.map((i) => {
                  const short = Number(qty[i._id]) < i.qty;
                  return (
                    <tr key={i._id}>
                      <td><b className="sd-item">{L(i.name_kh, i.name_en || i.name_kh)}</b><span className="md-code">{i.sku}</span></td>
                      <td>{qtyText(i.qty)} {unitLabel(i.unit_code, i.unit_name_kh, i.unit_name_en)}</td>
                      <td>
                        <input className={`pe-input pe-num ${short ? "sd-short-input" : ""}`} type="number" min="0" max={i.qty} step="any" value={qty[i._id]} onChange={(e) => setQty((q) => ({ ...q, [i._id]: e.target.value }))} />
                        {short && <span className="sd-short">{L("ខ្វះ", "short")} {qtyText(i.qty - Number(qty[i._id] || 0))}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="md-field">
            <label>{L("កំណត់សម្គាល់", "Note")}</label>
            <input className="pe-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={shortLines.length ? L("ហេតុអ្វីខ្វះ?", "Why is it short?") : ""} />
          </div>
          {error && <div className="md-form-error">{error}</div>}
        </div>
        <div className="md-modal-footer">
          <button type="button" className="md-btn md-btn-ghost" onClick={onClose} disabled={busy}>{L("បោះបង់", "Cancel")}</button>
          <button type="button" className="md-btn md-btn-primary" onClick={submit} disabled={busy}>
            <PackageCheck size={15} />
            {shortLines.length ? L(`បញ្ជាក់ការទទួល (ខ្វះ ${shortLines.length} ជួរ)`, `Confirm (${shortLines.length} short)`) : L("បញ្ជាក់ការទទួល", "Confirm received")}
          </button>
        </div>
      </div>
    </div>
  );
}

function TransferComponent() {
  const portal = usePortal();
  const manage = canManageStock();
  const shop = isShopUser();
  const mine = myWarehouseIds();
  const own = (w) => mine.includes(String(w?._id || w));
  const [receiving, setReceiving] = useState(null);

  const canDispatch = (d) => ["requested", "draft"].includes(d.state) && (manage || (shop && own(d.warehouse_id)));
  const canReceive = (d) => d.state === "dispatched" && (manage || (shop && own(d.to_warehouse_id)));
  const dispatchConfirm = (d, api) =>
    api.setConfirm({
      title: L("បញ្ជូនទំនិញ", "Dispatch"),
      text: L(`បញ្ជូន ${d.doc_no}? ស្តុកនឹងចេញពី ${d.warehouse_id?.code} ហើយស្ថិតក្នុងការដឹកជញ្ជូនរហូតដល់ ${d.to_warehouse_id?.code} ទទួល។ Batch ដែលជិតផុតកំណត់ចេញមុន។`, `Dispatch ${d.doc_no}? Stock leaves ${d.warehouse_id?.code} and stays in transit until ${d.to_warehouse_id?.code} receives it. Nearest-expiry batches go first.`),
      run: () => transferService.dispatch(d._id),
    });
  const openReceive = async (d, api) => {
    try {
      setReceiving({ doc: (await transferService.get(d._id)).data, api });
    } catch (err) {
      api.notify("error", err.message);
    }
  };

  const config = {
    toolbarExtra: () => <SendTelegramButton reports={["pending_work"]} warehouseIds={portal ? [portal._id] : []} />,
    service: transferService,
    docLabel: L("ផ្ទេរស្តុក", "Transfer"),
    createLabel: shop ? L("ស្នើសុំស្តុក", "Request stock") : L("ផ្ទេរស្តុកថ្មី", "New transfer"),
    canCreate: manage || shop,
    defaults: (ctx) =>
      shop
        ? { to_warehouse_id: ctx.warehouses[0]?._id || "" }
        : { warehouse_id: ctx.warehouses.find((w) => w.type === "central")?._id || "", to_warehouse_id: "" },
    // portal: a shop receives into itself (request / from central) · the central warehouse sends out of itself
    portalDefaults: (w, ctx) =>
      w.type === "central"
        ? { warehouse_id: w._id, to_warehouse_id: "" }
        : shop
          ? { to_warehouse_id: w._id }
          : { warehouse_id: ctx.warehouses.find((x) => x.type === "central")?._id || "", to_warehouse_id: w._id },
    Header: ({ form, set, ctx, disabled, editing }) => (
      <>
        {!shop && (
          <div className="md-field">
            <label>{L("ពីឃ្លាំង", "From")}<span className="md-required">*</span></label>
            <select className="pe-input" value={form.warehouse_id || ""} onChange={(e) => set({ warehouse_id: e.target.value })} disabled={disabled}>
              {ctx.warehouses.map((w) => (
                <option key={w._id} value={w._id}>{nameKh(w)} ({w.code})</option>
              ))}
            </select>
          </div>
        )}
        <div className="md-field">
          <label>{L("ទៅឃ្លាំង", "To")}<span className="md-required">*</span></label>
          <select className="pe-input" value={form.to_warehouse_id || ""} onChange={(e) => set({ to_warehouse_id: e.target.value })} disabled={disabled}>
            <option value="">{L("-- ជ្រើសរើស --", "-- Choose --")}</option>
            {ctx.warehouses.filter((w) => String(w._id) !== String(form.warehouse_id)).map((w) => (
              <option key={w._id} value={w._id}>{nameKh(w)} ({w.code})</option>
            ))}
          </select>
        </div>
        {shop && <p className="sd-hint">{L("ស្នើសុំពីឃ្លាំងកណ្តាល។ ឃ្លាំងកណ្តាលអាចកែចំនួនមុនពេលបញ្ជូន។", "Requested from the central warehouse. Central may change the quantities before dispatch.")}</p>}
      </>
    ),
    validate: (f) => (!shop && !f.warehouse_id ? L("សូមជ្រើសឃ្លាំងចេញ", "Choose FROM") : !f.to_warehouse_id ? L("សូមជ្រើសឃ្លាំងចូល", "Choose TO") : null),
    payload: (f) => (shop ? { to_warehouse_id: f.to_warehouse_id } : { warehouse_id: f.warehouse_id, to_warehouse_id: f.to_warehouse_id }),
    cost: () => "none",
    batchOut: () => !shop,
    stockFrom: (f) => (shop ? null : f.warehouse_id || null),
    checkStock: () => true,
    saveLabel: (f, editor) => (shop && !editor.id ? L("ផ្ញើសំណើ", "Send request") : null),
    columns: [
      { label: L("ពី → ទៅ", "From → To"), render: route },
      { label: L("ជួរ", "Lines"), render: (d) => d.items.length },
      {
        label: L("ព័ត៌មាន", "Info"),
        render: (d) =>
          d.shortage_qty > 0 ? (
            <span className="md-badge md-badge-danger">{L("ខ្វះ", "Short")} {qtyText(d.shortage_qty)}</span>
          ) : d.state === "requested" ? (
            <span className="md-sub">{L("ស្នើដោយ", "by")} {userName(d.created_by)}</span>
          ) : (
            <span className="md-sub">-</span>
          ),
      },
    ],
    filters: [
      { key: "state", label: L("-- ស្ថានភាពទាំងអស់ --", "-- All status --"), options: STATE_OPTIONS(["requested", "draft", "dispatched", "received", "cancelled"]) },
      { key: "warehouse_id", label: L("-- ឃ្លាំងទាំងអស់ --", "-- All warehouses --"), options: (ctx) => ctx.warehouses.map((w) => ({ value: w._id, label: w.code })) },
    ],
    canEdit: (d) => (manage && ["requested", "draft"].includes(d.state)) || (shop && d.state === "requested"),
    canPost: () => false,
    hasPost: false,
    actions: (d, api) => (
      <>
        {canDispatch(d) && (
          <button type="button" className="md-icon-btn sd-ok" title={L("បញ្ជូន", "Dispatch")} onClick={() => dispatchConfirm(d, api)}>
            <Truck size={16} />
          </button>
        )}
        {canReceive(d) && (
          <button type="button" className="md-icon-btn sd-ok" title={L("ទទួល", "Receive")} onClick={() => openReceive(d, api)}>
            <PackageCheck size={16} />
          </button>
        )}
      </>
    ),
    viewActions: (d, api) => (
      <>
        {canDispatch(d) && <button type="button" className="md-btn md-btn-primary" onClick={() => dispatchConfirm(d, api)}><Truck size={15} />{L("បញ្ជូន", "Dispatch")}</button>}
        {canReceive(d) && <button type="button" className="md-btn md-btn-primary" onClick={() => openReceive(d, api)}><PackageCheck size={15} />{L("ទទួល", "Receive")}</button>}
      </>
    ),
    info: (d) => [
      [L("ពី", "From"), `${nameKh(d.warehouse_id)} (${d.warehouse_id?.code})`],
      [L("ទៅ", "To"), `${nameKh(d.to_warehouse_id)} (${d.to_warehouse_id?.code})`],
      ...(d.dispatched_at ? [[L("បញ្ជូនដោយ", "Dispatched by"), `${userName(d.dispatched_by)} · ${dateTimeText(d.dispatched_at)}`]] : []),
      ...(d.received_at ? [[L("ទទួលដោយ", "Received by"), `${userName(d.received_by)} · ${dateTimeText(d.received_at)}`]] : []),
      ...(d.shortage_qty > 0
        ? [[L("ខ្វះ", "Shortage"), `${qtyText(d.shortage_qty)}${shop ? "" : ` · ${usd(d.shortage_cost)}`} → ${d.shortage_adjustment_id?.doc_no || ""}`]]
        : []),
      ...(d.receive_note ? [[L("កំណត់សម្គាល់ពេលទទួល", "Receive note"), d.receive_note]] : []),
    ],
    viewColumns: [
      {
        label: L("បានទទួល", "Received"),
        render: (i) =>
          i.received_qty === null || i.received_qty === undefined ? (
            <span className="md-sub">-</span>
          ) : (
            <span className={i.received_qty < i.qty ? "sd-short" : ""}>{qtyText(i.received_qty)}</span>
          ),
      },
    ],
    ViewExtra: ({ doc }) =>
      doc.requested_items?.length ? (
        <section className="pe-section sd-requested">
          <b>{L("សំណើដើមរបស់ហាង", "Shop's original request")}</b>
          <span>{doc.requested_items.map((r) => `${r.sku} × ${qtyText(r.qty)} ${r.unit_code}`).join(" · ")}</span>
        </section>
      ) : null,
  };
  return (
    <>
      <StockDocPage config={config} />
      {receiving && <ReceiveDialog doc={receiving.doc} api={receiving.api} onClose={() => setReceiving(null)} />}
    </>
  );
}

export default TransferComponent;
