import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, CornerDownLeft, LayoutGrid, Shirt, ScanBarcode, Warehouse, FileText, Factory, FolderTree, BadgeCheck, User, Clock, Boxes } from "lucide-react";
import { searchService } from "../../../api/api.service";
import { L } from "../../../i18n";
import "./search.style.css";

const RECENT_KEY = "inventory_pos_recent_search";
const readRecent = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, 6);
  } catch {
    return [];
  }
};
const saveRecent = (item) => {
  try {
    const list = [item, ...readRecent().filter((r) => r.to !== item.to)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // storage blocked
  }
};

const DOC = {
  transfer: { path: "/stock/transfer", label: L("ផ្ទេរស្តុក", "Transfer") },
  receive: { path: "/stock/receive", label: L("ទទួលទំនិញ", "Goods receive") },
  adjustment: { path: "/stock/adjustment", label: L("កែតម្រូវស្តុក", "Adjustment") },
  opening: { path: "/stock/opening", label: L("ស្តុកដើមគ្រា", "Opening stock") },
};
const STATE = {
  draft: L("សេចក្តីព្រាង", "Draft"),
  requested: L("ស្នើសុំ", "Requested"),
  posted: L("បាន Post", "Posted"),
  dispatched: L("កំពុងដឹក", "In transit"),
  received: L("បានទទួល", "Received"),
  cancelled: L("បានបោះបង់", "Cancelled"),
};
const nm = (r) => L(r?.name_kh || r?.name_en || r?.name || "", r?.name_en || r?.name_kh || r?.name || "");
const enc = (v) => encodeURIComponent(v || "");
const fold = (s) => String(s || "").toLowerCase();

// every page the user may open (from the sidebar routes) → searchable list
function pagesOf(routeList) {
  const out = [];
  routeList.forEach((row) => {
    if (!row.child || row.child.length === 0) {
      if (row.is_show_sidebar !== false || row.url === "account") out.push({ name: row.name, sub: row.subtitle, to: "/" + row.url, icon: row.icon });
      return;
    }
    row.child.forEach((group) =>
      group.forEach((c) => out.push({ name: c.name, sub: `${row.name} · ${c.subtitle || ""}`, to: `/${row.url}/${c.url}`, icon: c.icon })),
    );
  });
  return out;
}

/**
 * Global search (top bar button / Ctrl+K / ⌘K): pages + products, SKUs / barcodes, warehouses,
 * documents, suppliers, categories, brands, users. Only results the user may open are shown.
 */
function GlobalSearch({ routeList }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const pages = useMemo(() => pagesOf(routeList || []), [routeList]);
  const allowed = useMemo(() => new Set(pages.map((p) => p.to)), [pages]);
  const can = (path) => allowed.has(path);

  // Ctrl+K / ⌘K anywhere, "/" when not typing
  useEffect(() => {
    const onKey = (e) => {
      const typing = /input|textarea|select/i.test(e.target?.tagName) || e.target?.isContentEditable;
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    } else {
      setQ("");
      setData(null);
    }
  }, [open]);

  // data search (debounced; pages are searched here in the browser)
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) {
      setData(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    let alive = true;
    const t = setTimeout(() => {
      searchService
        .query(text)
        .then((res) => alive && setData(res.data || null))
        .catch(() => alive && setData(null))
        .finally(() => alive && setLoading(false));
    }, 220);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  // ---------- results → groups of { title, items: [{ key, icon, title, sub, badge, to }] } ----------
  const groups = useMemo(() => {
    const text = fold(q.trim());
    if (!text) {
      const recent = readRecent();
      return recent.length ? [{ title: L("ស្វែងរកថ្មីៗ", "Recent"), items: recent.map((r, i) => ({ ...r, key: `r${i}`, icon: <Clock size={16} /> })) }] : [];
    }
    const out = [];
    // pages: a match in the page name comes first; a match only in its description goes after the data
    const pageItem = (p) => ({ key: p.to, icon: p.icon || <LayoutGrid size={16} />, title: p.name, sub: p.sub, to: p.to });
    const byName = pages.filter((p) => fold(`${p.name} ${p.to}`).includes(text)).slice(0, 5);
    const bySub = pages.filter((p) => !byName.includes(p) && fold(p.sub).includes(text)).slice(0, 3);
    if (byName.length) out.push({ title: L("ទំព័រ", "Pages"), items: byName.map(pageItem) });
    const related = () => bySub.length && out.push({ title: L("ទំព័រពាក់ព័ន្ធ", "Related pages"), items: bySub.map(pageItem) });
    if (!data) {
      related();
      return out;
    }

    const add = (title, items) => items.length && out.push({ title, items });
    if (can("/stock/balance") || can("/product/item")) {
      add(
        L("ប្រភេទរង / SKU / បាកូដ", "SKUs / barcodes"),
        data.skus.map((v) => ({
          key: `s${v._id}`,
          icon: <ScanBarcode size={16} />,
          title: nm(v),
          sub: [v.code, v.barcode].filter(Boolean).join(" · "),
          badge: L("ស្តុក", "Stock"),
          to: can("/stock/balance") ? `/stock/balance?q=${enc(v.code)}` : `/product/item?q=${enc(v.code)}`,
        })),
      );
    }
    if (can("/product/item"))
      add(
        L("ទំនិញ", "Products"),
        data.products.map((p) => ({
          key: `p${p._id}`,
          icon: p.image?.url ? <img src={p.image.url} alt="" /> : <Shirt size={16} />,
          title: nm(p),
          sub: `${p.code}${p.variant_count > 1 ? ` · ${p.variant_count} SKU` : ""}`,
          to: `/product/item?q=${enc(p.code)}`,
        })),
      );
    add(
      L("ឯកសារស្តុក", "Stock documents"),
      data.documents
        .filter((d) => can(DOC[d.type]?.path))
        .map((d) => ({
          key: `d${d._id}`,
          icon: <FileText size={16} />,
          title: d.doc_no,
          sub: `${DOC[d.type].label} · ${d.to ? `${d.from} → ${d.to}` : d.from || ""}`,
          badge: STATE[d.state] || d.state,
          to: `${DOC[d.type].path}?open=${d._id}`,
        })),
    );
    add(
      L("ឃ្លាំង / ហាង", "Warehouses / shops"),
      data.warehouses.map((w) => ({
        key: `w${w._id}`,
        icon: <Warehouse size={16} />,
        title: `${w.code} · ${nm(w)}`,
        sub: w.type === "central" ? L("ឃ្លាំងកណ្តាល", "Central warehouse") : L("ហាង", "Shop"),
        to: can("/setup/warehouse") ? `/setup/warehouse?q=${enc(w.code)}` : `/shop/${w.code}`,
        alt: { label: L("ស្តុក", "Stock"), to: `/shop/${w.code}/stock` },
      })),
    );
    if (can("/purchase/supplier"))
      add(
        L("អ្នកផ្គត់ផ្គង់", "Suppliers"),
        data.suppliers.map((s) => ({ key: `u${s._id}`, icon: <Factory size={16} />, title: s.name, sub: [s.code, s.phone].filter(Boolean).join(" · "), to: `/purchase/supplier?q=${enc(s.code)}` })),
      );
    if (can("/product/category"))
      add(
        L("ប្រភេទទំនិញ", "Categories"),
        data.categories.map((c) => ({ key: `c${c._id}`, icon: <FolderTree size={16} />, title: nm(c), sub: c.code, to: `/product/category?q=${enc(c.code)}` })),
      );
    if (can("/product/brand"))
      add(
        L("ម៉ាក", "Brands"),
        data.brands.map((b) => ({ key: `b${b._id}`, icon: <BadgeCheck size={16} />, title: nm(b), sub: b.code, to: `/product/brand?q=${enc(b.code)}` })),
      );
    if (can("/users"))
      add(
        L("អ្នកប្រើប្រាស់", "Users"),
        data.users.map((u) => ({
          key: `x${u._id}`,
          icon: <User size={16} />,
          title: `${u.firstname || ""} ${u.lastname || ""}`.trim() || u.email,
          sub: [u.email, u.role].filter(Boolean).join(" · "),
          to: `/users?q=${enc(u.email)}`,
        })),
      );
    related();
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, data, pages, allowed]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  useEffect(() => setActive(0), [q, data]);

  const go = (item) => {
    if (!item?.to) return;
    saveRecent({ title: item.title, sub: item.sub, to: item.to });
    setOpen(false);
    navigate(item.to);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(flat[active]);
    }
  };

  // keep the highlighted row visible
  useEffect(() => {
    listRef.current?.querySelector(".gs-item.on")?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const isMac = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
  let n = -1;

  return (
    <>
      <button type="button" className="gs-open" onClick={() => setOpen(true)} title={L("ស្វែងរកគ្រប់យ៉ាង", "Search everything")}>
        <Search size={17} />
        <span className="gs-open-text">{L("ស្វែងរក...", "Search...")}</span>
        <kbd>{isMac ? "⌘K" : "Ctrl K"}</kbd>
      </button>

      {open && (
        <div className="gs-backdrop" onMouseDown={() => setOpen(false)}>
          <div className="gs-box" role="dialog" aria-label={L("ស្វែងរក", "Search")} onMouseDown={(e) => e.stopPropagation()}>
            <div className="gs-input">
              <Search size={18} />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={L("ស្វែងរកទំព័រ ទំនិញ SKU បាកូដ ឯកសារ ហាង...", "Search pages, products, SKU, barcode, documents, shops...")}
                aria-label={L("ស្វែងរក", "Search")}
              />
              {loading && <span className="gs-spin" />}
              {q && (
                <button type="button" className="gs-clear" onClick={() => setQ("")} aria-label="Clear">
                  <X size={15} />
                </button>
              )}
              <kbd className="gs-esc" onClick={() => setOpen(false)}>
                Esc
              </kbd>
            </div>

            <div className="gs-list" ref={listRef}>
              {groups.map((g) => (
                <div key={g.title} className="gs-group">
                  <p className="gs-title">{g.title}</p>
                  {g.items.map((item) => {
                    n += 1;
                    const idx = n;
                    return (
                      <div key={item.key} className={`gs-item ${idx === active ? "on" : ""}`} onMouseMove={() => setActive(idx)} onClick={() => go(item)} role="option" aria-selected={idx === active}>
                        <span className="gs-icon">{item.icon}</span>
                        <span className="gs-text">
                          <b>{item.title}</b>
                          {item.sub && <small>{item.sub}</small>}
                        </span>
                        {item.badge && <span className="gs-badge">{item.badge}</span>}
                        {idx === active && <CornerDownLeft size={15} className="gs-enter" />}
                      </div>
                    );
                  })}
                </div>
              ))}

              {q.trim().length >= 2 && !loading && flat.length === 0 && (
                <div className="gs-empty">
                  <Boxes size={26} />
                  {L(`រកមិនឃើញ «${q.trim()}»`, `Nothing found for “${q.trim()}”`)}
                </div>
              )}
              {!q.trim() && flat.length === 0 && (
                <div className="gs-empty">{L("វាយឈ្មោះ SKU បាកូដ លេខឯកសារ ឬឈ្មោះទំព័រ", "Type a name, SKU, barcode, document number or page")}</div>
              )}
            </div>

            <div className="gs-foot">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> {L("ជ្រើស", "move")}
              </span>
              <span>
                <kbd>Enter</kbd> {L("បើក", "open")}
              </span>
              <span>
                <kbd>Esc</kbd> {L("បិទ", "close")}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default GlobalSearch;
