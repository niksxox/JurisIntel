'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { SectionHeader } from '@/components/jurisintel/SectionHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search as SearchIcon, FileText, Database } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────
type CaseResult = {
  firNumber: string;
  title: string;
  category: string;
  district: string;
  status: string;
  priority: string;
  description: string;
};

type CasesResponse = {
  data: CaseResult[];
  total: number;
};

// ── Helpers ────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  open: 'border-ops-red/40 text-ops-red bg-ops-red/10',
  closed: 'border-ops-emerald/40 text-ops-emerald bg-ops-emerald/10',
  'charge-sheeted': 'border-ops-amber/40 text-ops-amber bg-ops-amber/10',
  'under-investigation': 'border-sky-400/40 text-sky-400 bg-sky-400/10',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'border-ops-red/40 text-ops-red bg-ops-red/10',
  high: 'border-ops-amber/40 text-ops-amber bg-ops-amber/10',
  medium: 'border-ops-emerald/40 text-ops-emerald bg-ops-emerald/10',
  low: 'border-border text-muted-foreground bg-muted/30',
};

function getBadgeClass(map: Record<string, string>, key: string): string {
  const lower = key.toLowerCase();
  return map[lower] ?? 'border-border text-muted-foreground bg-muted/30';
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-ops-amber/30 text-ops-amber rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

const EXAMPLE_CHIPS = ['theft', 'Bengaluru', 'FIR/2024', 'murder'];

// ── Main component ─────────────────────────────────────────────────────
export function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CasesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/cases?q=${encodeURIComponent(q)}&limit=20`);
      const data = (await r.json()) as CasesResponse;
      setResults(data);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="GLOBAL SEARCH"
        subtitle="Search across all case files"
      />

      {/* ── Search input ── */}
      <div className="max-w-2xl mx-auto">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search cases by FIR number, title, district, category..."
            className="pl-12 h-12 text-base font-mono ops-border text-center"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {loading && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-ops-amber border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>

      {/* ── Empty state: no query yet ── */}
      {!query.trim() && !loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Database className="w-10 h-10 text-muted-foreground/30" />
          <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
            ENTER A SEARCH QUERY
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {EXAMPLE_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => setQuery(chip)}
                className="font-mono text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-ops-amber hover:border-ops-amber/40 transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Loading state ── */}
      {loading && (
        <div className="space-y-3 max-w-2xl mx-auto">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {/* ── No results ── */}
      {searched && !loading && results && results.data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <FileText className="w-10 h-10 text-muted-foreground/30" />
          <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
            NO MATCHES FOUND
          </p>
        </div>
      )}

      {/* ── Results ── */}
      {!loading && results && results.data.length > 0 && (
        <div className="max-w-3xl mx-auto space-y-4">
          <p className="font-mono text-xs text-muted-foreground">
            {results.total} RESULTS FOR &apos;{query}&apos;
          </p>
          {results.data.map((c) => (
            <Card key={c.firNumber} className="ops-border hover:border-ops-amber/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-ops-amber font-bold">
                      {c.firNumber}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className={`font-mono text-[10px] px-1.5 py-0 h-5 ${getBadgeClass(STATUS_COLORS, c.status)}`}
                    >
                      {c.status.toUpperCase()}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`font-mono text-[10px] px-1.5 py-0 h-5 ${getBadgeClass(PRIORITY_COLORS, c.priority)}`}
                    >
                      {c.priority.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <h3 className="font-medium text-sm mb-2">
                  {highlightMatch(c.title, query)}
                </h3>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] px-1.5 py-0 h-5 border-border text-muted-foreground"
                  >
                    {c.category}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] px-1.5 py-0 h-5 border-border text-muted-foreground"
                  >
                    {c.district}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {highlightMatch(c.description?.slice(0, 120) ?? '', query)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
