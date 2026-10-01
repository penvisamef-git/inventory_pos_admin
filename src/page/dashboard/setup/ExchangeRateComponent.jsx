import React, { useCallback, useEffect, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import MasterDataPage, { dateTimeText } from "../master_data/MasterDataPage";
import { exchangeRateService } from "../../../api/api.service";
import { RATE_STATE, canEditSetup, riel } from "./setupOptions";
import "./setup.style.css";

import { L } from "../../../i18n";
const fullName = (u) => (u ? `${u.firstname || ""} ${u.lastname || ""}`.trim() || u.email : "-");

const COLUMNS = [
  { key: "rate", label: L("អត្រា", "Rate"), render: (row) => <b>1 USD = {riel(row.rate)}</b> },
  { key: "effective_from", label: L("ចាប់ផ្តើមប្រើពី", "Starts from"), render: (row) => dateTimeText(row.effective_from) },
  {
    key: "state",
    label: L("ស្ថានភាព", "Status"),
    render: (row) => {
      const s = RATE_STATE[row.state] || RATE_STATE.past;
      return <span className={`md-badge ${s.className}`}>{s.label}</span>;
    },
  },
  { key: "note", label: L("កំណត់សម្គាល់", "Note"), render: (row) => row.note || "-" },
  { key: "created_by", label: L("បង្កើតដោយ", "Created by"), render: (row) => fullName(row.created_by) },
];

const FIELDS = [
  { key: "rate", label: L("អត្រា (៛ ក្នុង 1 USD)", "Rate (៛ per 1 USD)"), type: "number", required: true, placeholder: "4100" },
  {
    key: "effective_from",
    label: L("ចាប់ផ្តើមប្រើពី", "Starts from"),
    type: "datetime",
    required: true,
    hint: L("ពេលវេលាកន្លងហើយ = ប្រើភ្លាមៗ · ពេលអនាគត = កំណត់ទុកមុន", "Past time = starts now · future time = scheduled"),
  },
  { key: "note", label: L("កំណត់សម្គាល់", "Note"), type: "textarea" },
];

const isUpcoming = (row) => row.state === "upcoming";

function ExchangeRateComponent() {
  const [current, setCurrent] = useState(null);

  const loadCurrent = useCallback(() => {
    exchangeRateService
      .current()
      .then((res) => setCurrent(res.data))
      .catch(() => setCurrent(null));
  }, []);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  return (
    <div className="md-page">
      <section className="st-rate-hero">
        <span className="st-rate-icon">
          <ArrowRightLeft size={22} />
        </span>
        <div>
          <small>{L("អត្រាដែលកំពុងប្រើ", "Rate in use")}</small>
          <strong>{current ? `1 USD = ${riel(current.rate)}` : L("មិនទាន់កំណត់", "Not set")}</strong>
          {current && <span>{L("ចាប់ពី", "Since")} {dateTimeText(current.effective_from)}</span>}
        </div>
        <p>{L("អត្រាដែលបានចាប់ផ្តើមប្រើរួច មិនអាចកែប្រែបានទេ ព្រោះវិក្កយបត្រចាស់ៗប្រើអត្រានោះ។ សូមបង្កើតអត្រាថ្មីជំនួសវិញ។", "A rate that has started can't be changed because old invoices use it. Create a new rate instead.")}</p>
      </section>

      <MasterDataPage
        title={L("អត្រាប្តូរប្រាក់", "Exchange rate")}
        service={exchangeRateService}
        fields={FIELDS}
        columns={COLUMNS}
        searchKeys={["note"]}
        canEdit={canEditSetup()}
        canEditRow={isUpcoming}
        canDelete={isUpcoming}
        getName={(row) => `1 USD = ${riel(row.rate)}`}
        onSaved={loadCurrent}
        hideStatus
      />
    </div>
  );
}

export default ExchangeRateComponent;
