import React, { useState } from "react";
import { Link2, Unplug } from "lucide-react";
import { api } from "../api";
import { L, LANG, setLang, dateTimeText } from "../i18n";
import Keypad from "../parts/Keypad";

// First start: link this computer to its shop with the 6-digit code from the admin web (CONNECT → POS devices).
export default function Pair({ status, onDone }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (value = code) => {
    if (value.length !== 6) return;
    setBusy(true);
    setError("");
    try {
      await api.pair(value);
      onDone();
    } catch (err) {
      setError(err.message);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pos-center pos-bg">
      <div className="pos-card pos-pair">
        <button type="button" className="pos-lang" onClick={() => setLang(LANG === "kh" ? "en" : "kh")}>{LANG === "kh" ? "EN" : "ខ្មែរ"}</button>
        <div className="pos-pair-icon"><Link2 size={30} /></div>
        <h1>{L("ភ្ជាប់ POS នេះទៅហាង", "Link this POS to its shop")}</h1>
        <p className="pos-muted">{L("នៅ Admin web: ការតភ្ជាប់ → ម៉ាស៊ីន POS → បន្ថែម POS អនឡាញ ហើយវាយលេខកូដ 6 ខ្ទង់នៅទីនេះ។", "In the admin web: CONNECT → POS devices → Add cloud POS, then type the 6-digit code here.")}</p>
        <div className="pos-code">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className={code[i] ? "on" : ""}>{code[i] || ""}</span>
          ))}
        </div>
        {status?.revoked_reason && (
          <div className="pos-unlinked">
            <Unplug size={18} />
            <span>
              <b>{L("POS នេះត្រូវបានផ្តាច់ពី Admin web", "This POS was unlinked in the admin web")}</b>
              <small>{status.revoked_reason}{status.revoked_at ? ` · ${dateTimeText(status.revoked_at)}` : ""}</small>
              <small>{L("ទិន្នន័យហាងនៅលើកុំព្យូទ័រនេះត្រូវបានលុប។ សុំលេខកូដថ្មីពីអ្នកគ្រប់គ្រង។", "The shop data on this computer was cleared. Ask the admin for a new code.")}</small>
              {status.pending_sales > 0 && (
                <small className="warn">{L(`មានវិក្កយបត្រ ${status.pending_sales} មិនទាន់ផ្ញើ — វានឹងផ្ញើពេលភ្ជាប់ POS ដដែលនេះម្តងទៀត។`, `${status.pending_sales} sale(s) not sent yet — they are sent when this same POS is linked again.`)}</small>
              )}
            </span>
          </div>
        )}
        {error && <div className="pos-error">{error}</div>}
        <Keypad
          value={code}
          max={6}
          disabled={busy}
          onChange={(v) => {
            setCode(v);
            if (v.length === 6) submit(v);
          }}
          onEnter={() => submit()}
        />
        {busy && <p className="pos-muted">{L("កំពុងភ្ជាប់ និងទាញទិន្នន័យ...", "Linking and downloading the shop's data...")}</p>}
      </div>
    </div>
  );
}
