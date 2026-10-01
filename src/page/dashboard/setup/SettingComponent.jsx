import React, { useEffect, useRef, useState } from "react";
import { Building2, ImagePlus, Percent, Receipt, Save, Boxes, X } from "lucide-react";
import { settingService, uploadService } from "../../../api/api.service";
import { TAX_MODE_OPTIONS, canEditSetup } from "./setupOptions";
import "../master_data/masterdata.style.css";
import "./setup.style.css";

import { L } from "../../../i18n";
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
            <select value={form.tax_mode} onChange={set("tax_mode")} disabled={disabled}>
              {TAX_MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
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
