'use client';

import { useEffect, useState, useMemo } from 'react';
import { SectionHeader } from '@/components/jurisintel/SectionHeader';
import { StatCard } from '@/components/jurisintel/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Users as UsersIcon, Shield, MapPin, Info } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────
type UserRow = {
  id: number;
  username: string;
  name: string;
  role: string;
  district: string | null;
  createdAt: string;
};

// ── Helpers ────────────────────────────────────────────────────────────
async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed: ${url}`);
  return (await r.json()) as T;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'border-ops-red/40 text-ops-red bg-ops-red/10',
  supervisor: 'border-ops-amber/40 text-ops-amber bg-ops-amber/10',
  analyst: 'border-sky-400/40 text-sky-400 bg-sky-400/10',
  investigator: 'border-ops-emerald/40 text-ops-emerald bg-ops-emerald/10',
};

function roleBadgeClass(role: string): string {
  return ROLE_COLORS[role.toLowerCase()] ?? 'border-border text-muted-foreground bg-muted/30';
}

// ── Main component ─────────────────────────────────────────────────────
export function Users() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getJSON<UserRow[]>('/api/rbac/users');
        if (cancelled) return;
        setUsers(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const totalUsers = users?.length ?? 0;
  const adminCount = users?.filter((u) => u.role.toLowerCase() === 'admin').length ?? 0;
  const activeDistricts = useMemo(() => {
    if (!users) return 0;
    const set = new Set(users.map((u) => u.district).filter(Boolean));
    return set.size;
  }, [users]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="USER MANAGEMENT"
        subtitle="System access control — authorized personnel"
      />

      {error && (
        <div className="ops-border rounded-md bg-ops-red/10 border-ops-red/30 p-3">
          <p className="font-mono-label text-ops-red">
            INTEL FEED ERROR: {error}
          </p>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {users === null ? (
          <Skeleton className="h-[88px] col-span-2 lg:col-span-3" />
        ) : (
          <>
            <StatCard
              label="TOTAL USERS"
              value={totalUsers}
              icon={<UsersIcon className="w-4 h-4" />}
            />
            <StatCard
              label="ADMINS"
              value={adminCount}
              icon={<Shield className="w-4 h-4" />}
              severity="critical"
            />
            <StatCard
              label="ACTIVE DISTRICTS"
              value={activeDistricts}
              icon={<MapPin className="w-4 h-4" />}
              className="col-span-2 lg:col-span-1"
            />
          </>
        )}
      </div>

      {/* ── Table ── */}
      <Card className="ops-border">
        <CardContent className="p-0">
          {users === null ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-mono-label text-xs">USERNAME</TableHead>
                    <TableHead className="font-mono-label text-xs">NAME</TableHead>
                    <TableHead className="font-mono-label text-xs">ROLE</TableHead>
                    <TableHead className="font-mono-label text-xs hidden md:table-cell">DISTRICT</TableHead>
                    <TableHead className="font-mono-label text-xs text-right">CREATED</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} className="border-border/40">
                      <TableCell className="py-2.5 font-mono text-xs text-ops-amber">
                        {u.username}
                      </TableCell>
                      <TableCell className="py-2.5 font-medium text-sm">
                        {u.name}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge
                          variant="outline"
                          className={`font-mono text-[10px] px-1.5 py-0 h-5 ${roleBadgeClass(u.role)}`}
                        >
                          {u.role.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                        {u.district ?? '—'}
                      </TableCell>
                      <TableCell className="py-2.5 text-right font-mono text-xs text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ── Note card ── */}
      <Card className="ops-border border-border/60">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="font-mono-label text-xs text-muted-foreground">
            User provisioning is managed by the system administrator. Contact IT desk for access requests.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
