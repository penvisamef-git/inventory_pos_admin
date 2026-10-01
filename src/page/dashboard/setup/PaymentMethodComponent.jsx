import React from "react";
import MasterDataPage, { imageCell, statusCell } from "../master_data/MasterDataPage";
import { paymentMethodService } from "../../../api/api.service";
import { CURRENCY_OPTIONS, PAYMENT_TYPE_OPTIONS, canEditSetup, labelOf, nameKh, nameOther } from "./setupOptions";

import { L } from "../../../i18n";
const yesNo = (v) => (v ? <span className="md-badge md-badge-on">{L("បាទ/ចាស", "Yes")}</span> : <span className="md-badge md-badge-off">{L("ទេ", "No")}</span>);

const COLUMNS = [
  { key: "icon", label: L("រូប", "Image"), render: (row) => imageCell(row.icon) },
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
  { key: "type", label: L("ប្រភេទ", "Type"), render: (row) => <span className="md-badge md-badge-gold">{labelOf(PAYMENT_TYPE_OPTIONS, row.type)}</span> },
  { key: "currency", label: L("រូបិយប័ណ្ណ", "Currency"), render: (row) => labelOf(CURRENCY_OPTIONS, row.currency) },
  { key: "requires_reference", label: L("ត្រូវការលេខយោង", "Needs reference"), render: (row) => yesNo(row.requires_reference) },
  { key: "online_mode", label: L("QR មានចំនួនទឹកប្រាក់", "QR with amount"), render: (row) => yesNo(row.online_mode) },
  { key: "status", label: L("ស្ថានភាព", "Status"), render: statusCell },
];

const FIELDS = [
  { key: "icon", label: L("រូបតំណាង", "Icon"), type: "image", folder: "setting" },
  { key: "code", label: L("កូដ", "Code"), required: true, placeholder: "cash_usd", hint: L("អក្សរអង់គ្លេសតូច លេខ ឬ _ ឧ. cash_usd, khqr", "Lowercase letters, digits or _ e.g. cash_usd, khqr") },
  { key: "type", label: L("ប្រភេទ", "Type"), type: "select", required: true, noEmpty: true, default: "cash", options: PAYMENT_TYPE_OPTIONS },
  { key: "name_kh", label: L("ឈ្មោះ (ខ្មែរ)", "Name (Khmer)"), required: true, placeholder: L("សាច់ប្រាក់ ដុល្លារ", "Cash USD") },
  { key: "name_en", label: L("ឈ្មោះ (អង់គ្លេស)", "Name (English)"), placeholder: "Cash USD" },
  { key: "currency", label: L("រូបិយប័ណ្ណ", "Currency"), type: "select", noEmpty: true, default: "any", options: CURRENCY_OPTIONS },
  { key: "requires_reference", label: L("អ្នកគិតលុយត្រូវបញ្ចូលលេខយោង (QR ពេលគ្មានអ៊ីនធឺណិត)", "Cashier must enter a reference no. (QR when offline)"), type: "checkbox", full: true },
  { key: "online_mode", label: L("បង្កើត QR មានចំនួនទឹកប្រាក់ពេលមានអ៊ីនធឺណិត (KHQR / ABA)", "Make a QR with the amount when online (KHQR / ABA)"), type: "checkbox", full: true },
  { key: "note", label: L("កំណត់សម្គាល់", "Note"), type: "textarea", full: true },
];

function PaymentMethodComponent() {
  return (
    <MasterDataPage
      title={L("វិធីបង់ប្រាក់", "Payment methods")}
      service={paymentMethodService}
      fields={FIELDS}
      columns={COLUMNS}
      searchKeys={["code", "name_kh", "name_en"]}
      filters={[{ key: "type", label: L("-- ប្រភេទទាំងអស់ --", "-- All types --"), options: PAYMENT_TYPE_OPTIONS }]}
      listParams={{ sort: "sort_order", order: "asc" }}
      canEdit={canEditSetup()}
      getName={(row) => `${nameKh(row)} (${row.code})`}
      wide
    />
  );
}

export default PaymentMethodComponent;
