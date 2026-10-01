import React, { useEffect, useMemo, useState } from "react";
import { Briefcase, Eye, EyeOff, KeyRound, Lock, Mail, Phone, Shield, ShieldCheck, User } from "lucide-react";
import { authService } from "../../../api/api.service";
import Auth from "../../util/auth";
import { roleLabel, roleText } from "../user/userRoles";
import KidsDecor from "../../decor/KidsDecor";
import { APP_NAME } from "../../../appInfo";
import "../master_data/masterdata.style.css";
import "../master_data/masterdata.theme.css";
import "./account.style.css";

import { L } from "../../../i18n";
function InfoRow({ icon, label, value, tone = "" }) {
  return (
    <div className={`ac-tile ${tone}`}>
      <span className="ac-tile-icon">{icon}</span>
      <div className="ac-tile-text">
        <dt>{label}</dt>
        <dd>{value || "-"}</dd>
      </div>
    </div>
  );
}

function PasswordField({ id, label, value, onChange, show, autoComplete }) {
  return (
    <div className="ac-field">
      <label htmlFor={id}>{label}</label>
      <div className="ac-input">
        <Lock size={16} className="ac-input-icon" />
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder="••••••••"
        />
      </div>
    </div>
  );
}

// display only: how strong the new password looks (0 – 4)
function strengthOf(pwd) {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd) || pwd.length >= 12) score++;
  return score;
}
const STRENGTH_TEXT = ["", L("ខ្សោយ", "Weak"), L("មធ្យម", "Fair"), L("ល្អ", "Good"), L("ខ្លាំង", "Strong")];

function AccountPage() {
  const auth = useMemo(() => new Auth(), []);
  const login = useMemo(() => auth.getClientLogin() || {}, [auth]);

  const [profile, setProfile] = useState({});
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // must change password (first login / reset by admin)
  const [mustChange, setMustChange] = useState(
    !!login.is_first_login || new URLSearchParams(window.location.search).get("first") === "1",
  );

  useEffect(() => {
    let alive = true;
    authService
      .me()
      .then((res) => alive && setProfile(res.data || {}))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // saved login info is the base; the live profile fills in / overrides
  const me = { ...login, ...profile };
  const fullName = `${me.firstname || ""} ${me.lastname || ""}`.trim();
  const initial = Array.from(me.firstname || me.email || "?")[0].toUpperCase();
  const roleName = me.is_super_admin ? "Super Admin" : roleLabel(roleText(me.role));
  const strength = strengthOf(password);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!oldPassword) {
      setError(L("សូមបញ្ចូលពាក្យសម្ងាត់ចាស់", "Please enter your old password"));
      return;
    }
    if (!password) {
      setError(L("សូមបញ្ចូលពាក្យសម្ងាត់ថ្មី", "Please enter a new password"));
      return;
    }
    if (password.length < 8) {
      setError(L("ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច 8 តួអក្សរ!", "Password must be at least 8 characters!"));
      return;
    }
    if (password !== confirm) {
      setError(L("ពាក្យសម្ងាត់បញ្ជាក់មិនត្រូវគ្នា", "Passwords don't match"));
      return;
    }
    setSaving(true);
    try {
      const res = await authService.changePassword({ old_password: oldPassword, new_password: password });
      setNotice(res?.message || L("បានប្តូរពាក្យសម្ងាត់ថ្មី!", "Password changed!"));
      setOldPassword("");
      setPassword("");
      setConfirm("");
      setMustChange(false);
      auth.setClientLogin({ ...auth.getClientLogin(), is_first_login: false });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="md-page ac-page">
      {notice && <div className="md-notice md-notice-success">{notice}</div>}
      {mustChange && (
        <div className="md-notice md-notice-error">
          {L("សូមប្តូរពាក្យសម្ងាត់របស់អ្នកជាមុនសិន ដើម្បីសុវត្ថិភាពគណនី។", "Please change your password first to keep your account safe.")}
        </div>
      )}

      {/* ---------- profile header ---------- */}
      <section className="ac-profile">
        <div className="ac-cover">
          <span className="ac-cover-word" aria-hidden="true">
            {APP_NAME}
          </span>
          <KidsDecor variant="duck" className="ac-cover-bowl" />
        </div>
        <div className="ac-profile-body">
          <div className="ac-avatar" aria-hidden="true">
            {initial}
          </div>
          <div className="ac-profile-text">
            <h2>{fullName || L("គណនីរបស់ខ្ញុំ", "My account")}</h2>
            <p>
              <Mail size={14} /> {me.email || "-"}
            </p>
          </div>
          <div className="ac-chips">
            {roleName && (
              <span className="ac-chip">
                <Shield size={13} />
                {roleName}
              </span>
            )}
            {me.job_title && (
              <span className="ac-chip ac-chip-soft">
                <Briefcase size={13} />
                {me.job_title}
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="ac-grid">
        {/* ---------- personal info ---------- */}
        <section className="ac-card">
          <header className="ac-card-head">
            <span className="ac-card-icon">
              <User size={18} />
            </span>
            <div>
              <h3>{L("ព័ត៌មានផ្ទាល់ខ្លួន", "Profile")}</h3>
              <p>{L("ព័ត៌មានគណនីរបស់អ្នកក្នុងប្រព័ន្ធ", "Your account in the system")}</p>
            </div>
          </header>
          <dl className="ac-tiles">
            <InfoRow icon={<User size={16} />} label={L("គោត្តនាម", "First name")} value={me.firstname} />
            <InfoRow icon={<User size={16} />} label={L("នាម", "Last name")} value={me.lastname} />
            <InfoRow icon={<Mail size={16} />} label={L("អ៊ីមែល", "Email")} value={me.email} tone="wide" />
            <InfoRow icon={<Phone size={16} />} label={L("លេខទំនាក់ទំនង", "Contact")} value={me.contact} />
            <InfoRow icon={<Briefcase size={16} />} label={L("មុខតំណែង", "Job title")} value={me.job_title} />
            <InfoRow icon={<Shield size={16} />} label={L("តួនាទី", "Role")} value={roleName} tone="wide accent" />
          </dl>
        </section>

        {/* ---------- password ---------- */}
        <section className={`ac-card ac-card-password ${mustChange ? "is-required" : ""}`}>
          <header className="ac-card-head">
            <span className="ac-card-icon">
              <ShieldCheck size={18} />
            </span>
            <div>
              <h3>{L("ប្តូរពាក្យសម្ងាត់", "Change password")}</h3>
              <p>{L("បញ្ចូលពាក្យសម្ងាត់ចាស់ ហើយពាក្យសម្ងាត់ថ្មី (យ៉ាងតិច 8 តួ)", "Enter your old password, then a new one (8+ characters)")}</p>
            </div>
          </header>
          <form className="ac-form" onSubmit={submit} noValidate>
            <PasswordField
              id="ac-old"
              label={L("ពាក្យសម្ងាត់ចាស់", "Old password")}
              value={oldPassword}
              onChange={setOldPassword}
              show={showPwd}
              autoComplete="current-password"
            />
            <PasswordField
              id="ac-new"
              label={L("ពាក្យសម្ងាត់ថ្មី", "New password")}
              value={password}
              onChange={setPassword}
              show={showPwd}
              autoComplete="new-password"
            />
            {password && (
              <div className={`ac-strength s${strength}`}>
                <div className="ac-strength-bars">
                  {[1, 2, 3, 4].map((n) => (
                    <i key={n} className={strength >= n ? "on" : ""} />
                  ))}
                </div>
                <span>{STRENGTH_TEXT[strength]}</span>
              </div>
            )}
            <PasswordField
              id="ac-confirm"
              label={L("បញ្ជាក់ពាក្យសម្ងាត់ថ្មី", "Confirm new password")}
              value={confirm}
              onChange={setConfirm}
              show={showPwd}
              autoComplete="new-password"
            />
            {error && <div className="ac-form-error">{error}</div>}
            <div className="ac-form-actions">
              <button type="button" className="ac-btn ac-btn-ghost" onClick={() => setShowPwd((v) => !v)}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                {showPwd ? L("លាក់", "Hide") : L("បង្ហាញ", "Show")}
              </button>
              <button type="submit" className="ac-btn ac-btn-primary" disabled={saving}>
                <KeyRound size={16} />
                {saving ? L("កំពុងរក្សាទុក...", "Saving...") : L("ប្តូរពាក្យសម្ងាត់", "Change password")}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export default AccountPage;
