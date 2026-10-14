// Browser POS ↔ cloud API (/pos-device/*), same protocol as local_pos_api/src/sync.js.
// The page never waits for this: sales are saved in IndexedDB first, then pushed in the background.
import * as idb from "./db";

const API_HOST = (process.env.REACT_APP_API_HOST || "http://localhost:8086").replace(/\/$/, "");
const API_KEY = process.env.REACT_APP_API_AUTH_KEY || "";
export const CLOUD_URL = API_HOST;
const APP_VERSION = "cloud-1.0.0";
const PUSH_EVERY_MS = 15000;
const PULL_EVERY_MS = 5 * 60 * 1000;
const PING_EVERY_MS = 20000;
const TIMEOUT_MS = 20000;

export const state = { online: navigator.onLine ? null : false };
const listeners = new Set();
export const onChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const changed = () => listeners.forEach((fn) => fn());

// one pull and one push at a time in this tab
const queue = { pull: Promise.resolve(), push: Promise.resolve() };
const serial = (name, fn) => {
  const next = queue[name].catch(() => {}).then(fn);
  queue[name] = next;
  return next;
};
// …and in only one tab of this browser (two tabs of the same POS must not push twice at once)
const oneTab = (name, fn) => (navigator.locks ? navigator.locks.request(`cloud_pos_${name}`, fn) : fn());

export const getConfig = () => idb.get("kv", "config").then((r) => r?.value || null);
export const setConfig = (patch) => idb.update("kv", "config", (cur) => ({ key: "config", value: { ...(cur?.value || {}), ...patch } }));
export const getData = () => idb.get("kv", "data").then((r) => r?.value || null);

export async function cloud(method, path, { body, key } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_HOST}/api/admin${path}`, {
      method,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY, "x-app-version": APP_VERSION, ...(key ? { "x-device-key": key } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (state.online !== true) {
      state.online = true;
      changed();
    }
    setConfig({ last_online_at: new Date().toISOString() }).catch(() => {});
    if (!res.ok || json.success === false) {
      const err = new Error(json.message || `Cloud error ${res.status}`);
      err.status = res.status;
      err.code = json.code;
      if (key && (res.status === 401 || res.status === 403)) {
        if (json.code === "DEVICE_UNPAIRED" || json.code === "DEVICE_OFF") await revoke(err.message);
        else await setConfig({ last_error: err.message });
      }
      throw err;
    }
    return json.data;
  } catch (err) {
    if (err.name === "AbortError" || err instanceof TypeError) {
      if (state.online !== false) {
        state.online = false;
        changed();
      }
      const e = new Error(`មិនអាចភ្ជាប់ Cloud / No connection to the cloud (${err.name === "AbortError" ? "timeout" : "offline"})`);
      e.offline = true;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(t);
  }
}

// the admin unlinked this POS (deleted / turned off / new code) → forget the shop's data; unsent sales stay
export async function revoke(reason) {
  const cfg = await getConfig();
  if (!cfg?.device_key) return;
  await setConfig({ device_key: null, last_error: reason, revoked_at: new Date().toISOString(), revoked_reason: reason });
  await idb.clear(["products", "users", "sessions", "holds"]);
  await idb.del("kv", "data");
  invalidate();
  changed();
}

// ---------------- products in memory (fast lookups while selling) ----------------
let products = null;
export const invalidate = () => {
  products = null;
};
export async function productList() {
  if (!products) products = (await idb.all("products")).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  return products;
}
export async function productOfVariant(variantId) {
  const list = await productList();
  return list.find((p) => p.doc.variants.some((v) => String(v._id) === String(variantId))) || null;
}
// shop stock on this screen: + / − base qty of one variant
export async function addStock(variantId, delta) {
  const p = await productOfVariant(variantId);
  if (!p) return;
  const v = p.doc.variants.find((x) => String(x._id) === String(variantId));
  v.stock = Math.round(((v.stock || 0) + delta) * 10000) / 10000;
  await idb.put("products", p);
}

// ---------------- pair / pull ----------------
export async function pair(code) {
  const data = await cloud("POST", "/pos-device/pair", { body: { code, app_version: APP_VERSION } });
  await setConfig({ cloud_url: API_HOST, device_key: data.device_key, device: data.device, warehouse: data.warehouse, paired_at: new Date().toISOString(), last_error: "", revoked_at: null, revoked_reason: "" });
  await pull();
  return data;
}

const ymParts = (d = new Date()) => {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Phnom_Penh", year: "2-digit", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const g = (t) => p.find((x) => x.type === t).value;
  return { ym: `${g("year")}${g("month")}`, ymd: `${g("year")}${g("month")}${g("day")}` };
};
export const yymm = ymParts;

export const pull = () => serial("pull", () => oneTab("pull", doPull));
async function doPull() {
  const cfg = await getConfig();
  if (!cfg?.device_key) throw new Error("POS មិនទាន់ភ្ជាប់ / POS is not paired");
  const d = await cloud("GET", "/pos-device/pull", { key: cfg.device_key });
  // what is still waiting to be pushed is already counted here
  const [sales, refunds] = await Promise.all([idb.all("sales"), idb.all("refunds")]);
  const waiting = new Map();
  sales.filter((s) => !s.synced && s.state === "paid").forEach((s) => s.items.forEach((i) => waiting.set(String(i.variant_id), (waiting.get(String(i.variant_id)) || 0) + i.base_qty)));
  refunds.filter((r) => !r.synced).forEach((r) => r.items.forEach((i) => waiting.set(String(i.variant_id), (waiting.get(String(i.variant_id)) || 0) - i.base_qty)));
  const rows = d.products.map((p, i) => {
    p.variants.forEach((v) => {
      v.stock = Math.round(((v.stock || 0) - (waiting.get(String(v._id)) || 0)) * 10000) / 10000;
    });
    return { _id: String(p._id), doc: p, sort: i };
  });
  await idb.putMany("products", rows, { replace: true });
  await idb.putMany("users", d.users.map((u) => ({ ...u, _id: String(u._id) })), { replace: true });
  const { products: _p, users: _u, ...rest } = d;
  await idb.put("kv", { key: "data", value: { ...rest, pulled_at: new Date().toISOString() } });
  await setConfig({ last_pull_at: new Date().toISOString(), device: d.device, warehouse: d.warehouse, last_error: "" });
  // numbers already used by this POS in the cloud (storage cleared, other browser …) → continue after them
  const code = d.device?.code || "";
  const num = (s, re) => {
    const m = String(s || "").match(re);
    return m ? m : null;
  };
  const esc = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const inv = num(d.device?.last_invoice_no, new RegExp(`^${esc}-(\\d{4})-(\\d+)$`));
  if (inv) await idb.atLeast(`INV${inv[1]}`, Number(inv[2]));
  const rf = num(d.device?.last_refund_no, new RegExp(`^${esc}-R(\\d{4})-(\\d+)$`));
  if (rf) await idb.atLeast(`R${rf[1]}`, Number(rf[2]));
  const sh = num(d.device?.last_shift_no, new RegExp(`^${esc}-S(\\d{6})-(\\d+)$`));
  if (sh) await idb.atLeast(`S${sh[1]}`, Number(sh[2]));
  invalidate();
  changed();
  return { products: rows.length, users: d.users.length };
}

// ---------------- push ----------------
const saleForCloud = ({ synced, synced_at, sync_error, discarded_at, discarded_by, discarded_by_name, discard_reason, ...s }) => s;
const shiftForCloud = (s) => ({
  shift_no: s.shift_no,
  state: s.state,
  opened_by: s.opened_by,
  opened_by_name: s.opened_by_name,
  opened_at: s.opened_at,
  opening_usd: s.opening_usd,
  opening_khr: s.opening_khr,
  closed_by: s.closed_by,
  closed_by_name: s.closed_by_name,
  closed_at: s.closed_at,
  counted_usd: s.counted_usd,
  counted_khr: s.counted_khr,
  report: s.report,
  note: s.note,
});

export const push = () => serial("push", () => oneTab("push", doPush));
async function doPush() {
  const cfg = await getConfig();
  if (!cfg?.device_key) return null;
  const key = cfg.device_key;
  const out = { sent: 0, failed: 0 };
  // sales
  for (let round = 0; round < 20; round++) {
    const list = (await idb.all("sales")).filter((s) => !s.synced && s.state === "paid").sort((a, b) => (a.sold_at < b.sold_at ? -1 : 1)).slice(0, 50);
    if (!list.length) break;
    const r = await cloud("POST", "/pos-device/push", { key, body: { invoices: list.map(saleForCloud) } });
    const ok = new Set([...r.accepted, ...r.duplicate]);
    const bad = new Map(r.failed.map((f) => [f.uuid, f.error]));
    for (const s of list) {
      if (ok.has(s.uuid)) await idb.put("sales", { ...s, synced: true, synced_at: new Date().toISOString(), sync_error: "" });
      else if (bad.has(s.uuid)) await idb.put("sales", { ...s, sync_error: bad.get(s.uuid) });
    }
    out.sent += ok.size;
    out.failed += bad.size;
    if (!ok.size) break;
  }
  // refunds (after their invoices)
  const refunds = (await idb.all("refunds")).filter((r) => !r.synced).slice(0, 50);
  if (refunds.length) {
    const r = await cloud("POST", "/pos-device/push", { key, body: { invoices: [], refunds: refunds.map(({ synced, synced_at, sync_error, ...x }) => x) } });
    const rr = r.refunds || { accepted: [], duplicate: [], failed: [] };
    const ok = new Set([...rr.accepted, ...rr.duplicate]);
    const bad = new Map(rr.failed.map((f) => [f.uuid, f.error]));
    for (const x of refunds) {
      if (ok.has(x.uuid)) await idb.put("refunds", { ...x, synced: true, synced_at: new Date().toISOString(), sync_error: "" });
      else if (bad.has(x.uuid)) await idb.put("refunds", { ...x, sync_error: bad.get(x.uuid) });
    }
  }
  // login / logout
  const events = (await idb.all("events")).filter((e) => !e.synced).slice(0, 200);
  if (events.length) {
    const r = await cloud("POST", "/pos-device/push", { key, body: { invoices: [], events: events.map(({ synced, ...e }) => e) } });
    const saved = new Set(r.events?.saved || []);
    for (const e of events) if (saved.has(e.uuid)) await idb.put("events", { ...e, synced: true });
  }
  // shifts
  const shifts = (await idb.all("shifts")).filter((s) => !s.synced).slice(0, 50);
  if (shifts.length) {
    const r = await cloud("POST", "/pos-device/push", { key, body: { invoices: [], shifts: shifts.map(shiftForCloud) } });
    const saved = new Set(r.shifts?.saved || []);
    for (const s of shifts) {
      if (!saved.has(s.shift_no)) continue;
      // only mark what did not change while it was being sent
      await idb.update("shifts", s._id, (cur) => (cur && cur.updated_at === s.updated_at ? { ...cur, synced: true } : undefined));
    }
  }
  await setConfig({ last_push_at: new Date().toISOString(), last_error: "" });
  changed();
  return out;
}

export async function ping() {
  const cfg = await getConfig();
  if (!cfg?.device_key) return null;
  return cloud("GET", "/pos-device/ping", { key: cfg.device_key });
}

// ---------------- background (while the POS page is open) ----------------
let timers = null;
export function startWorker() {
  if (timers) return;
  const quiet = (fn) => () => fn().catch(() => {});
  timers = [setInterval(quiet(push), PUSH_EVERY_MS), setInterval(quiet(pull), PULL_EVERY_MS), setInterval(quiet(ping), PING_EVERY_MS)];
  const back = () => {
    state.online = null;
    push().then(() => pull()).catch(() => {});
  };
  window.addEventListener("online", back);
  window.addEventListener("offline", () => {
    state.online = false;
    changed();
  });
  setTimeout(quiet(async () => {
    await push();
    await pull();
  }), 1500);
}

export const idle = () => Promise.all([queue.pull.catch(() => {}), queue.push.catch(() => {})]);
