import React, { useEffect, useState } from "react";
import { ShieldCheck, User } from "lucide-react";
import { api, session } from "../api";
import { L, LANG, setLang } from "../i18n";
import Keypad from "../parts/Keypad";
import StatusDot from "../parts/StatusDot";

// Staff tiles → PIN (4–6 digits). Only staff of this shop with a POS PIN are listed (set in the admin web).
export default function Login({ status, onLogin }) {
  const [users, setUsers] = useState([]);
  const [picked, setPicked] = useState(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.users().then(setUsers).catch((e) => setError(e.message));
  }, []);

  const submit = async (value = pin) => {
    if (!picked || value.length < 4) return;
    setBusy(true);
    setError("");
    try {
      const r = await api.login(picked._id, value);
      session.save(r.token, r.user);
      onLogin(r.user);
    } catch (err) {
      setError(err.message);
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pos-center pos-bg">
      <div className="pos-card pos-login">
        <div className="pos-login-head">
          <div>
            <h1>{status.warehouse?.name_kh || status.warehouse?.code}</h1>
            <span className="pos-muted">{status.device?.name} · {status.device?.code}</span>
          </div>
          <div className="pos-login-tools">
            <StatusDot status={status} />
            <button type="button" className="pos-lang" onClick={() => setLang(LANG === "kh" ? "en" : "kh")}>{LANG === "kh" ? "EN" : "ខ្មែរ"}</button>
          </div>
        </div>
        {!picked ? (
          <>
            <h2>{L("អ្នកណាកំពុងលក់?", "Who is selling?")}</h2>
            {!users.length && !error && <p className="pos-muted">{L("មិនមានបុគ្គលិកមាន PIN — កំណត់ PIN នៅ Admin web (អ្នកប្រើប្រាស់ / បុគ្គលិកហាង) ហើយធ្វើសមកាលកម្ម។", "No staff with a PIN — set a POS PIN in the admin web (Users / shop Staff), then sync.")}</p>}
            <div className="pos-users">
              {users.map((u) => (
                <button key={u._id} type="button" className="pos-user" onClick={() => { setPicked(u); setPin(""); setError(""); }}>
                  <span className="pos-avatar">{u.is_manager ? <ShieldCheck size={22} /> : <User size={22} />}</span>
                  <b>{u.name}</b>
                  <small>{u.is_manager ? L("អ្នកគ្រប់គ្រងហាង", "Shop manager") : L("អ្នកគិតលុយ", "Cashier")}</small>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="pos-pin">
            <button type="button" className="pos-link" onClick={() => setPicked(null)}>← {L("ប្តូរអ្នកប្រើ", "Change user")}</button>
            <h2>{picked.name}</h2>
            <div className="pos-code pos-code-pin">
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                <span key={i} className={pin[i] ? "on" : ""}>{pin[i] ? "•" : ""}</span>
              ))}
            </div>
            {error && <div className="pos-error">{error}</div>}
            <Keypad value={pin} max={6} disabled={busy} onChange={setPin} onEnter={() => submit()} />
          </div>
        )}
      </div>
    </div>
  );
}
