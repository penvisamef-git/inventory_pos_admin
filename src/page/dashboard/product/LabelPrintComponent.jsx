import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, Printer, Search, Tags, Trash2 } from "lucide-react";
import { priceService, settingService, warehouseService, exchangeRateService } from "../../../api/api.service";
import { Barcode128 } from "../../util/code128";
import { nameKh } from "../setup/setupOptions";
import Select from "../../util/Select";
import { L } from "../../../i18n";
import "./label.style.css";

// Barcode / price labels: pick items (search by name, SKU or barcode), copies per item, label size, what to show → Print.
// Roll printers (thermal 40×30, 50×30 …): one label per page. A4 sheets: a grid of labels.
const SIZES = [
  { key: "40x30", w: 40, h: 30, kind: "roll", label: "40 × 30 mm" },
  { key: "50x30", w: 50, h: 30, kind: "roll", label: "50 × 30 mm" },
  { key: "58x40", w: 58, h: 40, kind: "roll", label: "58 × 40 mm" },
  { key: "70x40", w: 70, h: 40, kind: "roll", label: "70 × 40 mm" },
  { key: "a4_3x8", w: 63.5, h: 33.9, kind: "a4", cols: 3, rows: 8, label: L("A4 · 3 × 8 (24 ផ្ទាំង)", "A4 · 3 × 8 (24 labels)") },
  { key: "a4_4x10", w: 48.5, h: 25.4, kind: "a4", cols: 4, rows: 10, label: L("A4 · 4 × 10 (40 ផ្ទាំង)", "A4 · 4 × 10 (40 labels)") },
];
const usd = (v) => `$${Number(v || 0).toFixed(2)}`;
const khr = (v) => `${Math.round(Number(v || 0)).toLocaleString("en-US")}៛`;
const PREF = "label_print_prefs";
const loadPrefs = () => {
  try {
    return JSON.parse(localStorage.getItem(PREF) || "null") || {};
  } catch {
    return {};
  }
};

function Label({ item, show, size, shopName, rate, step }) {
  const price = item.price;
  const khrPrice = price !== null && price !== undefined ? Math.round((price * rate) / step) * step : null;
  const code = item.barcode || item.code;
  const small = size.h <= 26;
  return (
    <div className={`lb-label ${small ? "small" : ""}`} style={{ width: `${size.w}mm`, height: `${size.h}mm` }}>
      {show.shop && shopName && <div className="lb-shop">{shopName}</div>}
      {show.name && <div className="lb-name">{L(item.name_kh, item.name_en || item.name_kh)}</div>}
      {show.price && price !== null && price !== undefined && (
        <div className="lb-price">
          <b>{usd(price)}</b>
          {show.khr && <span>{khr(khrPrice)}</span>}
          {item.unit_name && <small>/ {item.unit_name}</small>}
        </div>
      )}
      {show.barcode && code && <Barcode128 value={code} width={Math.min(size.w - 4, 46)} height={small ? 7 : 9} />}
      {show.code && <div className="lb-code">{code}</div>}
    </div>
  );
}

export default function LabelPrintComponent() {
  const prefs = loadPrefs();
  const [shops, setShops] = useState([]);
  const [shopId, setShopId] = useState(prefs.shopId || "");
  const [setting, setSetting] = useState(null);
  const [rate, setRate] = useState(4100);
  const [q, setQ] = useState("");
  const [found, setFound] = useState([]);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]); // [{ key, variant_id, code, barcode, name_kh, name_en, price, unit_name, copies }]
  const [sizeKey, setSizeKey] = useState(prefs.sizeKey || "50x30");
  const [show, setShow] = useState(prefs.show || { shop: true, name: true, price: true, khr: true, barcode: true, code: true });
  const size = SIZES.find((s) => s.key === sizeKey) || SIZES[1];

  useEffect(() => {
    warehouseService.all({ type: "shop" }).then((r) => setShops((r.data || []).filter((w) => w.type === "shop"))).catch(() => {});
    settingService.get().then((r) => setSetting(r.data)).catch(() => {});
    (exchangeRateService.current ? exchangeRateService.current() : Promise.reject()).then((r) => r?.data?.rate && setRate(r.data.rate)).catch(() => {});
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(PREF, JSON.stringify({ shopId, sizeKey, show }));
    } catch {
      // ignore
    }
  }, [shopId, sizeKey, show]);

  // search (name / SKU / barcode) with the price of the chosen shop
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) return setFound([]);
    let alive = true;
    setLoading(true);
    const timer = setTimeout(() => {
      priceService
        .current({ q: t, warehouse_id: shopId || undefined, limit: 30 })
        .then((r) => {
          if (!alive) return;
          const rows = [];
          (r.data || []).forEach((v) =>
            (v.units || []).forEach((u) => {
              const price = shopId ? u.price : u.default?.price ?? null;
              const ub = (v.unit_barcodes || []).find((b) => String(b.unit_id) === String(u.unit_id));
              rows.push({ key: `${v.variant_id}|${u.unit_id}`, variant_id: v.variant_id, code: v.code, barcode: u.is_base ? v.barcode : ub?.barcode || null, name_kh: v.name_kh, name_en: v.name_en, price, unit_name: (v.units || []).length > 1 ? L(u.unit_name_kh, u.unit_name_en || u.unit_name_kh) : "" });
            }),
          );
          setFound(rows);
        })
        .catch(() => alive && setFound([]))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q, shopId]);

  const add = (r) => setItems((list) => (list.some((x) => x.key === r.key) ? list.map((x) => (x.key === r.key ? { ...x, copies: x.copies + 1 } : x)) : [...list, { ...r, copies: 1 }]));
  const setCopies = (key, n) => setItems((list) => list.map((x) => (x.key === key ? { ...x, copies: Math.max(1, Math.min(500, n)) } : x)));
  const labels = useMemo(() => items.flatMap((it) => Array.from({ length: it.copies }, (_, k) => ({ ...it, n: k }))), [items]);
  const shop = shops.find((s) => s._id === shopId);
  const shopName = (L(setting?.company_name_kh, setting?.company_name_en || setting?.company_name_kh) || (shop ? nameKh(shop) : "")).trim();
  const step = Number(setting?.khr_rounding) || 100;
  const toggle = (k) => setShow((s) => ({ ...s, [k]: !s[k] }));
  const sheets = size.kind === "a4" ? Array.from({ length: Math.ceil(labels.length / (size.cols * size.rows)) }, (_, p) => labels.slice(p * size.cols * size.rows, (p + 1) * size.cols * size.rows)) : [];

  const print = () => {
    document.body.classList.add("lb-printing");
    const style = document.createElement("style");
    style.id = "lb-page";
    style.textContent = size.kind === "roll" ? `@page { size: ${size.w}mm ${size.h}mm; margin: 0; }` : "@page { size: A4; margin: 0; }";
    document.head.appendChild(style);
    const after = () => {
      document.body.classList.remove("lb-printing");
      document.getElementById("lb-page")?.remove();
      window.removeEventListener("afterprint", after);
    };
    window.addEventListener("afterprint", after);
    setTimeout(() => window.print(), 80);
  };

  const printArea = (
    <div className={`lb-print ${size.kind}`}>
      {size.kind === "roll"
        ? labels.map((l) => <div key={`${l.key}-${l.n}`} className="lb-page-roll"><Label item={l} show={show} size={size} shopName={shopName} rate={rate} step={step} /></div>)
        : sheets.map((page, p) => (
            <div key={p} className="lb-sheet" style={{ gridTemplateColumns: `repeat(${size.cols}, ${size.w}mm)`, gridAutoRows: `${size.h}mm` }}>
              {page.map((l) => <Label key={`${l.key}-${l.n}`} item={l} show={show} size={size} shopName={shopName} rate={rate} step={step} />)}
            </div>
          ))}
    </div>
  );

  return (
    <div className="md-page lb-page">
      <div className="lb-layout">
        <section className="md-card lb-pick">
          <div className="lb-row">
            <Select className="md-filter lb-select" value={shopId} onChange={(e) => setShopId(e.target.value)} title={L("តម្លៃរបស់ហាង", "Prices of the shop")}>
              <option value="">{L("តម្លៃលំនាំដើម", "Default prices")}</option>
              {shops.map((s) => <option key={s._id} value={s._id}>{s.code} · {nameKh(s)}</option>)}
            </Select>
          </div>
          <label className="md-search lb-search">
            <Search size={16} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={L("ឈ្មោះ SKU ឬបាកូដ", "Name, SKU or barcode")} />
          </label>
          <div className="lb-found">
            {loading && <div className="md-empty">{L("កំពុងស្វែងរក...", "Searching...")}</div>}
            {!loading && q.trim().length >= 2 && !found.length && <div className="md-empty">{L("រកមិនឃើញ", "Nothing found")}</div>}
            {found.map((r) => (
              <button key={r.key} type="button" className="lb-found-row" onClick={() => add(r)}>
                <span>
                  <b>{L(r.name_kh, r.name_en || r.name_kh)}</b>
                  <small>{r.code}{r.barcode ? ` · ${r.barcode}` : ""}{r.unit_name ? ` · ${r.unit_name}` : ""}</small>
                </span>
                <em>{r.price === null || r.price === undefined ? L("គ្មានតម្លៃ", "no price") : usd(r.price)}</em>
                <Plus size={16} />
              </button>
            ))}
          </div>
          <h4 className="lb-h">{L("ស្លាកត្រូវបោះពុម្ព", "Labels to print")} · {labels.length}</h4>
          <div className="lb-items">
            {!items.length && <div className="md-empty">{L("ស្វែងរក ហើយចុចលើទំនិញ", "Search and tap an item")}</div>}
            {items.map((it) => (
              <div key={it.key} className="lb-item">
                <span>
                  <b>{L(it.name_kh, it.name_en || it.name_kh)}</b>
                  <small>{it.code} · {it.price === null || it.price === undefined ? "-" : usd(it.price)}</small>
                </span>
                <div className="lb-copies">
                  <button type="button" onClick={() => setCopies(it.key, it.copies - 1)}><Minus size={14} /></button>
                  <input inputMode="numeric" value={it.copies} onChange={(e) => setCopies(it.key, Number(e.target.value.replace(/\D/g, "")) || 1)} />
                  <button type="button" onClick={() => setCopies(it.key, it.copies + 1)}><Plus size={14} /></button>
                </div>
                <button type="button" className="md-icon-btn md-icon-btn-danger" onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </section>

        <section className="md-card lb-setup">
          <div className="lb-row">
            <Tags size={18} />
            <Select className="md-filter lb-select" value={sizeKey} onChange={(e) => setSizeKey(e.target.value)}>
              {SIZES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
            <button type="button" className="md-btn md-btn-primary" disabled={!labels.length} onClick={print}><Printer size={16} /> {L("បោះពុម្ព", "Print")} ({labels.length})</button>
          </div>
          <div className="lb-show">
            {[["shop", L("ឈ្មោះហាង", "Shop name")], ["name", L("ឈ្មោះទំនិញ", "Item name")], ["price", L("តម្លៃ $", "Price $")], ["khr", L("តម្លៃ ៛", "Price ៛")], ["barcode", L("បាកូដ", "Barcode")], ["code", L("លេខកូដ", "Code text")]].map(([k, t]) => (
              <button key={k} type="button" className={`md-chip ${show[k] ? "on" : ""}`} onClick={() => toggle(k)}><span className="md-chip-box">{show[k] ? "✓" : ""}</span>{t}</button>
            ))}
          </div>
          <p className="md-sub">{size.kind === "roll" ? L("ម៉ាស៊ីនបោះពុម្ពស្លាក (Roll): ជ្រើសទំហំក្រដាសដូចគ្នានៅក្នុង Print dialog, Margin = None", "Label printer (roll): pick the same paper size in the print dialog, margins None") : L("ក្រដាស A4 ស្លាកស្អិត, Margin = None, Scale 100%", "A4 sticker sheet, margins None, scale 100%")}</p>
          <div className="lb-preview">
            {labels.slice(0, 12).map((l) => <Label key={`${l.key}-${l.n}`} item={l} show={show} size={size} shopName={shopName} rate={rate} step={step} />)}
            {labels.length > 12 && <div className="md-empty">+{labels.length - 12}</div>}
            {!labels.length && <Label item={{ name_kh: "អាវជាប់ខោកប្បាស (ស)", name_en: "Cotton romper (White)", code: "ROMPER01-NB", barcode: "2000000010014", price: 5.9 }} show={show} size={size} shopName={shopName || "Kids shop"} rate={rate} step={step} />}
          </div>
        </section>
      </div>
      {createPortal(printArea, document.body)}
    </div>
  );
}
