import React, { useEffect, useRef, useState } from "react";
import { Building2, ImagePlus, Percent, Receipt, Save, Boxes, X, Palette, Check } from "lucide-react";
import { SKIN_LIST } from "../../theme/themes";
import { setSkin } from "../../theme/default/color.script";
import { settingService, uploadService } from "../../../api/api.service";
import { TAX_MODE_OPTIONS, canEditSetup } from "./setupOptions";
import "../master_data/masterdata.style.css";
import "./setup.style.css";

import { L } from "../../../i18n";
import Select from "../../util/Select"; // searchable <select>
const EMPTY = {
  company_name_kh: "",
  company_name_en: "",
  logo: null,
  address: "",
  phone: "",
  email: "",
  vat_no: "",
  khr_rounding: 100,
  tax_mode: "none",
  tax_rate: 0,
  tax_name: "VAT",
  receipt_header: "",
  receipt_footer: "",
  low_stock_default: 5,
  expiry_alert_days: 30,
  ui_theme: "forest",
};

function Field({ label, hint, children, full }) {
  return (
    <div className={`md-field ${full ? "st-full" : ""}`}>
      <label>{label}</label>
      {children}
      {hint && <span className="md-sub">{hint}</span>}
    </div>
  );
}

// Mini picture of a theme (sidebar + card + button) in its own colors
function ThemePreview({ skin }) {
  const c = skin.light;
  const r = (px) => `${Math.round(px * skin.radius)}px`;
  const navySide = skin.key === "navy";
  return (
    <div className="st-theme-shot" style={{ background: c.background.app, borderRadius: r(12), fontFamily: `"${skin.fontName}", system-ui` }}>
      <div className="st-theme-side" style={{ background: navySide ? "#13213a" : c.background.sidebar, borderRadius: r(9) }}>
        <i style={{ background: c.gradient.button, borderRadius: r(6) }} />
        <b style={{ background: navySide ? c.gold.main : c.primary.main }} />
        <b style={{ background: navySide ? "#4a5a75" : c.border.strong }} />
        <b style={{ background: navySide ? "#4a5a75" : c.border.strong }} />
      </div>
      <div className="st-theme-main">
        <div className="st-theme-hero" style={{ background: c.gradient.primary, borderRadius: r(10) }}>Aa</div>
        <div className="st-theme-card" style={{ background: c.background.card, borderRadius: r(10), color: c.text.primary }}>
          <span style={{ background: c.primary.soft, color: c.primary.dark, borderRadius: skin.key === "ocean" ? "4px" : skin.key === "navy" ? "5px" : "999px" }}>{skin.name_en}</span>
          <em style={{ background: c.gradient.button, borderRadius: skin.key === "ocean" ? "6px" : skin.key === "navy" ? "7px" : "999px" }} />
        </div>
      </div>
    </div>
  );
}

function SettingComponent() {
  const canEdit = canEditSetup();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    settingService
      .get()
      .then((res) => setForm({ ...EMPTY, ...(res.data || {}) }))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // theme: saved at once (whole system), applied right away
  const [themeSaving, setThemeSaving] = useState("");
  const pickTheme = async (key) => {
    if (!canEdit || key === form.ui_theme) return;
    const before = form.ui_theme;
    setThemeSaving(key);
    setError("");
    setSkin(key);
    setForm((f) => ({ ...f, ui_theme: key }));
    try {
      await settingService.update({ ui_theme: key });
      setNotice(L("រចនាប័ទ្មត្រូវបានប្តូរសម្រាប់អ្នកប្រើទាំងអស់!", "Theme changed for everyone!"));
    } catch (err) {
      setSkin(before);
      setForm((f) => ({ ...f, ui_theme: before }));
      setError(err.message);
    } finally {
      setThemeSaving("");
    }
  };

  const uploadLogo = async (file) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("files", file);
      fd.append("folder", "setting");
      const res = await uploadService.upload(fd);
      setForm((f) => ({ ...f, logo: res.data?.[0] || null }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form };
      ["khr_rounding", "tax_rate", "low_stock_default", "expiry_alert_days"].forEach((k) => {
        payload[k] = Number(payload[k]) || 0;
      });
      ["_id", "key", "updated_by", "created_date", "updated_date", "__v"].forEach((k) => delete payload[k]);
      const res = await settingService.update(payload);
      setForm({ ...EMPTY, ...(res.data || {}) });
      setNotice(res.message || L("បានរក្សាទុក!", "Saved!"));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="md-page st-loading">{L("កំពុងផ្ទុក...", "Loading...")}</div>;
  const disabled = !canEdit || saving;

  return (
    <form className="md-page st-page" onSubmit={save}>
      {notice && <div className="md-notice md-notice-success">{notice}</div>}
      {!canEdit && <div className="md-hint">{L("អ្នកអាចមើលបានតែប៉ុណ្ណោះ (កែប្រែបានតែអ្នកគ្រប់គ្រងប្រព័ន្ធ)", "View only (only the admin can edit)")}</div>}

      {/* ---------- Theme ---------- */}
      <section className="st-card">
        <header>
          <Palette size={18} />
          <h3>{L("រចនាប័ទ្មប្រព័ន្ធ", "System theme")}</h3>
        </header>
        <p className="md-hint st-theme-hint">
          {L(
            "ពណ៌ រាង និងអក្សរ សម្រាប់អ្នកប្រើទាំងអស់ (Admin web និង Shop portal)។ ភ្លឺ / ងងឹត នៅតែជាជម្រើសរបស់អ្នកប្រើម្នាក់ៗ។",
            "Colors, shapes and fonts for everyone (admin web and shop portal). Light / dark stays each user's own choice.",
          )}
        </p>
        <div className="st-themes">
          {SKIN_LIST.map((skin) => {
            const on = form.ui_theme === skin.key;
            return (
              <button
                key={skin.key}
                type="button"
                className={`st-theme ${on ? "on" : ""}`}
                onClick={() => pickTheme(skin.key)}
                disabled={!canEdit || !!themeSaving}
                aria-pressed={on}
              >
                <ThemePreview skin={skin} />
                <span className="st-theme-name">
                  {on && <Check size={15} />}
                  {L(skin.name_kh, skin.name_en)}
                </span>
                <span className="md-sub">{L(skin.desc_kh, skin.desc_en)}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---------- Company ---------- */}
      <section className="st-card">
        <header>
          <Building2 size={18} />
          <h3>{L("ព័ត៌មានក្រុមហ៊ុន", "Company")}</h3>
        </header>
        <div className="st-logo">
          {form.logo?.url ? <img src={form.logo.url} alt="" /> : <span>LOGO</span>}
          {canEdit && (
            <div className="st-logo-actions">
              <input
                ref={fileRef}
                type="file"
                hidden
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => {
                  uploadLogo(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <button type="button" className="md-btn md-btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <ImagePlus size={16} />
                {uploading ? L("កំពុងបញ្ចូល...", "Uploading...") : L("ជ្រើសរើសឡូហ្គោ", "Choose logo")}
              </button>
              {form.logo && (
                <button type="button" className="md-btn md-btn-ghost" onClick={() => setForm((f) => ({ ...f, logo: null }))}>
                  <X size={14} />
                  {L("ដកចេញ", "Remove")}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="st-grid">
          <Field label={L("ឈ្មោះក្រុមហ៊ុន (ខ្មែរ)", "Company name (Khmer)")}>
            <input value={form.company_name_kh} onChange={set("company_name_kh")} disabled={disabled} />
          </Field>
          <Field label={L("ឈ្មោះក្រុមហ៊ុន (អង់គ្លេស)", "Company name (English)")}>
            <input value={form.company_name_en} onChange={set("company_name_en")} disabled={disabled} />
          </Field>
          <Field label={L("លេខទូរស័ព្ទ", "Phone")}>
            <input value={form.phone} onChange={set("phone")} disabled={disabled} />
          </Field>
          <Field label={L("អ៊ីមែល", "Email")}>
            <input type="email" value={form.email} onChange={set("email")} disabled={disabled} />
          </Field>
          <Field label={L("លេខអត្តសញ្ញាណកម្មអាករ (VAT TIN)", "VAT TIN")}>
            <input value={form.vat_no} onChange={set("vat_no")} disabled={disabled} />
          </Field>
          <Field label={L("អាសយដ្ឋាន", "Address")} full>
            <textarea rows={2} value={form.address} onChange={set("address")} disabled={disabled} />
          </Field>
        </div>
      </section>

      {/* ---------- Tax + money ---------- */}
      <section className="st-card">
        <header>
          <Percent size={18} />
          <h3>{L("ពន្ធ និងរូបិយប័ណ្ណ", "Tax & currency")}</h3>
        </header>
        <div className="st-grid">
          <Field label={L("របៀបពន្ធ (VAT)", "Tax mode (VAT)")} hint={L("ការផ្លាស់ប្តូរមានប្រសិទ្ធភាពលើវិក្កយបត្រថ្មីប៉ុណ្ណោះ", "Changes apply to new invoices only")}>
            <Select value={form.tax_mode} onChange={set("tax_mode")} disabled={disabled}>
              {TAX_MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={L("អត្រាពន្ធ (%)", "Tax rate (%)")}>
            <input type="number" min="0" max="100" step="0.01" value={form.tax_rate} onChange={set("tax_rate")} disabled={disabled || form.tax_mode === "none"} />
          </Field>
          <Field label={L("ឈ្មោះពន្ធ", "Tax name")}>
            <input value={form.tax_name} onChange={set("tax_name")} disabled={disabled || form.tax_mode === "none"} />
          </Field>
          <Field label={L("បង្គត់សាច់ប្រាក់រៀល (៛)", "Round cash riel to (៛)")} hint={L("ឧ. 100 → 12,345៛ បង្គត់ជា 12,300៛", "e.g. 100 → 12,345៛ becomes 12,300៛")}>
            <input type="number" min="0" step="50" value={form.khr_rounding} onChange={set("khr_rounding")} disabled={disabled} />
          </Field>
        </div>
      </section>

      {/* ---------- Receipt ---------- */}
      <section className="st-card">
        <header>
          <Receipt size={18} />
          <h3>{L("វិក្កយបត្រ POS", "POS receipt")}</h3>
        </header>
        <div className="st-grid">
          <Field label={L("ក្បាលវិក្កយបត្រ", "Receipt header")} full>
            <textarea rows={2} value={form.receipt_header} onChange={set("receipt_header")} disabled={disabled} />
          </Field>
          <Field label={L("ចុងវិក្កយបត្រ", "Receipt footer")} full>
            <textarea rows={2} value={form.receipt_footer} onChange={set("receipt_footer")} disabled={disabled} />
          </Field>
        </div>
      </section>

      {/* ---------- Stock alerts ---------- */}
      <section className="st-card">
        <header>
          <Boxes size={18} />
          <h3>{L("ការជូនដំណឹងស្តុក", "Stock alerts")}</h3>
        </header>
        <div className="st-grid">
          <Field label={L("ស្តុកទាប (លំនាំដើម)", "Low stock (default)")} hint={L("ប្រើពេលទំនិញមិនបានកំណត់ min stock", "Used when a product has no min stock")}>
            <input type="number" min="0" value={form.low_stock_default} onChange={set("low_stock_default")} disabled={disabled} />
          </Field>
          <Field label={L("ជូនដំណឹងមុនផុតកំណត់ (ថ្ងៃ)", "Expiry alert (days before)")}>
            <input type="number" min="0" value={form.expiry_alert_days} onChange={set("expiry_alert_days")} disabled={disabled} />
          </Field>
        </div>
      </section>

      {error && <div className="md-form-error">{error}</div>}
      {canEdit && (
        <div className="st-actions">
          <button type="submit" className="md-btn md-btn-primary" disabled={saving || uploading}>
            <Save size={16} />
            {saving ? L("កំពុងរក្សាទុក...", "Saving...") : L("រក្សាទុកការកំណត់", "Save settings")}
          </button>
        </div>
      )}
    </form>
  );
}

export default SettingComponent;
