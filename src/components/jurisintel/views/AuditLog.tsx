'use client';

import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/jurisintel/SectionHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Info } from 'lucide-react';
import { safeFetch } from '@/lib/safeFetch';

// ── Types ──────────────────────────────────────────────────────────────
type AuditEntry = {
  id: number;
  action: string;
  entity: string;
  entityId: number | string;
  details: string | null;
  ipAddress: string;
  createdAt: string;
  user: { name: string };
};

// ── Helpers ────────────────────────────────────────────────────────────
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hours}:${mins}`;
}

const ACTION_COLORS: Record<string, string> = {
  login: 'border-sky-400/40 text-sky-400 bg-sky-400/10',
  view: 'border-ops-emerald/40 text-ops-emerald bg-ops-emerald/10',
  search: 'border-ops-amber/40 text-ops-amber bg-ops-amber/10',
  update: 'border-violet-400/40 text-violet-400 bg-violet-400/10',
  delete: 'border-ops-red/40 text-ops-red bg-ops-red/10',
};

function actionBadgeClass(action: string): string {
  const lower = action.toLowerCase();
  return ACTION_COLORS[lower] ?? 'border-border text-muted-foreground bg-muted/30';
}

function getDotColor(action: string): string {
  const lower = action.toLowerCase();
  if (lower === 'login') return 'bg-sky-400';
  if (lower === 'view') return 'bg-ops-emerald';
  if (lower === 'search') return 'bg-ops-amber';
  if (lower === 'update') return 'bg-violet-400';
  if (lower === 'delete') return 'bg-ops-red';
  return 'bg-muted-foreground';
}

// ── Main component ─────────────────────────────────────────────────────
export function AuditLog() {
  const [logs, setLogs] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await safeFetch<AuditEntry[]>('/api/rbac/audit-logs');
        if (cancelled) return;
        setLogs(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="AUDIT LOG"
        subtitle="System activity trail — all actions monitored"
      />

      {error && (
        <div className="ops-border rounded-md bg-ops-red/10 border-ops-red/30 p-3">
          <p className="font-mono-label text-ops-red">
            INTEL FEED ERROR: {error}
          </p>
        </div>
      )}

      <Card className="ops-border">
        <CardContent className="p-0">
          {logs === null ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Info className="w-10 h-10 text-muted-foreground/30" />
              <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
                NO AUDIT ENTRIES
              </p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto audit-scroll">
              <div className="relative pl-6">
                {/* Vertical line */}
                <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border" />
                
                {logs.map((entry) => (
                  <div key={entry.id} className="relative pb-4 last:pb-0">
                    {/* Dot */}
                    <div className={`absolute -left-6 top-1.5 w-[7px] h-[7px] rounded-full ${getDotColor(entry.action)} ring-4 ring-background`} />
                    
                    <div className="group">
                      {/* Header row */}
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {formatTimestamp(entry.createdAt)}
                        </span>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] px-1.5 py-0 h-5 border-ops-amber/40 text-ops-amber bg-ops-amber/10"
                        >
                          {entry.user.name}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`font-mono text-[10px] px-1.5 py-0 h-5 ${actionBadgeClass(entry.action)}`}
                        >
                          {entry.action.toUpperCase()}
                        </Badge>
                      </div>

                      {/* Entity + ID */}
                      <div className="flex flex-wrap items-center gap-2 text-xs mb-0.5">
                        <span className="text-muted-foreground">{entry.entity}</span>
                        {entry.entityId != null && (
                          <span className="font-mono text-[10px] text-muted-foreground/70">
                            #{String(entry.entityId)}
                          </span>
                        )}
                        <span className="text-muted-foreground/40">·</span>
                        <span className="font-mono text-[10px] text-muted-foreground/60">
                          {entry.ipAddress}
                        </span>
                      </div>

                      {/* Details */}
                      {entry.details && (
                        <p className="font-mono text-[11px] text-muted-foreground/60 mt-0.5">
                          {entry.details}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
