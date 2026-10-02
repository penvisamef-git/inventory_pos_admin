import React, { useRef, useCallback, useEffect, useState } from "react";
import { Plus, KeyRound, Lock, X, Power, Pencil } from "lucide-react";
import { shopService } from "../../api/api.service";
import { usePortal } from "./portalContext";
import { ROLE, roleLabel } from "../dashboard/user/userRoles";
import { L } from "../../i18n";

const EMPTY = { firstname: "", lastname: "", email: "", contact: "", password: "", pos_pin: "" };

// Staff of this shop. Managers add / disable cashiers, reset password and POS PIN (managers themselves: admin web).
function PortalStaff() {
  const w = usePortal();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [dialog, setDialog] = useState(null); // { kind: new | edit | password | pin, user, form }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const current = useRef(null); // warehouse shown now (ignore late answers for another one)
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const id = w._id;
      current.current = id;
      setRows((await shopService.staff(id, { onFresh: (res) => current.current === id && setRows(res.data || []) })).data || []);
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  }, [w]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const open = (kind, user = null) => {
    setError("");
    setDialog({ kind, user, form: kind === "edit" ? { firstname: user.firstname, lastname: user.lastname, contact: user.contact || "" } : { ...EMPTY } });
  };
  const set = (patch) => setDialog((d) => ({ ...d, form: { ...d.form, ...patch } }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const f = dialog.form;
      let res;
      if (dialog.kind === "new") res = await shopService.createCashier({ ...f, warehouse_id: w._id, pos_pin: f.pos_pin || undefined });
      if (dialog.kind === "edit") res = await shopService.updateCashier(dialog.user._id, f);
      if (dialog.kind === "password") res = await shopService.resetPassword(dialog.user._id, f.password);
      if (dialog.kind === "pin") res = await shopService.setPin(dialog.user._id, f.pos_pin || null);
      setNotice({ type: "success", text: res.message });
      setDialog(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (u) => {
    try {
      const res = await shopService.updateCashier(u._id, { status: u.status === false });
      setNotice({ type: "success", text: res.message });
      load();
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    }
  };

  const field = (key, label, props = {}) => (
    <div className="md-field">
      <label>{label}{props.required && <span className="md-required">*</span>}</label>
      <input value={dialog.form[key] ?? ""} onChange={(e) => set({ [key]: e.target.value })} disabled={busy} {...props} />
    </div>
  );

  return (
    <div className="md-page">
      {notice && <div className={`md-notice md-notice-${notice.type}`}>{notice.text}</div>}
      <div className="md-toolbar">
        <p className="sd-hint">{L("អ្នកគិតលុយចូល POS ដោយលេខ PIN។ ការផ្លាស់ប្តូរនឹងទៅដល់ POS ពេល Sync លើកក្រោយ។", "Cashiers sign in to the POS with their PIN. Changes reach the POS on its next sync.")}</p>
        <div className="md-toolbar-actions">
          <button type="button" className="md-btn md-btn-primary" onClick={() => open("new")}>
            <Plus size={16} />
            {L("បន្ថែមអ្នកគិតលុយ", "Add cashier")}
          </button>
        </div>
      </div>
      <div className="ps-grid">
        {loading && !rows.length && <div className="md-empty">{L("កំពុងផ្ទុក...", "Loading...")}</div>}
        {rows.map((u) => {
          const isCashier = u.role === ROLE.CASHIER;
          const name = `${u.firstname || ""} ${u.lastname || ""}`.trim();
          return (
            <div key={u._id} className={`ps-card ${u.status === false ? "off" : ""}`}>
              <div className="ps-top">
                <span className="user-avatar">{Array.from(name || "?")[0].toUpperCase()}</span>
                <div>
                  <b>{name}</b>
                  <small>{roleLabel(u.role)}</small>
                </div>
                <span className={`md-badge ${u.status === false ? "md-badge-off" : "md-badge-on"}`}>{u.status === false ? L("បិទ", "Disabled") : L("សកម្ម", "Active")}</span>
              </div>
              <div className="ps-info">
                <span>{u.email}</span>
                {u.contact && <span>{u.contact}</span>}
                {isCashier && (
                  <span className={u.has_pos_pin ? "ps-pin ok" : "ps-pin"}>
                    <KeyRound size={13} /> {u.has_pos_pin ? L("មាន PIN", "PIN set") : L("មិនទាន់មាន PIN", "No PIN yet")}
                  </span>
                )}
              </div>
              {isCashier ? (
                <div className="ps-actions">
                  <button type="button" className="md-btn md-btn-ghost" onClick={() => open("pin", u)}><KeyRound size={14} />PIN</button>
                  <button type="button" className="md-btn md-btn-ghost" onClick={() => open("password", u)}><Lock size={14} />{L("ពាក្យសម្ងាត់", "Password")}</button>
                  <button type="button" className="md-icon-btn" onClick={() => open("edit", u)} title={L("កែប្រែ", "Edit")}><Pencil size={15} /></button>
                  <button type="button" className={`md-icon-btn ${u.status === false ? "sd-ok" : "md-icon-btn-danger"}`} onClick={() => toggle(u)} title={u.status === false ? L("បើក", "Enable") : L("បិទ", "Disable")}><Power size={15} /></button>
                </div>
              ) : (
                <div className="ps-actions"><span className="md-sub">{L("គ្រប់គ្រងដោយ Admin", "Managed by admin")}</span></div>
              )}
            </div>
          );
        })}
      </div>

      {dialog && (
        <div className="md-modal-backdrop" onMouseDown={() => !busy && setDialog(null)}>
          <form className="md-modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>
                {dialog.kind === "new" && L(`អ្នកគិតលុយថ្មី · ${w.code}`, `New cashier · ${w.code}`)}
                {dialog.kind === "edit" && L("កែប្រែអ្នកគិតលុយ", "Edit cashier")}
                {dialog.kind === "password" && L("ប្តូរពាក្យសម្ងាត់", "Reset password")}
                {dialog.kind === "pin" && L("កំណត់ PIN សម្រាប់ POS", "Set POS PIN")}
              </h3>
              <button type="button" className="md-icon-btn" onClick={() => setDialog(null)}><X size={18} /></button>
            </div>
            <div className="md-modal-body">
              {dialog.user && <p className="sd-hint">{`${dialog.user.firstname} ${dialog.user.lastname} · ${dialog.user.email}`}</p>}
              <div className="md-fields">
                {(dialog.kind === "new" || dialog.kind === "edit") && (
                  <>
                    {field("firstname", L("គោត្តនាម", "First name"), { required: true })}
                    {field("lastname", L("នាម", "Last name"), { required: true })}
                    {dialog.kind === "new" && field("email", L("អ៊ីមែល (សម្រាប់ចូល)", "Email (login)"), { required: true, type: "email", placeholder: `cashier3.${w.code.toLowerCase()}@...` })}
                    {field("contact", L("ទូរស័ព្ទ", "Phone"), { type: "tel" })}
                  </>
                )}
                {(dialog.kind === "new" || dialog.kind === "password") && field("password", L("ពាក្យសម្ងាត់ (≥ 8 តួ)", "Password (≥ 8 chars)"), { required: true, type: "text", autoComplete: "new-password" })}
                {(dialog.kind === "new" || dialog.kind === "pin") &&
                  field("pos_pin", L("PIN POS (4–6 ខ្ទង់)", "POS PIN (4–6 digits)"), { inputMode: "numeric", maxLength: 6, placeholder: "1234", pattern: "\\d{4,6}", required: dialog.kind === "pin" && !dialog.user?.has_pos_pin })}
                {dialog.kind === "pin" && dialog.user?.has_pos_pin && <span className="md-sub">{L("ទុកទទេ = ដក PIN ចេញ", "Leave empty = remove the PIN")}</span>}
              </div>
              {error && <div className="md-form-error">{error}</div>}
            </div>
            <div className="md-modal-footer">
              <button type="button" className="md-btn md-btn-ghost" onClick={() => setDialog(null)} disabled={busy}>{L("បោះបង់", "Cancel")}</button>
              <button type="submit" className="md-btn md-btn-primary" disabled={busy}>{busy ? "…" : L("រក្សាទុក", "Save")}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default PortalStaff;
