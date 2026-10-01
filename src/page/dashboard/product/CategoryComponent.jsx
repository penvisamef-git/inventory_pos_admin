import React, { useCallback, useEffect, useMemo, useState } from "react";
import MasterDataPage, { imageCell, statusCell } from "../master_data/MasterDataPage";
import { categoryService } from "../../../api/api.service";
import { canEditProduct, flattenTree, nameKh, nameOther } from "./productOptions";
import { L } from "../../../i18n";

const COLUMNS = [
  { key: "image", label: L("រូប", "Image"), render: (row) => imageCell(row.image) },
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
    key: "parent",
    label: L("ប្រភេទមេ", "Parent"),
    render: (row) => (row.parent_id ? nameKh(row.parent_id) : <span className="md-badge md-badge-shop">{L("កម្រិតទី 1", "Top level")}</span>),
  },
  { key: "child_count", label: L("ប្រភេទកូន", "Sub-categories"), render: (row) => row.child_count ?? 0 },
  { key: "product_count", label: L("ទំនិញ", "Products"), render: (row) => row.product_count ?? 0 },
  { key: "status", label: L("ស្ថានភាព", "Status"), render: statusCell },
];

function CategoryComponent() {
  const [tree, setTree] = useState([]);

  const loadTree = useCallback(() => {
    categoryService
      .tree()
      .then((res) => setTree(res.data || []))
      .catch(() => setTree([]));
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const flat = useMemo(() => flattenTree(tree), [tree]);

  const fields = useMemo(
    () => [
      { key: "image", label: L("រូបភាព", "Image"), type: "image", folder: "category" },
      {
        key: "code",
        label: L("កូដ", "Code"),
        required: true,
        placeholder: "clothing_tops",
        hint: L("អក្សរអង់គ្លេសតូច លេខ ឬ _ ឧ. clothing_tops", "Lowercase letters, digits or _ e.g. clothing_tops"),
      },
      {
        key: "parent_id",
        label: L("ប្រភេទមេ", "Parent category"),
        type: "select",
        placeholder: L("-- កម្រិតទី 1 (គ្មានមេ) --", "-- Top level (no parent) --"),
        options: flat.map((o) => ({ value: o.value, label: o.label })),
      },
      { key: "name_kh", label: L("ឈ្មោះ (ខ្មែរ)", "Name (Khmer)"), required: true, placeholder: "អាវ" },
      { key: "name_en", label: L("ឈ្មោះ (អង់គ្លេស)", "Name (English)"), placeholder: "Tops" },
      { key: "note", label: L("កំណត់សម្គាល់", "Note"), type: "textarea", full: true },
    ],
    [flat],
  );

  // filter: top level only, or the children of one top-level category
  const filters = useMemo(
    () => [
      {
        key: "parent_id",
        label: L("-- ប្រភេទទាំងអស់ --", "-- All categories --"),
        options: [
          { value: "root", label: L("កម្រិតទី 1 ប៉ុណ្ណោះ", "Top level only") },
          ...flat.filter((o) => o.depth === 0).map((o) => ({ value: o.value, label: `${L("ក្នុង", "In")}: ${o.label}` })),
        ],
      },
    ],
    [flat],
  );

  return (
    <MasterDataPage
      title={L("ប្រភេទទំនិញ", "Categories")}
      service={categoryService}
      fields={fields}
      columns={COLUMNS}
      filters={filters}
      searchKeys={["code", "name_kh", "name_en"]}
      listParams={{ sort: "sort_order", order: "asc" }}
      canEdit={canEditProduct()}
      onSaved={loadTree}
      getName={(row) => `${nameKh(row)} (${row.code})`}
      wide
    />
  );
}

export default CategoryComponent;
