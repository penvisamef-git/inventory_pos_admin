import apiClient from "./api.client";

/**
 * Standard CRUD endpoints exposed by inventory_pos_api for a resource.
 *
 * List params (see inventory_pos_api/src/util/mongo_db/mongoDB_Queries.js):
 *   page, limit, sort, order ("asc" | "desc"), q, q_key, q_id, q_key_id, includeDeleted
 */
function createResource(route) {
  return {
    list: (params) => apiClient.get(`/${route}`, params),
    all: (params) => apiClient.get(`/${route}-all`, params),
    get: (id) => apiClient.get(`/${route}/${id}`),
    create: (data) => apiClient.post(`/${route}`, data),
    update: (id, data) => apiClient.put(`/${route}/${id}`, data),
    remove: (id) => apiClient.delete(`/${route}/${id}`),
    restore: (id) => apiClient.put(`/${route}/restore/${id}`),
    // drag & drop order: items = [{ _id, sort_order }]
    sort: (items) => apiClient.put(`/${route}-sort`, { items }),
  };
}

// ================= Auth =================
export const authService = {
  login: (email, password) =>
    apiClient.post("/auth/login", { email, password }, { skipAuth: true }),
  me: () => apiClient.get("/auth/me"),
  logout: () => apiClient.post("/auth/logout", {}),
  // { old_password, new_password }
  changePassword: (data) => apiClient.put("/auth/change-password", data),
  testLoggedIn: () => apiClient.get("/auth/test-logged-in"),
};

// ================= User =================
export const userService = {
  ...createResource("users"),
  roles: () => apiClient.get("/users-roles"),
  resetPassword: (id, data) => apiClient.put(`/users/reset-password/${id}`, data),
  // { pos_pin: "1234" } (4–6 digits) or { pos_pin: null } to remove
  setPosPin: (id, pos_pin) => apiClient.put(`/users/pos-pin/${id}`, { pos_pin }),
};

// ================= Upload (Cloudinary, through the API) =================
// upload(FormData): files (many) + folder ("product" | "category" | "brand" | "setting" | "others")
//   → { data: [{ url, public_id, width, height, ... }] }
export const uploadService = {
  upload: (formData) => apiClient.post("/upload", formData),
  remove: (public_id) => apiClient.delete("/upload", { public_id }),
};

// ================= Setup =================
// list params: { type: "central" | "shop" } · shop roles only get their own warehouses
export const warehouseService = createResource("setup/warehouse");

// one document: company, receipt, tax (tax_mode: none | inclusive | exclusive), stock alerts
export const settingService = {
  get: () => apiClient.get("/setup/setting"),
  update: (data) => apiClient.put("/setup/setting", data),
};

// USD → KHR history; rows have state: "current" | "upcoming" | "past" (only upcoming can change)
export const exchangeRateService = {
  ...createResource("setup/exchange-rate"),
  current: () => apiClient.get("/setup/exchange-rate/current"),
};

// list params: { type: "cash" | "qr" | "card" | "bank" }
export const paymentMethodService = createResource("setup/payment-method");

// ================= Product =================
export const unitService = createResource("product/unit");

// list params: { parent_id: "<id>" | "root" } · rows include child_count
export const categoryService = {
  ...createResource("product/category"),
  tree: () => apiClient.get("/product/category-tree"),
};

// list params: { type: "size" | "color" | "other" } · values: [{ _id, code, name_kh, name_en, color_hex }]
export const attributeService = createResource("product/attribute");

export const brandService = createResource("product/brand");

// Product (style) + variants (SKU). get(id) → { ...product, variants: [...] }
// list params: { q (also SKU / barcode), category_id (with sub-categories), brand_id, attribute_id, track_batch, status }
export const productService = {
  ...createResource("product/item"),
  barcode: (code) => apiClient.get(`/product/item/barcode/${encodeURIComponent(code)}`),
  checkCode: (value, productId) => apiClient.get("/product/item/check-code", { value, product_id: productId || undefined }),
};

// Sale prices (USD). No update: a change is a new row. warehouse_id null = default, shop id = override (price null = back to default)
export const priceService = {
  history: (params) => apiClient.get("/product/price", params),
  current: (params) => apiClient.get("/product/price/current", params),
  create: (data) => apiClient.post("/product/price", data),
  bulk: (data) => apiClient.post("/product/price/bulk", data),
  remove: (id) => apiClient.delete(`/product/price/${id}`),
};

// Flat SKU list: { q, product_id, category_id, status, ids: "a,b" } · rows have product_id populated
export const variantService = {
  list: (params) => apiClient.get("/product/variant", params),
  get: (id) => apiClient.get(`/product/variant/${id}`),
};

// ================= Purchase & Stock =================
export const supplierService = createResource("purchase/supplier");

// read-only stock views (shop manager: own shops, no cost)
export const stockService = {
  // { warehouse_id, category_id, product_id, q, only: low|negative|in_stock|out, page, limit } → data + warehouses + summary
  balance: (params) => apiClient.get("/stock/balance", params),
  movement: (params) => apiClient.get("/stock/movement", params),
  expiry: (params) => apiClient.get("/stock/expiry", params),
  availability: (warehouseId, variantIds) => apiClient.get("/stock/availability", { warehouse_id: warehouseId, variant_ids: variantIds.join(",") }),
  fefo: (params) => apiClient.get("/stock/fefo", params),
};

// stock documents: list / get / create / update (draft) / cancel / post
function stockDoc(route) {
  return {
    list: (params) => apiClient.get(`/${route}`, params),
    get: (id) => apiClient.get(`/${route}/${id}`),
    create: (data) => apiClient.post(`/${route}`, data),
    update: (id, data) => apiClient.put(`/${route}/${id}`, data),
    cancel: (id) => apiClient.put(`/${route}/cancel/${id}`),
    post: (id) => apiClient.put(`/${route}/post/${id}`),
  };
}
export const openingService = stockDoc("stock/opening");
export const receiveService = stockDoc("stock/receive");
export const adjustmentService = stockDoc("stock/adjustment");
export const transferService = {
  ...stockDoc("stock/transfer"),
  dispatch: (id) => apiClient.put(`/stock/transfer/dispatch/${id}`),
  // items: [{ _id (line id), received_qty }]
  receive: (id, data) => apiClient.put(`/stock/transfer/receive/${id}`, data),
};

// ================= Shop portal (one warehouse) =================
export const shopService = {
  summary: (warehouseId) => apiClient.get("/shop/summary", { warehouse_id: warehouseId }),
  staff: (warehouseId) => apiClient.get("/shop/staff", { warehouse_id: warehouseId }),
  // cashier only: { warehouse_id, firstname, lastname, email, contact, password, pos_pin? }
  createCashier: (data) => apiClient.post("/shop/staff", data),
  updateCashier: (id, data) => apiClient.put(`/shop/staff/${id}`, data),
  resetPassword: (id, password) => apiClient.put(`/shop/staff/reset-password/${id}`, { password }),
  setPin: (id, pos_pin) => apiClient.put(`/shop/staff/pos-pin/${id}`, { pos_pin }),
};

// ================= Telegram (admin only; bot tokens stay in the cloud, never returned) =================
const asPage = (res) => ({ ...res, pagination: res.pagination || { total: (res.data || []).length, totalPages: 1 } });
export const telegramService = {
  events: () => apiClient.get("/telegram/events"), // { events, reports, languages }
  // bots: { name, token, is_default, note } · update: token only when replacing it
  bot: {
    list: async () => asPage(await apiClient.get("/telegram/bot")),
    create: (data) => apiClient.post("/telegram/bot", data),
    update: (id, data) => apiClient.put(`/telegram/bot/${id}`, data),
    remove: (id) => apiClient.delete(`/telegram/bot/${id}`),
    test: (id) => apiClient.post(`/telegram/bot/test/${id}`, {}),
    findChats: (id) => apiClient.get(`/telegram/bot/chats/${id}`), // groups that wrote to the bot recently
  },
  // chats: { bot_id, chat_id, title, type, language: kh|en|both, warehouse_ids, event_codes }
  chat: {
    list: (params) => apiClient.get("/telegram/chat", params),
    all: () => apiClient.get("/telegram/chat-all"),
    create: (data) => apiClient.post("/telegram/chat", data),
    update: (id, data) => apiClient.put(`/telegram/chat/${id}`, data),
    remove: (id) => apiClient.delete(`/telegram/chat/${id}`),
    test: (id) => apiClient.post(`/telegram/chat/test/${id}`, {}),
  },
  templates: () => apiClient.get("/telegram/template"),
  saveTemplate: (code, data) => apiClient.put(`/telegram/template/${code}`, data),
  resetTemplate: (code) => apiClient.delete(`/telegram/template/${code}`),
  previewTemplate: (data) => apiClient.post("/telegram/template/preview", data),
  // report schedules: { name, chat_ids, report_codes, warehouse_ids, times: ["08:00"], days: [0..6] }
  schedule: {
    list: async () => asPage(await apiClient.get("/telegram/schedule")),
    create: (data) => apiClient.post("/telegram/schedule", data),
    update: (id, data) => apiClient.put(`/telegram/schedule/${id}`, data),
    remove: (id) => apiClient.delete(`/telegram/schedule/${id}`),
    sendNow: (id) => apiClient.post(`/telegram/schedule/send/${id}`, {}),
  },
  previewReport: (params) => apiClient.get("/telegram/report/preview", params), // { code, warehouse_ids: "a,b", language, category_id, days, limit }
  // one-click send (admin + central manager): groups + reports for the box · send { chat_ids, report_codes, warehouse_ids, category_id, days, text }
  targets: () => apiClient.get("/telegram/targets"),
  send: (data) => apiClient.post("/telegram/send", data),
  // message log: { state: pending|sent|failed, code, chat_ref, page, limit } → data + counts
  messages: (params) => apiClient.get("/telegram/message", params),
  retry: (id) => apiClient.put(`/telegram/message/retry/${id}`, {}),
};

// ================= Session & Log =================
export const sessionService = {
  list: (params) => apiClient.get("/session", params),
  remove: (id) => apiClient.delete(`/session/${id}`),
};

export const activityLogService = {
  list: (params) => apiClient.get("/activity_log", params),
  categories: () => apiClient.get("/activity_log/category-all"),
};
