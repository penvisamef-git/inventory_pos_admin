import React, { useEffect, useRef, useState } from "react";
import { Monitor, Moon, Settings, Sun } from "lucide-react";
import { L, LANG, getPrefs, setLang } from "../../../i18n";
import { setThemeMode } from "./color.script";
import "./preference.style.css";

// Gear button → language (ខ្មែរ / English) + theme (light / dark / system)
function PreferenceMenu({ className = "" }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(getPrefs().theme);
  const ref = useRef(null);

  // close on outside click / Esc
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pickTheme = (mode) => {
    setTheme(mode);
    setThemeMode(mode);
  };

  const themes = [
    { value: "light", label: L("ភ្លឺ", "Light"), icon: <Sun size={15} /> },
    { value: "dark", label: L("ងងឹត", "Dark"), icon: <Moon size={15} /> },
    { value: "system", label: L("តាមឧបករណ៍", "System"), icon: <Monitor size={15} /> },
  ];

  return (
    <div className={`pref ${className}`} ref={ref}>
      <button
        type="button"
        className="pref-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={L("ការកំណត់ភាសា និងពណ៌", "Language & theme")}
      >
        <Settings size={19} />
      </button>

      {open && (
        <div className="pref-pop" role="dialog" aria-label={L("ការកំណត់ភាសា និងពណ៌", "Language & theme")}>
          <p className="pref-label">{L("ភាសា", "Language")}</p>
          <div className="pref-seg">
            <button type="button" className={LANG === "kh" ? "on" : ""} onClick={() => setLang("kh")}>
              ខ្មែរ
            </button>
            <button type="button" className={LANG === "en" ? "on" : ""} onClick={() => setLang("en")}>
              English
            </button>
          </div>

          <p className="pref-label">{L("ពណ៌ផ្ទៃ", "Theme")}</p>
          <div className="pref-seg pref-seg-3">
            {themes.map((t) => (
              <button key={t.value} type="button" className={theme === t.value ? "on" : ""} onClick={() => pickTheme(t.value)}>
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PreferenceMenu;
