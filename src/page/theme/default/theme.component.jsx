import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, Menu, X, ChevronDown, ChevronRight, User, Baby, Home, Store } from "lucide-react";
import "./theme.style.css";
import "./color.script";
import PreferenceMenu from "./PreferenceMenu";
import Auth from "../../util/auth.js";
import { authService } from "../../../api/api.service";
import { canUsePortal, roleOf } from "../../util/permission";
import { ROLE, roleLabel } from "../../dashboard/user/userRoles";
import { APP_NAME, APP_NAME_KH, APP_VERSION_TEXT } from "../../../appInfo";

import { L, LANG } from "../../../i18n";
// true when the current URL is this route (also /create, /edit/:id, /view/:id)
// Sidebar headings (route.script.js → section). "system" also holds My account + Log out.
const SECTIONS = [
  { key: "menu", label: L("ម៉ឺនុយ", "MENU") },
  { key: "warehouse", label: L("ឃ្លាំងទំនិញ", "WAREHOUSE") },
  { key: "connect", label: L("ការតភ្ជាប់", "CONNECT") },
  { key: "system", label: L("ប្រព័ន្ធ", "SYSTEM") },
];

function matchesRoute(currentURL, base) {
  if (base.endsWith("/") && base.length > 1) base = base.slice(0, -1);
  return (
    currentURL === base ||
    currentURL === base + "/create" ||
    new RegExp(`^${base}/edit/[^/]+$`).test(currentURL) ||
    new RegExp(`^${base}/view/[^/]+$`).test(currentURL)
  );
}

function cleanPath() {
  let url = window.location.pathname;
  if (url.endsWith("/") && url.length > 1) url = url.slice(0, -1);
  return url;
}

function Theme({ component, currentRoute, routeList }) {
  const auth = new Auth();
  const login = auth.getClientLogin() || {};
  const role = roleOf(login);

  // Find the initial open menu based on current URL
  const getInitialOpenMenu = () => {
    const currentURL = cleanPath();
    for (let row of routeList) {
      if (row.is_show_sidebar && row.child && row.child.length > 0) {
        const hasActiveChild = row.child.some((group) => group.some((c) => c.is_show_sidebar && matchesRoute(currentURL, "/" + row.url + "/" + c.url)));
        if (hasActiveChild) return row.name;
      }
    }
    return null;
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [openMenu, setOpenMenu] = useState(getInitialOpenMenu);

  useEffect(() => {
    document.title = `${currentRoute?.name || "Dashboard"} · ${APP_NAME}`;
  }, [currentRoute]);

  // Esc closes the logout dialog
  useEffect(() => {
    if (!confirmLogout) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setConfirmLogout(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmLogout]);

  // Close the session on the server too, then clear the local login
  const doLogout = async () => {
    setLoggingOut(true);
    try {
      await authService.logout();
    } catch {
      // token already expired → nothing to close on the server
    }
    auth.removeClientLogin();
    window.location.href = "/login";
  };

  const toggleSubMenu = (menu) => setOpenMenu(openMenu === menu ? null : menu);
  const closeSidebar = () => setSidebarOpen(false);

  // *************************** Breadcrumb ***************************//
  const getBreadcrumbs = () => {
    const url = cleanPath();
    for (let row of routeList) {
      if (url === "/" + row.url) {
        return row.breadcrumb?.length ? row.breadcrumb : [{ name: row.name, url: row.url }];
      }
      for (let group of row.child || []) {
        for (let child of group) {
          const childRoute = "/" + row.url + "/" + child.url;
          const isExact = childRoute.includes(":") ? new RegExp(`^${childRoute.replace(/:[^/]+/g, "[^/]+")}$`).test(url) : matchesRoute(url, childRoute);
          if (isExact) {
            return child.breadcrumb?.length
              ? child.breadcrumb
              : [
                  { name: row.name, url: null },
                  { name: child.name, url: null },
                ];
          }
        }
      }
    }
    return [{ name: L("ទំព័រដើម", "Home"), url: "home" }];
  };

  const breadcrumbs = getBreadcrumbs();
  const pageTitle = currentRoute?.name || breadcrumbs[breadcrumbs.length - 1]?.name;

  // *************************** Side bar menu ***************************//
  const isActive = (path) => (matchesRoute(cleanPath(), path) ? "active" : "");
  const groupActive = (row) => (cleanPath().split("/")[1] || "") === (row.url || "").split("/")[0];

  const menuOf = (section) =>
    routeList
      .filter((row) => row.is_show_sidebar && (row.section || "menu") === section)
      .map((row, i) => {
        if (!row.child || row.child.length === 0) {
          return (
            <Link key={i + "menu"} to={"/" + row.url} className={`nav-item ${isActive("/" + row.url)}`} onClick={closeSidebar}>
              {row.icon}
              <span>{row.name}</span>
            </Link>
          );
        }

        const subMenu = [];
        row.child.forEach((group, g) =>
          group.forEach((child, c) => {
            if (!child.is_show_sidebar) return;
            const path = ("/" + row.url + "/" + child.url).replace(/\/+/g, "/");
            subMenu.push(
              <Link key={`${g}-${c}-sub`} to={path} className={`nav-sub ${isActive(path)}`} onClick={closeSidebar}>
                {child.icon}
                <span>{child.name}</span>
              </Link>,
            );
          }),
        );
        const open = openMenu === row.name;

        return (
          <div key={i + "group"} className={`nav-group ${groupActive(row) ? "has-active" : ""}`}>
            <button type="button" className={`nav-item ${open ? "open" : ""}`} onClick={() => toggleSubMenu(row.name)}>
              {row.icon}
              <span>{row.name}</span>
              <ChevronDown size={16} className={`nav-caret ${open ? "rotate" : ""}`} />
            </button>
            <div className={`nav-subs ${open ? "open" : ""}`}>
              <div className="nav-subs-inner">{subMenu}</div>
            </div>
          </div>
        );
      });

  const initial = Array.from(login.firstname || login.email || "?")[0].toUpperCase();
  const fullName = `${login.firstname || ""} ${login.lastname || ""}`.trim() || login.email;

  // *************************** View ***************************//
  return (
    <div className="app">
      {/* Mobile menu button */}
      <button type="button" className="mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menu">
        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
      {sidebarOpen && <div className="overlay" onClick={closeSidebar}></div>}

      {/* ================= Sidebar ================= */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <Link to="/home" className="brand" onClick={closeSidebar}>
          <span className="brand-mark">
            <Baby size={20} />
          </span>
          <span className="brand-text">
            <strong>{APP_NAME}</strong>
            <small>{APP_NAME_KH}</small>
          </span>
        </Link>

        {SECTIONS.filter((sec) => sec.key !== "system").map((sec) => {
          const items = menuOf(sec.key);
          if (!items.length) return null;
          return (
            <React.Fragment key={sec.key}>
              <p className={`nav-label nav-label-${LANG}`}>{sec.label}</p>
              <nav className="nav">{items}</nav>
            </React.Fragment>
          );
        })}

        <p className={`nav-label nav-label-${LANG}`}>{SECTIONS[3].label}</p>
        <nav className="nav">
          {menuOf("system")}
          <Link to="/account" className={`nav-item ${isActive("/account")}`} onClick={closeSidebar}>
            <User />
            <span>{L("គណនីរបស់ខ្ញុំ", "My account")}</span>
          </Link>
          <button type="button" className="nav-item" onClick={() => setConfirmLogout(true)}>
            <LogOut />
            <span>{L("ចាកចេញ", "Log out")}</span>
          </button>
        </nav>

        <div className="side-card">
          <span className="side-card-mark">
            <Baby size={18} />
          </span>
          <strong>{L("ហាងទំនិញកុមារ", "Baby & Kids Store")}</strong>
          <p>{L("ឃ្លាំង · ទំនិញ · ស្តុក · POS", "Warehouse · Products · Stock · POS")}</p>
          <span className="side-card-version">{APP_VERSION_TEXT}</span>
        </div>
      </aside>

      {/* ================= Main ================= */}
      <main className="main">
        <header className="topbar">
          <button type="button" className="topbar-menu" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={L("ម៉ឺនុយ", "Menu")}>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <nav className="breadcrumb" aria-label="breadcrumb">
            <Link to="/home" className="breadcrumb-home" aria-label={L("ទំព័រដើម", "Home")}>
              <Home size={15} />
            </Link>
            {breadcrumbs.map((crumb, index) => (
              <span key={index} className="breadcrumb-item">
                <ChevronRight size={14} />
                {crumb.url ? (
                  <Link to={"/" + crumb.url}>{crumb.name}</Link>
                ) : (
                  <span className={index === breadcrumbs.length - 1 ? "is-last" : ""}>{crumb.name}</span>
                )}
              </span>
            ))}
          </nav>

          <div className="topbar-right">
            {canUsePortal(login) && (
              <Link to="/shop" className="topbar-portal" title={L("ប្តូរទៅផ្ទាំងគ្រប់គ្រងហាង / ឃ្លាំង", "Switch to a shop / warehouse dashboard")}>
                <Store size={16} />
                <span>{L("ផ្ទាំងហាង", "Shop dashboard")}</span>
              </Link>
            )}
            <PreferenceMenu />
            <Link to="/account" className="user-chip" title={L("គណនីរបស់ខ្ញុំ", "My account")}>
              <span className="user-avatar">{initial}</span>
              <span className="user-text">
                <strong>{fullName}</strong>
                <small>{role === ROLE.SUPER ? "Super admin" : roleLabel(role) || login.email}</small>
              </span>
            </Link>
          </div>
        </header>

        <section className="page">
          <div className="page-head">
            <h1>{pageTitle}</h1>
            {currentRoute?.subtitle && <p>{currentRoute.subtitle}</p>}
          </div>

          <div className="page-body">{component}</div>

          <footer className="footer">
            © {new Date().getFullYear()} {APP_NAME} · {APP_NAME_KH} · {APP_VERSION_TEXT}
          </footer>
        </section>
      </main>

      {/* ================= Logout confirmation ================= */}
      {confirmLogout && (
        <div className="logout-backdrop" onClick={() => !loggingOut && setConfirmLogout(false)}>
          <div className="logout-dialog" role="alertdialog" aria-modal="true" aria-labelledby="logout-title" onClick={(e) => e.stopPropagation()}>
            <div className="logout-dialog-icon">
              <LogOut size={22} />
            </div>
            <h3 id="logout-title">{L("ចាកចេញពីគណនី", "Log out")}</h3>
            <p>{L("តើអ្នកពិតជាចង់ចាកចេញពីគណនីមែនទេ?", "Do you really want to log out?")}</p>
            <div className="logout-dialog-actions">
              <button type="button" className="btn-ghost" onClick={() => setConfirmLogout(false)} disabled={loggingOut} autoFocus>
                {L("បោះបង់", "Cancel")}
              </button>
              <button type="button" className="btn-primary" onClick={doLogout} disabled={loggingOut}>
                {loggingOut ? L("កំពុងចាកចេញ...", "Logging out...") : L("ចាកចេញ", "Log out")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Theme;
