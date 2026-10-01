import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { stockService } from "../../../api/api.service";
import { dateTimeText } from "../master_data/MasterDataPage";
import { MOVE_TYPES, OptionChips, isShopUser, nameKh, qtyText, usd } from "./stockOptions";
import { L } from "../../../i18n";

// Ledger of one variant in one warehouse (newest first)
function MovementDrawer({ row, warehouse, onClose }) {
  const shop = isShopUser();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    stockService
      .movement({ variant_id: row.variant_id, warehouse_id: warehouse.warehouse_id, sort: "movement_date", order: "desc", limit: 100 })
      .then((r) => setRows(r.data || []))
      .catch(() => setRows([]));
  }, [row, warehouse]);
  return (
    <div className="md-modal-backdrop" onMouseDown={onClose}>
      <div className="md-modal pe-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="md-modal-header">
          <h3>
            {nameKh(row.product)} · <span className="md-code">{row.sku}</span> · {warehouse.code}
          </h3>
          <button type="button" className="md-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="md-modal-body">
          <OptionChips options={row.options} />
          {!rows ? (
            <div className="md-empty">{L("កំពុងផ្ទុក...", "Loading...")}</div>
          ) : !rows.length ? (
            <div className="md-empty">{L("មិនទាន់មានចលនា", "No movements yet")}</div>
          ) : (
            <MovementTable rows={rows} shop={shop} />
          )}
        </div>
      </div>
    </div>
  );
}

export function MovementTable({ rows, shop, showItem, showWarehouse }) {
  return (
    <div className="md-table-scroll pe-variants">
      <table className="md-table">
        <thead>
          <tr>
            <th>{L("ពេលវេលា", "Time")}</th>
            {showWarehouse && <th>{L("ឃ្លាំង", "Warehouse")}</th>}
            {showItem && <th>{L("ទំនិញ", "Item")}</th>}
            <th>{L("ប្រភេទ", "Type")}</th>
            <th>{L("ឯកសារ", "Document")}</th>
            <th>Batch</th>
            <th className="sb-num">{L("ចំនួន", "Qty")}</th>
            <th className="sb-num">{L("សមតុល្យ", "Balance")}</th>
            {!shop && <th className="sb-num">{L("ថ្លៃ/ឯកតា", "Unit cost")}</th>}
            {!shop && <th className="sb-num">{L("ថ្លៃមធ្យមបន្ទាប់", "Avg after")}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m._id}>
              <td><span className="sb-min">{dateTimeText(m.movement_date)}</span></td>
              {showWarehouse && <td>{m.warehouse_id?.code}</td>}
              {showItem && (
                <td>
                  <span className="md-code">{m.variant_id?.code}</span>
                </td>
              )}
              <td><span className={`sm-type sm-${MOVE_TYPES[m.type]?.cls}`}>{MOVE_TYPES[m.type]?.label || m.type}</span></td>
              <td><b>{m.ref_no}</b></td>
              <td><span className="sb-min">{m.batch_id?.batch_no || "-"}</span></td>
              <td className={`sb-num ${m.qty < 0 ? "sb-neg" : "sm-pos"}`}>{m.qty > 0 ? "+" : ""}{qtyText(m.qty)}</td>
              <td className="sb-num"><b>{qtyText(m.balance_after)}</b></td>
              {!shop && <td className="sb-num">{usd(m.unit_cost, 4)}</td>}
              {!shop && <td className="sb-num"><span className="sb-min">{usd(m.avg_cost_after, 4)}</span></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default MovementDrawer;
