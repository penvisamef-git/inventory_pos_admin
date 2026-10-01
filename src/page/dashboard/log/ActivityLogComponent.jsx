import React, { useEffect, useMemo, useState } from "react";
import MasterDataPage from "../master_data/MasterDataPage";
import { activityLogService } from "../../../api/api.service";

import { L } from "../../../i18n";
const CATEGORY_LABELS = {
  other: L("ផ្សេងៗ", "Other"),
  auth: L("ចូល / ចេញគណនី", "Login / logout"),
  user: L("អ្នកប្រើប្រាស់", "Users"),
  setting: L("ការកំណត់", "Settings"),
  exchange_rate: L("អត្រាប្តូរប្រាក់", "Exchange rate"),
  payment_method: L("វិធីបង់ប្រាក់", "Payment methods"),
  warehouse: L("ឃ្លាំង / ហាង", "Warehouses / Shops"),
  unit: L("ឯកតា", "Units"),
  category: L("ប្រភេទទំនិញ", "Categories"),
  attribute: L("លក្ខណៈ (ទំហំ / ពណ៌)", "Attributes (size / color)"),
  brand: L("ម៉ាក", "Brands"),
  product: L("ទំនិញ", "Products"),
  price: L("តម្លៃ", "Price"),
  promotion: L("ប្រូម៉ូសិន", "Promotions"),
  supplier: L("អ្នកផ្គត់ផ្គង់", "Suppliers"),
};

const COLUMNS = [
  { key: "time", label: L("ពេលវេលា", "Time"), render: (row) => <span style={{ whiteSpace: "nowrap" }}>{row.time || "-"}</span> },
  {
    key: "title",
    label: L("សកម្មភាព", "Activity"),
    render: (row) => (
      <>
        <b>{row.title}</b>
        {row.description && <span className="md-sub">{row.description}</span>}
      </>
    ),
  },
  {
    key: "category",
    label: L("ប្រភេទ", "Type"),
    render: (row) => {
      const t = row.activity_log_category_id?.title;
      return <span className="md-badge md-badge-gold">{CATEGORY_LABELS[t] || t || "-"}</span>;
    },
  },
  {
    key: "by",
    label: L("ដោយ", "By"),
    render: (row) => {
      const u = row.create_by_id;
      return u ? (
        <>
          {`${u.firstname || ""} ${u.lastname || ""}`.trim()}
          <span className="md-sub">{u.email}</span>
        </>
      ) : (
        "-"
      );
    },
  },
  { key: "device", label: L("ឧបករណ៍", "Device"), render: (row) => (row.device ? `${row.device.device} · ${row.device.browser}` : "-") },
];

const SEARCH_KEYS = ["title", "description"];

// Read-only list of what happened in the system
function ActivityLogComponent() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    activityLogService
      .categories()
      .then((res) => setCategories(res.data || []))
      .catch(() => setCategories([]));
  }, []);

  const filters = useMemo(
    () => [
      {
        key: "category",
        label: L("-- ប្រភេទទាំងអស់ --", "-- All types --"),
        options: categories.map((c) => ({ value: c.title, label: CATEGORY_LABELS[c.title] || c.title })),
      },
    ],
    [categories],
  );

  return (
    <MasterDataPage
      title={L("កំណត់ត្រា", "Log")}
      service={activityLogService}
      fields={[]}
      columns={COLUMNS}
      searchKeys={SEARCH_KEYS}
      filters={filters}
      canEdit={false}
    />
  );
}

export default ActivityLogComponent;
