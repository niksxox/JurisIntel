// Safe fetch utility — never throws on invalid JSON, empty body, or network errors.
// Every frontend data fetch should use this instead of raw fetch().then(r => r.json()).
//
// Automatically unwraps the { success, demoMode, data } envelope so views
// receive the inner payload directly (e.g. T[] or T object).

export async function safeFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, init);
    const text = await response.text();

    // Empty body — return null
    if (!text || text.trim().length === 0) {
      return null as unknown as T;
    }

    try {
      const parsed = JSON.parse(text);
      // Auto-unwrap the { success, demoMode, data } envelope
      if (parsed && typeof parsed === 'object' && 'data' in parsed && 'success' in parsed) {
        return (parsed.data ?? null) as unknown as T;
      }
      // Raw response (no envelope) — return as-is for backward compat
      return parsed as T;
    } catch {
      // Response was not valid JSON (e.g. HTML error page)
      return null as unknown as T;
    }
  } catch {
    // Network error, DNS failure, etc.
    return null as unknown as T;
  }
}
