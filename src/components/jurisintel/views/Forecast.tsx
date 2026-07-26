'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { SectionHeader } from '@/components/jurisintel/SectionHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Activity,
  Target,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────
type ForecastPoint = { month: string; count: number; lower: number; upper: number };
type ForecastResponse = {
  historical: { month: string; count: number }[];
  forecast: ForecastPoint[];
  method: string;
  alpha: number;
};
type PredictedHotspot = {
  district: string;
  predictedCount: number;
  confidence: number;
  trend: 'rising' | 'stable' | 'falling';
};
type EarlyWarning = {
  id: string;
  district: string;
  category: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | string;
  confidence: number;
  description: string;
  date: string;
};

// ── Theme ──────────────────────────────────────────────────────────────
const GRID_STROKE = 'oklch(0.28 0.008 250)';
const AXIS_TICK = { fill: 'oklch(0.62 0.01 250)', fontSize: 11 };
const AMBER = 'oklch(0.75 0.15 70)';
const EMERALD = 'oklch(0.72 0.19 162)';
const RED = 'oklch(0.65 0.24 25)';
const SKY = 'oklch(0.70 0.13 230)';
const TOOLTIP_STYLE = {
  backgroundColor: 'oklch(0.20 0.01 250)',
  border: '1px solid oklch(0.35 0.02 250)',
  borderRadius: '6px',
  fontSize: '12px',
  color: 'oklch(0.93 0.005 250)',
} as const;

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed: ${url}`);
  return (await r.json()) as T;
}

// ── Severity config ────────────────────────────────────────────────────
const SEVERITY_CFG: Record<
  string,
  { icon: React.ReactNode; border: string; bg: string; text: string; label: string }
> = {
  critical: {
    icon: <AlertTriangle className="w-4 h-4" />,
    border: 'border-l-ops-red',
    bg: 'bg-ops-red/5',
    text: 'text-ops-red',
    label: 'CRITICAL',
  },
  high: {
    icon: <AlertCircle className="w-4 h-4" />,
    border: 'border-l-ops-amber',
    bg: 'bg-ops-amber/5',
    text: 'text-ops-amber',
    label: 'HIGH',
  },
  medium: {
    icon: <Info className="w-4 h-4" />,
    border: 'border-l-sky-400',
    bg: 'bg-sky-400/5',
    text: 'text-sky-400',
    label: 'MEDIUM',
  },
};

function severityConfig(sev: string) {
  return SEVERITY_CFG[sev] ?? SEVERITY_CFG.medium;
}

// ── Chart card ─────────────────────────────────────────────────────────
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
export function Forecast() {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [hotspots, setHotspots] = useState<PredictedHotspot[] | null>(null);
  const [warnings, setWarnings] = useState<EarlyWarning[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [f, h, w] = await Promise.all([
          getJSON<ForecastResponse>('/api/prediction/forecast'),
          getJSON<PredictedHotspot[]>('/api/prediction/hotspots'),
          getJSON<EarlyWarning[]>('/api/prediction/early-warnings'),
        ]);
        if (cancelled) return;
        setForecast(f);
        setHotspots(h);
        setWarnings(w);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Merge historical + forecast into one chart series ──
  const chartData = useMemo(() => {
    if (!forecast) return [];
    const hist = forecast.historical.map((h) => ({
      month: h.month,
      hist: h.count,
      fc: null as number | null,
      lower: null as number | null,
      upper: null as number | null,
    }));
    // Add the last historical point as the first forecast point so the dashed line connects smoothly
    if (hist.length > 0 && forecast.forecast.length > 0) {
      const lastHist = forecast.historical[forecast.historical.length - 1];
      forecast.forecast.unshift({ ...lastHist, lower: lastHist.count, upper: lastHist.count });
    }
    const fc = forecast.forecast.map((f) => ({
      month: f.month,
      hist: null as number | null,
      fc: f.count,
      lower: f.lower,
      upper: f.upper,
    }));
    return [...hist, ...fc];
  }, [forecast]);

  const maxPredicted = useMemo(
    () => (hotspots && hotspots.length > 0 ? Math.max(...hotspots.map((h) => h.predictedCount)) : 1),
    [hotspots]
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="PREDICTIVE FORECAST"
        subtitle="AI-driven crime projection & early warning system"
      />

      {error && (
        <div className="ops-border rounded-md bg-ops-red/10 border-ops-red/30 p-3">
          <p className="font-mono-label text-ops-red">FORECAST ENGINE ERROR: {error}</p>
        </div>
      )}

      {/* ── Model badges ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="font-mono text-[11px] px-2.5 py-1 h-6 border-ops-amber/40 text-ops-amber bg-ops-amber/10 gap-1.5"
        >
          <Brain className="w-3 h-3" />
          MODEL: EXPONENTIAL SMOOTHING (α={forecast?.alpha.toFixed(2) ?? '0.30'})
        </Badge>
        <Badge
          variant="outline"
          className="font-mono text-[11px] px-2.5 py-1 h-6 border-ops-emerald/40 text-ops-emerald bg-ops-emerald/10 gap-1.5"
        >
          <Activity className="w-3 h-3" />
          FORECAST HORIZON: 6 MONTHS
        </Badge>
        <Badge
          variant="outline"
          className="font-mono text-[11px] px-2.5 py-1 h-6 border-border text-muted-foreground gap-1.5"
        >
          <Target className="w-3 h-3" />
          METHOD: {forecast?.method?.toUpperCase() ?? '—'}
        </Badge>
      </div>

      {/* ── Crime Volume Forecast ── */}
      <ChartCard
        title="CRIME VOLUME FORECAST"
        icon={<Activity className="w-4 h-4" />}
      >
        {!forecast ? (
          <Skeleton className="w-full h-[340px]" />
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: -8, bottom: 4 }}>
              <defs>
                <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={EMERALD} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={EMERALD} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="month"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={{ stroke: GRID_STROKE }}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: AMBER }}
                formatter={(value: number, name: string) => {
                  if (value === null || value === undefined) return ['—', name];
                  const labels: Record<string, string> = {
                    hist: 'Historical',
                    fc: 'Forecast',
                    upper: 'Upper bound',
                    lower: 'Lower bound',
                  };
                  return [value, labels[name] ?? name];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }}
                formatter={(v) => {
                  const map: Record<string, string> = {
                    hist: 'Historical',
                    fc: 'Forecast',
                    upper: 'Upper bound',
                    lower: 'Lower bound',
                  };
                  return map[v] ?? v;
                }}
              />
              {/* Confidence band */}
              <Area
                type="monotone"
                dataKey="upper"
                stroke="none"
                fill="url(#bandGrad)"
                isAnimationActive={false}
                connectNulls
              />
              <Area
                type="monotone"
                dataKey="lower"
                stroke="none"
                fill="oklch(0.20 0.01 250)"
                isAnimationActive={false}
                connectNulls
              />
              {/* Historical solid amber line */}
              <Line
                type="monotone"
                dataKey="hist"
                stroke={AMBER}
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 4, fill: AMBER }}
                connectNulls={false}
              />
              {/* Forecast dashed emerald line */}
              <Line
                type="monotone"
                dataKey="fc"
                stroke={EMERALD}
                strokeWidth={2.4}
                strokeDasharray="6 4"
                dot={{ r: 2.5, fill: EMERALD }}
                activeDot={{ r: 4, fill: EMERALD }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ── Predicted Hotspots + Early Warnings ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Predicted Hotspots */}
        <ChartCard title="PREDICTED HOTSPOTS" icon={<Target className="w-4 h-4" />}>
          {!hotspots ? (
            <Skeleton className="w-full h-[260px]" />
          ) : hotspots.length === 0 ? (
            <p className="font-mono-label py-12 text-center">NO HOTSPOT PREDICTIONS</p>
          ) : (
            <div className="space-y-3">
              {hotspots.map((h, i) => {
                const pct = maxPredicted > 0 ? (h.predictedCount / maxPredicted) * 100 : 0;
                const TrendIcon =
                  h.trend === 'rising'
                    ? TrendingUp
                    : h.trend === 'falling'
                      ? TrendingDown
                      : Minus;
                const trendCls =
                  h.trend === 'rising'
                    ? 'text-ops-red'
                    : h.trend === 'falling'
                      ? 'text-ops-emerald'
                      : 'text-muted-foreground';
                return (
                  <div key={h.district} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="font-medium text-sm truncate">{h.district}</span>
                        <TrendIcon className={`w-3.5 h-3.5 ${trendCls} flex-shrink-0`} />
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-mono text-sm font-bold text-ops-amber">
                          {h.predictedCount}
                        </span>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] px-1.5 py-0 h-4 border-border text-muted-foreground"
                        >
                          {h.confidence.toFixed(0)}% conf
                        </Badge>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${EMERALD}, ${AMBER})`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>

        {/* Early Warnings */}
        <ChartCard title="EARLY WARNINGS" icon={<AlertTriangle className="w-4 h-4" />}>
          {!warnings ? (
            <Skeleton className="w-full h-[260px]" />
          ) : warnings.length === 0 ? (
            <p className="font-mono-label py-12 text-center">NO ACTIVE WARNINGS</p>
          ) : (
            <ScrollArea className="max-h-[420px]">
              <div className="space-y-2.5 pr-2">
                {warnings.map((w) => {
                  const cfg = severityConfig(w.severity);
                  return (
                    <div
                      key={w.id}
                      className={`rounded-md border border-border border-l-4 ${cfg.border} ${cfg.bg} p-3 transition-colors hover:bg-accent/30`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={cfg.text}>{cfg.icon}</span>
                          <span className={`font-mono text-[10px] font-bold ${cfg.text}`}>
                            {cfg.label}
                          </span>
                          <Separator orientation="vertical" className="h-3" />
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {w.id}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`font-mono text-[10px] px-1.5 py-0 h-4 ${cfg.text} border-current/40`}
                        >
                          {w.confidence.toFixed(0)}%
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] px-1.5 py-0 h-4 border-ops-amber/40 text-ops-amber bg-ops-amber/10"
                        >
                          {w.district}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] px-1.5 py-0 h-4 border-border text-muted-foreground"
                        >
                          {w.category}
                        </Badge>
                        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                          {w.type.replace(/-/g, ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {w.description}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground mt-1.5">
                        ▸ TRIGGERED: {w.date}
                      </p>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </ChartCard>
      </div>

      {/* ── Predicted hotspots bar viz (extra polish) ── */}
      {hotspots && hotspots.length > 0 && (
        <ChartCard
          title="PREDICTED VOLUME — DISTRICT COMPARISON"
          icon={<TrendingUp className="w-4 h-4" />}
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={hotspots}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            >
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
              <YAxis
                type="category"
                dataKey="district"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={100}
              />
              <Tooltip
                cursor={{ fill: 'oklch(0.72 0.19 162 / 0.08)' }}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: EMERALD }}
              />
              <Bar dataKey="predictedCount" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {hotspots.map((h, i) => (
                  <Cell
                    key={i}
                    fill={h.trend === 'rising' ? RED : h.trend === 'falling' ? EMERALD : AMBER}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
