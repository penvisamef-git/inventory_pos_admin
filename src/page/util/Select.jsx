import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Search } from "lucide-react";
import { L } from "../../i18n";
import "./select.style.css";

/**
 * Drop-in replacement for <select> with a search box.
 *   <Select value={v} onChange={(e) => set(e.target.value)} className="md-filter"> <option value="">…</option> … </Select>
 * - Still renders the real <select> (same CSS, same width, form behaviour), but opens our own list instead of the
 *   browser's: themed, works in dialogs, and has a search box when there are 6+ options.
 * - onChange gets { target: { value, name, id } } like a normal change event.
 * - Search ignores case and the "— " indentation of category trees; Khmer and English both work.
 */
const SEARCH_FROM = 6;

const textOf = (node) => {
  if (node === null || node === undefined || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node.props) return textOf(node.props.children);
  return "";
};

// <option> elements anywhere in the children (arrays, fragments, conditionals)
function optionsOf(children, out = []) {
  React.Children.forEach(children, (child) => {
    if (!child) return;
    if (child.type === "option") {
      const label = textOf(child.props.children);
      out.push({ value: child.props.value !== undefined ? String(child.props.value) : label, label, disabled: !!child.props.disabled });
    } else if (child.type === React.Fragment || child.type === "optgroup") {
      optionsOf(child.props.children, out);
    }
  });
  return out;
}

const fold = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/^[\s—–\-·.]+/, "")
    .normalize("NFC");

function Select({ value, onChange, children, disabled, name, id, className, style, title, hidden, required, "aria-label": ariaLabel, ...rest }) {
  const selectRef = useRef(null);
  const popRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);

  const options = useMemo(() => optionsOf(children), [children]);
  const searchable = options.length >= SEARCH_FROM;
  const current = String(value ?? "");
  const shown = useMemo(() => {
    const t = fold(q.trim());
    return t ? options.filter((o) => fold(o.label).includes(t) || fold(o.value).includes(t)) : options;
  }, [options, q]);

  // place the list under (or above) the select; follow scroll / resize
  const place = () => {
    const el = selectRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, 220), vw - 16);
    const left = Math.min(Math.max(8, r.left), vw - width - 8);
    const below = vh - r.bottom;
    const up = below < 260 && r.top > below;
    setPos({ left, width, top: up ? undefined : r.bottom + 4, bottom: up ? vh - r.top + 4 : undefined, maxHeight: Math.max(160, Math.min(340, (up ? r.top : below) - 16)) });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  // close on outside click
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || selectRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("touchstart", onDown, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("touchstart", onDown, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    const i = options.findIndex((o) => o.value === current);
    setActive(i >= 0 ? i : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    if (open) listRef.current?.querySelector(".ss-opt.on")?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const pick = (opt) => {
    if (!opt || opt.disabled) return;
    setOpen(false);
    selectRef.current?.focus();
    if (opt.value !== current && onChange) onChange({ target: { value: opt.value, name, id }, currentTarget: { value: opt.value, name, id }, preventDefault() {}, stopPropagation() {} });
  };

  const openList = () => !disabled && setOpen(true);

  const onKey = (e) => {
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        e.stopPropagation(); // don't close the dialog behind
        setOpen(false);
        selectRef.current?.focus();
      }
      return;
    }
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      } else if (searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); // typing on the closed select starts a search
        openList();
        setTimeout(() => setQ(e.key), 0);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(shown[active]);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <>
      <select
        {...rest}
        ref={selectRef}
        id={id}
        name={name}
        className={className}
        style={style}
        title={title}
        hidden={hidden}
        required={required}
        aria-label={ariaLabel}
        disabled={disabled}
        value={current}
        onChange={() => {}}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault(); // no browser list
          if (open) setOpen(false);
          else {
            selectRef.current?.focus();
            openList();
          }
        }}
        onKeyDown={onKey}
        data-open={open ? "true" : undefined}
      >
        {children}
      </select>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            className="ss-pop"
            style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
            onKeyDown={onKey}
            role="listbox"
          >
            {searchable && (
              <div className="ss-search">
                <Search size={15} />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={L("ស្វែងរក...", "Search...")} aria-label={L("ស្វែងរក", "Search")} />
                <span className="ss-count">{shown.length}</span>
              </div>
            )}
            <div className="ss-list" ref={listRef} style={{ maxHeight: pos.maxHeight - (searchable ? 48 : 0) }} tabIndex={searchable ? -1 : 0} autoFocus={!searchable}>
              {shown.map((o, i) => (
                <div
                  key={`${o.value}|${i}`}
                  className={`ss-opt ${i === active ? "on" : ""} ${o.value === current ? "sel" : ""} ${o.disabled ? "off" : ""} ${o.value === "" ? "ss-empty-opt" : ""}`}
                  onMouseMove={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                  role="option"
                  aria-selected={o.value === current}
                >
                  <span className="ss-label">{o.label || " "}</span>
                  {o.value === current && <Check size={15} />}
                </div>
              ))}
              {shown.length === 0 && <div className="ss-none">{L("រកមិនឃើញ", "Nothing found")}</div>}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default Select;
