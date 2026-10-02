import Auth from "../page/util/auth";

import { L } from "../i18n";
const API_HOST = process.env.REACT_APP_API_HOST || "http://localhost:8086";
const API_AUTH_KEY = process.env.REACT_APP_API_AUTH_KEY || "";
export const API_BASE = `${API_HOST}/api/admin`;

const auth = new Auth();

// Build "?a=1&b=2" from an object, skipping empty values
function toQueryString(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.append(key, typeof value === "object" ? JSON.stringify(value) : value);
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// Session expired / invalid token → clear local login and go back to login page
function handleUnauthorized() {
  clearApiCache();
  auth.removeClientLogin();
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

/**
 * Call the Inventory POS API.
 * Returns the JSON body ({ success, data, pagination, message }).
 * Throws an Error with the server message when the request fails.
 */
async function request(path, { method = "GET", body, params, skipAuth = false } = {}) {
  // FormData (file upload): let the browser set the multipart Content-Type + boundary
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  const headers = {
    "x-api-key": API_AUTH_KEY,
  };
  if (!isForm) headers["Content-Type"] = "application/json";

  const token = auth.getClientLogin()?.access_token;
  if (token && !skipAuth) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}${toQueryString(params)}`, {
      method,
      headers,
      body: body !== undefined ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch (err) {
    throw new Error(L("មិនអាចភ្ជាប់ទៅម៉ាសុីនមេបានទេ!", "Can't connect to the server!"));
  }

  const json = await res.json().catch(() => ({}));

  if (res.status === 401 && !skipAuth) {
    handleUnauthorized();
  }

  if (!res.ok || json.success === false) {
    const error = new Error(json.message || `Request failed (${res.status})`);
    error.status = res.status;
    error.response = json;
    throw error;
  }

  return json;
}

// ---------------- GET cache ----------------
// 1) Lookup lists (…-all, category tree, current rate, roles) are asked by many screens and rarely change:
//    each answer is reused for 60 s per login.
// 2) Lists / tables (pages) — stale-while-revalidate: get(path, params, { onFresh }) answers at once from the last
//    copy (≤ 5 min old) and loads a fresh copy in the background; onFresh(json) runs only when it changed.
//    get(path, params, { prefetch: true }) loads a page (e.g. the next one) into the cache without showing it.
// Any save (POST / PUT / DELETE) clears everything, so edits show at once. Identical GETs on the way share one request.
const CACHE_TTL_MS = 60 * 1000;
const SWR_MAX_AGE_MS = 5 * 60 * 1000;
const SWR_MAX_ENTRIES = 150;
const CACHEABLE = /^\/(?:[\w/-]+-all|product\/category-tree|setup\/exchange-rate\/current|users-roles|telegram\/events)$/;
const cache = new Map(); // key → { at, promise }   (lookups)
const pages = new Map(); // key → { at, json }      (lists, last answer)
const inflight = new Map(); // key → promise

// The page copies also live in this tab's sessionStorage, so a refresh (F5) shows tables at once too.
// (Only small answers, ≤ 3 MB in total; cleared with the cache. Blocked storage → memory only.)
const STORE_KEY = "inventory_pos_pages";
const STORE_MAX_CHARS = 3 * 1024 * 1024;
try {
  const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || "[]");
  saved.forEach(([k, v]) => v && Date.now() - v.at < SWR_MAX_AGE_MS && pages.set(k, v));
} catch {
  // nothing saved / storage blocked
}
let saveTimer = null;
const saveSoon = () => {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const rows = [];
      let size = 0;
      for (const entry of [...pages.entries()].reverse()) {
        const text = JSON.stringify(entry);
        if (size + text.length > STORE_MAX_CHARS) break;
        size += text.length;
        rows.push(entry);
      }
      sessionStorage.setItem(STORE_KEY, JSON.stringify(rows.reverse()));
    } catch {
      // storage full / blocked → memory only
    }
  }, 1000);
};

export function clearApiCache() {
  cache.clear();
  pages.clear();
  try {
    sessionStorage.removeItem(STORE_KEY);
  } catch {
    // ignore
  }
}

const remember = (key, json) => {
  pages.delete(key);
  if (pages.size >= SWR_MAX_ENTRIES) pages.delete(pages.keys().next().value); // drop the oldest
  pages.set(key, { at: Date.now(), json });
  saveSoon();
};

// one network request per key at a time; the answer is kept for stale-while-revalidate
function fetchFresh(key, path, params) {
  if (inflight.has(key)) return inflight.get(key);
  const promise = request(path, { params })
    .then((json) => {
      remember(key, json);
      return json;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

function cachedGet(path, params, opts = {}) {
  const key = `${auth.getClientLogin()?.access_token || ""}|${path}${toQueryString(params)}`;
  if (CACHEABLE.test(path)) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;
    const promise = request(path, { params }).catch((err) => {
      cache.delete(key); // don't keep errors
      throw err;
    });
    cache.set(key, { at: Date.now(), promise });
    return promise;
  }

  const hit = pages.get(key);
  const usable = hit && Date.now() - hit.at < SWR_MAX_AGE_MS;

  if (opts.prefetch) {
    if (usable || inflight.has(key)) return Promise.resolve(hit?.json);
    return fetchFresh(key, path, params).catch(() => undefined);
  }

  if (opts.onFresh && usable) {
    const before = JSON.stringify(hit.json);
    fetchFresh(key, path, params)
      .then((json) => {
        if (JSON.stringify(json) !== before) opts.onFresh(json);
      })
      .catch(() => {}); // keep showing the last copy
    return Promise.resolve(hit.json);
  }

  return fetchFresh(key, path, params);
}

const write = (path, options) => request(path, options).finally(clearApiCache);

const apiClient = {
  get: (path, params, opts) => cachedGet(path, params, opts),
  post: (path, body, options) => write(path, { method: "POST", body, ...options }),
  put: (path, body) => write(path, { method: "PUT", body }),
  delete: (path, body) => write(path, { method: "DELETE", body }),
  // public pages (QR catalog): no login token, no cache, a 401 never logs anyone out
  publicGet: (path, params) => request(path, { params, skipAuth: true }),
};

export default apiClient;
