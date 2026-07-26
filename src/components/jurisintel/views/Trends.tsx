'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { SectionHeader } from '@/components/jurisintel/SectionHeader';
import { StatCard } from '@/components/jurisintel/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarDays, Activity, MapPin, Crosshair } from 'lucide-react';
import { safeFetch } from '@/lib/safeFetch';

// ── Types ──────────────────────────────────────────────────────────────
type YearlyRow = { year: string; count: number };
type MonthlyRow = { month: string; count: number };
type CrimeTypeRow = { category: string; count: number; percentage: number };
type ModusRow = { modusOperandi: string; count: number };
type HotspotRow = {
  district: string;
  count: number;
  severity_avg: number;
  topCategory: string | null;
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

const CRIME_COLORS = [
  AMBER,
  EMERALD,
  'oklch(0.80 0.12 55)',
  RED,
  'oklch(0.70 0.14 145)',
  'oklch(0.78 0.13 90)',
  'oklch(0.68 0.20 200)',
  'oklch(0.72 0.18 350)',
  'oklch(0.66 0.16 145)',
  'oklch(0.74 0.10 60)',
];

// ── Helpers ────────────────────────────────────────────────────────────
function severityTier(s: number): 'high' | 'med' | 'low' {
  if (s >= 7) return 'high';
  if (s >= 4) return 'med';
  return 'low';
}

const severityBadge: Record<string, { label: string; cls: string }> = {
  high: { label: 'HIGH', cls: 'border-ops-red/40 text-ops-red bg-ops-red/10' },
  med: { label: 'MED', cls: 'border-ops-amber/40 text-ops-amber bg-ops-amber/10' },
  low: { label: 'LOW', cls: 'border-ops-emerald/40 text-ops-emerald bg-ops-emerald/10' },
};

// ── Loading skeleton ──────────────────────────────────────────────────
function ChartSkeleton({ height = 280 }: { height?: number }) {
  return <Skeleton className="w-full" style={{ height }} />;
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
export function Trends() {
  const [yearly, setYearly] = useState<YearlyRow[] | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRow[] | null>(null);
  const [crimeTypes, setCrimeTypes] = useState<CrimeTypeRow[] | null>(null);
  const [modus, setModus] = useState<ModusRow[] | null>(null);
  const [hotspots, setHotspots] = useState<HotspotRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [y, m, ct, mo, hs] = await Promise.all([
          safeFetch<YearlyRow[]>('/api/trends/yearly'),
          safeFetch<MonthlyRow[]>('/api/stats/monthly-trend'),
          safeFetch<CrimeTypeRow[]>('/api/trends/by-crime-type'),
          safeFetch<ModusRow[]>('/api/trends/modus-operandi'),
          safeFetch<HotspotRow[]>('/api/trends/hotspots'),
        ]);
        if (cancelled) return;
        setYearly(y);
        setMonthly(m);
        setCrimeTypes(ct);
        setModus(mo);
        setHotspots(hs);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Derived stats ──
  const totalCases = yearly?.reduce((s, r) => s + r.count, 0) ?? 0;
  const lastYear = yearly?.[yearly.length - 1];
  const prevYear = yearly && yearly.length >= 2 ? yearly[yearly.length - 2] : null;
  const yoyTrend =
    lastYear && prevYear && prevYear.count > 0
      ? `${lastYear.count > prevYear.count ? '+' : ''}${(
          ((lastYear.count - prevYear.count) / prevYear.count) *
          100
        ).toFixed(1)}% YoY`
      : undefined;
  const topType = crimeTypes?.[0];
  const topHotspot = hotspots?.[0];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="CRIME TRENDS"
        subtitle="Temporal & categorical analysis"
      />

      {error && (
        <div className="ops-border rounded-md bg-ops-red/10 border-ops-red/30 p-3">
          <p className="font-mono-label text-ops-red">
            INTEL FEED ERROR: {error}
          </p>
        </div>
      )}

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {yearly === null ? (
          <Skeleton className="h-[88px] col-span-2 lg:col-span-4" />
        ) : (
          <>
            <StatCard
              label="TOTAL CASES (4Y)"
              value={totalCases}
              icon={<Activity className="w-4 h-4" />}
              trend={yoyTrend}
              severity={yoyTrend?.startsWith('-') ? 'normal' : 'warning'}
            />
            <StatCard
              label="CURRENT YEAR"
              value={lastYear ? `${lastYear.year} → ${lastYear.count}` : '—'}
              icon={<CalendarDays className="w-4 h-4" />}
            />
            <StatCard
              label="TOP CRIME TYPE"
              value={topType ? topType.category : '—'}
              icon={<Crosshair className="w-4 h-4" />}
              trend={topType ? `${topType.percentage}%` : undefined}
            />
            <StatCard
              label="TOP HOTSPOT"
              value={topHotspot ? topHotspot.district : '—'}
              icon={<MapPin className="w-4 h-4" />}
              trend={topHotspot ? `${topHotspot.count} cases` : undefined}
              severity="critical"
            />
          </>
        )}
      </div>

      {/* ── Charts grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* YEARLY CASE VOLUME */}
        <ChartCard title="YEARLY CASE VOLUME" icon={<CalendarDays className="w-4 h-4" />}>
          {yearly === null ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={yearly} margin={{ top: 10, right: 12, left: -10, bottom: 4 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'oklch(0.75 0.15 70 / 0.08)' }}
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: AMBER }}
                />
                <Bar dataKey="count" fill={AMBER} radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* MONTHLY TREND */}
        <ChartCard title="MONTHLY TREND" icon={<Activity className="w-4 h-4" />}>
          {monthly === null ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={monthly} margin={{ top: 10, right: 12, left: -10, bottom: 4 }}>
                <defs>
                  <linearGradient id="monthlyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AMBER} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={AMBER} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={{ stroke: GRID_STROKE }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: AMBER }} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="none"
                  fill="url(#monthlyGrad)"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={AMBER}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: AMBER }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* CASES BY CRIME TYPE */}
        <ChartCard title="CASES BY CRIME TYPE" icon={<Crosshair className="w-4 h-4" />}>
          {crimeTypes === null ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                layout="vertical"
                data={crimeTypes}
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                <YAxis
                  type="category"
                  dataKey="category"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={92}
                />
                <Tooltip
                  cursor={{ fill: 'oklch(0.75 0.15 70 / 0.08)' }}
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: AMBER }}
                  formatter={(v: number, _n, p) => [
                    `${v} cases (${p?.payload?.percentage ?? 0}%)`,
                    'Count',
                  ]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {crimeTypes.map((_, i) => (
                    <Cell key={i} fill={CRIME_COLORS[i % CRIME_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {crimeTypes && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border">
              {crimeTypes.slice(0, 5).map((c, i) => (
                <Badge
                  key={c.category}
                  variant="outline"
                  className="font-mono text-[10px] gap-1 px-1.5 py-0 h-4"
                  style={{ borderColor: CRIME_COLORS[i % CRIME_COLORS.length] + '55' }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: CRIME_COLORS[i % CRIME_COLORS.length] }}
                  />
                  {c.category} · {c.percentage}%
                </Badge>
              ))}
            </div>
          )}
        </ChartCard>

        {/* MODUS OPERANDI TOP 8 */}
        <ChartCard title="MODUS OPERANDI (TOP 8)" icon={<Crosshair className="w-4 h-4" />}>
          {modus === null ? (
            <ChartSkeleton height={300} />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                layout="vertical"
                data={modus}
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                <YAxis
                  type="category"
                  dataKey="modusOperandi"
                  tick={{ fill: 'oklch(0.62 0.01 250)', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={140}
                  tickFormatter={(v: string) => (v.length > 22 ? v.slice(0, 22) + '…' : v)}
                />
                <Tooltip
                  cursor={{ fill: 'oklch(0.72 0.19 162 / 0.08)' }}
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: EMERALD }}
                />
                <Bar dataKey="count" fill={EMERALD} radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── DISTRICT HOTSPOTS ── */}
      <ChartCard title="DISTRICT HOTSPOTS" icon={<MapPin className="w-4 h-4" />}>
        {hotspots === null ? (
          <Skeleton className="w-full h-[280px]" />
        ) : hotspots.length === 0 ? (
          <p className="font-mono-label py-12 text-center">NO HOTSPOT DATA AVAILABLE</p>
        ) : (
          <ScrollArea className="max-h-96">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border">
                  <th className="font-mono-label py-2 pr-4">#</th>
                  <th className="font-mono-label py-2 pr-4">DISTRICT</th>
                  <th className="font-mono-label py-2 pr-4 text-right">CASES</th>
                  <th className="font-mono-label py-2 pr-4 text-center">SEVERITY</th>
                  <th className="font-mono-label py-2">TOP CATEGORY</th>
                </tr>
              </thead>
              <tbody>
                {hotspots.map((h, i) => {
                  const tier = severityTier(h.severity_avg);
                  const sb = severityBadge[tier];
                  return (
                    <tr
                      key={h.district}
                      className="border-b border-border/40 hover:bg-accent/30 transition-colors"
                    >
                      <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                        {String(i + 1).padStart(2, '0')}
                      </td>
                      <td className="py-2.5 pr-4 font-medium">{h.district}</td>
                      <td className="py-2.5 pr-4 text-right font-mono">
                        <span className="text-ops-amber">{h.count}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-center">
                        <Badge
                          variant="outline"
                          className={`font-mono text-[10px] px-1.5 py-0 h-5 ${sb.cls}`}
                        >
                          {sb.label} · {h.severity_avg.toFixed(1)}
                        </Badge>
                      </td>
                      <td className="py-2.5">
                        {h.topCategory ? (
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px] px-1.5 py-0 h-5 border-border text-muted-foreground"
                          >
                            {h.topCategory}
                          </Badge>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </ChartCard>
    </div>
  );
}
