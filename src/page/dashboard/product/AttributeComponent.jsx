import React from "react";
import MasterDataPage, { statusCell } from "../master_data/MasterDataPage";
import { attributeService } from "../../../api/api.service";
import { ATTRIBUTE_TYPE_OPTIONS, canEditProduct, labelOf, nameKh, nameOther } from "./productOptions";
import { L } from "../../../i18n";

const valueName = (v) => L(v.name_kh || v.name_en, v.name_en || v.name_kh);

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
    render: (row) => <span className="md-badge md-badge-gold">{labelOf(ATTRIBUTE_TYPE_OPTIONS, row.type)}</span>,
  },
  {
    key: "values",
    label: L("តម្លៃ", "Values"),
    render: (row) => (
      <div className="md-values">
        {(row.values || []).map((v) => (
          <span key={v._id || v.code} className="md-value">
            {v.color_hex && <i style={{ background: v.color_hex }} />}
            {valueName(v)}
          </span>
        ))}
      </div>
    ),
  },
  { key: "status", label: L("ស្ថានភាព", "Status"), render: statusCell },
];

const FIELDS = [
  { key: "code", label: L("កូដ", "Code"), required: true, placeholder: "size", hint: L("ឧ. size, color, diaper_size", "e.g. size, color, diaper_size") },
  { key: "type", label: L("ប្រភេទ", "Type"), type: "select", required: true, noEmpty: true, default: "size", options: ATTRIBUTE_TYPE_OPTIONS },
  { key: "name_kh", label: L("ឈ្មោះ (ខ្មែរ)", "Name (Khmer)"), required: true, placeholder: "ទំហំ" },
  { key: "name_en", label: L("ឈ្មោះ (អង់គ្លេស)", "Name (English)"), placeholder: "Size" },
  {
    key: "values",
    label: L("តម្លៃ (ឧ. 0-3 ខែ, ផ្កាឈូក)", "Values (e.g. 0-3M, Pink)"),
    type: "rows",
    required: true,
    full: true,
    addLabel: L("បន្ថែមតម្លៃ", "Add value"),
    newRow: () => ({ code: "", name_kh: "", name_en: "", color_hex: "" }),
    columns: [
      { key: "code", label: L("កូដ", "Code"), placeholder: "6-12m", width: "0.8fr" },
      { key: "name_kh", label: L("ឈ្មោះ (ខ្មែរ)", "Name (Khmer)"), placeholder: "6-12 ខែ" },
      { key: "name_en", label: L("ឈ្មោះ (អង់គ្លេស)", "Name (English)"), placeholder: "6-12M" },
      { key: "color_hex", label: L("ពណ៌ (បើមាន)", "Color (optional)"), type: "color", width: "1.1fr" },
    ],
  },
  { key: "note", label: L("កំណត់សម្គាល់", "Note"), type: "textarea", full: true },
];

function AttributeComponent() {
  return (
    <MasterDataPage
      title={L("លក្ខណៈ (ទំហំ / ពណ៌)", "Attributes (size / color)")}
      service={attributeService}
      fields={FIELDS}
      columns={COLUMNS}
      filters={[{ key: "type", label: L("-- ប្រភេទទាំងអស់ --", "-- All types --"), options: ATTRIBUTE_TYPE_OPTIONS }]}
      searchKeys={["code", "name_kh", "name_en"]}
      listParams={{ sort: "sort_order", order: "asc" }}
      canEdit={canEditProduct()}
      getName={(row) => `${nameKh(row)} (${row.code})`}
      wide
    />
  );
}

export default AttributeComponent;
