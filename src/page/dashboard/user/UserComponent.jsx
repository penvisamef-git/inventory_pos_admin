import React, { useEffect, useMemo, useState } from "react";
import { KeyRound, Smartphone, X } from "lucide-react";
import MasterDataPage, { statusCell } from "../master_data/MasterDataPage";
import "../master_data/masterdata.style.css";
import { userService, warehouseService } from "../../../api/api.service";
import { ROLE_OPTIONS, ROLE_SCOPE, roleLabel, roleText } from "./userRoles";
import Auth from "../../util/auth";

import { L } from "../../../i18n";
const fullName = (row) => `${row.firstname || ""} ${row.lastname || ""}`.trim();

const COLUMNS = [
  {
    key: "name",
    label: L("ឈ្មោះ", "Name"),
    render: (row) => (
      <>
        <b>{fullName(row) || "-"}</b>
        {row.job_title && <span className="md-sub">{row.job_title}</span>}
      </>
    ),
  },
  { key: "email", label: L("អ៊ីមែល", "Email") },
  { key: "contact", label: L("លេខទំនាក់ទំនង", "Contact") },
  {
    key: "role",
    label: L("តួនាទី", "Role"),
    render: (row) => <span className="md-badge md-badge-gold">{roleLabel(roleText(row.role)) || "-"}</span>,
  },
  {
    key: "warehouse_ids",
    label: L("ហាង", "Shops"),
    render: (row) =>
      ROLE_SCOPE[roleText(row.role)] === "all" ? (
        <span className="md-sub">{L("ទាំងអស់", "All")}</span>
      ) : (row.warehouse_ids || []).length ? (
        (row.warehouse_ids || []).map((w) => (
          <span key={w._id || w} className="md-badge md-badge-shop" style={{ marginRight: 4 }}>
            {w.code || w}
          </span>
        ))
      ) : (
        <span className="md-badge md-badge-danger">{L("មិនទាន់ភ្ជាប់", "Not linked")}</span>
      ),
  },
  {
    key: "has_pos_pin",
    label: "PIN",
    render: (row) =>
      row.has_pos_pin ? <span className="md-badge md-badge-on">{L("មាន", "Yes")}</span> : <span className="md-badge md-badge-off">{L("គ្មាន", "None")}</span>,
  },
  { key: "status", label: L("ស្ថានភាព", "Status"), render: statusCell },
];

const buildFields = (shopOptions) => [
  { key: "firstname", label: L("គោត្តនាម", "First name"), required: true, placeholder: L("បញ្ចូលគោត្តនាម", "Enter first name") },
  { key: "lastname", label: L("នាម", "Last name"), required: true, placeholder: L("បញ្ចូលនាម", "Enter last name") },
  { key: "email", label: L("អ៊ីមែល", "Email"), type: "email", required: true, placeholder: "name@example.com" },
  { key: "contact", label: L("លេខទំនាក់ទំនង", "Contact"), type: "tel", placeholder: "012345678" },
  {
    key: "password",
    label: L("ពាក្យសម្ងាត់ (យ៉ាងតិច 8 តួ)", "Password (8+ characters)"),
    type: "password",
    required: true,
    createOnly: true,
    placeholder: L("បញ្ចូលពាក្យសម្ងាត់", "Enter password"),
  },
  { key: "job_title", label: L("មុខតំណែង", "Job title"), placeholder: "Cashier / Manager" },
  {
    key: "role",
    label: L("តួនាទី", "Role"),
    type: "select",
    required: true,
    placeholder: L("-- ជ្រើសរើសតួនាទី --", "-- Choose a role --"),
    options: ROLE_OPTIONS,
    full: true,
  },
  {
    // shop manager + cashier only (central roles see every warehouse)
    key: "warehouse_ids",
    label: L("ហាងដែលធ្វើការ", "Works at shops"),
    type: "multiselect",
    required: true,
    full: true,
    options: shopOptions,
    emptyText: L("មិនទាន់មានហាង — សូមបង្កើតនៅ ការរៀបចំ → ឃ្លាំង / ហាង", "No shops yet — create one in Setup → Warehouses / Shops"),
    showIf: (form) => !!form.role && ROLE_SCOPE[form.role] === "own",
  },
  { key: "note", label: L("កំណត់សម្គាល់", "Note"), type: "textarea" },
];

const SEARCH_KEYS = ["firstname", "lastname", "email", "contact"];
const FILTERS_BASE = [{ key: "role", label: L("-- តួនាទីទាំងអស់ --", "-- All roles --"), options: ROLE_OPTIONS }];

function UserComponent() {
  const currentUserId = new Auth().getClientLogin()?._id;

  // ---------------- Shops (for warehouse_ids + filter) ----------------
  const [shops, setShops] = useState([]);
  useEffect(() => {
    warehouseService
      .all({ type: "shop" })
      .then((res) => setShops(res.data || []))
      .catch(() => setShops([]));
  }, []);
  const shopOptions = useMemo(() => shops.map((w) => ({ value: w._id, label: `${w.name_kh} (${w.code})` })), [shops]);
  const fields = useMemo(() => buildFields(shopOptions), [shopOptions]);
  const filters = useMemo(
    () => [...FILTERS_BASE, { key: "warehouse_id", label: L("-- ហាងទាំងអស់ --", "-- All shops --"), options: shopOptions }],
    [shopOptions],
  );
  const [reloadKey, setReloadKey] = useState(0);

  // ---------------- POS PIN dialog ----------------
  const [pinTarget, setPinTarget] = useState(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSaving, setPinSaving] = useState(false);

  const openPin = (row) => {
    setPinTarget(row);
    setPin("");
    setPinError("");
  };
  const closePin = () => {
    if (!pinSaving) setPinTarget(null);
  };
  const savePin = async (value) => {
    setPinError("");
    if (value !== null && !/^\d{4,6}$/.test(value)) {
      setPinError(L("លេខ PIN ត្រូវមាន 4 ទៅ 6 ខ្ទង់ (លេខតែប៉ុណ្ណោះ)!", "PIN must be 4–6 digits!"));
      return;
    }
    setPinSaving(true);
    try {
      const res = await userService.setPosPin(pinTarget._id, value);
      setNotice({ type: "success", text: res.message || L("បានរក្សាទុក!", "Saved!") });
      setPinTarget(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setPinError(err.message);
    } finally {
      setPinSaving(false);
    }
  };

  // ---------------- Reset password dialog ----------------
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const openReset = (row) => {
    setResetTarget(row);
    setResetPassword("");
    setResetConfirm("");
    setResetError("");
  };

  const closeReset = () => {
    if (resetSaving) return;
    setResetTarget(null);
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setResetError("");

    if (!resetPassword) {
      setResetError(L("សូមបញ្ចូលពាក្យសម្ងាត់ថ្មី", "Please enter a new password"));
      return;
    }
    if (resetPassword.length < 8) {
      setResetError(L("ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច 8 តួអក្សរ!", "Password must be at least 8 characters!"));
      return;
    }
    if (resetPassword !== resetConfirm) {
      setResetError(L("ពាក្យសម្ងាត់បញ្ជាក់មិនត្រូវគ្នា", "Passwords don't match"));
      return;
    }

    setResetSaving(true);
    try {
      const res = await userService.resetPassword(resetTarget._id, { password: resetPassword });
      setNotice({ type: "success", text: res.message || L("បានកំណត់ពាក្យសម្ងាត់ថ្មី!", "Password reset!") });
      setResetTarget(null);
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetSaving(false);
    }
  };

  return (
    <div className="md-page">
      {notice && <div className={`md-notice md-notice-${notice.type}`}>{notice.text}</div>}

      <MasterDataPage
        key={reloadKey}
        title={L("អ្នកប្រើប្រាស់", "Users")}
        service={userService}
        fields={fields}
        filters={filters}
        columns={COLUMNS}
        searchKeys={SEARCH_KEYS}
        getName={fullName}
        canDelete={(row) => row._id !== currentUserId}
        wide
        extraActions={(row) => (
          <>
            <button type="button" className="md-icon-btn" onClick={() => openPin(row)} title={L("លេខ PIN សម្រាប់ POS", "POS PIN")}>
              <Smartphone size={15} />
            </button>
            <button type="button" className="md-icon-btn" onClick={() => openReset(row)} title={L("កំណត់ពាក្យសម្ងាត់ថ្មី", "Reset password")}>
              <KeyRound size={15} />
            </button>
          </>
        )}
      />

      {resetTarget && (
        <div className="md-modal-backdrop" onMouseDown={closeReset}>
          <form className="md-modal md-modal-sm" onSubmit={submitReset} onMouseDown={(e) => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>{L("កំណត់ពាក្យសម្ងាត់ថ្មី", "Reset password")}</h3>
              <button type="button" className="md-icon-btn" onClick={closeReset} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="md-modal-body">
              <p>
                <strong>{fullName(resetTarget)}</strong> ({resetTarget.email})
              </p>

              <div className="md-field">
                <label htmlFor="reset-password">
                  {L("ពាក្យសម្ងាត់ថ្មី", "New password")}<span className="md-required">*</span>
                </label>
                <input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  disabled={resetSaving}
                  autoFocus
                />
              </div>

              <div className="md-field">
                <label htmlFor="reset-confirm">
                  {L("បញ្ជាក់ពាក្យសម្ងាត់", "Confirm password")}<span className="md-required">*</span>
                </label>
                <input
                  id="reset-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  disabled={resetSaving}
                />
              </div>

              <div className="md-hint">
                {L("អ្នកប្រើប្រាស់នឹងត្រូវចាកចេញពីគ្រប់ឧបករណ៍ ហើយត្រូវប្តូរពាក្យសម្ងាត់ពេលចូលលើកក្រោយ។", "The user is logged out everywhere and must change the password at next login.")}
              </div>

              {resetError && <div className="md-form-error">{resetError}</div>}
            </div>

            <div className="md-modal-footer">
              <button type="button" className="md-btn md-btn-ghost" onClick={closeReset} disabled={resetSaving}>
                {L("បោះបង់", "Cancel")}
              </button>
              <button type="submit" className="md-btn md-btn-primary" disabled={resetSaving}>
                {resetSaving ? L("កំពុងរក្សាទុក...", "Saving...") : L("រក្សាទុក", "Save")}
              </button>
            </div>
          </form>
        </div>
      )}
      {pinTarget && (
        <div className="md-modal-backdrop" onMouseDown={closePin}>
          <form
            className="md-modal md-modal-sm"
            onSubmit={(e) => {
              e.preventDefault();
              savePin(pin.trim());
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="md-modal-header">
              <h3>{L("លេខ PIN សម្រាប់ POS", "POS PIN")}</h3>
              <button type="button" className="md-icon-btn" onClick={closePin} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="md-modal-body">
              <p>
                <strong>{fullName(pinTarget)}</strong> ({pinTarget.email}) ·{" "}
                {pinTarget.has_pos_pin ? L("មាន PIN រួចហើយ", "Has a PIN") : L("មិនទាន់មាន PIN", "No PIN yet")}
              </p>

              <div className="md-field">
                <label htmlFor="pos-pin">
                  {L("លេខ PIN ថ្មី (4–6 ខ្ទង់)", "New PIN (4–6 digits)")}<span className="md-required">*</span>
                </label>
                <input
                  id="pos-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  disabled={pinSaving}
                  autoFocus
                />
              </div>

              <div className="md-hint">{L("ប្រើសម្រាប់ចូល POS បានលឿន។ PIN ត្រូវបានរក្សាទុកជាកូដសម្ងាត់ មិនអាចមើលវិញបានទេ។", "Used for quick POS login. The PIN is stored as a hash and can't be viewed again.")}</div>

              {pinError && <div className="md-form-error">{pinError}</div>}
            </div>

            <div className="md-modal-footer">
              {pinTarget.has_pos_pin && (
                <button
                  type="button"
                  className="md-btn md-btn-ghost"
                  onClick={() => savePin(null)}
                  disabled={pinSaving}
                  style={{ marginRight: "auto" }}
                >
                  {L("លុប PIN", "Remove PIN")}
                </button>
              )}
              <button type="button" className="md-btn md-btn-ghost" onClick={closePin} disabled={pinSaving}>
                {L("បោះបង់", "Cancel")}
              </button>
              <button type="submit" className="md-btn md-btn-primary" disabled={pinSaving}>
                {pinSaving ? L("កំពុងរក្សាទុក...", "Saving...") : L("រក្សាទុក", "Save")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default UserComponent;
