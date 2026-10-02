import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ChevronDown, Languages, MapPin, Package, Phone, Search, Store, X } from "lucide-react";
import { catalogService } from "../../api/api.service";
import "./catalog.style.css";

// Public catalog (QR code): /c/:token — no login. Items of one shop / warehouse with price and stock status.
// Own language switch (customers are not admin users); Khmer first.
const LANG_KEY = "catalog_lang";
const PAGE_SIZE = 24;
const usd = (v) => (v === null || v === undefined ? "" : `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

function useLang() {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem(LANG_KEY) === "en" ? "en" : "kh";
    } catch {
      return "kh";
    }
  });
  const change = (l) => {
    setLang(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      // storage blocked
    }
  };
  const t = useCallback((kh, en) => (lang === "en" ? en : kh), [lang]);
  const nm = useCallback((o) => (o ? (lang === "en" ? o.name_en || o.name_kh : o.name_kh || o.name_en) || "" : ""), [lang]);
  return { lang, change, t, nm };
}

const STATUS = {
  in: ["មានស្តុក", "In stock"],
  low: ["នៅសល់តិច", "Few left"],
  out: ["អស់ស្តុក", "Out of stock"],
};

function StatusPill({ status, t, small }) {
  const [kh, en] = STATUS[status] || STATUS.out;
  return <span className={`ct-pill ct-${status} ${small ? "ct-pill-sm" : ""}`}><i />{t(kh, en)}</span>;
}

const priceText = (i) => (i.price_min === null ? "" : i.price_min === i.price_max ? usd(i.price_min) : `${usd(i.price_min)} – ${usd(i.price_max)}`);
const optionText = (v, nm) => (v.options || []).map((o) => nm(o)).join(" / ");

function Thumb({ src, name, out, big }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) {
    return (
      <div className={`ct-img ct-img-empty ${out ? "is-out" : ""} ${big ? "ct-img-big" : ""}`}>
        <Package size={big ? 56 : 34} strokeWidth={1.5} />
        <span>{(name || "?").slice(0, 1)}</span>
      </div>
    );
  }
  return (
    <div className={`ct-img ${out ? "is-out" : ""} ${big ? "ct-img-big" : ""}`}>
      <img src={src} alt={name} loading="lazy" onError={() => setBad(true)} />
    </div>
  );
}

// small preview of the options on a card: colour dots, else the first sizes
function Swatches({ item, nm }) {
  if (item.simple || item.variants.length < 2) return null;
  const colours = item.variants.flatMap((v) => v.options.filter((o) => o.color_hex)).filter((o, i, a) => a.findIndex((x) => x.color_hex === o.color_hex) === i);
  if (colours.length > 1) {
    return (
      <div className="ct-swatches">
        {colours.slice(0, 6).map((o) => <i key={o.color_hex} style={{ background: o.color_hex }} title={nm(o)} />)}
        {colours.length > 6 && <span>+{colours.length - 6}</span>}
      </div>
    );
  }
  const labels = [...new Set(item.variants.map((v) => optionText(v, nm)))];
  return (
    <div className="ct-swatches ct-sizes">
      {labels.slice(0, 3).map((x) => <span key={x}>{x}</span>)}
      {labels.length > 3 && <span>+{labels.length - 3}</span>}
    </div>
  );
}

export default function CatalogPage() {
  const { token } = useParams();
  const { lang, change, t, nm } = useLang();
  const [head, setHead] = useState(null); // company, store, categories …
  const [items, setItems] = useState([]);
  const [pg, setPg] = useState({ page: 0, total: 0, totalPages: 1 });
  const [keyword, setKeyword] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [onlyIn, setOnlyIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // { notFound, text }
  const [open, setOpen] = useState(null);
  const seq = useRef(0);
  const more = useRef(null);

  useEffect(() => {
    const id = setTimeout(() => setQ(keyword.trim()), 350);
    return () => clearTimeout(id);
  }, [keyword]);

  const load = useCallback(
    async (page) => {
      const my = ++seq.current;
      setLoading(true);
      try {
        const res = await catalogService.publicPage(token, { page, limit: PAGE_SIZE, q: q || undefined, category_id: cat || undefined, only: onlyIn ? "in_stock" : undefined });
        if (my !== seq.current) return;
        const d = res.data;
        setHead(d);
        setItems((list) => (page === 1 ? d.items : [...list, ...d.items]));
        setPg({ page, total: d.pagination.total, totalPages: d.pagination.totalPages });
        setError(null);
      } catch (err) {
        if (my !== seq.current) return;
        setError({ notFound: err.status === 404, text: err.message });
      } finally {
        if (my === seq.current) setLoading(false);
      }
    },
    [token, q, cat, onlyIn],
  );
  useEffect(() => {
    load(1);
  }, [load]);

  // next page when the "more" marker comes into view
  const canMore = pg.page < pg.totalPages && !loading;
  useEffect(() => {
    if (!canMore || !more.current || typeof IntersectionObserver === "undefined") return undefined;
    const ob = new IntersectionObserver((e) => e[0].isIntersecting && load(pg.page + 1), { rootMargin: "400px" });
    ob.observe(more.current);
    return () => ob.disconnect();
  }, [canMore, load, pg.page]);

  const storeName = head ? nm(head.store) : "";
  const companyName = head ? nm(head.company) || storeName : "";
  useEffect(() => {
    if (head) document.title = `${storeName}${companyName && companyName !== storeName ? ` · ${companyName}` : ""}`;
  }, [head, storeName, companyName]);
  useEffect(() => {
    document.body.classList.add("ct-body");
    return () => document.body.classList.remove("ct-body");
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [open]);

  const phone = head?.store?.phone || head?.company?.phone || "";
  const address = head?.store?.address || head?.company?.address || "";
  const updated = useMemo(() => (head?.updated_at ? new Date(head.updated_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""), [head]);

  if (error && !head) {
    return (
      <div className="ct-page">
        <div className="ct-missing">
          <div className="ct-missing-icon"><Store size={40} /></div>
          <h1>{error.notFound ? t("តំណនេះមិនអាចប្រើបានទេ", "This link is not available") : t("មិនអាចភ្ជាប់បាន", "Can't connect")}</h1>
          <p>{error.notFound ? t("តំណអាចត្រូវបានបិទ ឬប្តូរថ្មី។ សូមសួរហាងដើម្បីបានតំណថ្មី។", "The link may have been turned off or replaced. Please ask the shop for a new one.") : t("សូមព្យាយាមម្តងទៀត។", "Please try again.")}</p>
          {!error.notFound && <button type="button" className="ct-btn" onClick={() => load(1)}>{t("ព្យាយាមម្តងទៀត", "Try again")}</button>}
        </div>
      </div>
    );
  }

  return (
    <div className={`ct-page ${lang === "kh" ? "ct-kh" : ""}`}>
      {/* ---------- shop header ---------- */}
      <header className="ct-hero">
        <div className="ct-hero-in">
          <div className="ct-brand">
            {head?.company?.logo ? <img src={head.company.logo} alt="" className="ct-logo" /> : <div className="ct-logo ct-logo-text">{(companyName || storeName || "·").slice(0, 1)}</div>}
            <div className="ct-brand-text">
              <span className="ct-company">{companyName || " "}</span>
              <h1>{storeName || " "}</h1>
              {head?.link?.category && <span className="ct-scope">{nm(head.link.category)}</span>}
            </div>
            <button type="button" className="ct-lang" onClick={() => change(lang === "kh" ? "en" : "kh")} title="ភាសា / Language">
              <Languages size={16} />
              {lang === "kh" ? "EN" : "ខ្មែរ"}
            </button>
          </div>
          {(phone || address) && (
            <div className="ct-contact">
              {phone && <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}><Phone size={14} />{phone}</a>}
              {address && <span><MapPin size={14} />{address}</span>}
            </div>
          )}
        </div>
      </header>

      {/* ---------- search + filters ---------- */}
      <div className="ct-bar">
        <div className="ct-bar-in">
          <label className="ct-search">
            <Search size={18} />
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={t("ស្វែងរកទំនិញ ម៉ាក ទំហំ...", "Search items, brands, sizes...")} />
            {keyword && <button type="button" onClick={() => setKeyword("")} aria-label="clear"><X size={16} /></button>}
          </label>
          <button type="button" className={`ct-only ${onlyIn ? "is-on" : ""}`} onClick={() => setOnlyIn((v) => !v)}>
            <i />
            <span className="ct-only-long">{t("មានស្តុកប៉ុណ្ណោះ", "In stock only")}</span>
            <span className="ct-only-short">{t("មានស្តុក", "In stock")}</span>
          </button>
        </div>
        {head?.categories?.length > 1 && (
          <div className="ct-cats">
            <button type="button" className={!cat ? "is-on" : ""} onClick={() => setCat("")}>{t("ទាំងអស់", "All")} <b>{head.total_items}</b></button>
            {head.categories.map((c) => (
              <button key={c._id} type="button" className={cat === c._id ? "is-on" : ""} onClick={() => setCat(cat === c._id ? "" : c._id)}>
                {nm(c)} <b>{c.count}</b>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---------- items ---------- */}
      <main className="ct-main">
        <div className="ct-count">
          {pg.page > 0 && <span>{t(`${pg.total} មុខទំនិញ`, `${pg.total} item${pg.total === 1 ? "" : "s"}`)}</span>}
          {loading && <span className="ct-dot-load"><i /><i /><i /></span>}
        </div>

        <div className="ct-grid">
          {items.map((i) => (
            <button key={i._id} type="button" className={`ct-card ${i.status === "out" ? "is-out" : ""}`} onClick={() => setOpen(i)}>
              <Thumb src={i.image} name={nm(i)} out={i.status === "out"} />
              <StatusPill status={i.status} t={t} small />
              <div className="ct-card-body">
                {i.brand && <span className="ct-brandname">{nm(i.brand)}</span>}
                <span className="ct-name">{nm(i)}</span>
                <Swatches item={i} nm={nm} />
                <span className="ct-price">{priceText(i) || <em>{t("សួរតម្លៃ", "Ask for price")}</em>}</span>
              </div>
            </button>
          ))}
          {loading && !items.length && Array.from({ length: 8 }).map((_, k) => <div key={k} className="ct-card ct-skel"><div className="ct-img" /><div className="ct-card-body"><i /><i /><i /></div></div>)}
        </div>

        {!loading && !items.length && (
          <div className="ct-none">
            <Search size={30} />
            <b>{t("រកមិនឃើញទំនិញ", "No items found")}</b>
            {(q || cat || onlyIn) && <button type="button" className="ct-btn ct-btn-ghost" onClick={() => { setKeyword(""); setCat(""); setOnlyIn(false); }}>{t("បង្ហាញទាំងអស់", "Show everything")}</button>}
          </div>
        )}
        {pg.page < pg.totalPages && (
          <div ref={more} className="ct-more">
            <button type="button" className="ct-btn ct-btn-ghost" disabled={loading} onClick={() => load(pg.page + 1)}>
              <ChevronDown size={16} />
              {t("បង្ហាញបន្ថែម", "Show more")}
            </button>
          </div>
        )}
      </main>

      <footer className="ct-foot">
        <span>{t("តម្លៃជាដុល្លារ (USD) · ស្ថានភាពស្តុកអាចប្រែប្រួល", "Prices in USD · stock can change during the day")}{updated ? ` · ${t("ធ្វើបច្ចុប្បន្នភាព", "updated")} ${updated}` : ""}</span>
        <span>{companyName}</span>
      </footer>

      {/* ---------- item detail ---------- */}
      {open && (
        <div className="ct-sheet-back" onMouseDown={() => setOpen(null)}>
          <div className="ct-sheet" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <button type="button" className="ct-close" onClick={() => setOpen(null)} aria-label="close"><X size={20} /></button>
            <Thumb src={open.image} name={nm(open)} out={open.status === "out"} big />
            <div className="ct-sheet-body">
              <div className="ct-sheet-tags">
                <StatusPill status={open.status} t={t} />
                {open.category && <span className="ct-tag">{nm(open.category)}</span>}
              </div>
              {open.brand && <span className="ct-brandname">{nm(open.brand)}</span>}
              <h2>{nm(open)}</h2>
              <div className="ct-sheet-price">
                {priceText(open) || <em>{t("សួរតម្លៃ", "Ask for price")}</em>}
                {open.unit && <small> / {nm(open.unit)}</small>}
              </div>
              {open.description && <p className="ct-desc">{open.description}</p>}

              {!open.simple && open.variants.length > 0 && (
                <div className="ct-variants">
                  <b>{t("ជម្រើស", "Options")}</b>
                  {open.variants.map((v) => (
                    <div key={v._id} className={`ct-var ${v.status === "out" ? "is-out" : ""}`}>
                      <span className="ct-var-name">
                        {v.options.filter((o) => o.color_hex).map((o) => <i key={o.color_hex} style={{ background: o.color_hex }} />)}
                        {optionText(v, nm) || v.code}
                      </span>
                      <span className="ct-var-price">{usd(v.price)}</span>
                      <StatusPill status={v.status} t={t} small />
                    </div>
                  ))}
                </div>
              )}
              <span className="ct-code">{t("លេខកូដ", "Code")}: {open.simple ? open.variants[0]?.code : open.code}</span>
              {phone && (
                <a className="ct-btn ct-call" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
                  <Phone size={16} />
                  {t("ទូរស័ព្ទសួរហាង", "Call the shop")}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
