import React, { useState } from "react";
import { Check, Palette, Store, X } from "lucide-react";
import { L } from "../i18n";
import { CASHIER_THEMES, POS_THEMES, chooseUserTheme, currentTheme, userTheme } from "../theme";

// Menu → My colours: each cashier picks the POS colours he likes (kept on this computer, per cashier).
// "Shop colours" = follow the theme chosen in the admin web.
function Swatch({ k }) {
  const t = POS_THEMES[k];
  return (
    <span className="pos-th-shot" style={{ background: t["--pos-bg"], borderRadius: t["--pos-radius"] }}>
      <i style={{ background: `linear-gradient(135deg, ${t["--pos-green-light"]}, ${t["--pos-green-dark"]})` }} />
      <b style={{ background: t["--pos-green-soft"] }}><em style={{ background: t["--pos-green"] }} /></b>
      <u style={{ background: t["--pos-gold"] }} />
    </span>
  );
}

export default function ThemeDialog({ onClose }) {
  const [picked, setPicked] = useState(userTheme());
  const pick = (k) => {
    setPicked(k);
    chooseUserTheme(k);
  };
  const shop = currentTheme();
  return (
    <div className="pos-back" onMouseDown={onClose}>
      <div className="pos-dialog pos-themedlg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pos-dialog-head">
          <h3><Palette size={19} /> {L("ពណ៌របស់ខ្ញុំ", "My colours")}</h3>
          <button type="button" className="pos-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="pos-dialog-body">
          <p className="pos-muted">{L("ជ្រើសពណ៌ POS ដែលអ្នកចូលចិត្ត។ រក្សាទុកសម្រាប់តែអ្នក នៅលើកុំព្យូទ័រនេះ។", "Pick the POS colours you like. Kept for you only, on this computer.")}</p>
          <div className="pos-th-grid">
            <button type="button" className={`pos-th ${!picked ? "on" : ""}`} onClick={() => pick("")}>
              <Swatch k={shop} />
              <span className="pos-th-name">{!picked && <Check size={15} />}<Store size={14} /> {L("ពណ៌ហាង", "Shop colours")}</span>
              <small>{L("តាម Admin web", "Set in the admin web")}</small>
            </button>
            {CASHIER_THEMES.map((t) => (
              <button key={t.key} type="button" className={`pos-th ${picked === t.key ? "on" : ""}`} onClick={() => pick(t.key)}>
                <Swatch k={t.key} />
                <span className="pos-th-name">{picked === t.key && <Check size={15} />}{L(t.kh, t.en)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="pos-dialog-foot">
          <button type="button" className="pos-btn pos-btn-primary pos-btn-lg" onClick={onClose}>{L("រួចរាល់", "Done")}</button>
        </div>
      </div>
    </div>
  );
}
