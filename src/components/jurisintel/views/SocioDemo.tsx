'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { SectionHeader } from '@/components/jurisintel/SectionHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, ShieldAlert, Briefcase } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────
type AgeRow = { range: string; count: number };
type GenderRow = { gender: string; count: number };
type OccupationRow = { occupation: string; count: number };
type RiskRow = { factor: string; count: number; avgRisk: number };

type DemographicsData = {
  ageGroups: AgeRow[];
  gender: GenderRow[];
  occupation: OccupationRow[];
};

// ── Theme constants ────────────────────────────────────────────────────
const GRID_STROKE = 'oklch(0.28 0.008 250)';
const AXIS_TICK = { fill: 'oklch(0.62 0.01 250)', fontSize: 11 };
const AMBER = 'oklch(0.75 0.15 70)';
const EMERALD = 'oklch(0.72 0.19 162)';
const RED = 'oklch(0.65 0.24 25)';
const SKY = 'oklch(0.70 0.12 230)';
const MAGENTA = 'oklch(0.65 0.22 350)';
const MUTED = 'oklch(0.55 0.02 250)';
const TOOLTIP_STYLE = {
  backgroundColor: 'oklch(0.20 0.01 250)',
  border: '1px solid oklch(0.35 0.02 250)',
  borderRadius: '6px',
  fontSize: '12px',
  color: 'oklch(0.93 0.005 250)',
} as const;

const GENDER_COLORS: Record<string, string> = {
  Male: SKY,
  Female: MAGENTA,
  Other: MUTED,
};

// ── Helpers ────────────────────────────────────────────────────────────
async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed: ${url}`);
  return (await r.json()) as T;
}

function riskBadgeClass(avgRisk: number): string {
  if (avgRisk > 60) return 'border-ops-red/40 text-ops-red bg-ops-red/10';
  if (avgRisk > 40) return 'border-ops-amber/40 text-ops-amber bg-ops-amber/10';
  return 'border-ops-emerald/40 text-ops-emerald bg-ops-emerald/10';
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
export function SocioDemo() {
  const [demo, setDemo] = useState<DemographicsData | null>(null);
  const [risks, setRisks] = useState<RiskRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [d, r] = await Promise.all([
          getJSON<DemographicsData>('/api/socio/demographics'),
          getJSON<RiskRow[]>('/api/socio/risk-factors'),
        ]);
        if (cancelled) return;
        setDemo(d);
        setRisks(r);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="SOCIO-DEMOGRAPHIC PROFILE"
        subtitle="Accused demographics & risk factor analysis"
      />

      {error && (
        <div className="ops-border rounded-md bg-ops-red/10 border-ops-red/30 p-3">
          <p className="font-mono-label text-ops-red">
            INTEL FEED ERROR: {error}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── AGE GROUP DISTRIBUTION ── */}
        <ChartCard title="AGE GROUP DISTRIBUTION" icon={<Users className="w-4 h-4" />}>
          {demo === null ? (
            <Skeleton className="w-full h-[280px]" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={demo.ageGroups} margin={{ top: 10, right: 12, left: -10, bottom: 4 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="range" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'oklch(0.75 0.15 70 / 0.08)' }}
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: AMBER }}
                />
                <Bar dataKey="count" fill={AMBER} radius={[4, 4, 0, 0]} maxBarSize={48} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* ── GENDER DISTRIBUTION ── */}
        <ChartCard title="GENDER DISTRIBUTION" icon={<Users className="w-4 h-4" />}>
          {demo === null ? (
            <Skeleton className="w-full h-[280px]" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={demo.gender}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="gender"
                  stroke="none"
                >
                  {demo.gender.map((entry) => (
                    <Cell
                      key={entry.gender}
                      fill={GENDER_COLORS[entry.gender] ?? MUTED}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number) => [v, 'Count']}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(val: string) => (
                    <span className="font-mono text-xs" style={{ color: 'oklch(0.80 0.01 250)' }}>{val}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* ── OCCUPATION BREAKDOWN ── */}
        <ChartCard title="OCCUPATION BREAKDOWN" icon={<Briefcase className="w-4 h-4" />}>
          {demo === null ? (
            <Skeleton className="w-full h-[300px]" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                layout="vertical"
                data={demo.occupation.slice(0, 8)}
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                <YAxis
                  type="category"
                  dataKey="occupation"
                  tick={{ fill: 'oklch(0.62 0.01 250)', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <Tooltip
                  cursor={{ fill: 'oklch(0.75 0.15 70 / 0.08)' }}
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: AMBER }}
                />
                <Bar dataKey="count" fill={AMBER} radius={[0, 4, 4, 0]} maxBarSize={20} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* ── RISK FACTORS ── */}
        <ChartCard title="RISK FACTORS" icon={<ShieldAlert className="w-4 h-4" />}>
          {risks === null ? (
            <Skeleton className="w-full h-[300px]" />
          ) : risks.length === 0 ? (
            <p className="font-mono-label py-12 text-center">NO RISK DATA AVAILABLE</p>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-border">
                    <th className="font-mono-label py-2 pr-4">FACTOR</th>
                    <th className="font-mono-label py-2 pr-4 text-right">COUNT</th>
                    <th className="font-mono-label py-2 text-center">AVG RISK</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.map((r) => (
                    <tr
                      key={r.factor}
                      className="border-b border-border/40 hover:bg-accent/30 transition-colors"
                    >
                      <td className="py-2.5 pr-4 font-medium text-xs">{r.factor}</td>
                      <td className="py-2.5 pr-4 text-right font-mono text-xs">{r.count}</td>
                      <td className="py-2.5 text-center">
                        <Badge
                          variant="outline"
                          className={`font-mono text-[10px] px-1.5 py-0 h-5 ${riskBadgeClass(r.avgRisk)}`}
                        >
                          {r.avgRisk.toFixed(1)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
