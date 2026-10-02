import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Ban, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Plus, Printer, RefreshCw, RotateCcw, ScanBarcode, Search, Send, X } from "lucide-react";
import { categoryService, countService, warehouseService } from "../../../api/api.service";
import { flattenTree } from "../product/productOptions";
import { canManageStock, dateOnly, isShopUser, nameKh, qtyText, toDateInput, unitLabel, usd, userName } from "./stockOptions";
import { L } from "../../../i18n";
import { usePortal } from "../../portal/portalContext";
import Select from "../../util/Select"; // searchable <select>
import "../master_data/masterdata.style.css";
import "../master_data/masterdata.theme.css";
import "../product/product.style.css";
import "./stock.style.css";

// Stock count (blind): shop or central counts → submit (system qty taken, differences shown) → central posts
// (one stock adjustment, reason "stock_count") · reopen sends it back to counting.

const PAGE_SIZES = [10, 20, 50];
const SHOW_STEP = 200; // lines rendered at a time
const STATES = {
  counting: { label: L("កំពុងរាប់", "Counting"), badge: "md-badge-gold" },
  submitted: { label: L("បានបញ្ជូន", "Submitted"), badge: "md-badge-gold sc-submitted" },
  posted: { label: L("បាន Post", "Posted"), badge: "md-badge-on" },
  cancelled: { label: L("បានបោះបង់", "Cancelled"), badge: "md-badge-danger" },
};
const badge = (s) => <span className={`md-badge ${STATES[s]?.badge || ""}`}>{STATES[s]?.label || s}</span>;
const lineName = (l) => L(l.name_kh || l.name_en, l.name_en || l.name_kh);
const signed = (n) => (n > 0 ? `+${qtyText(n)}` : qtyText(n));
const isCounted = (l) => l.counted_qty !== null && l.counted_qty !== undefined;
// money with the sign first: −$27.50
const money = (v) => (v === null || v === undefined ? "" : v < 0 ? `−${usd(-v)}` : usd(v));
const printCount = (id) => window.open(`/print/count/${id}`, "_blank");

// ======================================================================================
// Counting / review screen for one count
// ======================================================================================
function CountSheet({ id, onBack, notify, notice }) {
  const manage = canManageStock() && !isShopUser();
  const shopUser = isShopUser();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState("");
  const [edits, setEdits] = useState({}); // lineId → counted text (not saved yet)
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [filter, setFilter] = useState("all");
  const [text, setText] = useState("");
  const [shown, setShown] = useState(SHOW_STEP);
  const [scan, setScan] = useState("");
  const [flash, setFlash] = useState(null);
  const [adding, setAdding] = useState(null); // { code, counted_qty, batch_no, expiry_date }
  const [confirm, setConfirm] = useState(null);
  const scanRef = useRef(null);
  const inputs = useRef({});

  const load = useCallback(async () => {
    try {
      const res = await countService.get(id);
      setDoc(res.data);
      setFilter((f) => (res.data.state === "counting" ? f : f === "all" ? "diff" : f));
    } catch (err) {
      setError(err.message);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const counting = doc?.state === "counting";
  const dirty = Object.keys(edits).length > 0;

  // ---------- save (debounced auto-save while counting) ----------
  const editsRef = useRef(edits);
  editsRef.current = edits;
  const save = useCallback(
    async (extra = {}) => {
      const pending = editsRef.current;
      const counts = Object.entries(pending).map(([_id, v]) => ({ _id, counted_qty: v === "" ? null : Number(v) }));
      if (!counts.length && !extra.add) return true;
      setSaving(true);
      try {
        const res = await countService.save(id, { counts, ...extra });
        setDoc(res.data);
        // keep edits typed while the request was running
        setEdits((now) => Object.fromEntries(Object.entries(now).filter(([k, v]) => pending[k] !== v)));
        setSavedAt(new Date());
        return true;
      } catch (err) {
        notify("error", err.message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [id, notify],
  );
  useEffect(() => {
    if (!dirty || !counting) return undefined;
    const t = setTimeout(() => save(), 2500);
    return () => clearTimeout(t);
  }, [edits, dirty, counting, save]);
  // warn before closing the tab with unsaved counts
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const valueOf = (l) => (edits[l._id] !== undefined ? edits[l._id] : isCounted(l) ? String(l.counted_qty) : "");
  const setValue = (l, v) => {
    if (v !== "" && !/^\d*\.?\d*$/.test(v)) return;
    setEdits((e) => ({ ...e, [l._id]: v }));
  };

  // ---------- scan / type a SKU or barcode ----------
  const onScan = (e) => {
    e.preventDefault();
    const code = scan.trim();
    if (!code) return;
    const key = code.toUpperCase();
    const hits = doc.lines.filter((l) => (l.sku || "").toUpperCase() === key || (l.barcode || "") === code);
    setScan("");
    if (!hits.length) {
      setAdding({ code, counted_qty: "1", batch_no: "", expiry_date: "" });
      return;
    }
    const l = hits[0];
    setFilter("all");
    setText("");
    if (hits.length === 1 && !l.track_batch) {
      const cur = Number(valueOf(l) || 0);
      setValue(l, String(cur + 1));
    }
    setFlash(l._id);
    setTimeout(() => {
      const el = inputs.current[l._id];
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        if (hits.length > 1 || l.track_batch) el.focus();
      }
    }, 50);
    setTimeout(() => setFlash(null), 1600);
  };

  const addItem = async () => {
    const a = adding;
    if (!a.code.trim()) return;
    const ok = await save({
      add: [{ sku: a.code.trim(), counted_qty: a.counted_qty === "" ? null : Number(a.counted_qty), batch_no: a.batch_no || undefined, expiry_date: a.expiry_date || undefined }],
    });
    if (ok) {
      setAdding(null);
      notify("success", L("បានបន្ថែមទំនិញ", "Item added"));
      scanRef.current?.focus();
    }
  };

  // ---------- actions ----------
  const act = async (fn, okText) => {
    setSaving(true);
    try {
      const res = await fn();
      setDoc(res.data);
      setEdits({});
      setConfirm(null);
      notify("success", res.message || okText);
      if (res.data.state !== "counting") setFilter("diff");
    } catch (err) {
      notify("error", err.message);
    } finally {
      setSaving(false);
    }
  };
  const submit = async (uncounted) => {
    if (dirty && !(await save())) return;
    act(() => countService.submit(id, { uncounted }), L("បានបញ្ជូន", "Submitted"));
  };

  // ---------- lines shown ----------
  const lines = useMemo(() => {
    if (!doc) return [];
    const q = text.trim().toLowerCase();
    return doc.lines.filter((l) => {
      const c = edits[l._id] !== undefined ? edits[l._id] !== "" : isCounted(l);
      if (filter === "todo" && c) return false;
      if (filter === "done" && !c) return false;
      if (filter === "diff" && !l.diff_qty) return false;
      if (!q) return true;
      return [l.sku, l.barcode, l.name_kh, l.name_en, l.batch_no].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [doc, edits, filter, text]);
  useEffect(() => setShown(SHOW_STEP), [filter, text]);

  if (error) return <div className="md-page"><div className="md-empty md-empty-error">{error}</div></div>;
  if (!doc) return <div className="md-page"><div className="md-empty">{L("កំពុងផ្ទុក...", "Loading...")}</div></div>;

  const counted = doc.lines.filter((l) => (edits[l._id] !== undefined ? edits[l._id] !== "" : isCounted(l))).length;
  const pct = doc.lines.length ? Math.round((counted / doc.lines.length) * 100) : 0;
  const todo = doc.lines.length - counted;
  const tabs = counting
    ? [["all", L("ទាំងអស់", "All"), doc.lines.length], ["todo", L("មិនទាន់រាប់", "Not counted"), todo], ["done", L("បានរាប់", "Counted"), counted]]
    : [["diff", L("មានខុសគ្នា", "Differences"), doc.diff_lines], ["all", L("ទាំងអស់", "All"), doc.lines.length], ["todo", L("មិនបានរាប់", "Not counted"), todo]];

  return (
    <div className="md-page sc-page">
      {notice && <div className={`md-notice md-notice-${notice.type}`}>{notice.text}</div>}
      <div className="sc-head md-card">
        <button type="button" className="md-btn md-btn-ghost" onClick={async () => { if (dirty) await save(); onBack(); }}>
          <ArrowLeft size={16} />{L("ត្រឡប់", "Back")}
        </button>
        <div className="sc-title">
          <b>{doc.doc_no}</b> {badge(doc.state)}
          <span className="md-sub">
            {nameKh(doc.warehouse_id)} ({doc.warehouse_id?.code}) · {doc.category_id ? nameKh(doc.category_id) : L("ទំនិញទាំងអស់", "All products")} · {dateOnly(doc.doc_date)} · {userName(doc.created_by)}
          </span>
        </div>
        <div className="sc-actions">
          <button type="button" className="md-btn md-btn-ghost" onClick={() => printCount(doc._id)}><Printer size={16} />{counting ? L("សន្លឹករាប់", "Count sheet") : L("បោះពុម្ព", "Print")}</button>
          {(counting || doc.state === "submitted") && (
            <button type="button" className="md-btn md-btn-ghost sc-danger" disabled={saving} onClick={() => setConfirm({ kind: "cancel" })}><Ban size={16} />{L("បោះបង់", "Cancel")}</button>
          )}
          {doc.state === "submitted" && manage && (
            <button type="button" className="md-btn md-btn-ghost" disabled={saving} onClick={() => setConfirm({ kind: "reopen" })}><RotateCcw size={16} />{L("រាប់ឡើងវិញ", "Reopen")}</button>
          )}
          {counting && (
            <button type="button" className="md-btn md-btn-primary" disabled={saving} onClick={() => setConfirm({ kind: "submit", uncounted: "skip" })}><Send size={16} />{L("បញ្ជូន", "Submit")}</button>
          )}
          {doc.state === "submitted" && manage && (
            <button type="button" className="md-btn md-btn-primary" disabled={saving} onClick={() => setConfirm({ kind: "post" })}><CheckCircle2 size={16} />{L("Post ចូលស្តុក", "Post to stock")}</button>
          )}
        </div>
      </div>

      {/* progress / result */}
      <div className="sc-stats">
        <div className="sc-stat">
          <span>{L("បានរាប់", "Counted")}</span>
          <b>{counted} / {doc.lines.length}</b>
          <div className="sc-bar"><i style={{ width: `${pct}%` }} /></div>
        </div>
        {!counting && (
          <>
            <div className="sc-stat"><span>{L("ជួរខុសគ្នា", "Lines with difference")}</span><b>{doc.diff_lines}</b></div>
            <div className="sc-stat"><span>{L("លើស", "Over")}</span><b className="sc-up">+{qtyText(doc.diff_in_qty)}</b></div>
            <div className="sc-stat"><span>{L("ខ្វះ", "Short")}</span><b className="sc-down">−{qtyText(doc.diff_out_qty)}</b></div>
            {!shopUser && doc.diff_cost !== null && doc.diff_cost !== undefined && (
              <div className="sc-stat"><span>{L("តម្លៃខុសគ្នា", "Value of difference")}</span><b className={doc.diff_cost < 0 ? "sc-down" : "sc-up"}>{money(doc.diff_cost)}</b></div>
            )}
            {doc.state === "submitted" && (
              <div className="sc-stat"><span>{L("ជួរមិនបានរាប់", "Not counted")}</span><b>{doc.uncounted === "zero" ? L("= 0 (បាត់)", "= 0 (missing)") : L("រំលង", "skipped")}</b></div>
            )}
            {doc.adjustment_id && (
              <div className="sc-stat"><span>{L("ការកែតម្រូវ", "Adjustment")}</span><b>{doc.adjustment_id.doc_no}</b></div>
            )}
          </>
        )}
        {counting && (
          <div className="sc-stat sc-save">
            <span>{L("រក្សាទុក", "Saved")}</span>
            <b>{saving ? L("កំពុងរក្សាទុក…", "Saving…") : dirty ? L("មិនទាន់រក្សាទុក", "Not saved yet") : savedAt ? savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "✓"}</b>
          </div>
        )}
      </div>

      <div className="md-toolbar">
        <div className="md-toolbar-left">
          {counting && (
            <form className="md-search sc-scan" onSubmit={onScan}>
              <ScanBarcode size={16} />
              <input ref={scanRef} autoFocus placeholder={L("ស្កេនបាកូដ / វាយ SKU រួចចុច Enter (+1)", "Scan barcode / type SKU + Enter (+1)")} value={scan} onChange={(e) => setScan(e.target.value)} />
            </form>
          )}
          <div className="md-search">
            <Search size={16} />
            <input placeholder={L("ស្វែងរកក្នុងបញ្ជី...", "Find in the list...")} value={text} onChange={(e) => setText(e.target.value)} />
            {text && <button type="button" onClick={() => setText("")}><X size={14} /></button>}
          </div>
          <div className="sc-tabs">
            {tabs.map(([k, label, n]) => (
              <button key={k} type="button" className={filter === k ? "is-on" : ""} onClick={() => setFilter(k)}>{label} <b>{n}</b></button>
            ))}
          </div>
        </div>
        <div className="md-toolbar-actions">
          {counting && (
            <>
              <button type="button" className="md-btn md-btn-ghost" onClick={() => setAdding({ code: "", counted_qty: "", batch_no: "", expiry_date: "" })}><Plus size={16} />{L("បន្ថែមទំនិញ", "Add item")}</button>
              <button type="button" className="md-btn md-btn-primary" disabled={!dirty || saving} onClick={() => save()}>{L("រក្សាទុក", "Save")}</button>
            </>
          )}
        </div>
      </div>

      <div className="md-card">
        <div className="md-table-scroll">
          <table className="md-table sc-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{L("ទំនិញ", "Item")}</th>
                <th>Batch</th>
                <th>{L("ឯកតា", "Unit")}</th>
                {!counting && <th className="sc-r">{L("ក្នុងប្រព័ន្ធ", "System")}</th>}
                <th className="sc-r">{L("រាប់បាន", "Counted")}</th>
                {!counting && <th className="sc-r">{L("ខុសគ្នា", "Difference")}</th>}
                {!counting && !shopUser && <th className="sc-r">{L("តម្លៃ", "Value")}</th>}
              </tr>
            </thead>
            <tbody>
              {!lines.length && <tr><td colSpan={8} className="md-empty">{L("គ្មាន", "None")}</td></tr>}
              {lines.slice(0, shown).map((l) => (
                <tr key={l._id} className={`${flash === l._id ? "sc-flash" : ""} ${l.added ? "sc-added" : ""}`}>
                  <td className="md-sub">{doc.lines.indexOf(l) + 1}</td>
                  <td>
                    <b className="sc-name">{lineName(l)}</b>
                    <span className="md-sub"><code>{l.sku}</code>{l.barcode ? ` · ${l.barcode}` : ""}{l.added ? ` · ${L("បន្ថែម", "added")}` : ""}</span>
                  </td>
                  <td className="sc-batch">
                    {l.track_batch ? (
                      <>
                        {l.batch_no || <span className="md-sub">{L("គ្មាន batch", "no batch")}</span>}
                        {l.expiry_date && <span className="md-sub">{dateOnly(l.expiry_date)}</span>}
                      </>
                    ) : (
                      <span className="md-sub">-</span>
                    )}
                  </td>
                  <td>{unitLabel(l.unit_code, l.unit_name_kh, l.unit_name_en)}</td>
                  {!counting && <td className="sc-r">{qtyText(l.expected_qty)}</td>}
                  <td className="sc-r">
                    {counting ? (
                      <input
                        ref={(el) => (inputs.current[l._id] = el)}
                        className={`pe-input sc-qty ${edits[l._id] !== undefined ? "is-dirty" : ""}`}
                        inputMode="decimal"
                        value={valueOf(l)}
                        placeholder="—"
                        onChange={(e) => setValue(l, e.target.value.trim())}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            scanRef.current?.focus();
                          }
                        }}
                      />
                    ) : isCounted(l) ? (
                      qtyText(l.counted_qty)
                    ) : (
                      <span className="md-sub">—</span>
                    )}
                  </td>
                  {!counting && <td className={`sc-r ${l.diff_qty > 0 ? "sc-up" : l.diff_qty < 0 ? "sc-down" : "md-sub"}`}>{l.diff_qty ? signed(l.diff_qty) : "0"}</td>}
                  {!counting && !shopUser && <td className={`sc-r ${l.diff_cost < 0 ? "sc-down" : ""}`}>{l.diff_cost ? money(l.diff_cost) : ""}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lines.length > shown && (
          <div className="sc-more">
            <button type="button" className="md-btn md-btn-ghost" onClick={() => setShown((n) => n + SHOW_STEP)}>
              {L(`បង្ហាញបន្ថែម (${lines.length - shown} ទៀត)`, `Show more (${lines.length - shown} left)`)}
            </button>
          </div>
        )}
      </div>

      {/* ---------- add an item found on the shelf ---------- */}
      {adding && (
        <div className="md-modal-backdrop" onMouseDown={() => !saving && setAdding(null)}>
          <div className="md-modal md-modal-sm" onMouseDown={(e) => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>{L("បន្ថែមទំនិញមិននៅក្នុងបញ្ជី", "Add an item not in the list")}</h3>
              <button type="button" className="md-icon-btn" onClick={() => setAdding(null)}><X size={18} /></button>
            </div>
            <div className="md-modal-body">
              <div className="md-fields">
                <div className="md-field">
                  <label>{L("SKU ឬ បាកូដ", "SKU or barcode")}<span className="md-required">*</span></label>
                  <input className="pe-input" autoFocus value={adding.code} onChange={(e) => setAdding({ ...adding, code: e.target.value })} />
                </div>
                <div className="md-field">
                  <label>{L("ចំនួនរាប់បាន (ឯកតាគោល)", "Counted qty (base unit)")}</label>
                  <input className="pe-input" inputMode="decimal" value={adding.counted_qty} onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && setAdding({ ...adding, counted_qty: e.target.value })} />
                </div>
                <div className="md-fields md-fields-grid">
                  <div className="md-field">
                    <label>{L("លេខ Batch (បើមាន)", "Batch no (if any)")}</label>
                    <input className="pe-input" value={adding.batch_no} onChange={(e) => setAdding({ ...adding, batch_no: e.target.value })} />
                  </div>
                  <div className="md-field">
                    <label>{L("ថ្ងៃផុតកំណត់", "Expiry")}</label>
                    <input type="date" className="pe-input" value={adding.expiry_date} onChange={(e) => setAdding({ ...adding, expiry_date: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
            <div className="md-modal-footer">
              <button type="button" className="md-btn md-btn-ghost" onClick={() => setAdding(null)} disabled={saving}>{L("បោះបង់", "Cancel")}</button>
              <button type="button" className="md-btn md-btn-primary" onClick={addItem} disabled={saving || !adding.code.trim()}>{saving ? "…" : L("បន្ថែម", "Add")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- confirm ---------- */}
      {confirm && (
        <div className="md-modal-backdrop" onMouseDown={() => !saving && setConfirm(null)}>
          <div className="md-modal md-modal-sm" onMouseDown={(e) => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>
                {confirm.kind === "submit" && L("បញ្ជូនការរាប់", "Submit the count")}
                {confirm.kind === "post" && L("Post ចូលស្តុក", "Post to stock")}
                {confirm.kind === "reopen" && L("រាប់ឡើងវិញ", "Reopen for counting")}
                {confirm.kind === "cancel" && L("បោះបង់ការរាប់", "Cancel the count")}
              </h3>
            </div>
            <div className="md-modal-body">
              {confirm.kind === "submit" && (
                <>
                  <p>{L("ប្រព័ន្ធនឹងយកចំនួនស្តុកពេលនេះ ហើយបង្ហាញភាពខុសគ្នា។ ក្រោយបញ្ជូន មិនអាចកែចំនួនបានទេ (លុះត្រាតែ​ការិយាល័យកណ្តាល​បើកឡើងវិញ)។", "The system qty is taken now and the differences are shown. Counts can't be changed after this (unless central reopens it).")}</p>
                  {todo > 0 && (
                    <div className="sc-choice">
                      <b>{L(`${todo} ជួរមិនទាន់រាប់៖`, `${todo} lines not counted:`)}</b>
                      <label><input type="radio" checked={confirm.uncounted === "skip"} onChange={() => setConfirm({ ...confirm, uncounted: "skip" })} />{L("រំលង (មិនប៉ះពាល់ស្តុក)", "Skip them (stock unchanged)")}</label>
                      <label><input type="radio" checked={confirm.uncounted === "zero"} onChange={() => setConfirm({ ...confirm, uncounted: "zero" })} />{L("រាប់ជា 0 (បាត់ទាំងអស់)", "Count them as 0 (all missing)")}</label>
                    </div>
                  )}
                </>
              )}
              {confirm.kind === "post" && (
                <p>
                  {L(`បង្កើតការកែតម្រូវស្តុក ${doc.diff_lines} ជួរ (លើស +${qtyText(doc.diff_in_qty)} / ខ្វះ −${qtyText(doc.diff_out_qty)}) ហើយ Post ភ្លាម? មិនអាចត្រឡប់វិញបានទេ។`, `Create and post a stock adjustment with ${doc.diff_lines} lines (over +${qtyText(doc.diff_in_qty)} / short −${qtyText(doc.diff_out_qty)})? This can't be undone.`)}
                </p>
              )}
              {confirm.kind === "reopen" && <p>{L("ត្រឡប់ទៅរាប់វិញ (ចំនួនក្នុងប្រព័ន្ធនឹងយកម្តងទៀតពេលបញ្ជូន)?", "Send it back to counting? The system qty is taken again on the next submit.")}</p>}
              {confirm.kind === "cancel" && <p>{L(`បោះបង់ ${doc.doc_no}? ស្តុកមិនប៉ះពាល់ទេ។`, `Cancel ${doc.doc_no}? Stock is not changed.`)}</p>}
            </div>
            <div className="md-modal-footer">
              <button type="button" className="md-btn md-btn-ghost" onClick={() => setConfirm(null)} disabled={saving}>{L("ទេ", "No")}</button>
              <button
                type="button"
                className={`md-btn ${confirm.kind === "cancel" ? "md-btn-danger" : "md-btn-primary"}`}
                disabled={saving}
                onClick={() => {
                  if (confirm.kind === "submit") submit(confirm.uncounted);
                  if (confirm.kind === "post") act(() => countService.post(id), L("បាន Post", "Posted"));
                  if (confirm.kind === "reopen") act(() => countService.reopen(id), L("បានបើកឡើងវិញ", "Reopened"));
                  if (confirm.kind === "cancel") act(() => countService.cancel(id), L("បានបោះបង់", "Cancelled"));
                }}
              >
                {saving ? "…" : L("បាទ / ចាស", "Yes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ======================================================================================
// List of counts + new count
// ======================================================================================
function StockCountComponent() {
  const portal = usePortal();
  const shopUser = isShopUser();
  const [openId, setOpenId] = useState(null);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZES[0]);
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [notice, setNotice] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [creating, setCreating] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const notify = useCallback((type, text) => setNotice({ type, text }), []);

  useEffect(() => {
    warehouseService.all().then((r) => setWarehouses(r.data || [])).catch(() => {});
    categoryService.tree().then((r) => setCategories(flattenTree(r.data || []))).catch(() => {});
  }, []);
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const loadSeq = useRef(0);
  const loadData = useCallback(async () => {
    const seq = ++loadSeq.current;
    const apply = (res) => {
      if (seq !== loadSeq.current) return;
      setRows(res.data || []);
      setPagination(res.pagination || { total: 0, totalPages: 1 });
    };
    const params = { page, limit, q: search || undefined, sort: "created_date", order: "desc", state: state || undefined, warehouse_id: portal ? portal._id : warehouseId || undefined };
    setLoading(true);
    setListError("");
    try {
      const res = await countService.list(params, { onFresh: apply });
      apply(res);
    } catch (err) {
      setListError(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, state, warehouseId, portal]);
  useEffect(() => {
    if (!openId) loadData();
  }, [loadData, openId]);
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setSearch(keyword.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [keyword]);

  const create = async () => {
    if (!creating.warehouse_id) return setFormError(L("សូមជ្រើសរើសឃ្លាំង", "Choose a warehouse"));
    setBusy(true);
    setFormError("");
    try {
      const res = await countService.create({ warehouse_id: creating.warehouse_id, category_id: creating.category_id || undefined, note: creating.note, doc_date: creating.doc_date });
      setCreating(null);
      notify("success", res.message);
      setOpenId(res.data._id);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (openId) {
    return (
      <CountSheet id={openId} notify={notify} notice={notice} onBack={() => setOpenId(null)} />
    );
  }

  const totalPages = Math.max(pagination.totalPages || 1, 1);
  const myWarehouses = portal ? [portal] : warehouses;
  return (
    <div className="md-page">
      {notice && <div className={`md-notice md-notice-${notice.type}`}>{notice.text}</div>}

      <div className="md-toolbar">
        <div className="md-toolbar-left">
          <div className="md-search">
            <Search size={16} />
            <input placeholder={L("ស្វែងរកលេខឯកសារ...", "Search number...")} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            {keyword && <button type="button" onClick={() => setKeyword("")}><X size={14} /></button>}
          </div>
          <Select className="md-filter" value={state} onChange={(e) => { setPage(1); setState(e.target.value); }}>
            <option value="">{L("-- ស្ថានភាពទាំងអស់ --", "-- All status --")}</option>
            {Object.entries(STATES).map(([k, s]) => (
              <option key={k} value={k}>{s.label}</option>
            ))}
          </Select>
          {!portal && (
            <Select className="md-filter" value={warehouseId} onChange={(e) => { setPage(1); setWarehouseId(e.target.value); }}>
              <option value="">{L("-- ឃ្លាំងទាំងអស់ --", "-- All warehouses --")}</option>
              {warehouses.map((w) => (
                <option key={w._id} value={w._id}>{nameKh(w)} ({w.code})</option>
              ))}
            </Select>
          )}
        </div>
        <div className="md-toolbar-actions">
          <button type="button" className="md-btn md-btn-ghost" onClick={loadData} disabled={loading} title={L("ផ្ទុកឡើងវិញ", "Reload")}>
            <RefreshCw size={16} className={loading ? "md-spin" : ""} />
          </button>
          <button
            type="button"
            className="md-btn md-btn-primary"
            onClick={() => {
              setFormError("");
              setCreating({ warehouse_id: portal ? portal._id : myWarehouses.length === 1 ? myWarehouses[0]._id : "", category_id: "", note: "", doc_date: toDateInput(new Date()) });
            }}
          >
            <ClipboardCheck size={16} />
            {L("ចាប់ផ្តើមរាប់ស្តុក", "Start a count")}
          </button>
        </div>
      </div>

      <div className="md-card">
        <div className="md-table-scroll">
          <table className="md-table">
            <thead>
              <tr>
                <th>{L("លេខ", "No.")}</th>
                <th>{L("កាលបរិច្ឆេទ", "Date")}</th>
                <th>{L("ឃ្លាំង", "Warehouse")}</th>
                <th>{L("ប្រភេទ", "Category")}</th>
                <th>{L("បានរាប់", "Counted")}</th>
                <th>{L("ខុសគ្នា", "Differences")}</th>
                {!shopUser && <th>{L("តម្លៃ", "Value")}</th>}
                <th>{L("ស្ថានភាព", "Status")}</th>
                <th className="md-col-actions">{L("សកម្មភាព", "Activity")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && !rows.length && <tr><td colSpan={9} className="md-empty">{L("កំពុងផ្ទុកទិន្នន័យ...", "Loading data...")}</td></tr>}
              {!loading && listError && <tr><td colSpan={9} className="md-empty md-empty-error">{listError}</td></tr>}
              {!loading && !listError && !rows.length && <tr><td colSpan={9} className="md-empty">{L("មិនទាន់មានការរាប់ស្តុក", "No stock counts yet")}</td></tr>}
              {rows.map((d) => (
                <tr key={d._id}>
                  <td><button type="button" className="sd-no" onClick={() => setOpenId(d._id)}>{d.doc_no}</button></td>
                  <td>{dateOnly(d.doc_date)}</td>
                  <td>{nameKh(d.warehouse_id)} <span className="md-sub">({d.warehouse_id?.code})</span></td>
                  <td>{d.category_id ? nameKh(d.category_id) : <span className="md-sub">{L("ទាំងអស់", "All")}</span>}</td>
                  <td>{d.counted_lines} / {d.total_lines}</td>
                  <td>
                    {d.state === "counting" || d.state === "cancelled" ? (
                      <span className="md-sub">-</span>
                    ) : (
                      <span>
                        {d.diff_lines} {L("ជួរ", "lines")} <span className="sc-up">+{qtyText(d.diff_in_qty)}</span> <span className="sc-down">−{qtyText(d.diff_out_qty)}</span>
                      </span>
                    )}
                  </td>
                  {!shopUser && <td>{d.diff_cost !== null && d.diff_cost !== undefined ? money(d.diff_cost) : <span className="md-sub">-</span>}</td>}
                  <td>{badge(d.state)}</td>
                  <td className="md-col-actions">
                    <button type="button" className="md-icon-btn" title={L("បោះពុម្ព", "Print")} onClick={() => printCount(d._id)}><Printer size={15} /></button>
                    <button type="button" className={`md-btn ${d.state === "counting" ? "md-btn-primary" : "md-btn-ghost"} sc-open`} onClick={() => setOpenId(d._id)}>
                      {d.state === "counting" ? L("រាប់", "Count") : d.state === "submitted" ? L("ពិនិត្យ", "Review") : L("មើល", "View")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md-pagination">
          <div className="md-page-size">
            {L("បង្ហាញ", "Show")}
            <Select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </Select>
            {L("/ សរុប", "/ total")} {pagination.total || 0}
          </div>
          <div className="md-pager">
            <button type="button" className="md-icon-btn" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button>
            <span>{L("ទំព័រ", "Page")} {page} / {totalPages}</span>
            <button type="button" className="md-icon-btn" disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {creating && (
        <div className="md-modal-backdrop" onMouseDown={() => !busy && setCreating(null)}>
          <div className="md-modal md-modal-sm" onMouseDown={(e) => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>{L("ចាប់ផ្តើមរាប់ស្តុក", "Start a stock count")}</h3>
              <button type="button" className="md-icon-btn" onClick={() => setCreating(null)} disabled={busy}><X size={18} /></button>
            </div>
            <div className="md-modal-body">
              <p className="md-sub sc-intro">
                {L("រាប់ដោយមិនឃើញចំនួនក្នុងប្រព័ន្ធ (Blind count)។ ពេលបញ្ជូន ប្រព័ន្ធបង្ហាញភាពខុសគ្នា ហើយការិយាល័យកណ្តាល Post ជាការកែតម្រូវស្តុក។", "Blind count: the system qty is hidden while counting. On submit the differences are shown, and central posts them as a stock adjustment.")}
              </p>
              <div className="md-fields">
                <div className="md-field">
                  <label>{L("ឃ្លាំង", "Warehouse")}<span className="md-required">*</span></label>
                  <Select className="pe-input" value={creating.warehouse_id} disabled={!!portal} onChange={(e) => setCreating({ ...creating, warehouse_id: e.target.value })}>
                    <option value="">{L("-- ជ្រើសរើស --", "-- Choose --")}</option>
                    {myWarehouses.map((w) => (
                      <option key={w._id} value={w._id}>{nameKh(w)} ({w.code})</option>
                    ))}
                  </Select>
                </div>
                <div className="md-field">
                  <label>{L("ប្រភេទទំនិញ", "Category")}</label>
                  <Select className="pe-input" value={creating.category_id} onChange={(e) => setCreating({ ...creating, category_id: e.target.value })}>
                    <option value="">{L("-- ទំនិញទាំងអស់ --", "-- All products --")}</option>
                    {categories.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="md-field">
                  <label>{L("កំណត់សម្គាល់", "Note")}</label>
                  <input className="pe-input" value={creating.note} onChange={(e) => setCreating({ ...creating, note: e.target.value })} />
                </div>
              </div>
              {formError && <div className="md-form-error">{formError}</div>}
            </div>
            <div className="md-modal-footer">
              <button type="button" className="md-btn md-btn-ghost" onClick={() => setCreating(null)} disabled={busy}>{L("បោះបង់", "Cancel")}</button>
              <button type="button" className="md-btn md-btn-primary" onClick={create} disabled={busy}>{busy ? "…" : L("ចាប់ផ្តើម", "Start")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StockCountComponent;
