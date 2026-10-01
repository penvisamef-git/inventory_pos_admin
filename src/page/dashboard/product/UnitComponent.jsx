import React from "react";
import MasterDataPage, { statusCell } from "../master_data/MasterDataPage";
import { unitService } from "../../../api/api.service";
import { canEditProduct, nameKh, nameOther } from "./productOptions";
import { L } from "../../../i18n";

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
  { key: "status", label: L("ស្ថានភាព", "Status"), render: statusCell },
];

const FIELDS = [
  { key: "code", label: L("កូដ", "Code"), required: true, placeholder: "pcs", hint: L("អក្សរអង់គ្លេសតូច ឧ. pcs, box, pack", "Lowercase e.g. pcs, box, pack") },
  { key: "name_kh", label: L("ឈ្មោះ (ខ្មែរ)", "Name (Khmer)"), required: true, placeholder: "ដុំ" },
  { key: "name_en", label: L("ឈ្មោះ (អង់គ្លេស)", "Name (English)"), placeholder: "Piece" },
  { key: "note", label: L("កំណត់សម្គាល់", "Note"), type: "textarea" },
];

function UnitComponent() {
  return (
    <MasterDataPage
      title={L("ឯកតា", "Units")}
      service={unitService}
      fields={FIELDS}
      columns={COLUMNS}
      searchKeys={["code", "name_kh", "name_en"]}
      listParams={{ sort: "sort_order", order: "asc" }}
      canEdit={canEditProduct()}
      getName={(row) => `${nameKh(row)} (${row.code})`}
    />
  );
}

export default UnitComponent;
