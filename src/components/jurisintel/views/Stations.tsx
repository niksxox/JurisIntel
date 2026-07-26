'use client';

import { useEffect, useState, useMemo } from 'react';
import { SectionHeader } from '@/components/jurisintel/SectionHeader';
import { StatCard } from '@/components/jurisintel/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { Building2, Phone, MapPin, FileWarning } from 'lucide-react';
import { safeFetch } from '@/lib/safeFetch';

// ── Types ──────────────────────────────────────────────────────────────
type Station = {
  id: number;
  name: string;
  district: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  activeCases: number;
  totalCases: number;
};

// ── Main component ─────────────────────────────────────────────────────
export function Stations() {
  const [stations, setStations] = useState<Station[] | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await safeFetch<Station[]>('/api/stations');
        if (cancelled) return;
        setStations(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sorted = useMemo(() => {
    if (!stations) return [];
    return [...stations].sort((a, b) => b.activeCases - a.activeCases);
  }, [stations]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.district.toLowerCase().includes(q)
    );
  }, [sorted, search]);

  const totalStations = stations?.length ?? 0;
  const totalActive = stations?.reduce((s, st) => s + st.activeCases, 0) ?? 0;
  const busiest = sorted[0];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="POLICE STATIONS"
        subtitle="Karnataka State Police station directory"
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
        {stations === null ? (
          <Skeleton className="h-[88px] col-span-2 lg:col-span-3" />
        ) : (
          <>
            <StatCard
              label="TOTAL STATIONS"
              value={totalStations}
              icon={<Building2 className="w-4 h-4" />}
            />
            <StatCard
              label="TOTAL ACTIVE CASES"
              value={totalActive}
              icon={<FileWarning className="w-4 h-4" />}
              severity="warning"
            />
            <StatCard
              label="BUSIEST STATION"
              value={busiest ? busiest.name : '—'}
              icon={<MapPin className="w-4 h-4" />}
              trend={busiest ? `${busiest.activeCases} active cases` : undefined}
              severity="critical"
            />
          </>
        )}
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-md">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by station name or district..."
          className="pl-9 font-mono text-sm ops-border"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ── Table ── */}
      <Card className="ops-border">
        <CardContent className="p-0">
          {stations === null ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Building2 className="w-8 h-8 text-muted-foreground/40" />
              <p className="font-mono-label text-sm">
                {search ? 'NO MATCHING STATIONS FOUND' : 'NO STATION DATA AVAILABLE'}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-mono-label text-xs">STATION NAME</TableHead>
                    <TableHead className="font-mono-label text-xs">DISTRICT</TableHead>
                    <TableHead className="font-mono-label text-xs hidden md:table-cell">ADDRESS</TableHead>
                    <TableHead className="font-mono-label text-xs">PHONE</TableHead>
                    <TableHead className="font-mono-label text-xs text-right">ACTIVE</TableHead>
                    <TableHead className="font-mono-label text-xs text-right">TOTAL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id} className="border-border/40">
                      <TableCell className="font-medium py-2.5">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-ops-amber flex-shrink-0" />
                          {s.name}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] px-1.5 py-0 h-5 border-border text-muted-foreground"
                        >
                          {s.district}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 text-muted-foreground text-xs hidden md:table-cell max-w-[200px] truncate">
                        {s.address}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <a
                          href={`tel:${s.phone}`}
                          className="font-mono text-xs text-ops-amber hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          {s.phone}
                        </a>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] px-1.5 py-0 h-5 border-ops-amber/40 text-ops-amber bg-ops-amber/10"
                        >
                          {s.activeCases}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 text-right font-mono text-xs">
                        {s.totalCases}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
