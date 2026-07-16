const BASE = "/api";

async function request(path, opts) {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export const api = {
  stats: () => request("/stats"),
  cases: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
    ).toString();
    return request(`/cases${qs ? `?${qs}` : ""}`);
  },
  case: (id) => request(`/cases/${id}`),
  network: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
    ).toString();
    return request(`/network${qs ? `?${qs}` : ""}`);
  },
  nlQuery: (text) =>
    request("/nl-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }),
  pdfUrl: (id) => `${BASE}/cases/${id}/pdf`,
};
