'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { SectionHeader } from '@/components/jurisintel/SectionHeader';
import { StatCard } from '@/components/jurisintel/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { IndianRupee, AlertTriangle, TrendingUp, Landmark } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────
type OverviewData = {
  totalTransactions: number;
  totalAmount: number;
  flaggedCount: number;
  flaggedAmount: number;
  byBank: { bank: string; count: number; amount: number }[];
};

type PatternRow = {
  pattern: string;
  count: number;
  totalAmount: number;
  description: string;
};

type TimelineRow = {
  month: string;
  count: number;
  amount: number;
  flagged: number;
};

// ── Theme constants ────────────────────────────────────────────────────
const GRID_STROKE = 'oklch(0.28 0.008 250)';
const AXIS_TICK = { fill: 'oklch(0.62 0.01 250)', fontSize: 11 };
const AMBER = 'oklch(0.75 0.15 70)';
const EMERALD = 'oklch(0.72 0.19 162)';
const RED = 'oklch(0.65 0.24 25)';
const TOOLTIP_STYLE = {
  backgroundColor: 'oklch(0.20 0.01 250)',
  border: '1px solid oklch(0.35 0.02 250)',
  borderRadius: '6px',
  fontSize: '12px',
  color: 'oklch(0.93 0.005 250)',
} as const;

// ── Helpers ────────────────────────────────────────────────────────────
async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed: ${url}`);
  return (await r.json()) as T;
}

function formatINR(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)}Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)}L`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatINRFull(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

// ── Card wrapper ───────────────────────────────────────────────────────
function ChartCard({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`ops-border ${className ?? ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          {icon && <span className="text-ops-amber">{icon}</span>}
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
            {title}
          </h3>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

// ── Main component ─────────────────────────────────────────────────────
export function Financial() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [patterns, setPatterns] = useState<PatternRow[] | null>(null);
  const [timeline, setTimeline] = useState<TimelineRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ov, pt, tl] = await Promise.all([
          getJSON<OverviewData>('/api/financial/overview'),
          getJSON<PatternRow[]>('/api/financial/suspicious-patterns'),
          getJSON<TimelineRow[]>('/api/financial/timeline'),
        ]);
        if (cancelled) return;
        setOverview(ov);
        setPatterns(pt);
        setTimeline(tl);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="FINANCIAL INTELLIGENCE"
        subtitle="Suspicious transaction monitoring — PMLA tracking"
      />

      {error && (
        <div className="ops-border rounded-md bg-ops-red/10 border-ops-red/30 p-3">
          <p className="font-mono-label text-ops-red">
            INTEL FEED ERROR: {error}
          </p>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {overview === null ? (
          <Skeleton className="h-[88px] col-span-2 lg:col-span-4" />
        ) : (
          <>
            <StatCard
              label="TOTAL TRANSACTIONS"
              value={overview.totalTransactions}
              icon={<TrendingUp className="w-4 h-4" />}
            />
            <StatCard
              label="TOTAL AMOUNT"
              value={formatINR(overview.totalAmount)}
              icon={<IndianRupee className="w-4 h-4" />}
              severity="warning"
            />
            <StatCard
              label="FLAGGED COUNT"
              value={overview.flaggedCount}
              icon={<AlertTriangle className="w-4 h-4" />}
              severity="critical"
            />
            <StatCard
              label="FLAGGED AMOUNT"
              value={formatINR(overview.flaggedAmount)}
              icon={<IndianRupee className="w-4 h-4" />}
              severity="critical"
            />
          </>
        )}
      </div>

      {/* ── Charts grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── TRANSACTION TIMELINE ── */}
        <ChartCard title="TRANSACTION TIMELINE" icon={<TrendingUp className="w-4 h-4" />} className="lg:col-span-2">
          {timeline === null ? (
            <Skeleton className="w-full h-[280px]" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={timeline} margin={{ top: 10, right: 12, left: -10, bottom: 4 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={{ stroke: GRID_STROKE }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  yAxisId="left"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => formatINR(v)}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: AMBER }}
                  formatter={(v: number, name: string) => [
                    name === 'amount' ? formatINRFull(v) : v,
                    name === 'amount' ? 'Amount' : 'Count',
                  ]}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  formatter={(val: string) => (
                    <span className="font-mono text-[10px]" style={{ color: 'oklch(0.80 0.01 250)' }}>
                      {val === 'count' ? 'COUNT' : 'AMOUNT'}
                    </span>
                  )}
                />
                <Bar yAxisId="left" dataKey="count" fill={AMBER} radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="amount"
                  stroke={EMERALD}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: EMERALD }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* ── SUSPICIOUS PATTERNS ── */}
        <ChartCard title="SUSPICIOUS PATTERNS" icon={<AlertTriangle className="w-4 h-4" />}>
          {patterns === null ? (
            <Skeleton className="w-full h-[300px]" />
          ) : patterns.length === 0 ? (
            <p className="font-mono-label py-12 text-center">NO SUSPICIOUS PATTERNS</p>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-border">
                    <th className="font-mono-label py-2 pr-4">PATTERN</th>
                    <th className="font-mono-label py-2 pr-4 text-right">COUNT</th>
                    <th className="font-mono-label py-2 pr-4 text-right">AMOUNT</th>
                    <th className="font-mono-label py-2 hidden md:table-cell">DESCRIPTION</th>
                  </tr>
                </thead>
                <tbody>
                  {patterns.map((p) => (
                    <tr
                      key={p.pattern}
                      className="border-b border-border/40 hover:bg-accent/30 transition-colors"
                    >
                      <td className="py-2.5 pr-4">
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] px-1.5 py-0 h-5 border-ops-amber/40 text-ops-amber bg-ops-amber/10"
                        >
                          {p.pattern}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono text-xs">{p.count}</td>
                      <td className="py-2.5 pr-4 text-right font-mono text-xs text-ops-amber">{formatINR(p.totalAmount)}</td>
                      <td className="py-2.5 text-xs text-muted-foreground hidden md:table-cell max-w-[180px] truncate">
                        {p.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </ChartCard>

        {/* ── BY BANK ── */}
        <ChartCard title="BY BANK" icon={<Landmark className="w-4 h-4" />}>
          {overview === null ? (
            <Skeleton className="w-full h-[300px]" />
          ) : overview.byBank.length === 0 ? (
            <p className="font-mono-label py-12 text-center">NO BANK DATA</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                layout="vertical"
                data={overview.byBank}
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                <YAxis
                  type="category"
                  dataKey="bank"
                  tick={{ fill: 'oklch(0.62 0.01 250)', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                />
                <Tooltip
                  cursor={{ fill: 'oklch(0.75 0.15 70 / 0.08)' }}
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: AMBER }}
                  formatter={(v: number, name: string) => [
                    name === 'amount' ? formatINRFull(v) : v,
                    name === 'amount' ? 'Amount' : 'Count',
                  ]}
                />
                <Bar dataKey="count" fill={AMBER} radius={[0, 4, 4, 0]} maxBarSize={20} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
