// Download a table as an .xlsx file (one sheet). columns: [{ label, value: (row) => any, width?, type?: "number" | "text" }]
import writeExcelFile from "write-excel-file/browser";

const cell = (v, type) => {
  if (v === null || v === undefined || v === "") return { type: String, value: "" };
  if (type === "number" || (type === undefined && typeof v === "number")) return Number.isFinite(Number(v)) ? { type: Number, value: Number(v), format: "#,##0.00" } : { type: String, value: String(v) };
  if (v instanceof Date) return { type: String, value: v.toISOString().slice(0, 10) };
  return { type: String, value: String(v) };
};

export async function exportExcel(fileName, sheet, columns, rows, { totals } = {}) {
  const data = [
    columns.map((c) => ({ value: c.label, fontWeight: "bold", backgroundColor: "#E8F1EC" })),
    ...rows.map((r) => columns.map((c) => cell(c.value(r), c.type))),
  ];
  if (totals) data.push(columns.map((c, i) => ({ ...(i === 0 ? { type: String, value: totals.label || "Total" } : cell(c.total !== undefined ? c.total : "", c.type)), fontWeight: "bold" })));
  await writeExcelFile(data, { sheet: String(sheet).slice(0, 31), columns: columns.map((c) => ({ width: c.width || 16 })), stickyRowsCount: 1 }).toFile(fileName);
}
