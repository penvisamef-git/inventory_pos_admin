import { L } from "../../../i18n";

// The roles a user can have (saved as text in the user's `role` field).
// The text must match the API exactly (inventory_pos_api/src/util/user_roles.js).
//   scope "all" → sees every warehouse · "own" → only the user's warehouse_ids
export const ROLE = {
  SUPER: "super_admin", // is_super_admin flag from the API (not a selectable role)
  ADMIN: "អ្នកគ្រប់គ្រងប្រព័ន្ធ", // everything
  CENTRAL_MANAGER: "អ្នកគ្រប់គ្រងឃ្លាំងកណ្តាល", // products, prices, purchase, transfer, stock (all warehouses)
  ACCOUNTANT: "គណនេយ្យករ", // view sales, cost, stock value (all warehouses)
  SHOP_MANAGER: "អ្នកគ្រប់គ្រងហាង", // own shop only
  CASHIER: "អ្នកគិតលុយ", // POS only — no admin web
};

export const ROLE_SCOPE = {
  [ROLE.ADMIN]: "all",
  [ROLE.CENTRAL_MANAGER]: "all",
  [ROLE.ACCOUNTANT]: "all",
  [ROLE.SHOP_MANAGER]: "own",
  [ROLE.CASHIER]: "own",
};

export const USER_ROLES = [ROLE.ADMIN, ROLE.CENTRAL_MANAGER, ROLE.ACCOUNTANT, ROLE.SHOP_MANAGER, ROLE.CASHIER];

// English names (the saved value stays Khmer)
const ROLE_EN = {
  [ROLE.ADMIN]: "Admin",
  [ROLE.CENTRAL_MANAGER]: "Central warehouse manager",
  [ROLE.ACCOUNTANT]: "Accountant",
  [ROLE.SHOP_MANAGER]: "Shop manager",
  [ROLE.CASHIER]: "Cashier",
};

// Display name of a role in the current language
export const roleLabel = (role) => (role ? L(role, ROLE_EN[role] || role) : "");

export const ROLE_OPTIONS = USER_ROLES.map((r) => ({ value: r, label: roleLabel(r) }));

// the API may return a plain string, or (older data) an object with a name
export const roleText = (role) => (typeof role === "string" ? role : role?.name || "");
