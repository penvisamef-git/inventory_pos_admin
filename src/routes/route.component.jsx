import React, { Suspense, useEffect, useState } from "react";
import lazyPage from "./lazyPage";
import { Routes, Route, BrowserRouter, Navigate } from "react-router-dom";
import LoginComponent from "../page/login/login.component";
import ThemeComponent from "../page/theme/default/theme.component";
import RouteScript from "./route.script";
import Auth from "../page/util/auth";
import { canUsePortal, filterRoutes, portalOnly, refreshLoginRole } from "../page/util/permission";
import PortalLayout from "../page/portal/PortalLayout";
import { settingService } from "../api/api.service";
import { currentSkin, setSkin } from "../page/theme/default/color.script";

// screens load on first use (own JS file each)
const PortalDashboard = lazyPage(() => import("../page/portal/PortalDashboard"));
const PortalStaff = lazyPage(() => import("../page/portal/PortalStaff"));
const StockBalanceComponent = lazyPage(() => import("../page/dashboard/stock/StockBalanceComponent"));
const TransferComponent = lazyPage(() => import("../page/dashboard/stock/TransferComponent"));
const AdjustmentComponent = lazyPage(() => import("../page/dashboard/stock/AdjustmentComponent"));
const ExpiryComponent = lazyPage(() => import("../page/dashboard/stock/ExpiryComponent"));
const StockCountComponent = lazyPage(() => import("../page/dashboard/stock/StockCountComponent"));
const MovementComponent = lazyPage(() => import("../page/dashboard/stock/MovementComponent"));
const AccountPage = lazyPage(() => import("../page/dashboard/account/AccountPage"));
const ActivityLogComponent = lazyPage(() => import("../page/dashboard/log/ActivityLogComponent"));
const SalesPage = lazyPage(() => import("../page/dashboard/sale/SalesPage"));
const NoteComponent = lazyPage(() => import("../page/dashboard/note/NoteComponent"));
const PrintDoc = lazyPage(() => import("../page/print/PrintDoc"));
const CatalogPage = lazyPage(() => import("../page/catalog/CatalogPage"));

function RouteComponent() {
  //**************** Declaration ****************//
  const routeScript = new RouteScript();
  const auth = new Auth();

  // The admin's theme (same for everyone): this browser shows the last one at once, then follows the server
  useEffect(() => {
    settingService
      .theme()
      .then((res) => {
        const key = res?.data?.ui_theme;
        if (key && key !== currentSkin()) setSkin(key);
      })
      .catch(() => {});
  }, []);

  // Keep the saved role in sync with the server (an admin may have changed it); re-render when it changes
  const [, setRoleVersion] = useState(0);
  useEffect(() => {
    if (!auth.getClientLogin()) return;
    refreshLoginRole(auth).then((changed) => {
      if (changed) setRoleVersion((v) => v + 1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //**************** Route Configuration ****************//

  // where a signed-in user starts: shop managers → Shop portal, everyone else → admin web
  const homeOf = (user) => (portalOnly(user) ? "/shop" : "/home");

  // ✅ Landing route "/" — home if logged in, otherwise /login
  const routePublic = () => {
    const isLogin = auth.getClientLogin();
    return [<Route key="/" path="/" element={<Navigate to={isLogin ? homeOf(isLogin) : "/login"} replace />} />];
  };

  // ✅ Shop portal /shop/:code/... — one warehouse (shop managers: own shops · admin / central: any)
  const routePortal = () => {
    const isLogin = auth.getClientLogin();
    if (!isLogin || !canUsePortal(isLogin)) return [];
    const page = (url, element) => (
      <Route key={"/shop/" + url} path={url ? `/shop/:code/${url}` : "/shop/:code"} element={<PortalLayout page={url}>{element}</PortalLayout>} />
    );
    return [
      <Route key="/shop" path="/shop" element={<PortalLayout page="" />} />,
      page("", <PortalDashboard />),
      page("stock", <StockBalanceComponent />),
      page("transfer", <TransferComponent />),
      page("adjustment", <AdjustmentComponent />),
      page("count", <StockCountComponent />),
      page("expiry", <ExpiryComponent />),
      page("movement", <MovementComponent />),
      page("sales", <SalesPage />),
      page("log", <ActivityLogComponent />),
      page("note", <NoteComponent />),
      page("staff", <PortalStaff />),
      page("account", <AccountPage />),
    ];
  };

  // ✅ Printable A4 documents /print/:type/:id (opened in a new tab, no menu) — signed-in users only
  const routePrint = () => {
    if (!auth.getClientLogin()) return [];
    return [
      <Route
        key="/print"
        path="/print/:type/:id"
        element={
          <Suspense fallback={null}>
            <PrintDoc />
          </Suspense>
        }
      />,
    ];
  };

  // ✅ Public catalog /c/:token (QR code) — anyone, logged in or not
  const routeCatalog = () => (
    <Route
      key="/c"
      path="/c/:token"
      element={
        <Suspense fallback={null}>
          <CatalogPage />
        </Suspense>
      }
    />
  );

  // ✅ Login route — redirect to /home if already logged in
  const routeLogin = () => {
    const isLogin = auth.getClientLogin();
    return (
      <Route key="/login" path="/login" element={isLogin ? <Navigate to={homeOf(isLogin)} replace /> : <LoginComponent />} />
    );
  };

  // ✅ 404 fallback
  const routeError = () => {
    const isLogin = auth.getClientLogin();
    return <Route key="404" path="*" element={<Navigate to={isLogin ? homeOf(isLogin) : "/"} replace />} />;
  };

  // ✅ Dashboard routes with auth guard
  const routeDashboardWithTheme = () => {
    const isLogin = auth.getClientLogin();

    // 🚫 No session → redirect everything to /login
    if (!isLogin) {
      return [<Route key="redirect-unauth" path="*" element={<Navigate to="/" replace />} />];
    }

    // ✅ Session exists → build dashboard routes
    const listOfRoute = [];

    // only the screens this user's role may open — anything else falls through to the 404 redirect (/home)
    const allowedRoutes = filterRoutes(routeScript.routeDashboard(), isLogin);

    allowedRoutes.forEach((row) => {
      if (!row.is_can_access_route) return;

      // ---- Level 0 (top-level route) ----
      if (!row.child || row.child.length === 0) {
        listOfRoute.push(
          <Route
            key={row.url}
            path={row.url}
            element={<ThemeComponent component={row.component} currentRoute={row} routeList={allowedRoutes} />}
          />,
        );
      } else {
        // ---- Level 1 + Level 2 (nested) ----
        row.child?.forEach((rowLevel1) => {
          rowLevel1.forEach((rowlv2) => {
            if (!rowlv2.is_can_access_route) return;

            const fullPath = row.url + "/" + rowlv2.url;

            listOfRoute.push(
              <Route
                key={fullPath}
                path={fullPath}
                element={
                  <ThemeComponent component={rowlv2.component} currentRoute={rowlv2} routeList={allowedRoutes} />
                }
              />,
            );
          });
        });
      }
    });

    return listOfRoute;
  };

  // **************** Design ****************//
  return (
    <BrowserRouter>
      <Routes>
        {routeCatalog()}
        {routeLogin()}
        {routePublic()}
        {routePortal()}
        {routePrint()}
        {routeDashboardWithTheme()}
        {routeError()}
      </Routes>
    </BrowserRouter>
  );
}

export default RouteComponent;
