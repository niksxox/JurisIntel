'use client';

import { useEffect, useMemo, useState } from 'react';
import { SectionHeader } from '@/components/jurisintel/SectionHeader';
import { StatCard } from '@/components/jurisintel/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Flame, Layers, TrendingUp } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────
type DistrictRow = { district: string; count: number };
type HotspotRow = {
  district: string;
  count: number;
  severity_avg: number;
  topCategory: string | null;
};

// ── District → region mapping (from seed.ts) ───────────────────────────
const DISTRICT_REGION: Record<string, string> = {
  'Bengaluru Urban': 'South',
  'Bengaluru Rural': 'South',
  Mysuru: 'South',
  Chamarajanagar: 'South',
  Ramanagara: 'South',
  Chikkaballapura: 'South',
  Mangaluru: 'Coastal',
  'Dakshina Kannada': 'Coastal',
  Udupi: 'Coastal',
  'Uttara Kannada': 'Coastal',
  'Hubli-Dharwad': 'North',
  Belagavi: 'North',
  Kalaburagi: 'North',
  Ballari: 'North',
  Vijayapura: 'North',
  Koppal: 'North',
  Raichur: 'North',
  Yadgir: 'North',
  Bidar: 'North',
  Gadag: 'North',
  Haveri: 'North',
  Bagalkote: 'North',
  Davanagere: 'Central',
  Tumakuru: 'Central',
  Hassan: 'Central',
  Mandya: 'Central',
  Chitradurga: 'Central',
  Shivamogga: 'Malnad',
  Chikkamagaluru: 'Malnad',
  Kodagu: 'Malnad',
};

const REGION_ORDER = ['North', 'South', 'Central', 'Coastal', 'Malnad'] as const;
const REGION_NOTE: Record<string, string> = {
  North: 'Hyderabad-Karnataka plateau · high crime density belt',
  South: 'Bengaluru-Mysuru urban corridor',
  Central: 'Central Karnataka plains',
  Coastal: 'Arabian Sea coastal districts',
  Malnad: 'Western Ghats forested belt',
};

// ── Helpers ────────────────────────────────────────────────────────────
function regionOf(d: string): string {
  return DISTRICT_REGION[d] ?? 'Central';
}

function densityTint(pct: number): { bg: string; border: string; bar: string; label: string } {
  // pct 0..1
  if (pct >= 0.75) {
    return {
      bg: 'rgba(255, 80, 60, 0.18)',
      border: 'border-ops-red/40',
      bar: 'linear-gradient(90deg, oklch(0.75 0.15 70), oklch(0.65 0.24 25))',
      label: 'CRITICAL',
    };
  }
  if (pct >= 0.5) {
    return {
      bg: 'rgba(255, 140, 50, 0.14)',
      border: 'border-ops-amber/40',
      bar: 'linear-gradient(90deg, oklch(0.80 0.12 55), oklch(0.75 0.15 70))',
      label: 'HIGH',
    };
  }
  if (pct >= 0.25) {
    return {
      bg: 'rgba(255, 200, 80, 0.10)',
      border: 'border-ops-amber/25',
      bar: 'linear-gradient(90deg, oklch(0.82 0.10 80), oklch(0.78 0.13 90))',
      label: 'MODERATE',
    };
  }
  return {
    bg: 'rgba(80, 220, 140, 0.08)',
    border: 'border-ops-emerald/30',
    bar: 'linear-gradient(90deg, oklch(0.70 0.14 145), oklch(0.72 0.19 162))',
    label: 'LOW',
  };
}

const DENSITY_LABELS: Record<string, string> = {
  CRITICAL: 'text-ops-red',
  HIGH: 'text-ops-amber',
  MODERATE: 'text-ops-amber/80',
  LOW: 'text-ops-emerald',
};

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed: ${url}`);
  return (await r.json()) as T;
}

// ── Main component ─────────────────────────────────────────────────────
export function CrimeMap() {
  const [districts, setDistricts] = useState<DistrictRow[] | null>(null);
  const [hotspots, setHotspots] = useState<HotspotRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [d, h] = await Promise.all([
          getJSON<DistrictRow[]>('/api/stats/by-district?all=true'),
          getJSON<HotspotRow[]>('/api/trends/hotspots'),
        ]);
        if (cancelled) return;
        setDistricts(d);
        setHotspots(h);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Merge district + hotspot info ──
  const merged = useMemo(() => {
    if (!districts) return [];
    const hotspotMap = new Map(hotspots?.map((h) => [h.district, h]));
    return districts.map((d) => {
      const hs = hotspotMap.get(d.district);
      return {
        district: d.district,
        count: d.count,
        region: regionOf(d.district),
        severity_avg: hs?.severity_avg ?? null,
        topCategory: hs?.topCategory ?? null,
      };
    });
  }, [districts, hotspots]);

  const maxCount = useMemo(
    () => (merged.length > 0 ? Math.max(...merged.map((m) => m.count)) : 0),
    [merged]
  );
  const totalCases = useMemo(
    () => merged.reduce((s, m) => s + m.count, 0),
    [merged]
  );
  const topDistrict = useMemo(
    () => [...merged].sort((a, b) => b.count - a.count)[0],
    [merged]
  );
  const avgCases = merged.length > 0 ? Math.round(totalCases / merged.length) : 0;

  // ── Group by region ──
  const byRegion = useMemo(() => {
    const m = new Map<string, typeof merged>();
    for (const r of REGION_ORDER) m.set(r, []);
    for (const d of merged) {
      const arr = m.get(d.region) ?? [];
      arr.push(d);
      m.set(d.region, arr);
    }
    // Sort each region by count desc
    for (const [, arr] of m) arr.sort((a, b) => b.count - a.count);
    return m;
  }, [merged]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="CRIME MAP"
        subtitle="District density heat-grid · Karnataka State Police"
      />

      {error && (
        <div className="ops-border rounded-md bg-ops-red/10 border-ops-red/30 p-3">
          <p className="font-mono-label text-ops-red">MAP FEED ERROR: {error}</p>
        </div>
      )}

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {districts === null ? (
          <Skeleton className="h-[88px] col-span-2 lg:col-span-4" />
        ) : (
          <>
            <StatCard
              label="TOTAL DISTRICTS"
              value={merged.length}
              icon={<Layers className="w-4 h-4" />}
            />
            <StatCard
              label="TOTAL CASES"
              value={totalCases}
              icon={<TrendingUp className="w-4 h-4" />}
              severity="warning"
            />
            <StatCard
              label="HIGHEST DENSITY"
              value={topDistrict ? topDistrict.district : '—'}
              icon={<Flame className="w-4 h-4" />}
              trend={topDistrict ? `${topDistrict.count} cases` : undefined}
              severity="critical"
            />
            <StatCard
              label="AVG / DISTRICT"
              value={avgCases}
              icon={<MapPin className="w-4 h-4" />}
            />
          </>
        )}
      </div>

      {/* ── Density legend ── */}
      <Card className="ops-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-mono-label">DENSITY SCALE</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-ops-emerald">LOW</span>
                <div
                  className="w-32 sm:w-48 h-2.5 rounded-full"
                  style={{
                    background:
                      'linear-gradient(90deg, oklch(0.72 0.19 162) 0%, oklch(0.82 0.10 80) 35%, oklch(0.75 0.15 70) 65%, oklch(0.65 0.24 25) 100%)',
                  }}
                />
                <span className="font-mono text-[10px] text-ops-red">HIGH</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] as const).map((l) => (
                <Badge
                  key={l}
                  variant="outline"
                  className={`font-mono text-[10px] px-1.5 py-0 h-4 ${DENSITY_LABELS[l]} border-current/30`}
                >
                  {l}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Region grids ── */}
      {districts === null ? (
        <Skeleton className="w-full h-[400px]" />
      ) : merged.length === 0 ? (
        <Card className="ops-border">
          <CardContent className="p-12 text-center">
            <p className="font-mono-label">NO DISTRICT DATA AVAILABLE</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {REGION_ORDER.map((region) => {
            const list = byRegion.get(region) ?? [];
            if (list.length === 0) return null;
            return (
              <div key={region} className="space-y-3">
                <div className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
                  <div>
                    <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">
                      {region} KARNATAKA
                    </h3>
                    <p className="font-mono-label text-[10px] mt-0.5">
                      {REGION_NOTE[region]} · {list.length} districts
                    </p>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {list.reduce((s, d) => s + d.count, 0)} cases
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {list.map((d) => {
                    const pct = maxCount > 0 ? d.count / maxCount : 0;
                    const tint = densityTint(pct);
                    return (
                      <Card
                        key={d.district}
                        className={`ops-border relative overflow-hidden border ${tint.border}`}
                        style={{ background: tint.bg }}
                      >
                        <CardContent className="p-3 relative z-10">
                          <div className="flex items-start justify-between gap-1 mb-2">
                            <p className="font-mono text-xs font-semibold leading-tight">
                              {d.district}
                            </p>
                            <span className={`font-mono text-[9px] font-bold ${DENSITY_LABELS[tint.label]}`}>
                              {tint.label}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-1 mb-2">
                            <span className="font-mono text-2xl font-bold text-foreground">
                              {d.count}
                            </span>
                            <span className="font-mono-label text-[10px]">cases</span>
                          </div>
                          {/* Density bar */}
                          <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden mb-2">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(8, pct * 100)}%`, background: tint.bar }}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-1 text-[10px]">
                            {d.topCategory ? (
                              <Badge
                                variant="outline"
                                className="font-mono text-[9px] px-1.5 py-0 h-4 border-border text-muted-foreground truncate max-w-[90px]"
                              >
                                {d.topCategory}
                              </Badge>
                            ) : (
                              <span className="font-mono text-[9px] text-muted-foreground/60">—</span>
                            )}
                            {d.severity_avg !== null && (
                              <span className="font-mono text-[9px] text-muted-foreground">
                                SEV {d.severity_avg.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </CardContent>
                        {/* Background density glow */}
                        <div
                          className="absolute inset-0 pointer-events-none opacity-30"
                          style={{
                            background: `radial-gradient(circle at 80% 20%, ${
                              pct >= 0.75
                                ? 'oklch(0.65 0.24 25 / 0.25)'
                                : pct >= 0.5
                                  ? 'oklch(0.75 0.15 70 / 0.2)'
                                  : pct >= 0.25
                                    ? 'oklch(0.80 0.12 55 / 0.15)'
                                    : 'oklch(0.72 0.19 162 / 0.10)'
                            }, transparent 70%)`,
                          }}
                        />
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
