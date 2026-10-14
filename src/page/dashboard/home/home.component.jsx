import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, ClipboardPen, MonitorSmartphone, PackageX, ReceiptText, RotateCcw, Store, TrendingUp, Truck, Warehouse, Users, Wallet } from "lucide-react";
import { dashboardService } from "../../../api/api.service";
import Auth from "../../util/auth";
import { ACCESS, canAccess, scopeOf } from "../../util/permission";
import KidsDecor from "../../decor/KidsDecor";
import "./home.style.css";

import { L } from "../../../i18n";
const riel = (v) => `${Number(v || 0).toLocaleString("en-US")} ៛`;
const EMPTY = { warehouses: [], users: null, rate: null, methods: [], products: 0, priced: false, opening: 0, sales: null, alerts: null };
const usd = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const hm = (d) => (d ? new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Phnom_Penh" }) : "");
const dayShort = (s) => new Date(`${s}T12:00:00+07:00`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "Asia/Phnom_Penh" });

// Today's POS sales: total vs yesterday (same time), 7 days, POS online + open shifts
function SalesToday({ s }) {
  const t = s.today;
  const y = s.yesterday.total;
  const change = y > 0 ? ((t.total - y) / y) * 100 : null;
  const max = Math.max(1e-9, ...s.days.map((d) => d.total));
  return (
    <section className="hm-sales">
      <Link to="/sales" className="hm-sale-hero">
        <div className="hm-stat-top">
          <span><ReceiptText size={16} /> {L("លក់ថ្ងៃនេះ", "Sales today")}</span>
          <i><ArrowUpRight size={18} /></i>
        </div>
        <strong>{usd(t.total)}</strong>
        <small>
          {t.count} {L("វិក្កយបត្រ", "invoices")} · {L("មធ្យម", "avg.")} {usd(t.average)}
          {t.last_sale_at ? ` · ${L("ចុងក្រោយ", "last")} ${hm(t.last_sale_at)}` : ""}
        </small>
        <div className="hm-sale-foot">
          {change === null ? (
            <em>{L("ម្សិលមិញ គ្មានការលក់នៅម៉ោងនេះ", "No sales yesterday by this time")}</em>
          ) : (
            <em className={change >= 0 ? "up" : "down"}>
              {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {Math.abs(change).toFixed(1)}% {L("ធៀបម្សិលមិញម៉ោងដដែល", "vs yesterday, same time")}
            </em>
          )}
          {t.refund_count > 0 && <em className="rf"><RotateCcw size={13} /> −{usd(t.refund_total)} · {L("សុទ្ធ", "net")} {usd(t.net_total)}</em>}
          {t.profit !== undefined && <em className="pf">{L("ចំណេញ", "Profit")} {usd(t.profit)}</em>}
        </div>
      </Link>
      <div className="hm-card hm-week">
        <div className="hm-card-head"><h3>{L("៧ ថ្ងៃចុងក្រោយ", "Last 7 days")}</h3></div>
        <div className="hm-week-bars">
          {s.days.map((d, k) => (
            <div key={d.date} title={`${d.date} · ${d.count} · ${usd(d.total)}`} className={k === s.days.length - 1 ? "today" : ""}>
              <small>{d.total ? `$${Math.round(d.total)}` : ""}</small>
              <i style={{ height: `${(d.total / max) * 100}%` }} />
              <span>{dayShort(d.date)}</span>
            </div>
          ))}
        </div>
      </div>
      <Link to="/pos-device" className="hm-card hm-posbox">
        <div className="hm-card-head"><h3><MonitorSmartphone size={16} /> POS</h3></div>
        <strong>{s.pos.online}<small> / {s.pos.devices} {L("កំពុងដំណើរការ", "online")}</small></strong>
        {s.pos.open_shifts.length ? (
          <ul>
            {s.pos.open_shifts.slice(0, 4).map((sh) => (
              <li key={sh._id}><b>{sh.device}</b> {sh.opened_by_name} · {L("បើក", "since")} {hm(sh.opened_at)}</li>
            ))}
          </ul>
        ) : (
          <p>{L("គ្មានវេនកំពុងបើក", "No shift open now")}</p>
        )}
      </Link>
    </section>
  );
}

// Last summary: kept in memory (and this tab's sessionStorage) so coming back to the dashboard
// shows the numbers at once; a fresh copy is loaded in the background and replaces it.
const CACHE_KEY = "inventory_pos_dashboard";
let memo = null;
const readCache = (userId) => {
  if (memo?.user === userId) return memo.data;
  try {
    const saved = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    return saved?.user === userId ? saved.data : null;
  } catch {
    return null;
  }
};
const writeCache = (userId, data) => {
  memo = { user: userId, data };
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(memo));
  } catch {
    // storage blocked → memory only
  }
};

// Dashboard home: today's sales, counts, stock alerts, best sellers, running low, expiring soon.
function HomeComponent() {
  const login = new Auth().getClientLogin() || {};
  const isAdmin = canAccess(login, ACCESS.ADMIN);
  const userId = login._id || login.email;
  const cached = readCache(userId);
  const [data, setData] = useState(cached || EMPTY);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let alive = true;
    dashboardService
      .summary()
      .then((res) => {
        if (!alive || !res?.data) return;
        const d = { ...EMPTY, ...res.data, warehouses: res.data.warehouses || [], methods: res.data.methods || [] };
        setData(d);
        writeCache(userId, d);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [userId]);

  const shops = data.warehouses.filter((w) => w.type === "shop");
  const centrals = data.warehouses.filter((w) => w.type === "central");
  const show = (n) => (loading ? "…" : n);
  const al = data.alerts;

  return (
    <div className="hm">
      {data.sales && <SalesToday s={data.sales} />}

      {/* ---------- Stat cards ---------- */}
      <section className="hm-stats">
        <Link to="/setup/warehouse" className="hm-stat is-hero">
          <div className="hm-stat-top">
            <span>{L("ហាង", "Shops")}</span>
            <i>
              <ArrowUpRight size={18} />
            </i>
          </div>
          <strong>{show(shops.length)}</strong>
          <small>
            <Store size={14} /> {scopeOf(login) === "all" ? L("ហាងទាំងអស់ក្នុងប្រព័ន្ធ", "All shops in the system") : L("ហាងរបស់ខ្ញុំ", "My shops")}
          </small>
        </Link>

        <Link to="/setup/warehouse" className="hm-stat">
          <div className="hm-stat-top">
            <span>{L("ឃ្លាំងកណ្តាល", "Central warehouse")}</span>
            <i>
              <ArrowUpRight size={18} />
            </i>
          </div>
          <strong>{show(centrals.length)}</strong>
          <small>
            <Warehouse size={14} /> {L("ផ្គត់ផ្គង់ទំនិញទៅហាង", "Supplies the shops")}
          </small>
        </Link>

        {isAdmin ? (
          <Link to="/users" className="hm-stat">
            <div className="hm-stat-top">
              <span>{L("អ្នកប្រើប្រាស់", "Users")}</span>
              <i>
                <ArrowUpRight size={18} />
              </i>
            </div>
            <strong>{show(data.users ?? 0)}</strong>
            <small>
              <Users size={14} /> {L("គណនីសកម្ម", "Active accounts")}
            </small>
          </Link>
        ) : (
          <Link to="/setup/payment-method" className="hm-stat">
            <div className="hm-stat-top">
              <span>{L("វិធីបង់ប្រាក់", "Payment methods")}</span>
              <i>
                <ArrowUpRight size={18} />
              </i>
            </div>
            <strong>{show(data.methods.length)}</strong>
            <small>
              <Wallet size={14} /> {L("សម្រាប់ POS", "For the POS")}
            </small>
          </Link>
        )}

        <Link to="/setup/exchange-rate" className="hm-stat">
          <div className="hm-stat-top">
            <span>{L("អត្រាប្តូរប្រាក់", "Exchange rate")}</span>
            <i>
              <ArrowUpRight size={18} />
            </i>
          </div>
          <strong className="hm-rate">{loading ? "…" : data.rate ? riel(data.rate.rate) : "—"}</strong>
          <small>{L("1 USD · កំពុងប្រើ", "1 USD · in use")}</small>
        </Link>
      </section>

      <section className="hm-grid">
        {/* ---------- Stock alerts ---------- */}
        <div className="hm-card">
          <div className="hm-card-head">
            <h3>{L("ការជូនដំណឹងស្តុក", "Stock alerts")}</h3>
          </div>
          <div className="hm-alerts">
            {[
              { icon: AlertTriangle, n: al?.low, label: L("ស្តុកទាប", "Low stock"), to: "/stock/balance", tone: "warn" },
              { icon: PackageX, n: al?.out, label: L("អស់ស្តុក", "Out of stock"), sub: al?.negative ? `${al.negative} ${L("ក្រោម 0", "below 0")}` : "", to: "/stock/balance", tone: "bad" },
              { icon: CalendarClock, n: al?.expiring, label: L(`ជិតផុតកំណត់ (${al?.expiry_days || 30} ថ្ងៃ)`, `Expiring (${al?.expiry_days || 30} days)`), sub: al?.expired ? `${al.expired} ${L("ផុតហើយ", "expired")}` : "", to: "/stock/expiry", tone: "warn" },
              { icon: Truck, n: al?.transfers_to_receive, label: L("ផ្ទេរ រង់ចាំទទួល", "Transfers to receive"), to: "/stock/transfer", tone: "info" },
              { icon: Truck, n: al?.transfers_pending, label: L("ផ្ទេរ រង់ចាំបញ្ជូន", "Transfers to send"), to: "/stock/transfer", tone: "info" },
              { icon: ClipboardPen, n: al?.adjustment_drafts, label: L("កែស្តុក (ព្រាង)", "Adjustment drafts"), to: "/stock/adjustment", tone: "info" },
            ].map((t) => (
              <Link key={t.label} to={t.to} className={`hm-alert ${t.n ? t.tone : "zero"}`}>
                <t.icon size={16} />
                <strong>{loading && !al ? "…" : t.n ?? 0}</strong>
                <span>{t.label}</span>
                {t.sub && <small>{t.sub}</small>}
              </Link>
            ))}
          </div>
        </div>

        {/* ---------- Top items today ---------- */}
        <div className="hm-card">
          <div className="hm-card-head">
            <h3><TrendingUp size={16} /> {L("លក់ដាច់ថ្ងៃនេះ", "Best sellers today")}</h3>
            <Link to="/sales" className="hm-pill">{L("របាយការណ៍", "Report")}</Link>
          </div>
          {!data.sales?.top_items?.length ? (
            <div className="hm-empty">{loading ? L("កំពុងផ្ទុក...", "Loading...") : L("មិនទាន់មានការលក់ថ្ងៃនេះ", "No sales yet today")}</div>
          ) : (
            <ol className="hm-rank">
              {data.sales.top_items.map((i, k) => {
                const max = data.sales.top_items[0].total || 1;
                return (
                  <li key={i.variant_id || k}>
                    <em>{k + 1}</em>
                    <div>
                      <b>{L(i.name_kh, i.name_en || i.name_kh)}</b>
                      <i style={{ width: `${Math.max(6, (i.total / max) * 100)}%` }} />
                    </div>
                    <span>{usd(i.total)}<small>× {i.qty}</small></span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* ---------- Running low ---------- */}
        <div className="hm-card">
          <div className="hm-card-head">
            <h3><AlertTriangle size={16} /> {L("ស្តុកជិតអស់", "Running low")}</h3>
            <Link to="/stock/balance" className="hm-pill">{L("មើលស្តុក", "Stock")}</Link>
          </div>
          {!al?.low_items?.length ? (
            <div className="hm-empty">{loading && !al ? L("កំពុងផ្ទុក...", "Loading...") : L("គ្មានទំនិញស្តុកទាប 👍", "Nothing running low 👍")}</div>
          ) : (
            <ul className="hm-lowlist">
              {al.low_items.map((i) => (
                <li key={`${i.warehouse}-${i.sku}`}>
                  <div>
                    <b>{L(i.name_kh, i.name_en || i.name_kh)}</b>
                    <small>{i.sku} · {i.warehouse}</small>
                  </div>
                  <span className="hm-qty"><strong>{i.qty}</strong> / {i.min}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ---------- Shops ---------- */}
        <div className="hm-card">
          <div className="hm-card-head">
            <h3>{L("ហាង និងឃ្លាំង", "Shops & warehouses")}</h3>
            <Link to="/setup/warehouse" className="hm-pill">
              {L("មើលទាំងអស់", "View all")}
            </Link>
          </div>
          {data.warehouses.length === 0 ? (
            <div className="hm-empty">{loading ? L("កំពុងផ្ទុក...", "Loading...") : L("មិនទាន់មានឃ្លាំង", "No warehouses yet")}</div>
          ) : (
            <ul className="hm-list">
              {data.warehouses.slice(0, 6).map((w) => (
                <li key={w._id}>
                  <span className={`hm-list-icon ${w.type}`}>{w.type === "shop" ? <Store size={16} /> : <Warehouse size={16} />}</span>
                  <div>
                    <b>{L(w.name_kh, w.name_en || w.name_kh)}</b>
                    <small>
                      {w.code} · {w.type === "shop" ? L("ហាង + POS", "Shop + POS") : L("ឃ្លាំងកណ្តាល", "Central warehouse")}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ---------- Expiring soon ---------- */}
        <div className="hm-card">
          <div className="hm-card-head">
            <h3><CalendarClock size={16} /> {L("ជិតផុតកំណត់", "Expiring soon")}</h3>
            <Link to="/stock/expiry" className="hm-pill">{L("មើលទាំងអស់", "View all")}</Link>
          </div>
          {!al?.expiring_items?.length ? (
            <div className="hm-empty">{loading && !al ? L("កំពុងផ្ទុក...", "Loading...") : L("គ្មានទំនិញជិតផុតកំណត់", "Nothing expiring soon")}</div>
          ) : (
            <ul className="hm-lowlist">
              {al.expiring_items.map((e, k) => (
                <li key={k}>
                  <div>
                    <b>{L(e.name_kh, e.name_en || e.name_kh)}</b>
                    <small>{e.sku} · {e.warehouse}{e.batch_no ? ` · ${e.batch_no}` : ""} · {e.qty}</small>
                  </div>
                  <span className={`hm-days ${e.days_left <= 0 ? "bad" : e.days_left <= 7 ? "warn" : ""}`}>
                    {e.days_left <= 0 ? L("ផុតហើយ", "Expired") : L(`${e.days_left} ថ្ងៃ`, `${e.days_left} d`)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ---------- POS card (dark) ---------- */}
        <Link to="/sales" className="hm-card hm-dark">
          <h3>{L("POS ហាង", "Shop POS")}</h3>
          <p>{L("លក់ពេលគ្មានអ៊ីនធឺណិត ហើយបញ្ជូនវិក្កយបត្រពេលមានអ៊ីនធឺណិត", "Sell offline, send invoices when the internet is back")}</p>
          <span className="hm-dark-badge">{L("មើលការលក់", "See sales")} →</span>
          <KidsDecor variant="bottle" className="hm-dark-decor" />
        </Link>
      </section>
    </div>
  );
}

export default HomeComponent;
