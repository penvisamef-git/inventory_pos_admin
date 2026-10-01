import { ROLE, ROLE_SCOPE, roleText } from "../dashboard/user/userRoles";
import { authService } from "../../api/api.service";

/**
 * What each screen needs. Put one of these on a route as `access` (see routes/route.script.js).
 * A route without `access` is treated as ADMIN only (safe default).
 *
 *   ALL       any signed-in admin-web user (dashboard, my account)
 *   MASTER    view master data → ADMIN, CENTRAL_MANAGER, ACCOUNTANT  (shop managers use the Shop portal /shop)
 *   PRODUCT   create / edit products, prices, units… → ADMIN, CENTRAL_MANAGER
 *   VIEW_ALL  central screens (all warehouses) → ADMIN, CENTRAL_MANAGER, ACCOUNTANT
 *   ADMIN     users, activity log, setup → ADMIN
 * Super admin can open everything. Cashier cannot use the admin web at all (POS only).
 */
export const ACCESS = {
  ALL: "all",
  MASTER: "master",
  PRODUCT: "product",
  VIEW_ALL: "view_all",
  ADMIN: "admin",
};

const ACCESS_ROLES = {
  [ACCESS.MASTER]: [ROLE.CENTRAL_MANAGER, ROLE.ACCOUNTANT],
  [ACCESS.PRODUCT]: [ROLE.CENTRAL_MANAGER],
  [ACCESS.VIEW_ALL]: [ROLE.CENTRAL_MANAGER, ROLE.ACCOUNTANT],
  [ACCESS.ADMIN]: [],
};

// the role of the signed-in user (login data). The API's super-admin flag always wins.
export function roleOf(user) {
  if (user?.is_super_admin) return ROLE.SUPER;
  return roleText(user?.role);
}

// "all" | "own" — which warehouses this user sees
export function scopeOf(user) {
  const role = roleOf(user);
  if (role === ROLE.SUPER) return "all";
  return ROLE_SCOPE[role] || "own";
}

// cashier (or no role) → no admin web
export function canUseAdminWeb(user) {
  const role = roleOf(user);
  return role === ROLE.SUPER || (!!role && role !== ROLE.CASHIER);
}

// Shop portal (/shop): one warehouse dashboard — admin, central manager (switch to any) and shop managers (own shops)
export function canUsePortal(user) {
  const role = roleOf(user);
  return [ROLE.SUPER, ROLE.ADMIN, ROLE.CENTRAL_MANAGER, ROLE.SHOP_MANAGER].includes(role);
}

// shop managers only use the portal, never the admin web
export function portalOnly(user) {
  return roleOf(user) === ROLE.SHOP_MANAGER;
}

export function canAccess(user, access = ACCESS.ADMIN) {
  if (!canUseAdminWeb(user)) return false;
  const role = roleOf(user);
  if (role === ROLE.SUPER || role === ROLE.ADMIN) return true;
  if (access === ACCESS.ALL) return !portalOnly(user);
  return (ACCESS_ROLES[access] || []).includes(role);
}

// drop every route / menu the user may not open (a menu group with nothing left disappears)
export function filterRoutes(list, user) {
  return list.reduce((acc, row) => {
    const hasChildren = Array.isArray(row.child) && row.child.length > 0;
    if (!hasChildren) {
      if (canAccess(user, row.access)) acc.push(row);
      return acc;
    }
    const groups = row.child
      .map((group) => group.filter((c) => canAccess(user, c.access ?? row.access)))
      .filter((group) => group.length > 0);
    if (groups.length > 0) acc.push({ ...row, child: groups });
    return acc;
  }, []);
}

// Keep the stored login in sync with the server (e.g. an admin changed the user's role).
// Returns true when something changed.
export async function refreshLoginRole(auth) {
  try {
    const res = await authService.me();
    const fresh = res?.data;
    const current = auth.getClientLogin();
    if (!current || !fresh || typeof fresh !== "object") return false;

    const next = { ...current };
    let changed = false;
    ["role", "is_super_admin", "firstname", "lastname", "is_first_login", "warehouse_ids"].forEach((key) => {
      if (fresh[key] !== undefined && JSON.stringify(fresh[key]) !== JSON.stringify(current[key])) {
        next[key] = fresh[key];
        changed = true;
      }
    });
    if (changed) auth.setClientLogin(next);
    return changed;
  } catch {
    return false;
  }
}
