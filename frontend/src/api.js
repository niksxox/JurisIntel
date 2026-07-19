const BASE = "/api";

const TOKEN_KEY = "ksp_dashboard_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

let onAuthError = () => {};
export function setAuthErrorHandler(fn) {
  onAuthError = fn;
}

async function request(path, opts = {}) {
  const token = getToken();
  const headers = { ...(opts.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (res.status === 401) {
    setToken(null);
    onAuthError();
    throw new Error("Session expired — please log in again");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = text;
    try { msg = JSON.parse(text).detail || text; } catch { /* noop */ }
    throw new Error(msg || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

function qs(params = {}) {
  const s = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ).toString();
  return s ? `?${s}` : "";
}

export const api = {
  // auth
  login: (username, password, purpose) =>
    request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, purpose }),
    }),
  me: () => request("/auth/me"),
  purposes: () => request("/auth/purposes"),

  // user management (admin)
  users: () => request("/users"),
  createUser: (payload) =>
    request("/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deactivateUser: (id) => request(`/users/${id}/deactivate`, { method: "POST" }),

  // core
  stats: () => request("/stats"),
  cases: (params = {}) => request(`/cases${qs(params)}`),
  case: (id) => request(`/cases/${id}`),
  network: (params = {}) => request(`/network${qs(params)}`),
  nlQuery: (text) =>
    request("/nl-query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }),
  pdfUrl: (id) => `${BASE}/cases/${id}/pdf`,
  roles: () => request("/roles"),
  criminalProfile: (name) => request(`/criminals/${encodeURIComponent(name)}/profile`),
  chat: (message, history, language) =>
    request("/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history, language }) }),
  chatPdf: async (messages, language) => {
    const token = getToken();
    const res = await fetch(`${BASE}/chat/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ messages, language }),
    });
    if (!res.ok) throw new Error("PDF export failed");
    return res.blob();
  },
  trends: () => request("/trends"),
  stateCrimeStats: () => request("/state-crime-stats"),
  scene: (caseId) => request(`/cases/${caseId}/scene`),
  auditLog: (limit = 100) => request(`/audit-log?limit=${limit}`),

  // stations, bulletin, wanted
  stations: () => request("/stations"),
  bulletin: () => request("/bulletin"),
  postBulletin: (subject, message) =>
    request("/bulletin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, message }) }),
  wanted: (status) => request(`/wanted${qs({ status })}`),
  postWanted: (payload) =>
    request("/wanted", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  updateWantedStatus: (id, status) =>
    request(`/wanted/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }),
};
