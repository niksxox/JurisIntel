export type Role = 'admin' | 'analyst' | 'investigator' | 'supervisor';

export interface Session {
  username: string;
  role: Role;
  name: string;
}

export const DEMO_USERS = [
  { username: 'admin', password: 'ChangeMe@2026', name: 'System Administrator', role: 'admin' as const },
  { username: 'analyst1', password: 'Analyst@2026', name: 'Priya Sharma', role: 'analyst' as const },
  { username: 'inv1', password: 'Inv@2026', name: 'Inspector Kumar', role: 'investigator' as const },
  { username: 'sup1', password: 'Sup@2026', name: 'DSP Anand Reddy', role: 'supervisor' as const },
];

const SESSION_KEY = 'ji_session';

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const decoded = atob(raw);
    const parsed = JSON.parse(decoded) as Session;
    if (!parsed.username || !parsed.role || !parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setSession(s: Session): void {
  if (typeof window === 'undefined') return;
  const encoded = btoa(JSON.stringify(s));
  localStorage.setItem(SESSION_KEY, encoded);
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}
