import React, { useEffect, useMemo, useState } from "react";
import MasterDataPage, { statusCell } from "../master_data/MasterDataPage";
import { userService, warehouseService } from "../../../api/api.service";
import { WAREHOUSE_TYPE_OPTIONS, canEditSetup, labelOf, nameKh, nameOther } from "./setupOptions";

import { Eye, MapPin, Package, Phone, Store, UserRound, Warehouse } from "lucide-react";
import WarehouseStockDialog from "./WarehouseStockDialog";
import { L } from "../../../i18n";
const fullName = (u) => (u ? `${u.firstname || ""} ${u.lastname || ""}`.trim() || u.email : "");

const stockText = (row) =>
  row.stock?.skus || row.stock?.negative ? (
    <>
      <b>{L(`${row.stock.skus} មុខ`, `${row.stock.skus} items`)}</b>
      <span className="md-sub">
        {L("សរុប", "Total")} {Number(row.stock.qty || 0).toLocaleString("en-US")}
        {row.stock.negative ? <span className="wh-neg"> · {L(`${row.stock.negative} ក្រោម 0`, `${row.stock.negative} below 0`)}</span> : null}
      </span>
    </>
  ) : (
    <span className="md-sub">{L("ទទេ", "Empty")}</span>
  );

const COLUMNS = [
  {
    key: "name",
    label: L("ឈ្មោះ", "Name"),
    render: (row) => (
      <>
        <b>{nameKh(row)}</b>
        {nameOther(row) && <span className="md-sub">{nameOther(row)}</span>}
      </>
    ),
  },
  { key: "code", label: L("កូដ", "Code"), render: (row) => <span className="md-code">{row.code}</span> },
  {
    key: "type",
    label: L("ប្រភេទ", "Type"),
    render: (row) => <span className={`md-badge md-badge-${row.type}`}>{labelOf(WAREHOUSE_TYPE_OPTIONS, row.type)}</span>,
  },
  {
    key: "contact",
    label: L("ទំនាក់ទំនង", "Contact"),
    render: (row) => (
      <>
        {row.phone || "-"}
        {row.address && <span className="md-sub">{row.address}</span>}
      </>
    ),
  },
  {
    key: "stock",
    label: L("ស្តុក", "Stock"),
    render: (row) => stockText(row),
  },
  { key: "manager", label: L("អ្នកគ្រប់គ្រង", "Manager"), render: (row) => fullName(row.manager_id) || "-" },
  {
    key: "allow_negative_stock",
    label: L("លក់ពេលស្តុក 0", "Sell at 0 stock"),
    render: (row) =>
      row.allow_negative_stock ? <span className="md-badge md-badge-gold">{L("អនុញ្ញាត", "Allowed")}</span> : <span className="md-badge md-badge-off">{L("មិនអនុញ្ញាត", "Not allowed")}</span>,
  },
  { key: "status", label: L("ស្ថានភាព", "Status"), render: statusCell },
];

// Grid card: a big icon for the level — central warehouse (supplies the shops) or shop (POS)
function WarehouseCard(row, onOpen) {
  const central = row.type === "central";
  const Icon = central ? Warehouse : Store;
  return (
    <div className={`wh-card ${row.type}`}>
      <div className="wh-card-top">
        <span className="wh-card-icon"><Icon size={30} strokeWidth={1.8} /></span>
        <div className="wh-card-title">
          <span className={`md-badge md-badge-${row.type}`}>{labelOf(WAREHOUSE_TYPE_OPTIONS, row.type)}</span>
          <b>{nameKh(row)}</b>
          {nameOther(row) && <span className="md-sub">{nameOther(row)}</span>}
        </div>
        <span className="md-code">{row.code}</span>
      </div>
      <button type="button" className={`wh-card-stock ${row.stock?.skus ? "" : "empty"}`} onClick={() => onOpen(row)} title={L("មើលទំនិញក្នុងឃ្លាំង", "See the items inside")}>
        <Package size={16} />
        {row.stock?.skus ? (
          <span>
            <b>{L(`${row.stock.skus} មុខ`, `${row.stock.skus} items`)}</b> · {L("សរុប", "total")} {Number(row.stock.qty || 0).toLocaleString("en-US")}
            {row.stock.negative ? <em> · {L(`${row.stock.negative} ក្រោម 0`, `${row.stock.negative} below 0`)}</em> : null}
          </span>
        ) : (
          <span>{L("មិនទាន់មានស្តុក", "No stock yet")}</span>
        )}
        <Eye size={15} className="wh-card-eye" />
      </button>
      <ul className="wh-card-info">
        <li><UserRound size={14} /> {fullName(row.manager_id) || <em>{L("គ្មានអ្នកគ្រប់គ្រង", "No manager")}</em>}</li>
        <li><Phone size={14} /> {row.phone || <em>-</em>}</li>
        <li><MapPin size={14} /> {row.address || <em>-</em>}</li>
      </ul>
      <div className="wh-card-foot">
        {statusCell(row)}
        {row.type === "shop" &&
          (row.allow_negative_stock ? <span className="md-badge md-badge-gold">{L("លក់ពេលស្តុក 0", "Sells at 0 stock")}</span> : <span className="md-badge md-badge-off">{L("មិនលក់ពេលស្តុក 0", "No sale at 0 stock")}</span>)}
      </div>
    </div>
  );
}

const SEARCH_KEYS = ["code", "name_kh", "name_en", "phone", "address"];
const FILTERS = [{ key: "type", label: L("-- ប្រភេទទាំងអស់ --", "-- All types --"), options: WAREHOUSE_TYPE_OPTIONS }];
const LIST_PARAMS = { sort: "sort_order", order: "asc" };

function WarehouseComponent() {
  const canEdit = canEditSetup();
  const [viewing, setViewing] = useState(null);
  const [users, setUsers] = useState([]);

  // manager dropdown (only admins edit, and only admins may read the user list)
  useEffect(() => {
    if (!canEdit) return;
    userService
      .all()
      .then((res) => setUsers(res.data || []))
      .catch(() => setUsers([]));
  }, [canEdit]);

  const fields = useMemo(
    () => [
      {
        key: "code",
        label: L("កូដ", "Code"),
        required: true,
        placeholder: "PP01",
        hint: L("អក្សរអង់គ្លេស + លេខ ឧ. WH01, PP01 (ប្រើជាលេខវិក្កយបត្រ POS)", "Letters + digits e.g. WH01, PP01 (also the POS receipt prefix)"),
      },
      {
        key: "type",
        label: L("ប្រភេទ", "Type"),
        type: "select",
        required: true,
        noEmpty: true,
        default: "shop",
        options: WAREHOUSE_TYPE_OPTIONS,
      },
      { key: "name_kh", label: L("ឈ្មោះ (ខ្មែរ)", "Name (Khmer)"), required: true, placeholder: L("ហាង ភ្នំពេញ ០១", "Phnom Penh Shop 01") },
      { key: "name_en", label: L("ឈ្មោះ (អង់គ្លេស)", "Name (English)"), placeholder: "Phnom Penh Shop 01" },
      { key: "phone", label: L("លេខទូរស័ព្ទ", "Phone"), type: "tel", placeholder: "012345678" },
      {
        key: "manager_id",
        label: L("អ្នកគ្រប់គ្រង", "Manager"),
        type: "select",
        placeholder: L("-- គ្មាន --", "-- None --"),
        options: users.map((u) => ({ value: u._id, label: `${fullName(u)} · ${u.email}` })),
      },
      { key: "address", label: L("អាសយដ្ឋាន", "Address"), type: "textarea", full: true },
      {
        key: "allow_negative_stock",
        label: L("អនុញ្ញាតឱ្យលក់ពេលស្តុកបង្ហាញ 0 (ហាង)", "Allow selling when stock shows 0 (shops)"),
        type: "checkbox",
        default: true,
        full: true,
      },
      { key: "note", label: L("កំណត់សម្គាល់", "Note"), type: "textarea", full: true },
    ],
    [users],
  );

  return (
    <>
    <MasterDataPage
      title={L("ឃ្លាំង / ហាង", "Warehouses / Shops")}
      service={warehouseService}
      fields={fields}
      columns={COLUMNS}
      searchKeys={SEARCH_KEYS}
      filters={FILTERS}
      listParams={LIST_PARAMS}
      canEdit={canEdit}
      getName={(row) => `${nameKh(row)} (${row.code})`}
      wide
      gridCard={(row) => WarehouseCard(row, setViewing)}
      viewKey="warehouse"
      extraActions={(row) => (
        <button type="button" className="md-icon-btn" onClick={() => setViewing(row)} title={L("មើលស្តុក", "View stock")}>
          <Eye size={15} />
        </button>
      )}
      // still holds stock → can't be deleted (the API checks too)
      canDelete={(row) => !(row.stock?.skus || row.stock?.negative)}
    />
    {viewing && <WarehouseStockDialog warehouse={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

export default WarehouseComponent;
