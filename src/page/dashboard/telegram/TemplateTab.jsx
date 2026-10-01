import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, X, RotateCcw, RefreshCw } from "lucide-react";
import { telegramService } from "../../../api/api.service";
import { GROUPS, nameOf, TgBubble } from "./telegramOptions";
import { L } from "../../../i18n";

// Edit the Khmer / English text of one event; {placeholders} are filled when it is sent
function EditModal({ row, onClose, onSaved }) {
  const [kh, setKh] = useState(row.template_kh);
  const [en, setEn] = useState(row.template_en);
  const [preview, setPreview] = useState({ kh: "", en: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const focused = useRef("kh");
  const khRef = useRef(null);
  const enRef = useRef(null);

  // live preview with sample data (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      telegramService
        .previewTemplate({ template_kh: kh, template_en: en })
        .then((res) => setPreview(res.data || { kh: "", en: "" }))
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [kh, en]);

  const insert = (name) => {
    const isKh = focused.current === "kh";
    const el = isKh ? khRef.current : enRef.current;
    const value = isKh ? kh : en;
    const token = `{${name}}`;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    (isKh ? setKh : setEn)(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      // same as the built-in text → remove the custom copy (future default changes apply again)
      if (kh.trim() === row.default_kh && en.trim() === row.default_en) await telegramService.resetTemplate(row.code);
      else await telegramService.saveTemplate(row.code, { template_kh: kh, template_en: en });
      onSaved(L("អត្ថបទត្រូវបានរក្សាទុក!", "Text saved!"));
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="md-modal-backdrop" onMouseDown={() => !saving && onClose()}>
      <div className="md-modal md-modal-wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="md-modal-header">
          <h3>{nameOf(row)}</h3>
          <button type="button" className="md-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="md-modal-body">
          <div className="tg-placeholders">
            <span className="md-hint">{L("ចុចដើម្បីបញ្ចូល:", "Click to insert:")}</span>
            {row.placeholders.map((p) => (
              <button key={p} type="button" className="md-value tg-ph" onClick={() => insert(p)}>
                {`{${p}}`}
              </button>
            ))}
            <span className="md-hint">{L("· អក្សរដិត: <b>…</b>", "· bold: <b>…</b>")}</span>
          </div>
          <div className="tg-edit-grid">
            <div className="md-field">
              <label>{L("ខ្មែរ", "Khmer")}<span className="md-required">*</span></label>
              <textarea ref={khRef} rows={6} value={kh} onFocus={() => (focused.current = "kh")} onChange={(e) => setKh(e.target.value)} disabled={saving} />
              <div className="tg-chat-bg">
                <TgBubble text={preview.kh} />
              </div>
            </div>
            <div className="md-field">
              <label>{L("អង់គ្លេស", "English")}</label>
              <textarea ref={enRef} rows={6} value={en} onFocus={() => (focused.current = "en")} onChange={(e) => setEn(e.target.value)} disabled={saving} />
              <div className="tg-chat-bg">
                <TgBubble text={preview.en} />
              </div>
            </div>
          </div>
          <p className="md-hint">{L("ការមើលជាមុនប្រើទិន្នន័យគំរូ។", "The preview uses sample data.")}</p>
          {error && <div className="md-form-error">{error}</div>}
        </div>
        <div className="md-modal-footer">
          <button type="button" className="md-btn md-btn-ghost" onClick={() => { setKh(row.default_kh); setEn(row.default_en); }} disabled={saving}>
            <RotateCcw size={14} />
            {L("ប្រើអត្ថបទដើម", "Use default text")}
          </button>
          <button type="button" className="md-btn md-btn-ghost" onClick={onClose} disabled={saving}>
            {L("បោះបង់", "Cancel")}
          </button>
          <button type="button" className="md-btn md-btn-primary" onClick={save} disabled={saving || !kh.trim()}>
            {saving ? L("កំពុងរក្សាទុក...", "Saving...") : L("រក្សាទុក", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplateTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await telegramService.templates();
      setRows(res.data || []);
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const groups = [...new Set(rows.map((r) => r.group))];

  return (
    <>
      {notice && <div className={`md-notice md-notice-${notice.type}`}>{notice.text}</div>}
      <div className="md-toolbar">
        <div className="md-toolbar-left md-hint">
          {L("អត្ថបទដែល Bot ផ្ញើពេលមានព្រឹត្តិការណ៍។ {…} ត្រូវបានជំនួសដោយទិន្នន័យពិត។", "The text a bot sends for each event. {…} is replaced with real data.")}
        </div>
        <div className="md-toolbar-actions">
          <button type="button" className="md-btn md-btn-ghost" onClick={load} disabled={loading} title={L("ផ្ទុកឡើងវិញ", "Reload")}>
            <RefreshCw size={16} className={loading ? "md-spin" : ""} />
          </button>
        </div>
      </div>
      {groups.map((g) => (
        <div key={g} className="md-card tg-tpl-group">
          <div className="tg-tpl-title">{GROUPS[g] || g}</div>
          {rows
            .filter((r) => r.group === g)
            .map((r) => (
              <div key={r.code} className="tg-tpl-row">
                <div className="tg-tpl-name">
                  <b>{nameOf(r)}</b>
                  <span className="md-sub">
                    <span className="md-code">{r.code}</span>
                    {r.custom && <span className="md-badge md-badge-gold">{L("បានកែ", "Edited")}</span>}
                    {r.phase >= 3 && <span className="md-badge md-badge-off">{L("POS ឆាប់ៗ", "POS, coming")}</span>}
                  </span>
                </div>
                <div className="tg-tpl-text">
                  <TgBubble text={L(r.template_kh, r.template_en || r.template_kh)} />
                </div>
                <div className="tg-tpl-actions">
                  <button type="button" className="md-icon-btn" onClick={() => setEditing(r)} title={L("កែប្រែ", "Edit")}>
                    <Pencil size={15} />
                  </button>
                </div>
              </div>
            ))}
        </div>
      ))}
      {editing && (
        <EditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setNotice({ type: "success", text });
            load();
          }}
        />
      )}
    </>
  );
}

export default TemplateTab;
