'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/jurisintel/StatCard';
import { SectionHeader } from '@/components/jurisintel/SectionHeader';
import { safeFetch } from '@/lib/safeFetch';
import {
  FolderOpen,
  AlertCircle,
  Scale,
  Users,
  AlertTriangle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// --- Types ---
interface OverviewData {
  totalCases: number;
  openCases: number;
  closedCases: number;
  convictionRate: number;
  repeatOffenders: number;
  criticalCases: number;
  activeStations: number;
  totalDistricts: number;
}

interface MonthlyTrendItem {
  month: string;
  count: number;
}

interface StatusItem {
  status: string;
  count: number;
}

interface DistrictItem {
  district: string;
  count: number;
}

interface CategoryItem {
  category: string;
  count: number;
}

interface CriticalCase {
  id: string;
  firNumber: string;
  title: string;
  district: string;
  status: string;
}

// --- Constants ---
const STATUS_COLORS: Record<string, string> = {
  open: 'oklch(0.75 0.15 70)',
  'under-investigation': 'oklch(0.70 0.10 200)',
  closed: 'oklch(0.72 0.19 162)',
  'charge-sheeted': 'oklch(0.65 0.20 295)',
  cancelled: 'oklch(0.55 0.01 250)',
};

const CATEGORY_COLORS: string[] = [
  'oklch(0.75 0.15 70)',
  'oklch(0.72 0.19 162)',
  'oklch(0.65 0.24 25)',
  'oklch(0.70 0.10 200)',
  'oklch(0.65 0.20 295)',
  'oklch(0.80 0.12 55)',
  'oklch(0.70 0.14 145)',
  'oklch(0.65 0.18 30)',
  'oklch(0.60 0.10 80)',
  'oklch(0.68 0.12 340)',
];

const STATUS_BADGE_CLASS: Record<string, string> = {
  open: 'bg-ops-amber/20 text-ops-amber border-ops-amber/30',
  'under-investigation': 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  closed: 'bg-ops-emerald/20 text-ops-emerald border-ops-emerald/30',
  'charge-sheeted': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

// --- Custom Tooltip ---
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md p-2.5 shadow-lg">
      <p className="font-mono text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-mono text-sm" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

// --- Main Dashboard ---
export function Dashboard() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [trend, setTrend] = useState<MonthlyTrendItem[]>([]);
  const [statusData, setStatusData] = useState<StatusItem[]>([]);
  const [districtData, setDistrictData] = useState<DistrictItem[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryItem[]>([]);
  const [criticalCases, setCriticalCases] = useState<CriticalCase[]>([]);
  const [lastSync, setLastSync] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const [ov, tr, st, di, ca, cr] = await Promise.all([
          safeFetch('/api/stats/overview'),
          safeFetch('/api/stats/monthly-trend'),
          safeFetch('/api/stats/by-status'),
          safeFetch('/api/stats/by-district'),
          safeFetch('/api/stats/by-category'),
          safeFetch('/api/cases?priority=critical&limit=5'),
        ]);
        if (cancelled) return;
        setOverview(ov);
        setTrend(Array.isArray(tr) ? tr : []);
        setStatusData(Array.isArray(st) ? st : []);
        setDistrictData(Array.isArray(di) ? di : []);
        setCategoryData(Array.isArray(ca) ? ca : []);
        setCriticalCases(cr?.data || []);
        setLastSync(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, []);

  const totalForCategories = categoryData.reduce((s, c) => s + c.count, 0);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <span className="font-mono-label text-[10px]">LAST SYNC: {lastSync} IST</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Cases" value={overview?.totalCases ?? '—'} icon={<FolderOpen className="w-5 h-5" />} trend={overview ? `+${overview.totalDistricts} districts` : undefined} />
        <StatCard label="Open Cases" value={overview?.openCases ?? '—'} icon={<AlertCircle className="w-5 h-5" />} severity="warning" trend={overview ? `${Math.round((overview.openCases / overview.totalCases) * 100)}% of total` : undefined} />
        <StatCard label="Conviction Rate" value={`${overview?.convictionRate ?? '—'}%`} icon={<Scale className="w-5 h-5" />} />
        <StatCard label="Repeat Offenders" value={overview?.repeatOffenders ?? '—'} icon={<Users className="w-5 h-5" />} />
        <StatCard label="Critical Cases" value={overview?.criticalCases ?? '—'} icon={<AlertTriangle className="w-5 h-5" />} severity="critical" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="ops-border lg:col-span-2">
          <CardContent className="p-4">
            <SectionHeader title="Monthly Case Trend" subtitle="Case registrations per month (2021-2024)" />
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.01 250)" />
                  <XAxis dataKey="month" tick={{ fill: 'oklch(0.55 0.01 250)', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={{ stroke: 'oklch(0.30 0.01 250)' }} />
                  <YAxis tick={{ fill: 'oklch(0.55 0.01 250)', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={{ stroke: 'oklch(0.30 0.01 250)' }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="count" stroke="oklch(0.75 0.15 70)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'oklch(0.75 0.15 70)', stroke: 'oklch(0.15 0.02 70)', strokeWidth: 2 }} name="Cases" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="ops-border">
          <CardContent className="p-4">
            <SectionHeader title="Case Status Distribution" subtitle="Current case dispositions" />
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
                    {statusData.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || 'oklch(0.40 0.01 250)'} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', color: 'oklch(0.55 0.01 250)' }} formatter={(value: string) => <span style={{ color: 'oklch(0.70 0.01 250)' }}>{value.replace(/-/g, ' ').toUpperCase()}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="ops-border">
          <CardContent className="p-4">
            <SectionHeader title="Cases by District (Top 10)" subtitle="Highest case volume districts" />
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...districtData].reverse()} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.01 250)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'oklch(0.55 0.01 250)', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={{ stroke: 'oklch(0.30 0.01 250)' }} />
                  <YAxis type="category" dataKey="district" tick={{ fill: 'oklch(0.55 0.01 250)', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={{ stroke: 'oklch(0.30 0.01 250)' }} width={120} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" fill="oklch(0.75 0.15 70)" radius={[0, 4, 4, 0]} name="Cases" barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="ops-border">
          <CardContent className="p-4">
            <SectionHeader title="Crime Category Breakdown" subtitle="Distribution by crime type" />
            <div className="space-y-3 mt-2 max-h-72 overflow-y-auto pr-1">
              {categoryData.map((cat, i) => {
                const pct = totalForCategories > 0 ? ((cat.count / totalForCategories) * 100).toFixed(1) : '0';
                return (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                    <span className="font-mono text-xs text-foreground w-32 flex-shrink-0 truncate">{cat.category.replace(/-/g, ' ')}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                    </div>
                    <span className="font-mono text-xs text-muted-foreground w-10 text-right flex-shrink-0">{cat.count}</span>
                    <span className="font-mono text-[10px] text-muted-foreground w-12 text-right flex-shrink-0">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="ops-border">
        <CardContent className="p-4">
          <SectionHeader title="Recent Critical Cases" subtitle="High-priority cases requiring immediate attention" />
          {criticalCases.length === 0 ? (
            <p className="font-mono-label text-xs text-center py-8">NO CRITICAL CASES ON RECORD</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="font-mono-label text-[10px] text-left py-2 px-3">FIR NUMBER</th>
                    <th className="font-mono-label text-[10px] text-left py-2 px-3">TITLE</th>
                    <th className="font-mono-label text-[10px] text-left py-2 px-3 hidden sm:table-cell">DISTRICT</th>
                    <th className="font-mono-label text-[10px] text-left py-2 px-3">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {criticalCases.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:bg-muted/50" tabIndex={0} role="button" aria-label={`View case ${c.firNumber}`}>
                      <td className="py-2.5 px-3 font-mono text-xs text-primary">{c.firNumber}</td>
                      <td className="py-2.5 px-3 text-sm text-foreground truncate max-w-[200px]">{c.title}</td>
                      <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground hidden sm:table-cell">{c.district}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className={`text-[10px] font-mono px-1.5 py-0 h-5 ${STATUS_BADGE_CLASS[c.status] || ''}`}>{c.status.replace(/-/g, ' ').toUpperCase()}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Skeleton ---
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end"><Skeleton className="h-4 w-32" /></div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="ops-border"><CardContent className="p-4"><Skeleton className="h-3 w-20 mb-2" /><Skeleton className="h-8 w-16" /></CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="ops-border lg:col-span-2"><CardContent className="p-4"><Skeleton className="h-4 w-40 mb-1" /><Skeleton className="h-3 w-56 mb-4" /><Skeleton className="h-64 w-full" /></CardContent></Card>
        <Card className="ops-border"><CardContent className="p-4"><Skeleton className="h-4 w-44 mb-1" /><Skeleton className="h-3 w-36 mb-4" /><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="ops-border"><CardContent className="p-4"><Skeleton className="h-4 w-48 mb-4" /><Skeleton className="h-64 w-full" /></CardContent></Card>
        <Card className="ops-border"><CardContent className="p-4"><Skeleton className="h-4 w-48 mb-4" /><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    </div>
  );
}
