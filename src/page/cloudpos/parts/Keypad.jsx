import React, { useEffect } from "react";
import { Delete, CornerDownLeft } from "lucide-react";

// Big number pad (touch) that also listens to the keyboard: digits, Backspace, Enter.
export default function Keypad({ value, onChange, onEnter, max = 6, disabled, dot = false, listen = true }) {
  const press = (k) => {
    if (disabled) return;
    if (k === "back") return onChange(value.slice(0, -1));
    if (k === "enter") return onEnter && onEnter();
    if (k === "." && (!dot || value.includes("."))) return;
    if (value.length >= max) return;
    onChange(value + k);
  };
  useEffect(() => {
    if (!listen) return undefined;
    const h = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "." && dot) press(".");
      else if (e.key === "Backspace") press("back");
      else if (e.key === "Enter") press("enter");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", dot ? "." : "back", "0", onEnter ? "enter" : dot ? "back" : ""];
  return (
    <div className="pos-keypad">
      {keys.map((k, i) =>
        k ? (
          <button key={i} type="button" className={`pos-key ${k === "enter" ? "pos-key-enter" : ""}`} onClick={() => press(k)} disabled={disabled}>
            {k === "back" ? <Delete size={22} /> : k === "enter" ? <CornerDownLeft size={22} /> : k}
          </button>
        ) : (
          <span key={i} />
        ),
      )}
    </div>
  );
}
