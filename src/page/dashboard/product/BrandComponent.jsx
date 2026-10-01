import React from "react";
import MasterDataPage, { imageCell, statusCell } from "../master_data/MasterDataPage";
import { brandService } from "../../../api/api.service";
import { canEditProduct, nameKh, nameOther } from "./productOptions";
import { L } from "../../../i18n";

const COLUMNS = [
  { key: "logo", label: L("ឡូហ្គោ", "Logo"), render: (row) => imageCell(row.logo) },
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
  { key: "logo", label: L("ឡូហ្គោ", "Logo"), type: "image", folder: "brand" },
  { key: "code", label: L("កូដ", "Code"), required: true, placeholder: "pampers", hint: L("អក្សរអង់គ្លេសតូច លេខ ឬ _", "Lowercase letters, digits or _") },
  { key: "name_kh", label: L("ឈ្មោះ (ខ្មែរ)", "Name (Khmer)"), required: true, placeholder: "ផេមភើស" },
  { key: "name_en", label: L("ឈ្មោះ (អង់គ្លេស)", "Name (English)"), placeholder: "Pampers" },
  { key: "note", label: L("កំណត់សម្គាល់", "Note"), type: "textarea", full: true },
];

function BrandComponent() {
  return (
    <MasterDataPage
      title={L("ម៉ាក", "Brand")}
      service={brandService}
      fields={FIELDS}
      columns={COLUMNS}
      searchKeys={["code", "name_kh", "name_en"]}
      listParams={{ sort: "sort_order", order: "asc" }}
      canEdit={canEditProduct()}
      getName={(row) => `${nameKh(row)} (${row.code})`}
    />
  );
}

export default BrandComponent;
