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

const apiClient = {
  get: (path, params) => request(path, { params }),
  post: (path, body, options) => request(path, { method: "POST", body, ...options }),
  put: (path, body) => request(path, { method: "PUT", body }),
  delete: (path, body) => request(path, { method: "DELETE", body }),
};

export default apiClient;
