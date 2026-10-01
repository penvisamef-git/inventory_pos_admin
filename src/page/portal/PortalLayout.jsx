import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Navigate, useNavigate, useParams, Link } from "react-router-dom";
import { LayoutDashboard, PackageSearch, Truck, ClipboardPen, CalendarClock, ListOrdered, Users, LogOut, Store, Warehouse as WarehouseIcon, ShieldCheck, ReceiptText, X, Menu } from "lucide-react";
import { authService, warehouseService } from "../../api/api.service";
import Auth from "../util/auth";
import { portalOnly, roleOf } from "../util/permission";
import { ROLE, roleLabel } from "../dashboard/user/userRoles";
import PreferenceMenu from "../theme/default/PreferenceMenu";
import { PortalContext } from "./portalContext";
import { nameKh } from "../dashboard/setup/setupOptions";
import { APP_NAME, APP_VERSION_TEXT } from "../../appInfo";
import { L } from "../../i18n";
import "../theme/default/theme.style.css";
import "../theme/default/color.script";
import "../dashboard/master_data/masterdata.style.css";
import "../dashboard/master_data/masterdata.theme.css";
import "./portal.style.css";

export const PORTAL_PAGES = [
  { url: "", icon: LayoutDashboard, name: L("ផ្ទាំងគ្រប់គ្រង", "Dashboard") },
  { url: "stock", icon: PackageSearch, name: L("ទំនិញ និងស្តុក", "Items & stock") },
  { url: "transfer", icon: Truck, name: L("ផ្ទេរស្តុក", "Transfers") },
  { url: "adjustment", icon: ClipboardPen, name: L("កែតម្រូវ", "Adjustments") },
  { url: "expiry", icon: CalendarClock, name: L("ជិតផុតកំណត់", "Near expiry") },
  { url: "movement", icon: ListOrdered, name: L("ចលនាស្តុក", "Movements") },
  { url: "staff", icon: Users, name: L("បុគ្គលិក", "Staff"), shopOnly: true },
  { url: "sales", icon: ReceiptText, name: L("ការលក់", "Sales"), soon: true },
];

/**
 * Shop portal shell: one warehouse at a time (/shop/:code/...).
 * Shop managers see only their shops; admin / central manager can switch to any warehouse.
 */
function PortalLayout({ page, children }) {
  const { code } = useParams();
  const navigate = useNavigate();
  const auth = new Auth();
  const login = auth.getClientLogin() || {};
  const role = roleOf(login);
  const onlyPortal = portalOnly(login);
  const [warehouses, setWarehouses] = useState(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [page, code]);

  useEffect(() => {
    warehouseService
      .all()
      .then((r) => setWarehouses(r.data || []))
      .catch(() => setWarehouses([]));
  }, []);

  const current = useMemo(() => (warehouses || []).find((w) => w.code === code) || null, [warehouses, code]);
  const pageInfo = PORTAL_PAGES.find((p) => p.url === page) || PORTAL_PAGES[0];
  useEffect(() => {
    document.title = `${current ? current.code + " · " : ""}${pageInfo.name} · ${APP_NAME}`;
  }, [current, pageInfo]);

  if (warehouses === null) return <div className="pt-loading">{L("កំពុងផ្ទុក...", "Loading...")}</div>;
  if (!warehouses.length) {
    return (
      <div className="pt-loading">
        {L("គណនីនេះមិនទាន់បានភ្ជាប់ទៅហាងណាមួយទេ", "This account is not linked to any shop yet")}
        <button type="button" className="md-btn md-btn-ghost" onClick={() => authService.logout().catch(() => {}).finally(() => { auth.removeClientLogin(); window.location.href = "/login"; })}>
          <LogOut size={15} /> {L("ចាកចេញ", "Log out")}
        </button>
      </div>
    );
  }
  // unknown / missing code → first warehouse (shops first for central roles too)
  if (!current) {
    const first = warehouses.find((w) => w.type === "shop") || warehouses[0];
    return <Navigate to={`/shop/${first.code}${page ? "/" + page : ""}`} replace />;
  }

  // a shop manager must change the password on first login (admin / central only get the reminder, like the admin web)
  if (onlyPortal && login.is_first_login && page !== "account") return <Navigate to={`/shop/${current.code}/account`} replace />;

  const fullName = `${login.firstname || ""} ${login.lastname || ""}`.trim() || login.email;
  const pages = PORTAL_PAGES.filter((p) => !(p.shopOnly && current.type !== "shop"));
  const doLogout = async () => {
    try {
      await authService.logout();
    } catch {
      /* ignore */
    }
    auth.removeClientLogin();
    window.location.href = "/login";
  };

  return (
    <PortalContext.Provider value={current}>
      <div className="pt-shell">
        <header className="pt-header">
          <button type="button" className="pt-menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label={L("ម៉ឺនុយ", "Menu")}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="pt-brand">
            <span className="pt-logo">{current.type === "shop" ? <Store size={20} /> : <WarehouseIcon size={20} />}</span>
            <div>
              <strong>{nameKh(current)}</strong>
              <small>{L(current.type === "shop" ? "ផ្ទាំងគ្រប់គ្រងហាង" : "ផ្ទាំងគ្រប់គ្រងឃ្លាំង", current.type === "shop" ? "Shop dashboard" : "Warehouse dashboard")} · {current.code}</small>
            </div>
          </div>

          {warehouses.length > 1 && (
            <select className="pt-switch" value={current.code} onChange={(e) => navigate(`/shop/${e.target.value}${page ? "/" + page : ""}`)} title={L("ប្តូរហាង / ឃ្លាំង", "Switch shop / warehouse")}>
              {warehouses.map((w) => (
                <option key={w._id} value={w.code}>
                  {w.code} · {nameKh(w)}
                </option>
              ))}
            </select>
          )}

          <div className="pt-right">
            {!onlyPortal && (
              <Link to="/home" className="pt-admin" title={L("ត្រឡប់ទៅ Admin web", "Back to the admin web")}>
                <ShieldCheck size={16} />
                <span>{L("Admin web", "Admin web")}</span>
              </Link>
            )}
            <PreferenceMenu />
            <Link to={`/shop/${current.code}/account`} className="user-chip">
              <span className="user-avatar">{Array.from(fullName || "?")[0].toUpperCase()}</span>
              <span className="user-text">
                <strong>{fullName}</strong>
                <small>{role === ROLE.SUPER ? "Super admin" : roleLabel(role)}</small>
              </span>
            </Link>
            <button type="button" className="pt-icon" onClick={() => setConfirmLogout(true)} title={L("ចាកចេញ", "Log out")}>
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <nav className={`pt-nav ${menuOpen ? "open" : ""}`}>
          {pages.map((p) => {
            const Icon = p.icon;
            return p.soon ? (
              <span key={p.url} className="pt-tab soon" title={L("បន្ទាប់ពី POS (ដំណាក់កាលទី 3)", "After the POS (Phase 3)")}>
                <Icon size={16} />
                {p.name}
                <em>{L("ឆាប់ៗ", "soon")}</em>
              </span>
            ) : (
              <NavLink key={p.url} end to={`/shop/${current.code}${p.url ? "/" + p.url : ""}`} className={({ isActive }) => `pt-tab ${isActive ? "on" : ""}`}>
                <Icon size={16} />
                {p.name}
              </NavLink>
            );
          })}
        </nav>

        <main className="pt-main">
          {page !== "" && page !== "account" && <h1 className="pt-title">{pageInfo.name}</h1>}
          {children}
          <footer className="footer">© {new Date().getFullYear()} {APP_NAME} · {APP_VERSION_TEXT}</footer>
        </main>

        {confirmLogout && (
          <div className="md-modal-backdrop" onMouseDown={() => setConfirmLogout(false)}>
            <div className="md-modal md-modal-sm" onMouseDown={(e) => e.stopPropagation()}>
              <div className="md-modal-header">
                <h3>{L("ចាកចេញពីគណនី", "Log out")}</h3>
                <button type="button" className="md-icon-btn" onClick={() => setConfirmLogout(false)}><X size={18} /></button>
              </div>
              <div className="md-modal-body"><p>{L("តើអ្នកចង់ចាកចេញមែនទេ?", "Do you want to log out?")}</p></div>
              <div className="md-modal-footer">
                <button type="button" className="md-btn md-btn-ghost" onClick={() => setConfirmLogout(false)}>{L("ទេ", "No")}</button>
                <button type="button" className="md-btn md-btn-danger" onClick={doLogout}>{L("ចាកចេញ", "Log out")}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalContext.Provider>
  );
}

export default PortalLayout;
