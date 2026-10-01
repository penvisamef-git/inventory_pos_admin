import React, { useEffect, useRef, useState } from "react";
import { Baby, Mail, Lock, Eye, EyeOff } from "lucide-react";
import KidsDecor, { Star } from "../decor/KidsDecor";
import "../theme/default/color.script";
import PreferenceMenu from "../theme/default/PreferenceMenu";
import "./login.style.css";
import Auth from "../util/auth";
import { authService } from "../../api/api.service";
import { canUseAdminWeb, portalOnly } from "../util/permission";
import { APP_NAME, APP_NAME_KH, APP_VERSION_TEXT } from "../../appInfo";

import { L } from "../../i18n";
// Decide which field a server error message is about
function fieldsFromMessage(message = "") {
  const both = /អ៊ីមែល ឬពាក្យសម្ងាត់/.test(message);
  if (both) return { email: true, password: true };
  const email = /អ៊ីមែល|email/i.test(message);
  const password = /ពាក្យសម្ងាត់|password/i.test(message);
  return { email, password };
}

function LoginComponent() {
  const auth = new Auth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [badFields, setBadFields] = useState({ email: false, password: false });
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const [focusField, setFocusField] = useState(null); // { name: "email" | "password" } (new object each time)

  useEffect(() => {
    document.title = `${L("ចូលគណនី", "Sign in")} · ${APP_NAME}`;
  }, []);

  // Focus the field that has the error (after inputs are enabled again)
  useEffect(() => {
    if (loading || !focusField) return;
    const el = focusField.name === "email" ? emailRef.current : passwordRef.current;
    el?.focus();
  }, [focusField, loading]);

  // Mark bad fields and focus the first one
  const markBad = (fields) => {
    setBadFields(fields);
    setFocusField(fields.email ? { name: "email" } : fields.password ? { name: "password" } : null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    markBad({ email: false, password: false });

    // ---- Validate ----
    if (!email || !password) {
      setError(L("សូមបំពេញព័ត៌មានទាំងអស់", "Please fill in all fields"));
      markBad({ email: !email, password: !password });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(L("អ៊ីមែលមិនត្រឹមត្រូវ", "Invalid email"));
      markBad({ email: true, password: false });
      return;
    }

    setLoading(true);

    try {
      const json = await authService.login(email.trim(), password);

      // cashier → POS only, no admin web (close the new session again)
      if (!canUseAdminWeb(json.data)) {
        auth.setClientLogin(json.data);
        await authService.logout().catch(() => {});
        auth.removeClientLogin();
        setError(L("គណនីនេះប្រើបានតែលើម៉ាស៊ីន POS ប៉ុណ្ណោះ!", "This account can only be used on the POS!"));
        return;
      }

      auth.setClientLogin(json.data);

      // first login / password reset by admin → change password first
      window.location.href = portalOnly(json.data) ? "/shop" : json.data?.is_first_login ? "/account?first=1" : "/home";
    } catch (err) {
      console.error("❌ Login error:", err);
      const message = err.message || L("អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ!", "Wrong email or password!");
      setError(message);
      // Only the field named in the message gets the red border
      markBad(fieldsFromMessage(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lg-page">
      <div className="lg-frame">
        {/* ================= Left: brand panel ================= */}
        <aside className="lg-hero" aria-hidden="true">
          <div className="lg-brand">
            <span className="lg-brand-mark">
              <Baby size={20} />
            </span>
            <span>
              <strong>{APP_NAME}</strong>
              <small>{APP_NAME_KH}</small>
            </span>
          </div>

          <div className="lg-hero-text">
            <h2>
              {L("គ្រប់គ្រង", "Manage")} <em>{L("ស្តុក ឃ្លាំង", "stock, warehouses")}</em>
              <br />
              {L("និងការលក់ទំនិញកុមារ", "and kids' product sales")}
            </h2>
            <p>{L("ឃ្លាំងកណ្តាល · ហាង · POS ក្នុងប្រព័ន្ធតែមួយ", "Central warehouse · shops · POS in one system")}</p>
          </div>

          <div className="lg-pills">
            <span>
              <i /> {L("ស្តុកតាមហាង", "Stock per shop")}
            </span>
            <span>
              <i /> {L("POS ដំណើរការពេលគ្មានអ៊ីនធឺណិត", "POS works offline")}
            </span>
            <span>
              <i /> {L("ថ្ងៃផុតកំណត់ទំនិញ", "Product expiry dates")}
            </span>
          </div>

          <KidsDecor variant="blocks" className="lg-decor lg-decor-blocks" />
          <KidsDecor variant="duck" className="lg-decor lg-decor-duck" />
          <Star className="lg-star lg-star-1" color="#fbbf24" />
          <Star className="lg-star lg-star-2" color="#9fd8b5" />
        </aside>

        {/* ================= Right: form ================= */}
        <main className="lg-main">
          <PreferenceMenu className="lg-pref" />
          <div className="lg-card">
            <h1>{L("ចូលគណនី", "Sign in")}</h1>
            <p className="lg-sub">{L("សូមបញ្ចូលអ៊ីមែល និងពាក្យសម្ងាត់របស់អ្នក", "Enter your email and password")}</p>

            <form onSubmit={handleSubmit} className="lg-form" noValidate>
              <div className="lg-field">
                <label htmlFor="email">{L("អ៊ីមែល", "Email")}</label>
                <div className={`lg-input ${badFields.email ? "is-error" : ""}`}>
                  <Mail size={17} />
                  <input
                    type="email"
                    id="email"
                    ref={emailRef}
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setBadFields((b) => ({ ...b, email: false }));
                    }}
                    onKeyDown={(e) => {
                      // Enter in email: move to password (when email is filled)
                      if (e.key === "Enter" && email.trim()) {
                        e.preventDefault();
                        passwordRef.current?.focus();
                      }
                    }}
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="lg-field">
                <label htmlFor="password">{L("ពាក្យសម្ងាត់", "Password")}</label>
                <div className={`lg-input ${badFields.password ? "is-error" : ""}`}>
                  <Lock size={17} />
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    ref={passwordRef}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setBadFields((b) => ({ ...b, password: false }));
                    }}
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="lg-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && <div className="lg-error">{error}</div>}

              <button type="submit" className="lg-submit" disabled={loading}>
                {loading && <span className="lg-spinner" />}
                {loading ? L("កំពុងចូលគណនី ...", "Signing in...") : L("ចូលប្រើប្រាស់", "Sign in")}
              </button>
            </form>

            <p className="lg-version">{APP_VERSION_TEXT}</p>
          </div>

          <footer className="lg-footer">
            © {new Date().getFullYear()} {APP_NAME} · {APP_NAME_KH}
          </footer>
        </main>
      </div>
    </div>
  );
}

export default LoginComponent;
