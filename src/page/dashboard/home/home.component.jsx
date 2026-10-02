import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Circle, Store, Warehouse, Users, Wallet } from "lucide-react";
import { dashboardService } from "../../../api/api.service";
import Auth from "../../util/auth";
import { ACCESS, canAccess, scopeOf } from "../../util/permission";
import KidsDecor from "../../decor/KidsDecor";
import "./home.style.css";

import { L } from "../../../i18n";
const riel = (v) => `${Number(v || 0).toLocaleString("en-US")} ៛`;
const EMPTY = { warehouses: [], users: null, rate: null, methods: [], products: 0, priced: false, opening: 0 };

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

// Dashboard home: real counts from the setup modules + a setup checklist.
// Sales / stock cards come with Phase 2–4.
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

  // setup checklist (Phase 1 → 3)
  const steps = [
    { label: L("ឃ្លាំងកណ្តាល", "Central warehouse"), done: centrals.length > 0, to: "/setup/warehouse" },
    { label: L("ហាង", "Shops"), done: shops.length > 0, to: "/setup/warehouse" },
    { label: L("អត្រាប្តូរប្រាក់", "Exchange rate"), done: !!data.rate, to: "/setup/exchange-rate" },
    { label: L("វិធីបង់ប្រាក់", "Payment methods"), done: data.methods.length > 0, to: "/setup/payment-method" },
    { label: L("ទំនិញ & តម្លៃ", "Products & prices"), done: data.products > 0 && data.priced, to: data.products > 0 ? "/product/price" : "/product/item" },
    { label: L("ស្តុកដំបូង", "Opening stock"), done: data.opening > 0, to: "/stock/opening" },
    { label: L("ម៉ាស៊ីន POS", "POS devices"), done: false, soon: "Phase 3" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="hm">
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
        {/* ---------- Setup progress (gauge) ---------- */}
        <div className="hm-card hm-progress">
          <h3>{L("ការរៀបចំប្រព័ន្ធ", "System setup")}</h3>
          <div className="hm-gauge" style={{ "--p": percent }}>
            <div className="hm-gauge-ring" />
            <div className="hm-gauge-text">
              <strong>{loading ? "…" : `${percent}%`}</strong>
              <span>
                {doneCount}/{steps.length} {L("ជំហាន", "steps")}
              </span>
            </div>
          </div>
          <div className="hm-legend">
            <span>
              <i className="on" /> {L("រួចរាល់", "Done")}
            </span>
            <span>
              <i className="todo" /> {L("នៅសល់", "Remaining")}
            </span>
          </div>
        </div>

        {/* ---------- Checklist ---------- */}
        <div className="hm-card">
          <div className="hm-card-head">
            <h3>{L("ជំហានរៀបចំ", "Setup steps")}</h3>
          </div>
          <ul className="hm-steps">
            {steps.map((s) => (
              <li key={s.label} className={s.done ? "done" : ""}>
                <span className="hm-step-icon">{s.done ? <Check size={14} /> : <Circle size={10} />}</span>
                {s.to && !s.done ? <Link to={s.to}>{s.label}</Link> : <span>{s.label}</span>}
                <em>{s.done ? L("រួចរាល់", "Done") : s.soon || L("ត្រូវរៀបចំ", "To do")}</em>
              </li>
            ))}
          </ul>
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

        {/* ---------- POS card (dark) ---------- */}
        <div className="hm-card hm-dark">
          <h3>{L("POS ហាង", "Shop POS")}</h3>
          <p>{L("លក់ពេលគ្មានអ៊ីនធឺណិត ហើយបញ្ជូនវិក្កយបត្រពេលមានអ៊ីនធឺណិត", "Sell offline, send invoices when the internet is back")}</p>
          <span className="hm-dark-badge">{L("មកដល់ក្នុង Phase 3", "Coming in Phase 3")}</span>
          <KidsDecor variant="bottle" className="hm-dark-decor" />
        </div>
      </section>
    </div>
  );
}

export default HomeComponent;
