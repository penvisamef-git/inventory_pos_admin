import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ban, BarChart3, ChevronDown, Monitor, Palette, PauseCircle, History as HistoryIcon, Languages, LogOut, Minus, Package, Percent, Plus, RefreshCw, ScanBarcode, Search, Trash2, Unplug, Wallet, X } from "lucide-react";
import { api } from "../api";
import { L, LANG, nm, setLang, usd, khr, qtyText } from "../i18n";
import { priceOf, totals as calcTotals } from "../cart";
import { applyTheme, currentTheme, onScreenTheme, screenTheme } from "../theme";
import StatusDot from "../parts/StatusDot";
import PayDialog from "./PayDialog";
import DiscountDialog from "./DiscountDialog";
import Receipt, { printReceipt } from "./Receipt";
import CloseShift from "./CloseShift";
import History from "./History";
import HoldList, { HoldNameDialog } from "./HoldDialog";
import StockApproveDialog from "./StockApproveDialog";
import Report from "./Report";
import RefundDialog from "./RefundDialog";
import ThemeDialog from "./ThemeDialog";

let seq = 0;
const optionText = (v) => (v.options || []).map((o) => nm(o)).join(" / ");

// The sell screen: products on the left (search / scan / categories), the cart on the right.
export default function Sell({ status, user, refresh, onLogout }) {
  const [cat, setCat] = useState(null); // catalog
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [group, setGroup] = useState("");
  const [lines, setLines] = useState([]);
  const [discount, setDiscount] = useState(null); // { type, value, approver }
  const [dialog, setDialog] = useState(null); // pay | discount | variants | receipt | close | history | menu
  const [pickProduct, setPickProduct] = useState(null);
  const [lastSale, setLastSale] = useState(null);
  const [flash, setFlash] = useState("");
  const [syncing, setSyncing] = useState(false);
  // out of stock: which items a manager allowed in this cart, and the manager (PIN kept only until the sale)
  const [stockOk, setStockOk] = useState({ approver: null, ids: [] });
  const [ask, setAsk] = useState(null); // { items, then, cancel }
  // auto-add scan: a scanned barcode goes into the cart by itself (no Enter). Each POS computer keeps its choice.
  const [autoScan, setAutoScan] = useState(() => {
    try {
      return localStorage.getItem("pos_scan_auto") !== "off";
    } catch {
      return true;
    }
  });
  const autoRef = useRef(autoScan);
  autoRef.current = autoScan;
  const toggleAuto = () => {
    const next = !autoScan;
    setAutoScan(next);
    try {
      localStorage.setItem("pos_scan_auto", next ? "on" : "off");
    } catch {
      // ignore
    }
    toast(next ? L("ស្កេន → ដាក់ចូលកន្ត្រកស្វ័យប្រវត្តិ", "Scan → added to the cart by itself") : L("ស្កេន ហើយចុច Enter", "Scan, then Enter"));
    searchRef.current?.focus();
  };
  const searchRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setCat(await api.catalog());
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const toast = (msg) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2200);
  };

  // ---------- lookups ----------
  const index = useMemo(() => {
    const byCode = new Map();
    const catById = new Map((cat?.categories || []).map((c) => [String(c._id), c]));
    const rootOf = (id) => {
      let c = catById.get(String(id));
      for (let i = 0; c && c.parent_id && i < 10; i++) c = catById.get(String(c.parent_id)) || c;
      return c ? String(c._id) : "";
    };
    (cat?.products || []).forEach((p) => {
      p.root = rootOf(p.category_id);
      p.search = `${p.code} ${p.name_kh} ${p.name_en} ${p.variants.map((v) => `${v.code} ${v.name_kh} ${v.name_en} ${v.barcode || ""}`).join(" ")}`.toLowerCase();
      p.variants.forEach((v) => {
        const base = p.units[0];
        if (v.barcode) byCode.set(v.barcode, { p, v, u: base });
        byCode.set(String(v.code).toUpperCase(), { p, v, u: base });
        (v.unit_barcodes || []).forEach((b) => {
          const u = p.units.find((x) => String(x._id) === String(b.unit_id));
          if (u && b.barcode) byCode.set(b.barcode, { p, v, u });
        });
      });
    });
    const roots = (cat?.categories || []).filter((c) => !c.parent_id && (cat?.products || []).some((p) => p.root === String(c._id)));
    return { byCode, roots };
  }, [cat]);

  const shown = useMemo(() => {
    const q = text.trim().toLowerCase();
    return (cat?.products || []).filter((p) => (!group || p.root === group) && (!q || q.split(/\s+/).every((w) => p.search.includes(w))));
  }, [cat, text, group]);

  // ---------- stock check (0 or less / more than the stock) ----------
  const tracked = (p) => p.track_stock !== false;
  const baseIn = (ls, vid) => ls.filter((l) => l.variant._id === vid).reduce((t, l) => t + (Number(l.qty) || 0) * (l.unit.factor || 1), 0);
  const shortOf = (ls) => {
    const seen = new Set();
    return ls.filter((l) => tracked(l.product) && !seen.has(l.variant._id) && seen.add(l.variant._id) && baseIn(ls, l.variant._id) > (Number(l.variant.stock) || 0) + 1e-9 && !stockOk.ids.includes(l.variant._id));
  };
  // run `then` now, or after a manager allows it (a manager is never asked)
  const checkStock = (next, then, cancel) => {
    const short = shortOf(next);
    if (!short.length) return then();
    if (user.is_manager) {
      setStockOk((s) => ({ ...s, ids: [...s.ids, ...short.map((l) => l.variant._id)] }));
      toast(L(`អស់ស្តុក: ${nm(short[0].product)} — លក់ដោយអ្នកគ្រប់គ្រង`, `Out of stock: ${nm(short[0].product)} — sold by a manager`));
      return then();
    }
    setAsk({
      items: short.map((l) => ({ key: l.variant._id, name: nm(l.product), option: optionText(l.variant) || l.variant.code, stock: Number(l.variant.stock) || 0, need: baseIn(next, l.variant._id) })),
      then: (approver) => {
        setStockOk((s) => ({ approver, ids: [...s.ids, ...short.map((l) => l.variant._id)] }));
        then();
      },
      cancel,
    });
  };

  // ---------- cart ----------
  const add = (p, v, u = p.units[0], qty = 1) => {
    if (priceOf({ variant: v, unit: u }) === undefined) return toast(L(`${v.code}: មិនទាន់មានតម្លៃលក់`, `${v.code}: no sale price yet`));
    checkStock([...lines, { product: p, variant: v, unit: u, qty }], () => addNow(p, v, u, qty));
  };
  const addNow = (p, v, u, qty) => {
    setLines((ls) => {
      const same = ls.find((l) => l.variant._id === v._id && l.unit._id === u._id);
      if (same) return ls.map((l) => (l === same ? { ...l, qty: l.qty + qty } : l)).sort((a, b) => (a === same ? -1 : b === same ? 1 : 0));
      return [{ key: ++seq, product: p, variant: v, unit: u, qty }, ...ls];
    });
  };
  const choose = (p) => {
    if (p.variants.length === 1) add(p, p.variants[0]);
    else setPickProduct(p);
  };
  const setQtyNow = (key, qty) => setLines((ls) => (qty <= 0 ? ls.filter((l) => l.key !== key) : ls.map((l) => (l.key === key ? { ...l, qty } : l))));
  const setQty = (key, qty, before) => {
    const next = lines.map((l) => (l.key === key ? { ...l, qty } : l));
    const up = qty > (before ?? lines.find((l) => l.key === key)?.qty ?? 0);
    if (!up || qty <= 0) return setQtyNow(key, qty);
    checkStock(next, () => setQtyNow(key, qty), () => before !== undefined && setQtyNow(key, before));
  };
  const setUnit = (key, unitId) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, unit: l.product.units.find((u) => String(u._id) === unitId) || l.unit } : l)));
  const clear = () => {
    setLines([]);
    setDiscount(null);
    setStockOk({ approver: null, ids: [] });
  };

  // ---------- hold / resume ----------
  const holdCart = async (label) => {
    try {
      const r = await api.hold({
        label,
        items: lines.map((l) => ({ variant_id: l.variant._id, unit_id: l.unit._id, qty: l.qty })),
        discount: discount ? { type: discount.type, value: discount.value } : null,
        total: t.total,
      });
      clear();
      setDialog(null);
      toast(L(`បានរក្សាទុក #${r.hold_no}${label ? ` · ${label}` : ""}`, `Held #${r.hold_no}${label ? ` · ${label}` : ""}`));
      refresh();
      return true;
    } catch (err) {
      toast(err.message);
      return false;
    }
  };
  const resume = async (h) => {
    try {
      if (lines.length) await holdCart(""); // the cart on screen is held first
      const taken = await api.unhold(h._id);
      const back = [];
      let missing = 0;
      taken.items.forEach((i) => {
        const p = (cat?.products || []).find((x) => x.variants.some((v) => String(v._id) === String(i.variant_id)));
        const v = p?.variants.find((x) => String(x._id) === String(i.variant_id));
        if (!p || !v) return missing++;
        const u = p.units.find((x) => String(x._id) === String(i.unit_id)) || p.units[0];
        back.push({ key: ++seq, product: p, variant: v, unit: u, qty: i.qty });
      });
      setLines(back);
      setStockOk({ approver: null, ids: [] }); // asked again at Pay if still out of stock
      // a discount needs the manager's PIN again (a PIN is never stored) — a manager keeps it as is
      const d = taken.discount;
      setDiscount(d && user.is_manager ? { ...d, approver: null } : null);
      setDialog(null);
      toast(
        [
          L(`បន្ត #${taken.hold_no}${taken.label ? ` · ${taken.label}` : ""}`, `Resumed #${taken.hold_no}${taken.label ? ` · ${taken.label}` : ""}`),
          missing ? L(`${missing} ទំនិញលែងមាន`, `${missing} item(s) no longer sold`) : "",
          d && !user.is_manager ? L("បញ្ចុះតម្លៃត្រូវអនុម័តម្តងទៀត", "add the discount again (manager PIN)") : "",
        ]
          .filter(Boolean)
          .join(" · "),
      );
      refresh();
    } catch (err) {
      toast(err.message);
    }
  };

  const scan = (code) => {
    const c = String(code || "").trim();
    if (!c) return false;
    const hit = index.byCode.get(c) || index.byCode.get(c.toUpperCase());
    if (hit) {
      add(hit.p, hit.v, hit.u);
      return true;
    }
    return false;
  };

  // auto-add: the search box holds exactly a barcode / item code → add it (short wait so the scanner finishes typing)
  useEffect(() => {
    if (!autoScan) return undefined;
    const c = text.trim();
    if (c.length < 3 || !(index.byCode.has(c) || index.byCode.has(c.toUpperCase()))) return undefined;
    const timer = setTimeout(() => {
      if (scan(c)) setText("");
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, autoScan, index]);

  // barcode scanner = fast keys (ending with Enter, or — with auto-add — just stopping) while no box has the focus
  useEffect(() => {
    let buf = "";
    let last = 0;
    let timer = null;
    const h = (e) => {
      if (dialog || pickProduct || ask) return;
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const now = Date.now();
      if (now - last > 80) buf = "";
      last = now;
      if (e.key === "Enter") {
        if (buf.length >= 3 && !scan(buf)) toast(L(`រកមិនឃើញ ${buf}`, `Not found: ${buf}`));
        buf = "";
      } else if (e.key.length === 1) {
        buf += e.key;
        if (autoRef.current) {
          clearTimeout(timer);
          timer = setTimeout(() => {
            if (buf.length >= 3 && scan(buf)) buf = "";
          }, 120);
        }
      } else if (e.key === "F2") searchRef.current?.focus();
      else if (e.key === "F8" && lines.length) setDialog("hold");
    };
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("keydown", h);
      clearTimeout(timer);
    };
  });

  const t = cat ? calcTotals(lines, discount, cat.setting, cat.rate) : null;

  // ---------- customer display (second screen) ----------
  const shown2 = useRef("idle"); // what the display shows now
  const lastShown = useRef({ mode: "idle", data: {} });
  const show = (mode, data = {}) => {
    shown2.current = mode;
    lastShown.current = { mode, data };
    api.display(mode, { ...data, theme: screenTheme() }).catch(() => {}); // the display uses the cashier's colours too
  };
  // cashier changed his colours → the customer display follows at once
  useEffect(() => {
    show("idle"); // a cashier just logged in → welcome screen in his colours
    return onScreenTheme(() => show(lastShown.current.mode, lastShown.current.data));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const cartView = () => ({
    items: lines.map((l) => ({
      key: l.key,
      name_kh: l.product.name_kh || l.product.name_en,
      name_en: l.product.name_en || "",
      option: optionText(l.variant),
      unit: l.product.units.length > 1 ? nm(l.unit) : "",
      qty: l.qty,
      price: priceOf(l) ?? 0,
      total: (priceOf(l) ?? 0) * l.qty,
    })),
    count: t.count,
    subtotal: t.subtotal,
    discount_total: t.discountTotal,
    tax: t.mode === "exclusive" ? t.tax : 0,
    tax_name: cat.setting?.tax_name,
    total: t.total,
    total_khr: t.totalKhr,
    rate: t.rate,
  });
  useEffect(() => {
    if (!t || dialog === "pay" || dialog === "receipt") return undefined;
    if (!lines.length && (shown2.current === "idle" || shown2.current === "done")) return undefined; // keep "thank you" on screen
    const timer = setTimeout(() => show(lines.length ? "cart" : "idle", lines.length ? cartView() : {}), 120);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, discount, dialog, cat]);
  const openDisplay = () => {
    setDialog(null);
    window.open(`${window.location.origin}/cloud/pos/display`, "pos-customer-display", "popup=yes,width=1280,height=800");
    setTimeout(() => show(lines.length ? "cart" : "idle", lines.length ? cartView() : {}), 1500);
  };

  const doSync = async () => {
    setSyncing(true);
    try {
      const r = await api.sync();
      await load();
      const changed = r?.ui_theme && r.ui_theme !== currentTheme();
      if (r?.ui_theme) applyTheme(r.ui_theme); // theme picked in the admin web
      toast(changed ? L("បានធ្វើសមកាលកម្ម · ប្តូររចនាប័ទ្ម", "Synced · theme updated") : L("បានធ្វើសមកាលកម្ម", "Synced"));
    } catch (err) {
      toast(err.message);
    } finally {
      setSyncing(false);
      refresh();
    }
  };

  const done = (sale) => {
    show("done", { invoice_no: sale.invoice_no, total: sale.total, total_khr: sale.total_khr, paid: sale.paid_usd, change: sale.change_usd, give_usd: sale.change_give_usd, give_khr: sale.change_give_khr });
    setLastSale(sale);
    clear();
    setDialog("receipt");
    refresh();
    load(); // stock on the cards
  };

  if (error && !cat) {
    return (
      <div className="pos-center">
        <div className="pos-card pos-msg">
          <h2>{L("មិនទាន់មានទិន្នន័យ", "No data yet")}</h2>
          <p>{error}</p>
          <button type="button" className="pos-btn pos-btn-primary" onClick={doSync} disabled={syncing}><RefreshCw size={16} /> {L("ធ្វើសមកាលកម្ម", "Sync now")}</button>
        </div>
      </div>
    );
  }
  if (!cat) return <div className="pos-center pos-muted">{L("កំពុងផ្ទុកទំនិញ...", "Loading products...")}</div>;

  return (
    <div className="pos-app">
      {/* ================= top bar ================= */}
      <header className="pos-top">
        <div className="pos-brand">
          <b>{nm(cat.warehouse)}</b>
          <span>{status.shift?.shift_no || cat.device?.code}</span>
        </div>
        <label className="pos-search">
          <Search size={18} />
          <input
            ref={searchRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (scan(text)) setText("");
                else if (shown.length === 1) {
                  choose(shown[0]);
                  setText("");
                }
              }
              if (e.key === "Escape") setText("");
            }}
            placeholder={autoScan ? L("ស្កេនបាកូដ (ចូលកន្ត្រកស្វ័យប្រវត្តិ) ឬស្វែងរក (F2)", "Scan (adds by itself) or search (F2)") : L("ស្វែងរក ឬស្កេនបាកូដ + Enter (F2)", "Search, or scan + Enter (F2)")}
          />
          {text && <button type="button" onClick={() => setText("")}><X size={16} /></button>}
          <button
            type="button"
            className={`pos-scan-toggle ${autoScan ? "on" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleAuto}
            title={autoScan ? L("ស្កេនស្វ័យប្រវត្តិ: បើក (ចុចដើម្បីបិទ)", "Auto-add scan: on (tap to turn off)") : L("ស្កេនស្វ័យប្រវត្តិ: បិទ — ត្រូវចុច Enter", "Auto-add scan: off — press Enter")}
          >
            <ScanBarcode size={17} /> <span>{autoScan ? L("ស្វ័យប្រវត្តិ", "Auto") : "Enter"}</span>
          </button>
        </label>
        <div className="pos-top-right">
          <StatusDot status={status} onClick={doSync} />
          <button type="button" className="pos-icon" onClick={doSync} disabled={syncing} title={L("ធ្វើសមកាលកម្ម", "Sync now")}><RefreshCw size={18} className={syncing ? "pos-spin" : ""} /></button>
          <div className="pos-menu-wrap">
            <button type="button" className="pos-user-btn" onClick={() => setDialog(dialog === "menu" ? null : "menu")}>
              <span className="pos-avatar-sm">{user.name.slice(0, 1)}</span>
              <span className="pos-user-name">{user.name}</span>
              <ChevronDown size={16} />
            </button>
            {dialog === "menu" && (
              <div className="pos-menu" onMouseLeave={() => setDialog(null)}>
                <button type="button" onClick={() => setDialog("history")}><HistoryIcon size={17} />{L("វិក្កយបត្រ", "Invoices")}</button>
                <button type="button" onClick={() => setDialog("report")}><BarChart3 size={17} />{user.is_manager ? L("របាយការណ៍លក់", "Sales report") : L("របាយការណ៍របស់ខ្ញុំ", "My report")}</button>
                <button type="button" onClick={openDisplay}><Monitor size={17} />{L("អេក្រង់អតិថិជន", "Customer display")}{status.display_screens ? " ✓" : ""}</button>
                <button type="button" onClick={() => setDialog("holds")}><PauseCircle size={17} />{L("កន្ត្រកដែលរក្សាទុក", "Held carts")}{status.held_carts ? ` (${status.held_carts})` : ""}</button>
                <button type="button" onClick={() => setDialog("close")}><Wallet size={17} />{L("បិទវេន", "Close shift")}</button>
                <button type="button" onClick={() => setDialog("theme")}><Palette size={17} />{L("ពណ៌របស់ខ្ញុំ", "My colours")}</button>
                <button type="button" onClick={() => setLang(LANG === "kh" ? "en" : "kh")}><Languages size={17} />{LANG === "kh" ? "English" : "ខ្មែរ"}</button>
                {user.is_manager && (
                  <button type="button" onClick={async () => { if (window.confirm(L("ផ្តាច់ POS នេះពីហាង?", "Unlink this POS from the shop?"))) { try { await api.unpair(); onLogout(); refresh(); } catch (e) { toast(e.message); } } }}>
                    <Unplug size={17} />{L("ផ្តាច់ POS", "Unlink POS")}
                  </button>
                )}
                <button type="button" onClick={onLogout}><LogOut size={17} />{L("ចាកចេញ", "Log out")}</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ================= products ================= */}
      <main className="pos-products">
        {index.roots.length > 1 && (
          <div className="pos-cats">
            <button type="button" className={!group ? "on" : ""} onClick={() => setGroup("")}>{L("ទាំងអស់", "All")}</button>
            {index.roots.map((c) => (
              <button key={c._id} type="button" className={group === String(c._id) ? "on" : ""} onClick={() => setGroup(group === String(c._id) ? "" : String(c._id))}>{nm(c)}</button>
            ))}
          </div>
        )}
        <div className="pos-grid">
          {shown.map((p) => {
            const prices = p.variants.map((v) => v.prices?.[String(p.units[0]._id)]).filter((x) => x !== undefined);
            const min = prices.length ? Math.min(...prices) : null;
            const max = prices.length ? Math.max(...prices) : null;
            const stock = p.variants.reduce((s, v) => s + (v.stock || 0), 0);
            return (
              <button key={p._id} type="button" className={`pos-prod ${min === null ? "no-price" : ""} ${p.track_stock && stock <= 0 ? "is-out" : ""}`} onClick={() => choose(p)}>
                <span className="pos-prod-img">
                  {p.image ? <img src={p.image} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <Package size={30} strokeWidth={1.5} />}
                  {p.track_stock && <em className={stock <= 0 ? "out" : ""}>{qtyText(stock)}</em>}
                  {p.track_stock && stock <= 0 && <span className="pos-out-tag">{L("អស់ស្តុក", "Out of stock")}</span>}
                </span>
                <span className="pos-prod-name">{nm(p)}</span>
                <span className="pos-prod-foot">
                  <b>{min === null ? L("គ្មានតម្លៃ", "No price") : min === max ? usd(min) : `${usd(min)}+`}</b>
                  {p.variants.length > 1 && <small>{p.variants.length} {L("ជម្រើស", "options")}</small>}
                </span>
              </button>
            );
          })}
          {!shown.length && <div className="pos-none">{L("រកមិនឃើញទំនិញ", "No items found")}</div>}
        </div>
      </main>

      {/* ================= cart ================= */}
      <aside className="pos-cart">
        <div className="pos-cart-head">
          <b>{L("កន្ត្រក", "Cart")} {t.count ? `· ${qtyText(t.count)}` : ""}</b>
          <span className="pos-cart-tools">
            {status.held_carts > 0 && (
              <button type="button" className="pos-held" onClick={() => setDialog("holds")} title={L("កន្ត្រកដែលរក្សាទុក", "Held carts")}>
                <PauseCircle size={15} /> {L("រក្សាទុក", "Held")} <em>{status.held_carts}</em>
              </button>
            )}
            {lines.length > 0 && <button type="button" className="pos-link danger" onClick={clear}><Trash2 size={15} /> {L("សម្អាត", "Clear")}</button>}
          </span>
        </div>
        <div className="pos-lines">
          {!lines.length && (
            <div className="pos-empty-cart">
              <ScanBarcode size={36} strokeWidth={1.4} />
              <span>{L("ស្កេនបាកូដ ឬចុចលើទំនិញ", "Scan a barcode or tap an item")}</span>
            </div>
          )}
          {lines.map((l) => {
            const price = priceOf(l);
            return (
              <div key={l.key} className="pos-line">
                <div className="pos-line-main">
                  <b>{nm(l.product)}</b>
                  <span className="pos-muted">
                    {optionText(l.variant) || l.variant.code}
                    {l.product.units.length > 1 ? (
                      <select value={String(l.unit._id)} onChange={(e) => setUnit(l.key, e.target.value)}>
                        {l.product.units.map((u) => (
                          <option key={u._id} value={String(u._id)}>{nm(u)}{u.factor > 1 ? ` ×${u.factor}` : ""}</option>
                        ))}
                      </select>
                    ) : (
                      ` · ${nm(l.unit)}`
                    )}
                  </span>
                  {tracked(l.product) && baseIn(lines, l.variant._id) > (Number(l.variant.stock) || 0) + 1e-9 && (
                    <span className="pos-line-out">{L(`អស់ស្តុក (នៅ ${qtyText(l.variant.stock)})`, `Out of stock (${qtyText(l.variant.stock)} left)`)}{stockOk.ids.includes(l.variant._id) ? ` · ${L("បានអនុញ្ញាត", "allowed")}` : ""}</span>
                  )}
                  <span className="pos-line-price">{price === undefined ? <em>{L("គ្មានតម្លៃ", "No price")}</em> : `${usd(price)} × ${qtyText(l.qty)}`}</span>
                </div>
                <div className="pos-line-side">
                  <b>{price === undefined ? "-" : usd(price * l.qty)}</b>
                  <div className="pos-qty">
                    <button type="button" onClick={() => setQty(l.key, l.qty - 1)}>{l.qty <= 1 ? <Trash2 size={15} /> : <Minus size={16} />}</button>
                    <input
                      inputMode="decimal"
                      value={l.qty}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^\d*\.?\d*$/.test(v)) setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, qty: v === "" ? 0 : Number(v) } : x)));
                      }}
                      onFocus={() => { l.before = l.qty; }}
                      onBlur={() => (l.qty <= 0 ? setQtyNow(l.key, 0) : l.before !== undefined && l.qty !== l.before && setQty(l.key, l.qty, l.before))}
                    />
                    <button type="button" onClick={() => setQty(l.key, l.qty + 1)}><Plus size={16} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pos-sum">
          <div><span>{L("សរុបរង", "Subtotal")}</span><span>{usd(t.subtotal)}</span></div>
          <div className="pos-sum-disc">
            <button type="button" className="pos-link" onClick={() => setDialog("discount")} disabled={!lines.length}>
              <Percent size={14} /> {discount ? (discount.type === "percent" ? `${L("បញ្ចុះ", "Discount")} ${discount.value}%` : L("បញ្ចុះតម្លៃ", "Discount")) : L("បញ្ចុះតម្លៃ", "Add discount")}
            </button>
            <span>{t.discountTotal ? `−${usd(t.discountTotal)}` : ""}{discount && <button type="button" className="pos-x" onClick={() => setDiscount(null)}><X size={13} /></button>}</span>
          </div>
          {t.mode !== "none" && t.taxRate > 0 && (
            <div><span>{cat.setting.tax_name} {t.taxRate}%{t.mode === "inclusive" ? ` (${L("រួមក្នុងតម្លៃ", "incl.")})` : ""}</span><span>{usd(t.tax)}</span></div>
          )}
          <div className="pos-total"><span>{L("សរុប", "Total")}</span><span><b>{usd(t.total)}</b><small>{khr(t.totalKhr)}</small></span></div>
          <div className="pos-pay-row">
          <button type="button" className="pos-btn pos-btn-ghost pos-hold-btn" disabled={!lines.length} onClick={() => setDialog("hold")} title={L("រក្សាទុកកន្ត្រក (F8)", "Hold cart (F8)")}>
            <PauseCircle size={20} /> {L("រក្សាទុក", "Hold")}
          </button>
          <button type="button" className="pos-btn pos-btn-primary pos-pay" disabled={!lines.length || lines.some((l) => priceOf(l) === undefined || !(l.qty > 0))} onClick={() => checkStock(lines, () => setDialog("pay"))}>
            <Wallet size={20} /> {L("គិតលុយ", "Pay")} {lines.length ? usd(t.total) : ""}
          </button>
          </div>
        </div>
      </aside>

      {flash && <div className="pos-toast">{flash}</div>}

      {/* ================= dialogs ================= */}
      {pickProduct && (
        <div className="pos-back" onMouseDown={() => setPickProduct(null)}>
          <div className="pos-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <div className="pos-dialog-head"><h3>{nm(pickProduct)}</h3><button type="button" className="pos-icon" onClick={() => setPickProduct(null)}><X size={20} /></button></div>
            <div className="pos-variants">
              {pickProduct.variants.map((v) => {
                const price = v.prices?.[String(pickProduct.units[0]._id)];
                return (
                  <button key={v._id} type="button" disabled={price === undefined} onClick={() => { add(pickProduct, v); setPickProduct(null); }}>
                    <span className="pos-var-name">
                      {(v.options || []).filter((o) => o.color_hex).map((o) => <i key={o.value_code} style={{ background: o.color_hex }} />)}
                      {optionText(v) || v.code}
                    </span>
                    <b>{price === undefined ? L("គ្មានតម្លៃ", "No price") : usd(price)}</b>
                    {pickProduct.track_stock && <small className={v.stock <= 0 ? "out" : ""}>{L("ស្តុក", "Stock")} {qtyText(v.stock)}</small>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {ask && (
        <StockApproveDialog
          items={ask.items}
          onClose={() => { ask.cancel?.(); setAsk(null); }}
          onApproved={(a) => { const go = ask.then; setAsk(null); go(a); toast(L(`អនុញ្ញាតដោយ ${a.name}`, `Allowed by ${a.name}`)); }}
        />
      )}
      {dialog === "hold" && <HoldNameDialog count={t.count} total={t.total} onClose={() => setDialog(null)} onHold={holdCart} />}
      {dialog === "theme" && <ThemeDialog onClose={() => setDialog(null)} />}
      {dialog === "holds" && <HoldList cartHasItems={lines.length > 0} onClose={() => setDialog(null)} onResume={resume} />}
            {dialog === "discount" && (
        <DiscountDialog user={user} current={discount} subtotal={t.subtotal} onClose={() => setDialog(null)} onApply={(d) => { setDiscount(d); setDialog(null); }} />
      )}
      {dialog === "pay" && (
        <PayDialog catalog={cat} totals={t} lines={lines} discount={discount} stockApprover={stockOk.approver} onClose={() => setDialog(null)} onDone={done} onState={(pay) => show("pay", { ...cartView(), pay })} />
      )}
      {dialog === "receipt" && lastSale && (
        <Receipt sale={lastSale} catalog={cat} onClose={() => { setDialog(null); searchRef.current?.focus(); }} autoPrint />
      )}
      {(dialog === "history" || dialog === "history-problem") && (
        <History
          shiftId={status.shift?._id}
          user={user}
          startOnProblems={dialog === "history-problem"}
          problemCount={status.failed_sales}
          onClose={() => setDialog(null)}
          onOpen={(s) => { setLastSale(s); setDialog(dialog === "history-problem" ? "receipt-old-p" : "receipt-old"); }}
          onChanged={refresh}
        />
      )}
      {(dialog === "receipt-old" || dialog === "receipt-old-p") && lastSale && (
        <Receipt
          sale={lastSale}
          catalog={cat}
          onClose={() => setDialog(dialog === "receipt-old-p" ? "history-problem" : "history")}
          onRefund={status.shift ? () => setDialog("refund") : undefined}
        />
      )}
      {dialog === "refund" && lastSale && (
        <RefundDialog
          sale={lastSale}
          catalog={cat}
          user={user}
          onClose={() => setDialog("receipt-old")}
          onDone={(s) => { setLastSale(s); refresh(); load(); setDialog("history"); }}
        />
      )}
      {dialog === "report" && <Report user={user} catalog={cat} onClose={() => setDialog(null)} printSlip={printReceipt} />}
      {dialog === "close" && (
        <CloseShift catalog={cat} onClose={() => setDialog(null)} onClosed={() => { setDialog(null); onLogout(); refresh(); }} printZ={printReceipt} />
      )}
      {status.failed_sales > 0 && (
        <button type="button" className="pos-warnbar" onClick={() => setDialog("history-problem")}><Ban size={15} /> {L(`វិក្កយបត្រ ${status.failed_sales} ផ្ញើទៅ Cloud មិនបាន — ចុចដើម្បីមើលមូលហេតុ / ព្យាយាមម្តងទៀត / ដកចេញ`, `${status.failed_sales} invoice(s) could not be sent to the cloud — tap to see why, try again or remove`)}</button>
      )}
    </div>
  );
}
