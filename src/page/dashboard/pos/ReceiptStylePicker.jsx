import React, { useEffect, useMemo, useState } from "react";
import { Check, ReceiptText, X } from "lucide-react";
import { settingService } from "../../../api/api.service";
import { RECEIPT_TEMPLATES, DEFAULT_RECEIPT } from "../../cloudpos/receiptTemplates";
import { ReceiptPaper } from "../../cloudpos/screens/Receipt";
import { canEditSetup } from "../setup/setupOptions";
import { L } from "../../../i18n";
import "./receipt-picker.css";

// Admin: choose how the POS receipt looks (24 styles). Saved in the settings; every POS (local + cloud)
// gets it with the next sync (or Sync button) and prints with it.
const SAMPLE_SALE = {
  invoice_no: "PP01-P1-2610-00042",
  sold_at: new Date().toISOString(),
  cashier_name: "Nita Ros",
  items: [
    { name_kh: "កន្ទបខោ Pampers (M)", name_en: "Pampers baby-dry pants (M)", qty: 2, price: 13.5, unit_name_kh: "កញ្ចប់", unit_name_en: "Pack" },
    { name_kh: "អាវជាប់ខោកប្បាស (ស)", name_en: "Cotton romper (White)", qty: 1, price: 5.9, unit_name_kh: "ដុំ", unit_name_en: "Piece" },
    { name_kh: "ក្រដាសសើមទារក 80", name_en: "Baby wipes 80 sheets", qty: 3, price: 1.8, unit_name_kh: "កញ្ចប់", unit_name_en: "Pack" },
  ],
  subtotal: 38.3,
  discount_total: 1.3,
  discount_type: "amount",
  tax_mode: "none",
  total: 37,
  total_khr: 151700,
  rate: 4100,
  payments: [{ name_kh: "សាច់ប្រាក់ ដុល្លារ", name_en: "Cash USD", currency: "USD", amount: 40 }],
  change_usd: 3,
  change_give_usd: 3,
  change_give_khr: 0,
};

export default function ReceiptStylePicker({ onClose, onSaved }) {
  const canEdit = canEditSetup();
  const [setting, setSetting] = useState(null);
  const [picked, setPicked] = useState(DEFAULT_RECEIPT);
  const [saved, setSaved] = useState(DEFAULT_RECEIPT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    settingService
      .get()
      .then((r) => {
        const st = r.data || {};
        setSetting(st);
        const k = st.receipt_template || DEFAULT_RECEIPT;
        setPicked(k);
        setSaved(k);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [busy, onClose]);

  // what the receipt shows from the settings (company, logo, header / footer)
  const catalog = useMemo(
    () => ({
      setting: {
        company_name_kh: setting?.company_name_kh || "ហាងកុមារ",
        company_name_en: setting?.company_name_en || "Kids shop",
        logo: setting?.logo?.url || null,
        address: setting?.address || "ភ្នំពេញ",
        phone: setting?.phone || "012 345 678",
        vat_no: setting?.vat_no || "",
        receipt_header: setting?.receipt_header || "",
        receipt_footer: setting?.receipt_footer || "សូមអរគុណ!",
      },
      warehouse: { name_kh: "ហាង ភ្នំពេញ ០១", name_en: "Phnom Penh Shop 01" },
    }),
    [setting],
  );

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await settingService.update({ receipt_template: picked });
      setSaved(picked);
      onSaved && onSaved(picked);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const cur = RECEIPT_TEMPLATES.find((t) => t.key === picked) || RECEIPT_TEMPLATES[0];

  return (
    <div className="md-modal-backdrop" onMouseDown={() => !busy && onClose()}>
      <div className="md-modal rsp" onMouseDown={(e) => e.stopPropagation()}>
        <div className="md-modal-header">
          <h3><ReceiptText size={19} /> {L("ទម្រង់វិក្កយបត្រ POS", "POS receipt style")}</h3>
          <button type="button" className="md-icon-btn" onClick={onClose} disabled={busy}><X size={18} /></button>
        </div>
        <div className="md-modal-body rsp-body">
          <div className="rsp-grid">
            {RECEIPT_TEMPLATES.map((t) => (
              <button key={t.key} type="button" className={`rsp-item ${picked === t.key ? "on" : ""}`} onClick={() => setPicked(t.key)}>
                <span className="rsp-mini">
                  <span className="rsp-mini-in"><ReceiptPaper sale={SAMPLE_SALE} catalog={catalog} template={t.key} /></span>
                </span>
                <span className="rsp-name">
                  {picked === t.key && <Check size={14} />}
                  {L(t.kh, t.en)}
                  {saved === t.key && <em>{L("កំពុងប្រើ", "In use")}</em>}
                </span>
              </button>
            ))}
          </div>
          <aside className="rsp-big">
            <div className="rsp-big-title">
              <b>{L(cur.kh, cur.en)}</b>
              <span className="md-sub">{L("មើលទំហំពិត (80 mm)", "Actual size (80 mm)")}</span>
            </div>
            <div className="rsp-paper"><ReceiptPaper sale={SAMPLE_SALE} catalog={catalog} template={picked} /></div>
          </aside>
        </div>
        <div className="md-modal-footer">
          {error && <span className="md-form-error rsp-err">{error}</span>}
          <span className="md-sub rsp-hint">{L("POS ទាំងអស់ (ក្នុងម៉ាស៊ីន និងអនឡាញ) ប្រើទម្រង់នេះ បន្ទាប់ពីធ្វើសមកាលកម្ម (≤ 5 នាទី ឬចុច Sync)។", "Every POS (local and cloud) prints with it after its next sync (≤ 5 min, or tap Sync).")}</span>
          <button type="button" className="md-btn md-btn-ghost" onClick={onClose} disabled={busy}>{L("បោះបង់", "Cancel")}</button>
          {canEdit && (
            <button type="button" className="md-btn md-btn-primary" onClick={save} disabled={busy || !setting || picked === saved}>
              <Check size={16} /> {busy ? "…" : L("ប្រើទម្រង់នេះ", "Use this style")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
