import React, { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { readSheet } from "read-excel-file/browser";
import writeExcelFile from "write-excel-file/browser";
import { productService } from "../../../api/api.service";
import { L, LANG } from "../../../i18n";

// Excel import of products (create + update by product_code). One row = one SKU; rows with the same
// product_code form one product. Blank cell = keep the current value. Import never deletes anything.
// The file is checked on the server first (preview), then saved — ~50 products per request.

const CHUNK = 50; // products per request

const HELP = [
  ["product_code", "លេខកូដទំនិញ (មេ) — ជួរដែលមានលេខកូដដូចគ្នា = ទំនិញតែមួយ", "Product (style) code — rows with the same code are one product", "BODY-01"],
  ["name_kh", "ឈ្មោះខ្មែរ (ចាំបាច់សម្រាប់ទំនិញថ្មី)", "Khmer name (required for a new product)", "អាវទារក"],
  ["name_en", "ឈ្មោះអង់គ្លេស", "English name", "Baby bodysuit"],
  ["category", "លេខកូដប្រភេទ (មើលសន្លឹក Lists)", "Category code (see the Lists sheet)", ""],
  ["brand", "លេខកូដម៉ាក ( - = គ្មាន)", "Brand code ( - = none)", ""],
  ["base_unit", "ឯកតាគោល (ចាំបាច់សម្រាប់ទំនិញថ្មី)", "Base unit code (required for a new product)", "pcs"],
  ["track_batch", "មាន Batch / ផុតកំណត់? yes / no", "Batch + expiry tracking? yes / no", "no"],
  ["min_stock", "ស្តុកអប្បបរមា", "Minimum stock (low-stock alert)", "5"],
  ["option_1..3", "លក្ខណៈ ឧ. size=0_3m , color=white", "Options, e.g. size=0_3m , color=white", "size=0_3m"],
  ["sku", "លេខកូដ SKU (ទទេ = បង្កើតដោយស្វ័យប្រវត្តិ)", "SKU code (blank = generated)", ""],
  ["barcode", "បាកូដ", "Barcode", "8850000000011"],
  ["unit_2", "ឯកតាទី២ ឧ. ប្រអប់", "Second unit, e.g. box", "box"],
  ["unit_2_factor", "១ ឯកតាទី២ = ? ឯកតាគោល", "1 second unit = ? base units", "12"],
  ["unit_2_barcode", "បាកូដឯកតាទី២", "Second unit barcode", ""],
  ["price", "តម្លៃលក់ (USD) ឯកតាគោល — ថ្មីតែពេលប្តូរ", "Sale price (USD) per base unit — added only when it changes", "4.5"],
  ["unit_2_price", "តម្លៃលក់ ឯកតាទី២", "Sale price per second unit", "50"],
];

const head = (columns) => columns.map((c) => ({ value: c, fontWeight: "bold", backgroundColor: "#E7F3EC" }));
const text = (v) => ({ value: v === null || v === undefined ? "" : String(v), type: String });
const widths = (columns) => columns.map((c) => ({ width: c.startsWith("name") ? 28 : c === "barcode" || c.endsWith("barcode") ? 18 : 13 }));

async function writeBook(columns, rows, lists, fileName) {
  const sheets = [{ data: [head(columns), ...rows.map((r) => columns.map((c) => text(r[c])))], sheet: "Products", columns: widths(columns), stickyRowsCount: 1 }];
  sheets.push({
    data: [head(["column", "ខ្មែរ", "English", "example"]), ...HELP.map((h) => h.map((v) => text(v)))],
    sheet: "Help",
    columns: [{ width: 16 }, { width: 50 }, { width: 50 }, { width: 16 }],
  });
  if (lists) {
    const groups = [
      ["category", lists.categories],
      ["brand", lists.brands],
      ["base_unit / unit_2", lists.units],
      ["option", lists.options],
    ];
    const max = Math.max(...groups.map(([, g]) => g.length));
    const data = [head(groups.flatMap(([k]) => [k, ""]))];
    for (let i = 0; i < max; i++) {
      data.push(groups.flatMap(([, g]) => (g[i] ? [text(g[i].code), text(LANG === "en" ? g[i].name_en || g[i].name_kh : g[i].name_kh)] : [text(""), text("")])));
    }
    sheets.push({ data, sheet: "Lists", columns: groups.flatMap(() => [{ width: 18 }, { width: 26 }]) });
  }
  await writeExcelFile(sheets).toFile(fileName);
}

const str = (v) => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());

// first sheet → [{ column: value, _row }] (header row = column names)
async function readRows(file, columns) {
  const data = await readSheet(file);
  const header = (data[0] || []).map((h) => str(h).toLowerCase());
  const known = header.filter((h) => columns.includes(h));
  if (!header.includes("product_code") || known.length < 3) {
    throw new Error(L("រកមិនឃើញជួរឈរ product_code — សូមប្រើ Template", "Column product_code not found — please use the template"));
  }
  const rows = [];
  data.slice(1).forEach((r, i) => {
    const row = { _row: i + 2 };
    let any = false;
    header.forEach((h, c) => {
      if (!columns.includes(h)) return;
      const v = str(r[c]);
      if (v !== "") any = true;
      row[h] = v;
    });
    if (any) rows.push(row);
  });
  if (!rows.length) throw new Error(L("ឯកសារគ្មានទិន្នន័យ", "The file has no data rows"));
  return rows;
}

// keep all rows of one product in the same request
function chunks(rows) {
  const groups = new Map();
  rows.forEach((r) => {
    const k = r.product_code || `#${r._row}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  });
  const list = [...groups.values()];
  const out = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK).flat());
  return out;
}

const emptySummary = () => ({ products: 0, create: 0, update: 0, error: 0, variants: 0, prices: 0 });
const addSummary = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, a[k] + (b?.[k] || 0)]));

export default function ProductImport({ onClose, onDone }) {
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState(null);
  const [preview, setPreview] = useState(null); // { summary, results }
  const [saved, setSaved] = useState(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const columnsRef = useRef(null);
  const columns = async () => {
    if (!columnsRef.current) {
      const res = await productService.importLists();
      columnsRef.current = res.data;
    }
    return columnsRef.current;
  };

  const run = (label, fn) => async () => {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
      setProgress(0);
    }
  };

  const template = run("template", async () => {
    const lists = await columns();
    await writeBook(lists.columns, [], lists, "product-import-template.xlsx");
  });

  const exportAll = run("export", async () => {
    const [lists, res] = await Promise.all([columns(), productService.exportRows()]);
    const day = new Date().toISOString().slice(0, 10);
    await writeBook(res.data.columns, res.data.rows, lists, `products-${day}.xlsx`);
  });

  // send in parts; apply = false → preview, true → save
  const send = async (list, apply) => {
    const parts = chunks(list);
    let summary = emptySummary();
    const results = [];
    for (let i = 0; i < parts.length; i++) {
      setProgress(Math.round((i / parts.length) * 100));
      const res = await productService.importRows(parts[i], apply);
      summary = addSummary(summary, res.data.summary);
      results.push(...res.data.results);
    }
    return { summary, results };
  };

  const readFile = async (file) => {
    setFileName(file.name);
    setRows(null);
    setPreview(null);
    setSaved(null);
    await run("read", async () => {
      const lists = await columns();
      const list = await readRows(file, lists.columns);
      setRows(list);
      const p = await send(list, false);
      setPreview(p);
      setFilter(p.summary.error ? "error" : "all");
    })();
  };

  const apply = run("save", async () => {
    const ok = new Set(preview.results.filter((r) => r.action !== "error").map((r) => r.product_code));
    const result = await send(
      rows.filter((r) => ok.has(r.product_code)),
      true,
    );
    setSaved(result);
    setFilter(result.summary.error ? "error" : "all");
    onDone && onDone(L(`បានរក្សាទុក ${result.summary.create + result.summary.update} ទំនិញ`, `Saved ${result.summary.create + result.summary.update} products`));
  });

  const shown = useMemo(() => {
    const list = (saved || preview)?.results || [];
    return filter === "all" ? list : list.filter((r) => r.action === filter);
  }, [preview, saved, filter]);

  const sum = (saved || preview)?.summary;
  const valid = preview ? preview.summary.create + preview.summary.update : 0;
  const ACTION = {
    create: [L("ថ្មី", "New"), "pi-new"],
    update: [L("កែ", "Update"), "pi-upd"],
    error: [L("កំហុស", "Error"), "pi-err"],
  };

  return (
    <div className="md-modal-backdrop" onMouseDown={() => !busy && onClose()}>
      <div className="md-modal md-modal-wide pi-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="md-modal-header">
          <h3>{L("នាំចូលទំនិញពី Excel", "Import products from Excel")}</h3>
          <button type="button" className="md-icon-btn" onClick={onClose} disabled={!!busy}><X size={18} /></button>
        </div>
        <div className="md-modal-body">
          <ol className="sd-steps">
            <li>
              {L("ទាញយក Template ទទេ ឬ ទំនិញទាំងអស់ (ដើម្បីកែ)", "Download an empty template, or all products (to edit)")}
              <button type="button" className="md-btn md-btn-ghost" onClick={template} disabled={!!busy}>
                <Download size={15} />Template
              </button>
              <button type="button" className="md-btn md-btn-ghost" onClick={exportAll} disabled={!!busy}>
                <FileSpreadsheet size={15} />{busy === "export" ? "…" : L("ទំនិញទាំងអស់", "All products")}
              </button>
            </li>
            <li>{L("មួយជួរ = មួយ SKU។ product_code ដូចគ្នា = ទំនិញតែមួយ។ ក្រឡាទទេ = រក្សាតម្លៃចាស់។ មើលសន្លឹក Help និង Lists។", "One row = one SKU. Same product_code = one product. Blank cell = keep the current value. See the Help and Lists sheets.")}</li>
            <li>{L("ជ្រើសឯកសារ → ពិនិត្យ → រក្សាទុក (មិនលុបអ្វីទាំងអស់)", "Choose the file → check → save (nothing is ever deleted)")}</li>
          </ol>

          <div className="pi-file">
            <input ref={fileRef} type="file" hidden accept=".xlsx" onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) readFile(f);
            }} />
            <button type="button" className="md-btn md-btn-ghost" onClick={() => fileRef.current?.click()} disabled={!!busy}>
              <Upload size={15} />{L("ជ្រើសរើសឯកសារ .xlsx", "Choose .xlsx file")}
            </button>
            {fileName && <span className="md-sub">{fileName}{rows ? ` · ${rows.length} ${L("ជួរ", "rows")}` : ""}</span>}
            {(busy === "read" || busy === "save") && (
              <span className="pi-busy">
                {busy === "read" ? L("កំពុងពិនិត្យ…", "Checking…") : L("កំពុងរក្សាទុក…", "Saving…")} {progress ? `${progress}%` : ""}
              </span>
            )}
          </div>

          {sum && (
            <>
              {saved && (
                <div className="pi-done">
                  <CheckCircle2 size={18} />
                  {L(`បានរក្សាទុក៖ ថ្មី ${saved.summary.create} · កែ ${saved.summary.update} · តម្លៃ ${saved.summary.prices}`, `Saved: ${saved.summary.create} new · ${saved.summary.update} updated · ${saved.summary.prices} prices`)}
                </div>
              )}
              <div className="pi-chips">
                {[
                  ["all", L("ទំនិញ", "Products"), sum.products],
                  ["create", L("ថ្មី", "New"), sum.create],
                  ["update", L("កែ", "Update"), sum.update],
                  ["error", L("កំហុស", "Errors"), sum.error],
                ].map(([k, label, n]) => (
                  <button key={k} type="button" className={`pi-chip ${filter === k ? "is-on" : ""} ${k === "error" && n ? "pi-chip-err" : ""}`} onClick={() => setFilter(k)}>
                    <b>{n}</b> {label}
                  </button>
                ))}
                <span className="md-sub">
                  {sum.variants} SKU · {sum.prices} {L("តម្លៃថ្មី", "price changes")}
                </span>
              </div>
              <div className="md-table-scroll pi-table">
                <table className="md-table">
                  <thead>
                    <tr>
                      <th>{L("ជួរ", "Row")}</th>
                      <th>product_code</th>
                      <th>{L("ស្ថានភាព", "Result")}</th>
                      <th>SKU</th>
                      <th>{L("តម្លៃ", "Prices")}</th>
                      <th>{L("សារ", "Message")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.slice(0, 300).map((r, i) => (
                      <tr key={r.product_code + i}>
                        <td className="md-sub">{r.rows?.length > 1 ? `${r.rows[0]}–${r.rows[r.rows.length - 1]}` : r.rows?.[0]}</td>
                        <td><code>{r.product_code}</code></td>
                        <td><span className={`pi-tag ${ACTION[r.action]?.[1] || ""}`}>{ACTION[r.action]?.[0] || r.action}</span></td>
                        <td>{r.action === "error" ? "" : r.variants}</td>
                        <td>{r.action === "error" ? "" : r.prices}</td>
                        <td className={r.action === "error" ? "pi-msg-err" : "md-sub"}>{r.message}</td>
                      </tr>
                    ))}
                    {!shown.length && (
                      <tr><td colSpan={6} className="md-empty">{L("គ្មាន", "None")}</td></tr>
                    )}
                  </tbody>
                </table>
                {shown.length > 300 && <div className="md-sub pi-more">{L(`បង្ហាញ 300 ក្នុងចំណោម ${shown.length}`, `Showing 300 of ${shown.length}`)}</div>}
              </div>
              {!saved && preview.summary.error > 0 && valid > 0 && (
                <div className="pi-warn"><AlertTriangle size={16} />{L(`ទំនិញ ${preview.summary.error} មានកំហុស នឹងត្រូវរំលង — កែក្នុង Excel ហើយនាំចូលម្តងទៀតបាន`, `${preview.summary.error} products with errors will be skipped — fix them in Excel and import again`)}</div>
              )}
            </>
          )}
          {error && <div className="md-form-error">{error}</div>}
        </div>
        <div className="md-modal-footer">
          <button type="button" className="md-btn md-btn-ghost" onClick={onClose} disabled={!!busy}>{saved ? L("បិទ", "Close") : L("បោះបង់", "Cancel")}</button>
          {!saved && (
            <button type="button" className="md-btn md-btn-primary" onClick={apply} disabled={!!busy || !valid}>
              {busy === "save" ? "…" : L(`រក្សាទុក ${valid} ទំនិញ`, `Save ${valid} products`)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
