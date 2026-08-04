'use client';

import { useEffect, useState, useCallback } from 'react';
import { SectionHeader } from '@/components/jurisintel/SectionHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  FolderOpen, Search, ChevronLeft, ChevronRight, X, MapPin, Calendar, Scale, AlertTriangle, FileText, Users, Shield, Link2,
} from 'lucide-react';
import { safeFetch } from '@/lib/safeFetch';

const CATEGORIES = ['Theft', 'Assault', 'Murder', 'Cybercrime', 'Fraud', 'Burglary', 'Kidnapping', 'Drug-Related', 'Sexual-Offense', 'Traffic'];
const STATUSES = ['open', 'under-investigation', 'closed', 'charge-sheeted', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const categoryColor: Record<string, string> = {
  Theft: 'bg-amber/15 text-amber border-amber/30',
  Assault: 'bg-red/15 text-red border-red/30',
  Murder: 'bg-red/25 text-red border-red/40',
  Cybercrime: 'bg-sky/15 text-sky border-sky/30',
  Fraud: 'bg-violet/15 text-violet border-violet/30',
  Burglary: 'bg-amber/15 text-amber border-amber/30',
  Kidnapping: 'bg-magenta/15 text-magenta border-magenta/30',
  'Drug-Related': 'bg-emerald/15 text-emerald border-emerald/30',
  'Sexual-Offense': 'bg-red/20 text-red border-red/40',
  Traffic: 'bg-sky/15 text-sky border-sky/30',
};

const priorityColor: Record<string, string> = {
  critical: 'bg-red/20 text-red border-red/40',
  high: 'bg-amber/20 text-amber border-amber/40',
  medium: 'bg-sky/15 text-sky border-sky/30',
  low: 'bg-muted text-muted-foreground border-border',
};

const statusColor: Record<string, string> = {
  open: 'bg-amber/15 text-amber border-amber/30',
  'under-investigation': 'bg-sky/15 text-sky border-sky/30',
  closed: 'bg-emerald/15 text-emerald border-emerald/30',
  'charge-sheeted': 'bg-violet/15 text-violet border-violet/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

function fmtDate(d: string | Date) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface CaseRow {
  id: string;
  firNumber: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  district: string;
  registeredAt: string;
  station: { name: string; district: string };
  _count?: { accused: number; victims: number };
}

interface CaseDetail extends CaseRow {
  description: string;
  modusOperandi: string;
  location: string;
  weaponUsed: string | null;
  severity: number;
  incidentDate: string;
  closedAt: string | null;
  station: { name: string; district: string; phone: string };
  accused: Array<{ id: string; name: string; age: number; gender: string; occupation: string; address: string; priorConvictions: number; riskScore: number; status: string; isWanted: boolean }>;
  victims: Array<{ id: string; name: string; age: number; gender: string; occupation: string | null; injurySeverity: string | null }>;
  evidence: Array<{ id: string; type: string; description: string; collectedBy: string; status: string }>;
  networkEdgesFrom: Array<{ id: string; relationType: string; strength: number; relatedCaseId: string; relatedCase: { id: string; firNumber: string; title: string; category: string; district: string } | null }>;
}

export function Cases() {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [district, setDistrict] = useState('all');
  const [priority, setPriority] = useState('all');
  const [districts, setDistricts] = useState<string[]>([]);
  const [data, setData] = useState<{ data: CaseRow[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // load districts once
  useEffect(() => {
    safeFetch<string[]>('/api/cases/districts').then(d => setDistricts(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  // fetch list
  useEffect(() => {
    // Reset to loading state for the new fetch cycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page), limit: String(limit),
      ...(debouncedQ && { q: debouncedQ }),
      ...(category !== 'all' && { category }),
      ...(status !== 'all' && { status }),
      ...(district !== 'all' && { district }),
      ...(priority !== 'all' && { priority }),
    });
    safeFetch(`/api/cases?${params}`)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [page, limit, debouncedQ, category, status, district, priority]);

  // fetch detail — reset to loading state when selection changes
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    // Intentionally resetting local UI state to reflect a new fetch cycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetailLoading(true);
    setDetail(null);
    safeFetch(`/api/cases/${selectedId}`)
      .then(d => { if (!cancelled) setDetail(d); })
      .catch(() => { if (!cancelled) setDetail(null); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const resetFilters = useCallback(() => {
    setQ(''); setDebouncedQ(''); setCategory('all'); setStatus('all'); setDistrict('all'); setPriority('all'); setPage(1);
  }, []);

  const total = data?.total ?? 0;
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="CASE FILES"
        subtitle="First Information Records — Karnataka State Police"
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search FIR number, title, description..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('-', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={district} onValueChange={(v) => { setDistrict(v); setPage(1); }}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="District" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Districts</SelectItem>
                  {districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1); }}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  {PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(q || category !== 'all' || status !== 'all' || district !== 'all' || priority !== 'all') && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="w-fit text-xs font-mono-label">
                <X className="w-3 h-3 mr-1" /> CLEAR FILTERS
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="font-mono-label">FIR NUMBER</TableHead>
                  <TableHead className="font-mono-label">TITLE</TableHead>
                  <TableHead className="font-mono-label">CATEGORY</TableHead>
                  <TableHead className="font-mono-label hidden md:table-cell">DISTRICT</TableHead>
                  <TableHead className="font-mono-label">PRIORITY</TableHead>
                  <TableHead className="font-mono-label">STATUS</TableHead>
                  <TableHead className="font-mono-label hidden sm:table-cell">REGISTERED</TableHead>
                  <TableHead className="font-mono-label text-right">ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !data || data.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground font-mono">
                      NO CASES MATCH FILTERS
                    </TableCell>
                  </TableRow>
                ) : (
                  data.data.map((c) => (
                    <TableRow
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <TableCell className="font-mono text-xs text-amber">{c.firNumber}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{c.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${categoryColor[c.category] || ''}`}>{c.category}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{c.district}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] capitalize ${priorityColor[c.priority] || ''}`}>{c.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${statusColor[c.status] || ''}`}>{c.status.replace('-', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell font-mono text-xs text-muted-foreground">{fmtDate(c.registeredAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-7 text-xs font-mono-label">VIEW</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <Separator />
          <div className="flex items-center justify-between px-4 py-3">
            <span className="font-mono-label text-[11px]">
              {loading ? 'LOADING...' : `SHOWING ${start}–${end} OF ${total} CASES`}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-mono text-xs px-2">PAGE {page}</span>
              <Button variant="outline" size="sm" disabled={end >= total || loading} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <Sheet open={!!selectedId} onOpenChange={(o) => { if (!o) { setSelectedId(null); setDetail(null); } }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto bg-card border-border p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border sticky top-0 bg-card z-10">
            <SheetTitle className="font-mono text-amber text-sm tracking-wider">
              {detailLoading ? <Skeleton className="h-5 w-40" /> : detail?.firNumber}
            </SheetTitle>
            <p className="text-sm text-foreground mt-1">{detail?.title}</p>
            {detail && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="outline" className={`text-[10px] ${statusColor[detail.status]}`}>{detail.status.replace('-', ' ')}</Badge>
                <Badge variant="outline" className={`text-[10px] capitalize ${priorityColor[detail.priority]}`}>{detail.priority}</Badge>
                <Badge variant="outline" className={`text-[10px] ${categoryColor[detail.category]}`}>{detail.category}</Badge>
              </div>
            )}
          </SheetHeader>

          {detailLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : detail ? (
            <div className="px-6 py-4 space-y-6">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <InfoItem icon={Calendar} label="INCIDENT DATE" value={fmtDate(detail.incidentDate)} />
                <InfoItem icon={Calendar} label="REGISTERED" value={fmtDate(detail.registeredAt)} />
                <InfoItem icon={MapPin} label="LOCATION" value={detail.location} />
                <InfoItem icon={MapPin} label="DISTRICT" value={detail.district} />
                <InfoItem icon={FileText} label="MODUS OPERANDI" value={detail.modusOperandi} />
                <InfoItem icon={AlertTriangle} label="WEAPON" value={detail.weaponUsed || 'None'} />
              </div>

              {/* Severity */}
              <div>
                <p className="font-mono-label mb-2">SEVERITY SCORE</p>
                <div className="flex items-center gap-3">
                  <Progress value={detail.severity * 10} className="h-2" />
                  <span className="font-mono text-sm font-bold">{detail.severity}/10</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="font-mono-label mb-2">DESCRIPTION</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{detail.description}</p>
              </div>

              <Separator />

              {/* Station */}
              <div>
                <p className="font-mono-label mb-2 flex items-center gap-2"><Shield className="w-3 h-3" /> STATION</p>
                <Card className="bg-muted/30">
                  <CardContent className="p-3 text-xs space-y-1">
                    <p className="font-medium">{detail.station.name}</p>
                    <p className="text-muted-foreground">{detail.station.district}</p>
                    <p className="font-mono text-amber">{detail.station.phone}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Accused */}
              {detail.accused.length > 0 && (
                <div>
                  <p className="font-mono-label mb-2 flex items-center gap-2"><Users className="w-3 h-3" /> ACCUSED ({detail.accused.length})</p>
                  <div className="space-y-2">
                    {detail.accused.map(a => (
                      <Card key={a.id} className="bg-muted/20">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{a.name}</span>
                            {a.isWanted && <Badge className="bg-red/20 text-red border-red/40 text-[10px]">WANTED</Badge>}
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                            <span>{a.age} yrs / {a.gender}</span>
                            <span>{a.occupation}</span>
                            <span className="col-span-2">{a.address}</span>
                            <span>Prior: {a.priorConvictions}</span>
                            <Badge variant="outline" className="text-[10px] w-fit">{a.status.replace('-', ' ')}</Badge>
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px] font-mono-label mb-1">
                              <span>RISK SCORE</span><span>{a.riskScore}</span>
                            </div>
                            <Progress
                              value={a.riskScore}
                              className="h-1.5"
                              // color via style hack
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Victims */}
              {detail.victims.length > 0 && (
                <div>
                  <p className="font-mono-label mb-2 flex items-center gap-2"><Users className="w-3 h-3" /> VICTIMS ({detail.victims.length})</p>
                  <div className="space-y-2">
                    {detail.victims.map(v => (
                      <Card key={v.id} className="bg-muted/20">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="text-xs">
                            <p className="font-medium text-sm">{v.name}</p>
                            <p className="text-muted-foreground">{v.age} yrs / {v.gender}{v.occupation ? ` · ${v.occupation}` : ''}</p>
                          </div>
                          {v.injurySeverity && v.injurySeverity !== 'none' && (
                            <Badge variant="outline" className={`text-[10px] ${v.injurySeverity === 'fatal' ? 'bg-red/15 text-red border-red/30' : 'bg-amber/15 text-amber border-amber/30'}`}>
                              {v.injurySeverity}
                            </Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidence */}
              {detail.evidence.length > 0 && (
                <div>
                  <p className="font-mono-label mb-2 flex items-center gap-2"><FileText className="w-3 h-3" /> EVIDENCE ({detail.evidence.length})</p>
                  <div className="space-y-2">
                    {detail.evidence.map(e => (
                      <Card key={e.id} className="bg-muted/20">
                        <CardContent className="p-3 flex items-start justify-between gap-2">
                          <div className="text-xs flex-1">
                            <p>{e.description}</p>
                            <p className="text-muted-foreground mt-1">Collected by {e.collectedBy}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] capitalize">{e.type}</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Network */}
              {detail.networkEdgesFrom.length > 0 && (
                <div>
                  <p className="font-mono-label mb-2 flex items-center gap-2"><Link2 className="w-3 h-3" /> NETWORK CONNECTIONS ({detail.networkEdgesFrom.length})</p>
                  <div className="space-y-2">
                    {detail.networkEdgesFrom.map(n => (
                      <Card key={n.id} className="bg-muted/20">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="text-xs">
                            <p className="font-mono text-amber">{n.relatedCase?.firNumber || n.relatedCaseId.slice(-8).toUpperCase()}</p>
                            <p className="text-muted-foreground capitalize">{n.relationType.replace(/-/g, ' ')}</p>
                            {n.relatedCase?.title && <p className="text-muted-foreground/70 text-[10px] mt-0.5 max-w-[200px] truncate">{n.relatedCase.title}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={n.strength} className="h-1.5 w-16" />
                            <span className="font-mono text-[10px] text-muted-foreground">{n.strength}%</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground font-mono text-sm">FAILED TO LOAD CASE</div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div>
      <p className="font-mono-label flex items-center gap-1 mb-0.5"><Icon className="w-3 h-3" />{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
