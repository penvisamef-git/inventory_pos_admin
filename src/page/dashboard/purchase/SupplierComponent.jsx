import React from "react";
import MasterDataPage, { statusCell } from "../master_data/MasterDataPage";
import { supplierService } from "../../../api/api.service";
import { canManageStock } from "../stock/stockOptions";
import { L } from "../../../i18n";

const COLUMNS = [
  { key: "name", label: L("ឈ្មោះ", "Name"), render: (row) => (<><b>{row.name}</b>{row.contact_name && <span className="md-sub">{row.contact_name}</span>}</>) },
  { key: "code", label: L("កូដ", "Code"), render: (row) => <span className="md-code">{row.code}</span> },
  { key: "phone", label: L("ទូរស័ព្ទ", "Phone"), render: (row) => row.phone || "-" },
  { key: "term", label: L("រយៈពេលបង់", "Payment term"), render: (row) => (row.payment_term_days ? L(`${row.payment_term_days} ថ្ងៃ`, `${row.payment_term_days} days`) : L("សាច់ប្រាក់", "Cash")) },
  { key: "status", label: L("ស្ថានភាព", "Status"), render: statusCell },
];

const FIELDS = [
  { key: "code", label: L("កូដ", "Code"), required: true, placeholder: "angkor_baby", hint: L("អក្សរអង់គ្លេសតូច លេខ ឬ _", "Lowercase letters, digits or _") },
  { key: "name", label: L("ឈ្មោះ", "Name"), required: true },
  { key: "contact_name", label: L("អ្នកទំនាក់ទំនង", "Contact person") },
  { key: "phone", label: L("ទូរស័ព្ទ", "Phone"), type: "tel" },
  { key: "email", label: L("អ៊ីមែល", "Email"), type: "email" },
  { key: "vat_no", label: L("លេខ VAT", "VAT no") },
  { key: "payment_term_days", label: L("រយៈពេលបង់ (ថ្ងៃ)", "Payment term (days)"), type: "number", step: "1" },
  { key: "address", label: L("អាសយដ្ឋាន", "Address"), type: "textarea", full: true },
  { key: "note", label: L("កំណត់សម្គាល់", "Note"), type: "textarea", full: true },
];

function SupplierComponent() {
  return (
    <MasterDataPage
      title={L("អ្នកផ្គត់ផ្គង់", "Supplier")}
      service={supplierService}
      fields={FIELDS}
      columns={COLUMNS}
      searchKeys={["code", "name", "contact_name", "phone"]}
      listParams={{ sort: "sort_order", order: "asc" }}
      canEdit={canManageStock()}
      getName={(row) => `${row.name} (${row.code})`}
      wide
    />
  );
}

export default SupplierComponent;
