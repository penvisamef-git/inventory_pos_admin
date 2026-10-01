import React, { useEffect, useState } from "react";
import { Routes, Route, BrowserRouter, Navigate } from "react-router-dom";
import LoginComponent from "../page/login/login.component";
import ThemeComponent from "../page/theme/default/theme.component";
import RouteScript from "./route.script";
import Auth from "../page/util/auth";
import { canUsePortal, filterRoutes, portalOnly, refreshLoginRole } from "../page/util/permission";
import PortalLayout from "../page/portal/PortalLayout";
import PortalDashboard from "../page/portal/PortalDashboard";
import PortalStaff from "../page/portal/PortalStaff";
import StockBalanceComponent from "../page/dashboard/stock/StockBalanceComponent";
import TransferComponent from "../page/dashboard/stock/TransferComponent";
import AdjustmentComponent from "../page/dashboard/stock/AdjustmentComponent";
import ExpiryComponent from "../page/dashboard/stock/ExpiryComponent";
import MovementComponent from "../page/dashboard/stock/MovementComponent";
import AccountPage from "../page/dashboard/account/AccountPage";

function RouteComponent() {
  //**************** Declaration ****************//
  const routeScript = new RouteScript();
  const auth = new Auth();

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
      page("expiry", <ExpiryComponent />),
      page("movement", <MovementComponent />),
      page("staff", <PortalStaff />),
      page("account", <AccountPage />),
    ];
  };

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
        {routeLogin()}
        {routePublic()}
        {routePortal()}
        {routeDashboardWithTheme()}
        {routeError()}
      </Routes>
    </BrowserRouter>
  );
}

export default RouteComponent;
