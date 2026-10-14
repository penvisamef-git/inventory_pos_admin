// Browser POS engine — the same calls as local_pos/src/api.js (→ local_pos_api), done here on IndexedDB.
// Port of local_pos_api/src/pos.route.js: keep the rules in step with it.
import bcrypt from "./bcrypt";
import * as idb from "./db";
import * as sync from "./sync";
import { priceCart, settle, r2, r4, roundKhr } from "./money";

const SESSION_HOURS = 14;
const LOCK_AFTER = 5;
const TOKEN_KEY = "cloud_pos_token";
const USER_KEY = "cloud_pos_user";
const wrong = new Map();
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
const now = () => new Date().toISOString();
const fullName = (u) => `${u.firstname || ""} ${u.lastname || ""}`.trim() || u.email;
const L2 = (kh, en) => `${kh} / ${en}`;

function fail(message, status = 400, extra = {}) {
  const e = new Error(message);
  e.status = status;
  Object.assign(e, extra);
  throw e;
}

// ---------------- session (this tab) ----------------
export const session = {
  token: () => {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  },
  user: () => {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  },
  save: (token, user) => {
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // storage blocked
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    } catch {
      // ignore
    }
  },
};
let onLoggedOut = () => {};
export const setLoggedOutHandler = (fn) => {
  onLoggedOut = fn;
};
export const BASE = ""; // (no server: kept for the screens that read it)

async function me() {
  const token = session.token();
  const s = token ? await idb.get("sessions", token) : null;
  if (!s || new Date(s.expires_at) < new Date()) {
    session.clear();
    onLoggedOut();
    fail("សូមចូលម្តងទៀត / Please log in again", 401);
  }
  return s;
}
async function paired() {
  const cfg = await sync.getConfig();
  if (!cfg?.device_key) fail("POS មិនទាន់ភ្ជាប់ / POS is not paired", 409);
  return cfg;
}

async function checkPin(userId, pin) {
  const lock = wrong.get(String(userId));
  if (lock && lock.until > Date.now()) return { error: `សូមរង់ចាំ ${Math.ceil((lock.until - Date.now()) / 1000)} វិនាទី / Wait a moment`, status: 429 };
  const u = await idb.get("users", String(userId));
  if (!u || !u.pin_hash) return { error: "រកមិនឃើញអ្នកប្រើ / User not found", status: 404 };
  if (!(await bcrypt.compare(String(pin || ""), u.pin_hash))) {
    const c = (lock?.count || 0) + 1;
    wrong.set(String(userId), { count: c, until: c >= LOCK_AFTER ? Date.now() + 60 * 1000 : 0 });
    return { error: "លេខ PIN ខុស / Wrong PIN", status: 401 };
  }
  wrong.delete(String(userId));
  return { user: u };
}
async function managerApproval(approver) {
  const a = approver || {};
  if (!a.user_id || !a.pin) fail("ត្រូវការ PIN អ្នកគ្រប់គ្រងហាង / A shop manager's PIN is needed", 403);
  const r = await checkPin(a.user_id, a.pin);
  if (r.error) fail(r.error, r.status === 401 ? 403 : r.status);
  if (!r.user.is_manager) fail("ត្រូវការ PIN អ្នកគ្រប់គ្រងហាង / A shop manager's PIN is needed", 403);
  return { _id: r.user._id, name: fullName(r.user) };
}

const openShift = async () => (await idb.all("shifts")).find((s) => s.state === "open") || null;
// ---------------- customers (loyalty) ----------------
const POINTS_METHOD = { _id: "points", code: "points", name_kh: "ពិន្ទុ", name_en: "Points", type: "points", currency: "USD" };
const DEPOSIT_METHOD = { _id: "deposit", code: "deposit", name_kh: "ប្រាក់កក់", name_en: "Deposit", type: "credit", currency: "USD" };
const EXCHANGE_METHOD = { _id: "exchange", code: "exchange", name_kh: "ប្តូរទំនិញ", name_en: "Exchange credit", type: "credit", currency: "USD" };
const MOVE_KINDS = { out: ["expense", "safe_drop", "other"], in: ["float", "other"] };
const managerOf = async (me_, approver) => (me_.is_manager ? { _id: me_.user_id, name: me_.name } : managerApproval(approver));
// money in / out of the drawer that is not a sale (the shift goes to the cloud again)
async function addCashMove(shift, me_, m, by = null) {
  const rate = Number((await sync.getData())?.rate?.rate) || 4100;
  const currency = m.currency === "KHR" ? "KHR" : "USD";
  const amount = currency === "KHR" ? Math.round(m.amount) : r2(m.amount);
  const move = { uuid: uuid(), type: m.type, kind: m.kind, category: String(m.category || "").slice(0, 40), amount, currency, amount_usd: currency === "KHR" ? r2(amount / rate) : amount, note: String(m.note || "").trim().slice(0, 200), ref: String(m.ref || "").slice(0, 60), by: me_.user_id, by_name: me_.name, approved_by_name: by?.name || "", at: now() };
  await idb.update("shifts", shift._id, (cur) => (cur ? { ...cur, cash_moves: [...(cur.cash_moves || []), move], synced: false, updated_at: now() } : undefined));
  return move;
}
async function takeDeposit(h, shift, me_, amount, currency) {
  const move = await addCashMove(shift, me_, { type: "in", kind: "deposit", amount, currency, note: `${L2("កក់ប្រាក់", "Layaway deposit")} #${h.hold_no} ${h.label || ""}`.trim(), ref: h._id });
  await idb.update("holds", h._id, (cur) => (cur ? { ...cur, deposit_usd: r2((cur.deposit_usd || 0) + move.amount_usd), deposits: [...(cur.deposits || []), { amount: move.amount, currency: move.currency, amount_usd: move.amount_usd, at: move.at, shift_no: shift.shift_no, by_name: me_.name }] } : undefined));
  sync.push().catch(() => {});
}
const phoneOf = (v) => {
  let d = String(v || "").replace(/\D/g, "");
  if (d.startsWith("855")) d = `0${d.slice(3)}`;
  if (d && !d.startsWith("0")) d = `0${d}`;
  return d.length >= 8 && d.length <= 11 ? d : null;
};
// points shown = cloud balance + what this POS changed and has not sent yet
async function pendingPoints(localId) {
  const [sales, refunds] = await Promise.all([idb.all("sales"), idb.all("refunds")]);
  return (
    sales.filter((x) => x.customer_local === localId && !x.synced && x.state === "paid").reduce((t, x) => t + (x.points_earned || 0) - (x.points_redeemed || 0), 0) +
    refunds.filter((x) => x.customer_local === localId && !x.synced).reduce((t, x) => t + (x.points_delta || 0), 0)
  );
}
const customerView = async (c) => ({ _id: c._id, cloud_id: c.cloud_id || null, code: c.code || "", name: c.name, phone: c.phone, kid_name: c.kid_name || "", kid_birthday: c.kid_birthday || "", kid_gender: c.kid_gender || "", points: (c.points || 0) + (await pendingPoints(c._id)), not_sent: !c.synced });
// by id; a customer added here moves from "u:<uuid>" to the cloud id once sent — still found by its uuid
async function findCustomer(id) {
  const c = await idb.get("customers", String(id));
  if (c || !String(id).startsWith("u:")) return c || null;
  const u = String(id).slice(2);
  return (await idb.all("customers")).find((x) => x.uuid === u) || null;
}
const loyaltyOf = (data) => ({
  enabled: data?.setting?.loyalty_enabled !== false,
  points_per_usd: Number(data?.setting?.points_per_usd ?? 1),
  point_value_usd: Number(data?.setting?.point_value_usd ?? 0.01),
  min_redeem_points: Number(data?.setting?.min_redeem_points ?? 100),
});

const findSale = async (id) => (await idb.get("sales", String(id))) || (await idb.all("sales")).find((s) => s.invoice_no === String(id)) || null;

// ---------------- customer display (same browser: BroadcastChannel) ----------------
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("cloud_pos_display") : null;
let displaySeen = 0;
if (channel) {
  channel.onmessage = (e) => {
    if (e.data?.type === "here") displaySeen = Date.now();
    if (e.data?.type === "hello") post(lastDisplay); // a display just opened → current screen
  };
}
let lastDisplay = { mode: "idle", at: Date.now(), data: {} };
function post(msg) {
  if (channel) channel.postMessage({ type: "show", ...msg });
}

// ---------------- shift totals ----------------
async function shiftTotals(shift) {
  const [sales, refunds] = await Promise.all([idb.all("sales"), idb.all("refunds")]);
  const mine = sales.filter((s) => s.shift_id === shift._id && s.state === "paid");
  const byMethod = {};
  let cashUsd = 0;
  let cashKhr = 0;
  mine.forEach((s) => {
    s.payments.forEach((p) => {
      const k = p.code;
      if (!byMethod[k]) byMethod[k] = { code: p.code, name_kh: p.name_kh, name_en: p.name_en, type: p.type, currency: p.currency, amount: 0, amount_usd: 0, count: 0 };
      byMethod[k].amount += p.amount;
      byMethod[k].amount_usd += p.amount_usd;
      byMethod[k].count += 1;
      if (p.type === "cash") {
        if (p.currency === "KHR") cashKhr += p.amount;
        else cashUsd += p.amount;
      }
    });
    cashUsd -= s.change_give_usd || 0;
    cashKhr -= s.change_give_khr || 0;
  });
  const rf = refunds.filter((r) => r.shift_id === shift._id);
  const refundMethods = {};
  rf.forEach((r) =>
    r.payments.forEach((p) => {
      const k = p.code;
      if (!refundMethods[k]) refundMethods[k] = { code: p.code, name_kh: p.name_kh, name_en: p.name_en, type: p.type, currency: p.currency, amount: 0, amount_usd: 0, count: 0 };
      refundMethods[k].amount += p.amount;
      refundMethods[k].amount_usd += p.amount_usd;
      refundMethods[k].count += 1;
      if (p.type === "cash") {
        if (p.currency === "KHR") cashKhr -= p.amount;
        else cashUsd -= p.amount;
      }
    }),
  );
  [...Object.values(byMethod), ...Object.values(refundMethods)].forEach((m) => {
    m.amount = m.currency === "KHR" ? Math.round(m.amount) : r2(m.amount);
    m.amount_usd = r2(m.amount_usd);
  });
  const salesTotal = r2(mine.reduce((t, s) => t + s.total, 0));
  const refundTotal = r2(rf.reduce((t, r) => t + r.total, 0));
  const moves = shift.cash_moves || [];
  const sumMoves = (type, cur) => moves.filter((m) => m.type === type && (m.currency === "KHR") === (cur === "KHR")).reduce((t, m) => t + m.amount, 0);
  const cash = { in_usd: r2(sumMoves("in", "USD")), in_khr: Math.round(sumMoves("in", "KHR")), out_usd: r2(sumMoves("out", "USD")), out_khr: Math.round(sumMoves("out", "KHR")) };
  cashUsd += cash.in_usd - cash.out_usd;
  cashKhr += cash.in_khr - cash.out_khr;
  const byKind = {};
  moves.forEach((m) => {
    const k = `${m.type}:${m.kind}`;
    if (!byKind[k]) byKind[k] = { type: m.type, kind: m.kind, count: 0, amount_usd: 0 };
    byKind[k].count += 1;
    byKind[k].amount_usd = r2(byKind[k].amount_usd + (m.amount_usd || 0));
  });
  return {
    cash_moves: cash,
    cash_move_kinds: Object.values(byKind),
    cash_move_count: moves.length,
    refund_count: rf.length,
    refund_total: refundTotal,
    refund_methods: Object.values(refundMethods),
    net_total: r2(salesTotal - refundTotal),
    invoice_count: mine.length,
    sales_total: salesTotal,
    discount_total: r2(mine.reduce((t, s) => t + (s.discount_total || 0), 0)),
    tax_total: r2(mine.reduce((t, s) => t + (s.tax_amount || 0), 0)),
    items_qty: mine.reduce((t, s) => t + s.items.reduce((a, i) => a + i.qty, 0), 0),
    methods: Object.values(byMethod),
    expected_usd: r2(shift.opening_usd + cashUsd),
    expected_khr: Math.round(shift.opening_khr + cashKhr),
  };
}

// ======================================================================================
export const api = {
  // ---------------- status / pairing / sync ----------------
  async status() {
    const [cfg, data, sales, refunds, open, holds] = await Promise.all([sync.getConfig(), sync.getData(), idb.all("sales"), idb.all("refunds"), openShift(), idb.all("holds")]);
    const waiting = sales.filter((s) => !s.synced && s.state === "paid");
    return {
      cloud: true,
      held_carts: holds.length,
      ui_theme: data?.setting?.ui_theme || "forest",
      display_screens: Date.now() - displaySeen < 30000 ? 1 : 0,
      paired: !!cfg?.device_key,
      has_data: !!data?.pulled_at,
      device: cfg?.device || null,
      warehouse: cfg?.warehouse || null,
      cloud_url: sync.CLOUD_URL,
      online: sync.state.online,
      last_online_at: cfg?.last_online_at || null,
      last_pull_at: cfg?.last_pull_at || null,
      last_push_at: cfg?.last_push_at || null,
      last_error: cfg?.last_error || "",
      revoked_at: cfg?.revoked_at || null,
      revoked_reason: cfg?.revoked_reason || "",
      pending_sales: waiting.length + refunds.filter((r) => !r.synced).length,
      failed_sales: waiting.filter((s) => s.sync_error).length,
      shift: open ? { _id: open._id, shift_no: open.shift_no, opened_by_name: open.opened_by_name, opened_at: open.opened_at } : null,
      server_time: now(),
    };
  },
  async pair(code) {
    const cfg = await sync.getConfig();
    if (cfg?.device_key) fail("POS នេះបានភ្ជាប់រួចហើយ / Already paired", 409);
    const c = String(code || "").replace(/\D/g, "");
    if (c.length !== 6) fail("លេខកូដមាន 6 ខ្ទង់ / The code has 6 digits");
    const d = await sync.pair(c);
    return { device: d.device, warehouse: d.warehouse };
  },
  async unpair() {
    const s = await me();
    if (!s.is_manager) fail("សម្រាប់អ្នកគ្រប់គ្រងហាង / Shop manager only", 403);
    if ((await idb.all("sales")).some((x) => !x.synced && x.state === "paid")) fail("មានវិក្កយបត្រមិនទាន់ផ្ញើទៅ Cloud — ភ្ជាប់អ៊ីនធឺណិតសិន / Some sales are not sent yet");
    await idb.del("kv", "config");
    await idb.clear(["sessions"]);
    return true;
  },
  async sync() {
    await me();
    await paired();
    const pushed = await sync.push();
    const unlinked = async () => {
      const c = await sync.getConfig();
      return c?.device_key ? null : c?.revoked_reason || "POS មិនទាន់ភ្ជាប់ / POS is not paired";
    };
    if (await unlinked()) fail(await unlinked(), 403);
    let pulled;
    try {
      pulled = await sync.pull();
    } catch (err) {
      if (await unlinked()) fail(await unlinked(), 403);
      throw err;
    }
    const theme = (await sync.getData())?.setting?.ui_theme || "forest";
    if (channel) channel.postMessage({ type: "shop" });
    return { pushed, pulled, ui_theme: theme };
  },

  // ---------------- login (PIN) ----------------
  async users() {
    await paired();
    const users = await idb.all("users");
    return users
      .map((u) => ({ _id: u._id, name: fullName(u), role: u.role, is_manager: !!u.is_manager }))
      .sort((a, b) => (a.is_manager === b.is_manager ? a.name.localeCompare(b.name) : a.is_manager ? 1 : -1));
  },
  async login(userId, pin) {
    await paired();
    const r = await checkPin(userId, pin);
    if (r.error) fail(r.error, r.status);
    const token = uuid();
    const s = { token, user_id: r.user._id, name: fullName(r.user), role: r.user.role, is_manager: !!r.user.is_manager, expires_at: new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString() };
    await idb.put("sessions", s);
    idb.put("events", { uuid: uuid(), action: "login", user_id: s.user_id, name: s.name, at: now(), synced: false }).then(() => sync.push()).catch(() => {});
    return { token, user: { _id: s.user_id, name: s.name, role: s.role, is_manager: s.is_manager } };
  },
  async approve(userId, pin) {
    await me();
    const r = await checkPin(userId, pin);
    if (r.error) fail(r.error, r.status === 401 ? 403 : r.status);
    if (!r.user.is_manager) fail("ត្រូវការ PIN អ្នកគ្រប់គ្រងហាង / A shop manager's PIN is needed", 403);
    return { user_id: r.user._id, name: fullName(r.user) };
  },
  async logout() {
    const token = session.token();
    const s = token ? await idb.get("sessions", token) : null;
    if (s) {
      await idb.del("sessions", token);
      idb.put("events", { uuid: uuid(), action: "logout", user_id: s.user_id, name: s.name, at: now(), synced: false }).then(() => sync.push()).catch(() => {});
    }
    return true;
  },

  // ---------------- catalog ----------------
  async catalog() {
    await me();
    const [data, products] = await Promise.all([sync.getData(), sync.productList()]);
    if (!data) fail("មិនទាន់មានទិន្នន័យ — សូមភ្ជាប់អ៊ីនធឺណិត ហើយធ្វើសមកាលកម្ម / No data yet — connect and sync", 409);
    return { ...data, products: products.map((p) => p.doc) };
  },

  // ---------------- shift ----------------
  async shift() {
    await me();
    const s = await openShift();
    return s ? { ...s, totals: await shiftTotals(s) } : null;
  },
  async openShift(b = {}) {
    const me_ = await me();
    const cfg = await paired();
    if (await openShift()) fail("មានវេនកំពុងបើករួចហើយ / A shift is already open", 409);
    const usd = Number(b.opening_usd) || 0;
    const khr = Math.round(Number(b.opening_khr) || 0);
    if (usd < 0 || khr < 0) fail("ចំនួនខុស / Wrong amount");
    const { ymd } = sync.yymm();
    const shiftNo = `${cfg.device.code}-S${ymd}-${await idb.nextSeq(`S${ymd}`)}`;
    const s = { _id: uuid(), shift_no: shiftNo, state: "open", opened_by: me_.user_id, opened_by_name: me_.name, opened_at: now(), opening_usd: r2(usd), opening_khr: khr, synced: false, updated_at: now() };
    await idb.put("shifts", s);
    sync.push().catch(() => {});
    return { ...s, totals: await shiftTotals(s) };
  },
  async closeShift(b = {}) {
    const me_ = await me();
    const s = await openShift();
    if (!s) fail("មិនមានវេនកំពុងបើក / No open shift", 404);
    const totals = await shiftTotals(s);
    const usd = r2(Number(b.counted_usd) || 0);
    const khr = Math.round(Number(b.counted_khr) || 0);
    const rate = Number((await sync.getData())?.rate?.rate) || 4100;
    const diffUsd = r2(usd - totals.expected_usd);
    const diffKhr = khr - totals.expected_khr;
    Object.assign(s, {
      state: "closed",
      closed_by: me_.user_id,
      closed_by_name: me_.name,
      closed_at: now(),
      counted_usd: usd,
      counted_khr: khr,
      note: String(b.note || "").slice(0, 300),
      report: { ...totals, counted_usd: usd, counted_khr: khr, diff_usd: diffUsd, diff_khr: diffKhr, diff_total_usd: r2(diffUsd + diffKhr / rate), rate },
      synced: false,
      updated_at: now(),
    });
    await idb.put("shifts", s);
    sync.push().catch(() => {});
    return s;
  },

  // ---------------- cash in / out ----------------
  async cashMove(b = {}) {
    const me_ = await me();
    const shift = await openShift();
    if (!shift) fail("សូមបើកវេនសិន / Open a shift first", 409);
    const type = b.type === "in" ? "in" : b.type === "out" ? "out" : null;
    if (!type) fail("in / out?");
    const kind = MOVE_KINDS[type].includes(b.kind) ? b.kind : "other";
    const amount = Number(b.amount);
    if (!(amount > 0) || amount > 1e9) fail("ចំនួនខុស / Wrong amount");
    if (!String(b.note || "").trim()) fail("សូមសរសេរមូលហេតុ / Write what it is for");
    let by = null;
    if (type === "out") {
      by = await managerOf(me_, b.approver);
      const t = await shiftTotals(shift);
      const want = b.currency === "KHR" ? Math.round(amount) : r2(amount);
      const have = b.currency === "KHR" ? t.expected_khr : t.expected_usd;
      if (want > have + 0.004) fail(`${L2("ក្នុងថតមិនគ្រប់", "Not that much in the drawer")} (${b.currency === "KHR" ? `${have}៛` : `$${have.toFixed(2)}`})`);
    }
    const move = await addCashMove(shift, me_, { type, kind, category: b.category, amount, currency: b.currency, note: b.note }, by);
    sync.push().catch(() => {});
    const fresh = await idb.get("shifts", shift._id);
    return { move, shift: { ...fresh, totals: await shiftTotals(fresh) } };
  },

  // ---------------- hold ----------------
  async holds() {
    await me();
    return (await idb.all("holds")).sort((a, b) => (a.created_date < b.created_date ? -1 : 1));
  },
  async hold(b = {}) {
    const me_ = await me();
    const items = (Array.isArray(b.items) ? b.items : [])
      .filter((i) => i && i.variant_id && Number(i.qty) > 0)
      .slice(0, 300)
      .map((i) => ({ variant_id: String(i.variant_id), unit_id: String(i.unit_id || ""), qty: Number(i.qty) }));
    if (!items.length) fail("មិនមានទំនិញក្នុងកន្ត្រក / The cart is empty");
    if ((await idb.all("holds")).length >= 50) fail("រក្សាទុកច្រើនពេក (50) — សូមលុប ឬបន្តលក់ខ្លះសិន / Too many held carts (50)");
    const { ymd } = sync.yymm();
    const no = await idb.nextSeq(`H${ymd}`);
    const discount = b.discount && Number(b.discount.value) > 0 ? { type: b.discount.type === "percent" ? "percent" : "amount", value: Number(b.discount.value) } : null;
    const customer = b.customer_id ? await findCustomer(b.customer_id) : null;
    let shift = null;
    const dep = b.deposit && Number(b.deposit.amount) > 0 ? { amount: Number(b.deposit.amount), currency: b.deposit.currency === "KHR" ? "KHR" : "USD" } : null;
    if (dep) {
      shift = await openShift();
      if (!shift) fail("សូមបើកវេនសិន / Open a shift first", 409);
      if (!customer && !String(b.label || "").trim()) fail("កក់ប្រាក់: សូមជ្រើសអតិថិជន ឬសរសេរឈ្មោះ / Deposit: choose the customer or write a name");
    }
    const h = { _id: uuid(), hold_no: no, label: String(b.label || customer?.name || "").trim().slice(0, 60), items, discount, note: String(b.note || "").slice(0, 200), total: r2(Number(b.total) || 0), user_id: me_.user_id, user_name: me_.name, created_date: now(), customer_id: customer?._id || null, customer_uuid: customer?.uuid || null, customer_name: customer?.name || "", customer_phone: customer?.phone || "", deposit_usd: 0, deposits: [] };
    await idb.put("holds", h);
    if (dep) await takeDeposit(h, shift, me_, dep.amount, dep.currency);
    return idb.get("holds", h._id);
  },
  async holdDeposit(id, b = {}) {
    const me_ = await me();
    const h = await idb.get("holds", String(id));
    if (!h) fail("រកមិនឃើញ / Held cart not found", 404);
    const shift = await openShift();
    if (!shift) fail("សូមបើកវេនសិន / Open a shift first", 409);
    if (!(Number(b.amount) > 0)) fail("ចំនួនខុស / Wrong amount");
    await takeDeposit(h, shift, me_, Number(b.amount), b.currency === "KHR" ? "KHR" : "USD");
    return idb.get("holds", h._id);
  },
  // resume: a plain hold leaves the list; a layaway (deposit paid) stays until its sale is done
  async resumeHold(id) {
    await me();
    const h = await idb.get("holds", String(id));
    if (!h) fail("រកមិនឃើញ / Held cart not found", 404);
    if (!(h.deposit_usd > 0)) await idb.del("holds", h._id);
    const c = h.customer_id ? (await findCustomer(h.customer_id)) || (h.customer_uuid ? await findCustomer(`u:${h.customer_uuid}`) : null) : null;
    return { ...h, customer: c ? await customerView(c) : null };
  },
  // delete: a layaway gives the deposit back from the drawer (manager) — { approver, give_back }
  async unhold(id, b = {}) {
    const me_ = await me();
    const h = await idb.get("holds", String(id));
    if (!h) fail("រកមិនឃើញ / Held cart not found", 404);
    if (h.deposit_usd > 0) {
      const by = await managerOf(me_, b?.approver);
      const shift = await openShift();
      if (!shift) fail("សូមបើកវេនសិន / Open a shift first", 409);
      if (b?.give_back !== false) {
        const byCur = {};
        (h.deposits || []).forEach((d) => (byCur[d.currency] = (byCur[d.currency] || 0) + d.amount));
        for (const [currency, amount] of Object.entries(byCur)) {
          await addCashMove(shift, me_, { type: "out", kind: "deposit_back", amount, currency, note: `${L2("សងប្រាក់កក់", "Deposit back")} #${h.hold_no} ${h.label || ""}`.trim(), ref: h._id }, by);
        }
      } else {
        await addCashMove(shift, me_, { type: "in", kind: "deposit_kept", amount: 0, currency: "USD", note: `${L2("ហាងទុកប្រាក់កក់", "Deposit kept")} #${h.hold_no} ($${h.deposit_usd.toFixed(2)})`, ref: h._id }, by);
      }
      sync.push().catch(() => {});
    }
    await idb.del("holds", h._id);
    return h;
  },

  // ---------------- sell ----------------
  // ---------------- customers ----------------
  async customers(q = "") {
    await me();
    const t = String(q || "").trim();
    const digits = t.replace(/\D/g, "");
    const all = await idb.all("customers");
    let rows = [];
    if (digits.length >= 3 && digits.length === t.replace(/[\s+-]/g, "").length) {
      const d = digits.replace(/^855/, "0");
      rows = all.filter((c) => String(c.phone || "").includes(d));
    } else if (t.length >= 2) {
      const low = t.toLowerCase();
      rows = all.filter((c) => (c.text || `${c.name} ${c.code} ${c.kid_name}`.toLowerCase()).includes(low));
    }
    rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return Promise.all(rows.slice(0, 20).map(customerView));
  },
  async customer(id) {
    await me();
    const c = await findCustomer(id);
    if (!c) fail("រកមិនឃើញអតិថិជន / Customer not found", 404);
    return customerView(c);
  },
  // Bakong KHQR: ask the cloud (it holds the Bakong token) whether this QR is paid
  async khqrCheck(md5) {
    await me();
    const cfg = await sync.getConfig();
    if (!cfg?.device_key) return { ready: false, paid: false };
    try {
      return await sync.cloud("POST", "/pos-device/khqr/check", { key: cfg.device_key, body: { md5 } });
    } catch (e) {
      return { ready: true, paid: false, offline: !!e.offline, error: e.message };
    }
  },
  async addCustomer(b = {}) {
    await me();
    await paired();
    const name = String(b.name || "").trim().slice(0, 80);
    const phone = phoneOf(b.phone);
    if (!name) fail("សូមបញ្ចូលឈ្មោះ / Name is required");
    if (!phone) fail("លេខទូរស័ព្ទមិនត្រឹមត្រូវ / Wrong phone number");
    const kidBirthday = String(b.kid_birthday || "").slice(0, 10);
    if (kidBirthday && !/^\d{4}-\d{2}-\d{2}$/.test(kidBirthday)) fail("ថ្ងៃកំណើតខុស / Wrong birthday");
    const same = (await idb.all("customers")).find((c) => c.phone === phone);
    if (same) fail(`លេខនេះជាអតិថិជនរួចហើយ: ${same.name} / Already a customer: ${same.name}`, 409, { data: await customerView(same) });
    const id = uuid();
    const kid = String(b.kid_name || "").trim().slice(0, 80);
    const c = { _id: `u:${id}`, uuid: id, cloud_id: null, code: "", name, phone, kid_name: kid, kid_birthday: kidBirthday, kid_gender: ["boy", "girl"].includes(b.kid_gender) ? b.kid_gender : "", points: 0, text: [name, kid].join(" ").toLowerCase(), synced: false };
    await idb.put("customers", c);
    sync.push().catch(() => {});
    return customerView(c);
  },

  async sell(b = {}) {
    const me_ = await me();
    const cfg = await paired();
    const shift = await openShift();
    if (!shift) fail("សូមបើកវេនសិន / Open a shift first", 409);
    const data = await sync.getData();
    if (!data) fail("មិនទាន់មានទិន្នន័យ / No data — sync first", 409);
    const items = Array.isArray(b.items) ? b.items : [];
    if (!items.length || items.length > 300) fail("មិនមានទំនិញក្នុងកន្ត្រក / The cart is empty");
    const cart = [];
    for (const i of items) {
      const p = (await sync.productOfVariant(i.variant_id))?.doc;
      if (!p) fail("រកមិនឃើញទំនិញ — សូមធ្វើសមកាលកម្ម / Item not found — sync");
      const v = p.variants.find((x) => String(x._id) === String(i.variant_id));
      const unit = p.units.find((u) => String(u._id) === String(i.unit_id)) || p.units[0];
      cart.push({ product: p, variant: v, unit, qty: Number(i.qty) });
    }
    // more than the shop stock: a manager may; a cashier needs a manager's PIN
    const need = new Map();
    cart.forEach((c) => {
      if (c.product.track_stock === false) return;
      const k = String(c.variant._id);
      need.set(k, (need.get(k) || 0) + Number(c.qty) * (c.unit.factor || 1));
    });
    const over = [];
    cart.forEach((c) => {
      const k = String(c.variant._id);
      if (!need.has(k) || over.some((o) => o.variant_id === k)) return;
      const stock = Number(c.variant.stock) || 0;
      if (need.get(k) > stock + 1e-9) over.push({ variant_id: k, sku: c.variant.code, name_kh: c.variant.name_kh, name_en: c.variant.name_en, stock, qty: need.get(k) });
    });
    let stockBy = null;
    if (over.length) {
      if (me_.is_manager) stockBy = { _id: me_.user_id, name: me_.name };
      else {
        try {
          stockBy = await managerApproval(b.stock_approver);
        } catch (e) {
          e.code = "STOCK_APPROVAL";
          e.items = over;
          if (e.message.includes("PIN អ្នកគ្រប់គ្រង") && !b.stock_approver) e.message = "ទំនិញអស់ស្តុក — ត្រូវការ PIN អ្នកគ្រប់គ្រងហាង / Out of stock — a shop manager's PIN is needed";
          throw e;
        }
      }
    }
    // discount: a manager may; a cashier needs a manager's PIN
    const discount = b.discount && Number(b.discount.value) > 0 ? { type: b.discount.type === "percent" ? "percent" : "amount", value: Number(b.discount.value) } : null;
    let discountBy = null;
    if (discount) discountBy = me_.is_manager ? { _id: me_.user_id, name: me_.name } : await managerApproval(b.approver);

    // customer (loyalty)
    let customer = null;
    if (b.customer_id) {
      customer = await findCustomer(b.customer_id);
      if (!customer) fail("រកមិនឃើញអតិថិជន / Customer not found", 404);
    }
    const loyalty = loyaltyOf(data);
    const balance = customer ? (customer.points || 0) + (await pendingPoints(customer._id)) : 0;

    const totals = priceCart(cart, { discount, setting: data.setting, rate: data.rate, promotions: data.promotions || [], promo: { warehouse_id: data.warehouse?._id, has_customer: !!customer, categories: data.categories } });
    if (totals.error) fail(totals.error);
    const methods = new Map((data.payment_methods || []).map((m) => [String(m._id), m]));
    const pays = [];
    const redeem = Math.max(0, Math.trunc(Number(b.redeem_points) || 0));
    let redeemUsd = 0;
    if (redeem) {
      if (!customer) fail("សូមជ្រើសអតិថិជន / Choose the customer");
      if (!loyalty.enabled) fail("ពិន្ទុត្រូវបានបិទ / Points are off");
      if (redeem < loyalty.min_redeem_points) fail(`${L2("ប្រើយ៉ាងតិច", "use at least")} ${loyalty.min_redeem_points} ${L2("ពិន្ទុ", "points")}`);
      if (redeem > balance) fail(`${L2("ពិន្ទុមិនគ្រប់", "Not enough points")} (${balance})`);
      redeemUsd = r2(redeem * loyalty.point_value_usd);
      if (redeemUsd > totals.total + 0.005) fail(L2("ពិន្ទុលើសតម្លៃវិក្កយបត្រ", "More points than the bill"));
      pays.push({ method: POINTS_METHOD, amount: redeemUsd, reference: `${redeem} pts` });
    }
    // layaway deposit / exchange credit = money already in the shop (not cash today)
    let hold = null;
    if (b.hold_id) {
      hold = await idb.get("holds", String(b.hold_id));
      if (!hold) fail("រកមិនឃើញការកក់ / Layaway not found", 404);
      if (hold.deposit_usd > 0) pays.push({ method: DEPOSIT_METHOD, amount: hold.deposit_usd, reference: `#${hold.hold_no}` });
    }
    let credit = null;
    if (b.exchange_refund_id) {
      credit = (await idb.get("refunds", String(b.exchange_refund_id))) || (await idb.all("refunds")).find((x) => x.refund_no === String(b.exchange_refund_id)) || null;
      if (!credit || !credit.exchange) fail("រកមិនឃើញការប្តូរ / Exchange not found", 404);
      if (credit.exchange_used) fail(`${L2("បានប្រើរួច", "Already used")}: ${credit.exchange_used}`, 409);
      if (credit.total > 0) pays.push({ method: EXCHANGE_METHOD, amount: credit.total, reference: credit.refund_no });
    }
    for (const p of Array.isArray(b.payments) ? b.payments : []) {
      const m = methods.get(String(p.method_id));
      if (!m) fail("វិធីបង់ប្រាក់មិនត្រឹមត្រូវ / Unknown payment method");
      pays.push({ method: m, amount: p.amount, reference: p.reference });
    }
    const paid = settle(totals, pays, data.setting);
    if (paid.error) fail(paid.error);
    const earned = customer && loyalty.enabled ? Math.floor(Math.max(0, totals.total - redeemUsd) * loyalty.points_per_usd + 1e-9) : 0;

    const { ym } = sync.yymm();
    const invoiceNo = `${cfg.device.code}-${ym}-${String(await idb.nextSeq(`INV${ym}`)).padStart(5, "0")}`;
    const sale = {
      uuid: uuid(),
      invoice_no: invoiceNo,
      shift_id: shift._id,
      shift_no: shift.shift_no,
      cashier_id: me_.user_id,
      cashier_name: me_.name,
      discount_by: discountBy?._id || null,
      discount_by_name: discountBy?.name || "",
      stock_override_by: stockBy?._id || null,
      stock_override_by_name: stockBy?.name || "",
      stock_override_items: over,
      sold_at: now(),
      items: totals.lines,
      subtotal: totals.subtotal,
      discount_type: discount?.type || null,
      discount_value: discount?.value || 0,
      discount_total: totals.discount_total,
      promo_total: totals.promo_total || 0,
      promotions: totals.promotions || [],
      customer_id: customer?.cloud_id || null,
      customer_uuid: customer?.uuid || null,
      customer_local: customer?._id || null,
      customer_name: customer?.name || "",
      customer_phone: customer?.phone || "",
      points_earned: earned,
      points_redeemed: redeem,
      points_balance: customer ? balance - redeem + earned : null,
      tax_mode: totals.tax_mode,
      tax_rate: totals.tax_rate,
      tax_name: data.setting?.tax_name || "VAT",
      tax_amount: totals.tax_amount,
      total: totals.total,
      rate: totals.rate,
      total_khr: totals.total_khr,
      payments: paid.payments,
      paid_usd: paid.paid_usd,
      change_usd: paid.change_usd,
      change_khr: paid.change_khr,
      change_give_usd: paid.change_give_usd,
      change_give_khr: paid.change_give_khr,
      note: String(b.note || "").slice(0, 300),
      layaway_no: hold ? String(hold.hold_no) : "",
      exchange_refund_no: credit?.refund_no || "",
      state: "paid",
      refunded_total: 0,
      refund_status: "",
      synced: false,
      sync_error: "",
    };
    await idb.put("sales", sale); // ← saved here first: the receipt never waits for the internet
    if (hold) await idb.del("holds", hold._id);
    if (credit) await idb.update("refunds", credit.uuid, (cur) => (cur && !cur.exchange_used ? { ...cur, exchange_used: invoiceNo } : undefined));
    for (const l of totals.lines) await sync.addStock(l.variant_id, -l.base_qty);
    sync.push().catch(() => {});
    return sale;
  },

  async sales(params = {}) {
    await me();
    let list = await idb.all("sales");
    if (params.shift_id) list = list.filter((s) => s.shift_id === String(params.shift_id));
    if (params.q) list = list.filter((s) => s.invoice_no.toLowerCase().includes(String(params.q).toLowerCase()));
    if (params.pending === "true") list = list.filter((s) => !s.synced && s.state === "paid");
    if (params.problem === "true") list = list.filter((s) => !s.synced && s.state === "paid" && s.sync_error);
    list.sort((a, b) => (a.sold_at < b.sold_at ? 1 : -1));
    return list.slice(0, Math.min(Number(params.limit) || 50, 200));
  },
  async receipt(id) {
    await me();
    const [s, data] = await Promise.all([findSale(id), sync.getData()]);
    if (!s) fail("រកមិនឃើញវិក្កយបត្រ / Invoice not found", 404);
    return { sale: s, setting: data?.setting || {}, warehouse: data?.warehouse || {}, device: data?.device || {} };
  },
  async retrySale(id) {
    await me();
    await paired();
    const s = await findSale(id);
    if (!s) fail("រកមិនឃើញវិក្កយបត្រ / Invoice not found", 404);
    if (s.synced) return s;
    await idb.put("sales", { ...s, sync_error: "" });
    await sync.push().catch(() => {});
    const after = await idb.get("sales", s.uuid);
    if (after.synced) return after;
    fail(after.sync_error || "មិនទាន់អាចផ្ញើបាន / Could not send yet", 409);
  },
  async discardSale(id, b = {}) {
    const me_ = await me();
    const s = await findSale(id);
    if (!s) fail("រកមិនឃើញវិក្កយបត្រ / Invoice not found", 404);
    if (s.synced) fail("វិក្កយបត្រនេះបានផ្ញើទៅ Cloud រួចហើយ / Already in the cloud — cannot remove here", 409);
    if (s.state !== "paid") fail("បានដកចេញរួចហើយ / Already removed", 409);
    const reason = String(b.reason || "").trim().slice(0, 200);
    if (!reason) fail("សូមសរសេរមូលហេតុ / Write the reason");
    const by = me_.is_manager ? { _id: me_.user_id, name: me_.name } : await managerApproval(b.approver);
    const out = { ...s, state: "discarded", discarded_at: now(), discarded_by: by._id, discarded_by_name: by.name, discard_reason: reason };
    await idb.put("sales", out);
    return out;
  },

  // ---------------- refund / void ----------------
  async refundSale(id, b = {}) {
    const me_ = await me();
    const cfg = await paired();
    const s = await findSale(id);
    if (!s) fail("រកមិនឃើញវិក្កយបត្រ / Invoice not found", 404);
    if (s.state !== "paid") fail("វិក្កយបត្រនេះត្រូវបានដកចេញ / This invoice was removed", 409);
    const shift = await openShift();
    if (!shift) fail("សូមបើកវេនសិន (លុយសងចេញពីថតលុយ) / Open a shift first (the money comes from the drawer)", 409);
    const reason = String(b.reason || "").trim().slice(0, 200);
    if (!reason) fail("សូមសរសេរមូលហេតុ / Write the reason");
    const items = s.items.map((i) => ({ ...i }));
    const want = new Map();
    if (b.all) items.forEach((i, k) => want.set(k, r4(i.qty - (i.refunded_qty || 0))));
    else (Array.isArray(b.lines) ? b.lines : []).forEach((l) => want.set(Number(l.index), r4((want.get(Number(l.index)) || 0) + Number(l.qty))));
    const lines = [];
    for (const [k, q] of want) {
      const i = items[k];
      if (!i) fail("បន្ទាត់ទំនិញខុស / Wrong line");
      if (!(q > 0)) continue;
      const left = r4(i.qty - (i.refunded_qty || 0));
      if (q > left + 1e-9) fail(`${i.sku}: ${L2("សងបានតែ", "can refund only")} ${left}`);
      lines.push({ k, i, q });
    }
    if (!lines.length) fail("សូមជ្រើសទំនិញដែលត្រូវសង / Choose what to refund");
    const by = me_.is_manager ? { _id: me_.user_id, name: me_.name } : await managerApproval(b.approver);

    const sumLines = s.items.reduce((t, i) => t + (i.line_total || 0), 0);
    const factor = sumLines > 0 ? s.total / sumLines : 1;
    const out = lines.map(({ k, i, q }) => ({
      index: k,
      variant_id: i.variant_id,
      product_id: i.product_id,
      unit_id: i.unit_id,
      sku: i.sku,
      name_kh: i.name_kh,
      name_en: i.name_en,
      unit_code: i.unit_code,
      unit_name_kh: i.unit_name_kh,
      unit_name_en: i.unit_name_en,
      factor: i.factor || 1,
      qty: q,
      base_qty: r4((i.base_qty / i.qty) * q),
      price: i.price,
      amount: r2(((i.line_total || 0) / i.qty) * q * factor),
    }));
    const fullLeft = s.items.reduce((t, i) => t + r2(((i.line_total || 0) / i.qty) * r4(i.qty - (i.refunded_qty || 0)) * factor), 0);
    let total = r2(out.reduce((t, l) => t + l.amount, 0));
    const everything = lines.length === s.items.filter((i) => i.qty - (i.refunded_qty || 0) > 1e-9).length && lines.every(({ i, q }) => Math.abs(q - (i.qty - (i.refunded_qty || 0))) < 1e-9);
    if (everything) total = r2(Math.min(s.total - (s.refunded_total || 0), Math.max(total, fullLeft)));
    // part paid with points goes back as points (not money); points earned on what goes back are taken back
    const value = total;
    let pointsBack = 0;
    let pointsBackUsd = 0;
    let pointsDelta = 0;
    if (s.customer_local || s.customer_id) {
      const pointsUsd = (s.payments || []).filter((p) => p.code === "points").reduce((t, p) => t + (p.amount_usd || 0), 0);
      if (pointsUsd > 0 && s.total > 0) {
        pointsBackUsd = r2(Math.min(value, (value * pointsUsd) / s.total));
        pointsBack = Math.round(((s.points_redeemed || 0) * value) / s.total);
        total = r2(value - pointsBackUsd);
      }
      pointsDelta = pointsBack - Math.round(((s.points_earned || 0) * value) / (s.total || 1));
    }
    const data = await sync.getData();
    const methods = data?.payment_methods || [];
    const m = b.exchange ? EXCHANGE_METHOD : methods.find((x) => String(x._id) === String(b.method_id)) || methods.find((x) => x.type === "cash" && x.currency !== "KHR") || methods[0];
    if (!m) fail("គ្មានវិធីបង់ប្រាក់ / No payment method");
    const rate = s.rate || Number(data?.rate?.rate) || 4100;
    const step = Number(data?.setting?.khr_rounding) || 100;
    const khrAmount = roundKhr(total * rate, step);
    const payment = { method_id: m._id, code: m.code, name_kh: m.name_kh, name_en: m.name_en, type: m.type, currency: m.currency === "KHR" ? "KHR" : "USD", amount: m.currency === "KHR" ? khrAmount : total, amount_usd: total, reference: b.exchange ? L2("ប្រើទិញទំនិញថ្មី", "for new items") : "" };
    const { ym } = sync.yymm();
    const refundNo = `${cfg.device.code}-R${ym}-${String(await idb.nextSeq(`R${ym}`)).padStart(5, "0")}`;
    const refund = {
      uuid: uuid(),
      refund_no: refundNo,
      kind: everything && !(s.refunded_total > 0) ? "void" : "refund",
      sale_uuid: s.uuid,
      invoice_no: s.invoice_no,
      shift_id: shift._id,
      shift_no: shift.shift_no,
      cashier_id: me_.user_id,
      cashier_name: me_.name,
      approved_by: by._id,
      approved_by_name: by.name,
      refunded_at: now(),
      reason,
      items: out,
      total,
      rate,
      total_khr: khrAmount,
      payments: total > 0 ? [payment] : [],
      points_back: pointsBack,
      points_back_usd: pointsBackUsd,
      customer_local: s.customer_local || null,
      points_delta: pointsDelta,
      exchange: !!b.exchange,
      exchange_used: "",
      synced: false,
      sync_error: "",
    };
    await idb.put("refunds", refund);
    lines.forEach(({ k, q }) => {
      items[k].refunded_qty = r4((items[k].refunded_qty || 0) + q);
    });
    const sale = { ...s, items, refunded_total: r2((s.refunded_total || 0) + value), refund_status: items.every((i) => i.qty - (i.refunded_qty || 0) < 1e-9) ? "full" : "partial" };
    await idb.put("sales", sale);
    for (const l of out) await sync.addStock(l.variant_id, l.base_qty);
    sync.push().catch(() => {});
    return { refund, sale };
  },

  // exchange not finished: the credit is paid out of the drawer
  async exchangeCash(id) {
    const me_ = await me();
    const rf = (await idb.get("refunds", String(id))) || (await idb.all("refunds")).find((x) => x.refund_no === String(id));
    if (!rf || !rf.exchange) fail("រកមិនឃើញការប្តូរ / Exchange not found", 404);
    if (rf.exchange_used) fail(`${L2("បានប្រើរួច", "Already used")}: ${rf.exchange_used}`, 409);
    const shift = await openShift();
    if (!shift) fail("សូមបើកវេនសិន / Open a shift first", 409);
    await idb.update("refunds", rf.uuid, (cur) => (cur ? { ...cur, exchange_used: "cash" } : undefined));
    const move = await addCashMove(shift, me_, { type: "out", kind: "exchange_cash", amount: rf.total, currency: "USD", note: `${L2("សងប្រាក់ (មិនប្តូរ)", "Exchange paid in cash")} ${rf.refund_no}`, ref: rf.refund_no });
    sync.push().catch(() => {});
    return move;
  },
  async openExchanges() {
    await me();
    return (await idb.all("refunds")).filter((r) => r.exchange && !r.exchange_used).sort((a, b) => (a.refunded_at < b.refunded_at ? 1 : -1)).slice(0, 20);
  },

  // ---------------- report (one day) ----------------
  async report(params = {}) {
    const me_ = await me();
    const PP = 7 * 3600 * 1000;
    const DAY = 86400000;
    const ymdPP = (d) => new Date(new Date(d).getTime() + PP).toISOString().slice(0, 10);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(params.date || "")) ? String(params.date) : ymdPP(Date.now());
    const from = new Date(`${date}T00:00:00+07:00`).getTime();
    const to = from + DAY;
    const userId = me_.is_manager ? String(params.user_id || "") : String(me_.user_id);
    const [all, allRefunds, shiftsAll] = await Promise.all([idb.all("sales"), idb.all("refunds"), idb.all("shifts")]);
    const inRange = (d, a, z) => {
      const t = new Date(d).getTime();
      return t >= a && t < z;
    };
    const sales = all.filter((s) => s.state === "paid" && (!userId || s.cashier_id === userId) && inRange(s.sold_at, from, to)).sort((a, b) => (a.sold_at < b.sold_at ? -1 : 1));
    const week = all.filter((s) => s.state === "paid" && (!userId || s.cashier_id === userId) && inRange(s.sold_at, from - 6 * DAY, to));
    const refunds = allRefunds.filter((r) => (!userId || r.cashier_id === userId) && inRange(r.refunded_at, from, to));
    const methods = {};
    const itemsMap = {};
    const hours = {};
    const shifts = {};
    const cashiers = {};
    for (const s of sales) {
      let change = s.change_usd || 0;
      for (const p of s.payments || []) {
        const k = p.code || p.method_id;
        if (!methods[k]) methods[k] = { code: k, name_kh: p.name_kh, name_en: p.name_en, type: p.type, currency: p.currency, count: 0, amount_usd: 0 };
        let usd = p.amount_usd || 0;
        if (p.type === "cash" && change > 0) {
          const take = Math.min(change, usd);
          usd -= take;
          change -= take;
        }
        methods[k].count += 1;
        methods[k].amount_usd += usd;
      }
      for (const i of s.items || []) {
        const k = `${i.variant_id}:${i.unit_id}`;
        if (!itemsMap[k]) itemsMap[k] = { sku: i.sku, name_kh: i.name_kh, name_en: i.name_en, unit_name_kh: i.unit_name_kh, unit_name_en: i.unit_name_en, qty: 0, total: 0 };
        itemsMap[k].qty += i.qty;
        itemsMap[k].total += i.line_total ?? i.qty * i.price;
      }
      const h = new Date(new Date(s.sold_at).getTime() + PP).getUTCHours();
      if (!hours[h]) hours[h] = { hour: h, count: 0, total: 0 };
      hours[h].count += 1;
      hours[h].total += s.total;
      if (!shifts[s.shift_id]) shifts[s.shift_id] = { _id: s.shift_id, shift_no: s.shift_no, count: 0, total: 0 };
      shifts[s.shift_id].count += 1;
      shifts[s.shift_id].total += s.total;
      if (!cashiers[s.cashier_id]) cashiers[s.cashier_id] = { _id: s.cashier_id, name: s.cashier_name, count: 0, total: 0 };
      cashiers[s.cashier_id].count += 1;
      cashiers[s.cashier_id].total += s.total;
    }
    const shiftInfo = new Map(shiftsAll.map((x) => [x._id, x]));
    const days = Array.from({ length: 7 }, (_, k) => ({ date: ymdPP(from - (6 - k) * DAY), count: 0, total: 0 }));
    week.forEach((s) => {
      const d = days.find((x) => x.date === ymdPP(s.sold_at));
      if (d) {
        d.count += 1;
        d.total += s.total;
      }
    });
    const sum = (f) => r2(sales.reduce((t, s) => t + (f(s) || 0), 0));
    const salesTotal = sum((s) => s.total);
    const refundTotal = r2(refunds.reduce((t, r) => t + r.total, 0));
    const fix = (o) => ({ ...o, total: r2(o.total) });
    return {
      date,
      scope: me_.is_manager ? (userId ? "user" : "all") : "own",
      user_id: userId || null,
      invoice_count: sales.length,
      sales_total: salesTotal,
      sales_total_khr: Math.round(sales.reduce((t, s) => t + (s.total_khr || 0), 0)),
      subtotal: sum((s) => s.subtotal),
      discount_total: sum((s) => s.discount_total),
      discount_count: sales.filter((s) => s.discount_total > 0).length,
      tax_total: sum((s) => s.tax_amount),
      items_qty: r2(sales.reduce((t, s) => t + (s.items || []).reduce((a, i) => a + i.qty, 0), 0)),
      average: sales.length ? r2(salesTotal / sales.length) : 0,
      refund_count: refunds.length,
      refund_total: refundTotal,
      net_total: r2(salesTotal - refundTotal),
      first_at: sales[0]?.sold_at || null,
      last_at: sales[sales.length - 1]?.sold_at || null,
      methods: Object.values(methods).map((m) => ({ ...m, amount_usd: r2(m.amount_usd) })).sort((a, b) => b.amount_usd - a.amount_usd),
      hours: Object.values(hours).map(fix).sort((a, b) => a.hour - b.hour),
      top_items: Object.values(itemsMap).map((i) => ({ ...fix(i), qty: r2(i.qty) })).sort((a, b) => b.total - a.total).slice(0, 10),
      shifts: Object.values(shifts).map((x) => {
        const info = shiftInfo.get(x._id) || {};
        return { ...fix(x), opened_at: info.opened_at, closed_at: info.closed_at, state: info.state, opened_by_name: info.opened_by_name, closed_by_name: info.closed_by_name };
      }),
      cashiers: me_.is_manager && !userId ? Object.values(cashiers).map(fix).sort((a, b) => b.total - a.total) : [],
      days: days.map(fix),
    };
  },

  // ---------------- customer display ----------------
  async display(mode, data) {
    await me();
    lastDisplay = { mode: ["idle", "cart", "pay", "done"].includes(mode) ? mode : "idle", at: Date.now(), data: data && typeof data === "object" ? data : {} };
    try {
      localStorage.setItem("cloud_pos_display", JSON.stringify(lastDisplay)); // a display opened later sees it
    } catch {
      // ignore
    }
    post(lastDisplay);
    return { screens: Date.now() - displaySeen < 30000 ? 1 : 0 };
  },
};

// errors from the engine look like the server's (status 401 → logged out, handled in me())
export { sync };
