'use client';

import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/jurisintel/SectionHeader';
import { StatCard } from '@/components/jurisintel/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Users, Gauge, Flame, Fingerprint, MapPin } from 'lucide-react';

interface WantedOffender {
  id: string;
  name: string;
  age: number;
  gender: string;
  occupation: string;
  district: string;
  riskScore: number;
  priorConvictions: number;
  status: string;
  isWanted: boolean;
  case?: { firNumber: string; category: string; title: string };
}

function riskTone(score: number) {
  if (score >= 75) return { bar: '[&>div]:bg-red', badge: 'bg-red/20 text-red border-red/40', label: 'CRITICAL' };
  if (score >= 50) return { bar: '[&>div]:bg-amber', badge: 'bg-amber/20 text-amber border-amber/40', label: 'HIGH' };
  return { bar: '[&>div]:bg-sky', badge: 'bg-sky/15 text-sky border-sky/30', label: 'ELEVATED' };
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

export function WantedList() {
  const [data, setData] = useState<WantedOffender[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/risk/wanted')
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const total = data?.length ?? 0;
  const avgRisk = data && data.length ? Math.round(data.reduce((s, o) => s + o.riskScore, 0) / data.length) : 0;
  const highest = data && data.length ? Math.max(...data.map(o => o.riskScore)) : 0;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="WANTED PERSONS"
        subtitle="Absconding & high-risk offenders — active warrants"
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="TOTAL WANTED" value={loading ? '—' : total} icon={<AlertTriangle className="w-5 h-5" />} severity="critical" />
        <StatCard label="AVERAGE RISK" value={loading ? '—' : `${avgRisk}`} icon={<Gauge className="w-5 h-5" />} severity="warning" />
        <StatCard label="HIGHEST RISK" value={loading ? '—' : `${highest}`} icon={<Flame className="w-5 h-5" />} severity="critical" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 w-full rounded-lg" />)}
        </div>
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald/15 flex items-center justify-center">
              <Users className="w-6 h-6 text-emerald" />
            </div>
            <p className="font-mono text-sm uppercase tracking-wider text-muted-foreground">NO ACTIVE WARRANTS</p>
            <p className="text-xs text-muted-foreground">All offenders currently in custody</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((o) => {
            const tone = riskTone(o.riskScore);
            return (
              <Card key={o.id} className="ops-border border-red/20 hover:border-red/40 transition-colors">
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-full bg-red/15 border border-red/30 flex items-center justify-center font-mono font-bold text-red text-sm flex-shrink-0">
                      {initials(o.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{o.name}</p>
                        <Badge className="bg-red/20 text-red border border-red/40 text-[9px] px-1.5 py-0 h-4 font-mono">WANTED</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{o.district}
                      </p>
                    </div>
                  </div>

                  {/* Risk score */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono-label text-[10px]">RISK SCORE</span>
                      <Badge variant="outline" className={`text-[9px] ${tone.badge}`}>{tone.label}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={o.riskScore} className={`h-2 ${tone.bar}`} />
                      <span className="font-mono text-sm font-bold w-8 text-right">{o.riskScore}</span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <Detail label="AGE" value={`${o.age}`} />
                    <Detail label="GENDER" value={o.gender} />
                    <Detail label="OCCUPATION" value={o.occupation} />
                    <Detail label="PRIOR" value={`${o.priorConvictions} convictions`} />
                  </div>

                  {/* Case */}
                  {o.case && (
                    <div className="pt-2 border-t border-border">
                      <p className="font-mono-label text-[9px] mb-1">ASSOCIATED CASE</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] text-amber">{o.case.firNumber}</span>
                        <Badge variant="outline" className="text-[9px]">{o.case.category}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">{o.case.title}</p>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="pt-2 border-t border-border flex items-center gap-2">
                    <Fingerprint className="w-3 h-3 text-red" />
                    <span className="font-mono-label text-[9px] text-red">ALERT LEVEL: HIGH</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono-label text-[9px]">{label}</p>
      <p className="text-foreground truncate">{value}</p>
    </div>
  );
}
