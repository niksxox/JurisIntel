const BASE = "/api";

let currentRole = "Investigating Officer";
export function setRole(role) {
  currentRole = role;
}
export function getRole() {
  return currentRole;
}

async function request(path, opts = {}) {
  const headers = { ...(opts.headers || {}), "X-User-Role": currentRole };
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
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
  stats: () => request("/stats"),
  cases: (params = {}) => request(`/cases${qs(params)}`),
  case: (id) => request(`/cases/${id}`),
  network: (params = {}) => request(`/network${qs(params)}`),
  nlQuery: (text) =>
    request("/nl-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }),
  pdfUrl: (id) => `${BASE}/cases/${id}/pdf`,
  roles: () => request("/roles"),
  criminalProfile: (name) => request(`/criminals/${encodeURIComponent(name)}/profile`),
  chat: (message, history, language) =>
    request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history, language }),
    }),
  chatPdf: async (messages, language) => {
    const res = await fetch(`${BASE}/chat/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Role": currentRole },
      body: JSON.stringify({ messages, language }),
    });
    if (!res.ok) throw new Error("PDF export failed");
    return res.blob();
  },
  trends: () => request("/trends"),
  scene: (caseId) => request(`/cases/${caseId}/scene`),
  auditLog: (limit = 100) => request(`/audit-log?limit=${limit}`),
};
