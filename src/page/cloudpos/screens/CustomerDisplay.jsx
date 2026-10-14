import React, { useEffect, useState } from "react";
import { CheckCircle2, Maximize, ShoppingBag, WifiOff } from "lucide-react";
import { sync } from "../engine/api";
import { applyTheme, showTheme } from "../theme";
import { usd, khr, qtyText } from "../i18n";
import "../display.css";

// Customer display of the cloud POS: /cloud/pos/display in the SAME browser (second screen, full screen).
// It follows the sell screen live (BroadcastChannel): welcome → cart → pay → thank you.
// Customers see Khmer and English together.
const THANKS_MS = 20000; // thank-you screen, then back to welcome

function Two({ kh, en, className = "" }) {
  return (
    <span className={`cd-two ${className}`}>
      <span className="cd-kh">{kh}</span>
      {en && <span className="cd-en">{en}</span>}
    </span>
  );
}

const clock = (d) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Phnom_Penh" });
const day = (d) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Phnom_Penh" });

export default function CustomerDisplay() {
  const [shop, setShop] = useState(null);
  const [view, setView] = useState({ mode: "idle", data: {} });
  const [live, setLive] = useState(true);
  const [now, setNow] = useState(new Date());
  const [full, setFull] = useState(!!document.fullscreenElement);

  useEffect(() => {
    document.title = "Customer display";
    // same browser as the cloud POS tab: shop data from its IndexedDB, live screens by BroadcastChannel
    let posTheme = ""; // colours of the POS screen (the cashier's own, else the shop's)
    const loadShop = () =>
      sync
        .getData()
        .then((d) => {
          if (!d) return;
          const st = d.setting || {};
          const wh = d.warehouse || {};
          setShop({ name_kh: wh.name_kh, name_en: wh.name_en, company_kh: st.company_name_kh, company_en: st.company_name_en, logo: st.logo || "", phone: wh.phone || st.phone || "", ui_theme: st.ui_theme });
          applyTheme(st.ui_theme);
          if (posTheme) showTheme(posTheme);
        })
        .catch(() => {});
    const show = (v) => {
      if (v?.data?.theme) {
        posTheme = v.data.theme;
        showTheme(posTheme);
      }
      setView(v.mode === "done" && Date.now() - (v.at || 0) > THANKS_MS ? { mode: "idle", data: {} } : v); // an old "thank you" → welcome
    };
    loadShop();
    try {
      const saved = JSON.parse(localStorage.getItem("cloud_pos_display") || "null");
      if (saved) show(saved);
    } catch {
      // ignore
    }
    const ch = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("cloud_pos_display") : null;
    if (ch) {
      ch.onmessage = (e) => {
        if (e.data?.type === "show") {
          setLive(true);
          show(e.data);
        }
        if (e.data?.type === "shop") loadShop(); // POS pressed Sync → new logo / theme now
      };
      ch.postMessage({ type: "hello" });
    } else setLive(false);
    const here = setInterval(() => ch && ch.postMessage({ type: "here" }), 10000); // the POS shows "display ✓"
    if (ch) ch.postMessage({ type: "here" });
    const t = setInterval(() => setNow(new Date()), 15000);
    const t2 = setInterval(loadShop, 60000);
    const f = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => {
      if (ch) ch.close();
      clearInterval(here);
      clearInterval(t);
      clearInterval(t2);
      document.removeEventListener("fullscreenchange", f);
    };
  }, []);

  // after the thank-you screen go back to welcome (a new cart replaces it at once)
  useEffect(() => {
    if (view.mode !== "done") return undefined;
    const left = THANKS_MS - (Date.now() - (view.at || Date.now()));
    const t = setTimeout(() => setView({ mode: "idle", data: {} }), Math.max(left, 0));
    return () => clearTimeout(t);
  }, [view]);

  const d = view.data || {};
  const company = shop?.company_kh || shop?.name_kh || "";
  const companyEn = shop?.company_en || shop?.name_en || "";
  const goFull = () => document.documentElement.requestFullscreen?.().catch(() => {});

  return (
    <div className={`cd cd-m-${view.mode}`}>
      {!full && (
        <button type="button" className="cd-full" onClick={goFull} title="Full screen">
          <Maximize size={18} /> Full screen
        </button>
      )}
      {!live && (
        <div className="cd-off">
          <WifiOff size={16} /> POS …
        </div>
      )}

      {/* ---------- welcome ---------- */}
      {view.mode === "idle" && (
        <div className="cd-welcome">
          {shop?.logo ? <img className="cd-logo" src={shop.logo} alt="" /> : <span className="cd-logo cd-logo-empty"><ShoppingBag size={64} strokeWidth={1.4} /></span>}
          <h1>{company}</h1>
          {companyEn && companyEn !== company && <p className="cd-sub">{companyEn}</p>}
          <Two className="cd-hello" kh="សូមស្វាគមន៍" en="Welcome" />
          <div className="cd-clock">
            <b>{clock(now)}</b>
            <span>{day(now)}</span>
          </div>
          {shop?.phone && <p className="cd-phone">{shop.phone}</p>}
        </div>
      )}

      {/* ---------- cart / pay ---------- */}
      {(view.mode === "cart" || view.mode === "pay") && (
        <div className="cd-sale">
          {view.mode === "pay" && d.pay?.qr?.image ? (
            <section className="cd-qr">
              <Two className="cd-qr-title" kh="ស្កេនដើម្បីបង់ប្រាក់" en="Scan to pay" />
              <div className="cd-qr-card">
                <img src={d.pay.qr.image} alt="QR" />
                {d.pay.qr.paid && <div className="cd-qr-paid">✓</div>}
              </div>
              <div className="cd-qr-amount">
                <span>{d.pay.qr.name}</span>
                <b>{d.pay.qr.khr ? khr(d.pay.qr.amount) : usd(d.pay.qr.amount)}</b>
              </div>
            </section>
          ) : (
          <section className="cd-list">
            <header>
              <Two kh="ទំនិញរបស់អ្នក" en="Your items" />
              <span className="cd-count">{qtyText(d.count)}</span>
            </header>
            <div className="cd-rows">
              {(d.items || []).map((i, k) => (
                <div key={`${i.key}-${k}`} className={`cd-row ${k === 0 ? "cd-new" : ""}`}>
                  <div className="cd-row-main">
                    <b>{i.name_kh || i.name_en}</b>
                    <span>
                      {i.name_en && i.name_en !== i.name_kh ? `${i.name_en} · ` : ""}
                      {[i.option, i.unit].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <span className="cd-row-qty">
                    {qtyText(i.qty)} × {usd(i.price)}
                  </span>
                  <b className="cd-row-total">{usd(i.total)}</b>
                </div>
              ))}
            </div>
          </section>
          )}

          <section className="cd-side">
            {company && <div className="cd-side-shop">{company}</div>}
            {d.customer && (
              <div className="cd-member">
                <span>👋 {d.customer.name}</span>
                <b>⭐ {d.customer.points}</b>
              </div>
            )}
            <div className="cd-lines">
              <div><Two kh="សរុបរង" en="Subtotal" /><span>{usd(d.subtotal)}</span></div>
              {(d.promotions || []).map((p, k) => (
                <div key={k} className="cd-promo"><span>🎁 {p.name_kh}{p.name_en && p.name_en !== p.name_kh ? <small> · {p.name_en}</small> : null}</span><span>−{usd(p.amount)}</span></div>
              ))}
              {d.discount_total > 0 && <div className="cd-disc"><Two kh="បញ្ចុះតម្លៃ" en="Discount" /><span>−{usd(d.discount_total)}</span></div>}
              {d.tax > 0 && <div><Two kh={d.tax_name || "ពន្ធ"} en={d.tax_inclusive ? "incl." : "Tax"} /><span>{usd(d.tax)}</span></div>}
            </div>
            <div className="cd-total">
              <Two kh="ត្រូវបង់" en="Total" />
              <b>{usd(d.total)}</b>
              <span>{khr(d.total_khr)}</span>
              {d.rate && <small>1$ = {khr(d.rate)}</small>}
            </div>
            {view.mode === "pay" && d.pay && (
              <div className="cd-pay">
                {d.pay.method && <div className="cd-method">{d.pay.method}</div>}
                <div><Two kh="បានបង់" en="Paid" /><span>{usd(d.pay.paid)}</span></div>
                {d.pay.enough ? (
                  <div className="cd-change">
                    <Two kh="ប្រាក់អាប់" en="Change" />
                    <span>
                      <b>{usd(d.pay.change)}</b>
                      {d.pay.change > 0 && <small>{d.pay.give_usd ? usd(d.pay.give_usd) + (d.pay.give_khr ? " + " : "") : ""}{d.pay.give_khr || !d.pay.give_usd ? khr(d.pay.give_khr) : ""}</small>}
                    </span>
                  </div>
                ) : (
                  <div className="cd-left">
                    <Two kh="នៅខ្វះ" en="Still to pay" />
                    <span>
                      <b>{usd(d.pay.remaining)}</b>
                      <small>{khr(d.pay.remaining_khr)}</small>
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ---------- thank you ---------- */}
      {view.mode === "done" && (
        <div className="cd-thanks">
          <CheckCircle2 size={96} strokeWidth={1.6} />
          <Two className="cd-thanks-title" kh="សូមអរគុណ!" en="Thank you!" />
          <div className="cd-thanks-box">
            <div><Two kh="សរុប" en="Total" /><b>{usd(d.total)}</b></div>
            <div><Two kh="បានបង់" en="Paid" /><b>{usd(d.paid)}</b></div>
            {d.change > 0 && (
              <div className="cd-thanks-change">
                <Two kh="ប្រាក់អាប់" en="Your change" />
                <b>
                  {d.give_usd ? usd(d.give_usd) : ""}
                  {d.give_usd && d.give_khr ? " + " : ""}
                  {d.give_khr || !d.give_usd ? khr(d.give_khr) : ""}
                </b>
              </div>
            )}
          </div>
          {d.promo_total > 0 && <div className="cd-saved"><Two kh={`អ្នកសន្សំបាន ${usd(d.promo_total)}`} en={`You saved ${usd(d.promo_total)}`} /></div>}
          {d.customer && (
            <div className="cd-saved cd-earned">
              <Two kh={`${d.customer.name} ទទួលបាន +${d.customer.earned || 0} ពិន្ទុ`} en={`${d.customer.name} earned +${d.customer.earned || 0} points`} />
              {d.customer.points !== null && d.customer.points !== undefined && <b>⭐ {d.customer.points}</b>}
            </div>
          )}
          <Two className="cd-again" kh="សូមអញ្ជើញមកម្តងទៀត" en="Please come again" />
          {d.invoice_no && <small className="cd-inv">{d.invoice_no}</small>}
        </div>
      )}
    </div>
  );
}
