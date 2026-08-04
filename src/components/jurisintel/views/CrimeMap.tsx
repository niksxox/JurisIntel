'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { SectionHeader } from '@/components/jurisintel/SectionHeader';
import { StatCard } from '@/components/jurisintel/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPin, Flame, Layers, TrendingUp, Filter, ZoomIn, ZoomOut } from 'lucide-react';
import { safeFetch } from '@/lib/safeFetch';

// ── Types ──────────────────────────────────────────────────────────────
type DistrictRow = { district: string; count: number };
type HotspotRow = {
  district: string;
  count: number;
  severity_avg: number;
  topCategory: string | null;
};
type StationRow = {
  id: string; name: string; district: string;
  latitude: number; longitude: number;
  activeCases: number; totalCases: number;
};
type HeatpointRow = {
  lat: number; lng: number; weight: number;
  district: string; category: string;
};

// ── District coordinates ───────────────────────────────────────────────
const DISTRICT_COORDS: Record<string, [number, number]> = {
  'Bengaluru Urban': [12.9716, 77.5946],
  'Bengaluru Rural': [13.0, 77.5],
  Mysuru: [12.2958, 76.6394],
  Mangaluru: [12.9141, 74.8560],
  'Hubli-Dharwad': [15.3647, 75.1240],
  Belagavi: [15.8522, 74.4987],
  Kalaburagi: [17.3297, 76.8343],
  Davanagere: [14.4634, 75.9234],
  Ballari: [15.1394, 76.9210],
  Vijayapura: [16.8302, 75.7104],
  Shivamogga: [13.9299, 75.5679],
  Tumakuru: [13.0674, 77.1006],
  Chikkamagaluru: [13.3177, 75.7734],
  Hassan: [13.0077, 76.0984],
  'Dakshina Kannada': [12.9141, 74.8560],
  Udupi: [13.3409, 74.7420],
  'Uttara Kannada': [14.5460, 74.4940],
  Kodagu: [12.3375, 75.8069],
  Chamarajanagar: [11.9228, 76.9390],
  Mandya: [12.5236, 76.8951],
  Chitradurga: [14.2271, 76.3976],
  Koppal: [15.3527, 76.1528],
  Raichur: [16.2076, 77.3463],
  Yadgir: [16.7700, 77.1300],
  Bidar: [17.9104, 77.5199],
  Gadag: [15.4359, 75.6148],
  Haveri: [14.7956, 75.3989],
  Bagalkote: [16.1850, 75.6901],
  Ramanagara: [12.7175, 77.2713],
  Chikkaballapura: [13.4344, 78.0486],
  Kolar: [13.1367, 78.1291],
  Vijayanagara: [15.1833, 76.3948],
};

const CATEGORIES = ['All', 'Theft', 'Assault', 'Murder', 'Cybercrime', 'Fraud',
  'Burglary', 'Kidnapping', 'Drug-Related', 'Sexual-Offense', 'Traffic'];

const SEVERITY_OPTIONS = ['All', 'Low (1-3)', 'Medium (4-6)', 'High (7-8)', 'Critical (9-10)'];

const YEAR_OPTIONS = ['All', '2022', '2023', '2024', '2025', '2026'];

const CATEGORY_COLORS: Record<string, string> = {
  Theft: '#f59e0b',
  Assault: '#ef4444',
  Murder: '#dc2626',
  Cybercrime: '#3b82f6',
  Fraud: '#8b5cf6',
  Burglary: '#f97316',
  Kidnapping: '#ec4899',
  'Drug-Related': '#22c55e',
  'Sexual-Offense': '#ef4444',
  Traffic: '#06b6d4',
};

// ── Bengaluru area stations for detailed view ─────────────────────────
const BENGALURU_AREAS: { lat: number; lng: number; name: string }[] = [
  { lat: 12.9716, lng: 77.6070, name: 'MG Road' },
  { lat: 12.9304, lng: 77.5838, name: 'Jayanagar' },
  { lat: 12.9967, lng: 77.5908, name: 'Malleshwaram' },
  { lat: 12.9784, lng: 77.6408, name: 'Indiranagar' },
  { lat: 12.9345, lng: 77.5518, name: 'Rajajinagar' },
  { lat: 12.9665, lng: 77.5458, name: 'Vijayanagar' },
  { lat: 12.9400, lng: 77.5700, name: 'Basavanagudi' },
  { lat: 12.9500, lng: 77.5100, name: 'Market Yard' },
  { lat: 12.9716, lng: 77.5700, name: 'City Market' },
  { lat: 12.9800, lng: 77.5950, name: 'Cubbon Park' },
  { lat: 12.9600, lng: 77.7000, name: 'Koramangala' },
  { lat: 12.9698, lng: 77.7500, name: 'HSR Layout' },
  { lat: 12.9591, lng: 77.7086, name: 'BTM Layout' },
  { lat: 13.0358, lng: 77.5970, name: 'Yelahanka' },
  { lat: 12.8399, lng: 77.6770, name: 'Electronic City' },
  { lat: 12.9698, lng: 77.7500, name: 'Whitefield' },
  { lat: 12.9200, lng: 77.5900, name: 'Lalbagh' },
  { lat: 12.9910, lng: 77.5570, name: 'Yeswanthpur' },
  { lat: 12.9550, lng: 77.6200, name: 'Ashok Nagar' },
  { lat: 12.9850, lng: 77.6100, name: 'Shivajinagar' },
];

// ── Main component ─────────────────────────────────────────────────────
export function CrimeMap() {
  const [districts, setDistricts] = useState<DistrictRow[] | null>(null);
  const [hotspots, setHotspots] = useState<HotspotRow[] | null>(null);
  const [stations, setStations] = useState<StationRow[] | null>(null);
  const [heatpoints, setHeatpoints] = useState<HeatpointRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');

  // Refs for Leaflet objects (avoids SSR issues)
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const heatLayerRef = useRef<any>(null);
  const stationsLayerRef = useRef<any>(null);

  // Fetch data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [d, h, s, hp] = await Promise.all([
          safeFetch<DistrictRow[]>('/api/stats/by-district?all=true'),
          safeFetch<HotspotRow[]>('/api/trends/hotspots'),
          safeFetch<StationRow[]>('/api/stations'),
          safeFetch<HeatpointRow[]>('/api/trends/hotspots'), // reuse hotspot data for heatmap
        ]);
        if (cancelled) return;
        setDistricts(Array.isArray(d) ? d : null);
        setHotspots(Array.isArray(h) ? h : null);
        setStations(Array.isArray(s) ? s : null);
        setHeatpoints(Array.isArray(hp) ? null : null);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Initialize Leaflet map (client-side only)
  useEffect(() => {
    if (loading || mapReady) return;
    if (typeof window === 'undefined') return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;

      if (mapInstanceRef.current) return;

      const map = L.map('crime-map-container', {
        center: [14.5, 76.5],
        zoom: 7,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

      mapInstanceRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);
      stationsLayerRef.current = L.layerGroup().addTo(map);

      setMapReady(true);
    };

    initMap();
  }, [loading, mapReady]);

  // Filtered data
  const filteredDistricts = useMemo(() => {
    if (!districts) return [];
    let result = districts;
    if (categoryFilter !== 'All') {
      const catDistricts = new Set(
        (hotspots || []).filter(h => h.topCategory === categoryFilter).map(h => h.district)
      );
      if (catDistricts.size > 0) result = result.filter(d => catDistricts.has(d.district));
    }
    return result;
  }, [districts, hotspots, categoryFilter]);

  // Update map markers when data changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const stationsLayer = stationsLayerRef.current;

    markersLayer.clearLayers();
    stationsLayer.clearLayers();

    if (!filteredDistricts.length) return;

    const maxCount = Math.max(...filteredDistricts.map(d => d.count), 1);

    // District circle markers
    const bounds: [number, number][] = [];
    for (const d of filteredDistricts) {
      const coords = DISTRICT_COORDS[d.district];
      if (!coords) continue;
      const intensity = d.count / maxCount;
      const radius = 8 + intensity * 20;
      const color = intensity >= 0.75 ? '#dc2626' : intensity >= 0.5 ? '#f59e0b' : intensity >= 0.25 ? '#eab308' : '#22c55e';

      const marker = L.circleMarker(coords, {
        radius,
        fillColor: color,
        color: color,
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.35,
      });

      const hs = hotspots?.find(h => h.district === d.district);
      marker.bindPopup(
        `<div style="font-family:monospace;min-width:200px">` +
        `<div style="font-size:13px;font-weight:bold;margin-bottom:6px;color:#f59e0b">${d.district}</div>` +
        `<div style="font-size:11px;margin-bottom:4px"><strong>Total Cases:</strong> ${d.count}</div>` +
        (hs ? `<div style="font-size:11px;margin-bottom:4px"><strong>Avg Severity:</strong> ${hs.severity_avg.toFixed(1)}/10</div>` : '') +
        (hs?.topCategory ? `<div style="font-size:11px;margin-bottom:4px"><strong>Top Category:</strong> ${hs.topCategory}</div>` : '') +
        `<div style="font-size:10px;color:#888;margin-top:4px">Click to zoom in</div>` +
        `</div>`,
        { className: 'dark-popup' }
      );
      marker.on('click', () => map.flyTo(coords, 10, { duration: 1 }));
      markersLayer.addLayer(marker);
      bounds.push(coords);
    }

    // Police station markers (limited to top districts for performance)
    const stationData = stations || [];
    const shownStationIds = new Set<string>();
    const topDistrictNames = filteredDistricts.slice(0, 15).map(d => d.district);

    for (const s of stationData) {
      if (!topDistrictNames.includes(s.district)) continue;
      if (shownStationIds.has(s.id)) continue;
      shownStationIds.add(s.id);

      const icon = L.divIcon({
        html: `<div style="width:8px;height:8px;background:#3b82f6;border:1px solid #60a5fa;border-radius:50%;box-shadow:0 0 6px rgba(59,130,246,0.5)"></div>`,
        className: '',
        iconSize: [8, 8],
        iconAnchor: [4, 4],
      });

      const sm = L.marker([s.latitude, s.longitude], { icon });
      sm.bindPopup(
        `<div style="font-family:monospace;min-width:180px">` +
        `<div style="font-size:12px;font-weight:bold;margin-bottom:4px">${s.name}</div>` +
        `<div style="font-size:11px"><strong>District:</strong> ${s.district}</div>` +
        `<div style="font-size:11px"><strong>Active Cases:</strong> ${s.activeCases}</div>` +
        `<div style="font-size:11px"><strong>Total Cases:</strong> ${s.totalCases}</div>` +
        `</div>`,
        { className: 'dark-popup' }
      );
      stationsLayer.addLayer(sm);
    }

    // Bengaluru area markers when zoomed in
    if (map.getZoom() >= 10) {
      for (const area of BENGALURU_AREAS) {
        const icon = L.divIcon({
          html: `<div style="width:6px;height:6px;background:#f59e0b;border:1px solid #fbbf24;border-radius:50%;box-shadow:0 0 4px rgba(245,158,11,0.6)"></div>`,
          className: '',
          iconSize: [6, 6],
          iconAnchor: [3, 3],
        });
        const m = L.marker([area.lat, area.lng], { icon });
        m.bindPopup(`<div style="font-family:monospace"><div style="font-size:12px;font-weight:bold">${area.name}</div><div style="font-size:10px;color:#888">Bengaluru Urban</div></div>`, { className: 'dark-popup' });
        stationsLayer.addLayer(m);
      }
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
    }
  }, [mapReady, filteredDistricts, hotspots, stations]);

  // Handle zoom change for detail layers
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const onZoomEnd = () => {
      // Re-render markers on significant zoom change
      if (map.getZoom() >= 10 || map.getZoom() < 10) {
        const event = new Event('zoom-change');
        window.dispatchEvent(event);
      }
    };
    map.on('zoomend', onZoomEnd);
    return () => { map.off('zoomend', onZoomEnd); };
  }, [mapReady]);

  // Computed stats
  const totalCases = useMemo(() => filteredDistricts.reduce((s, d) => s + d.count, 0), [filteredDistricts]);
  const topDistrict = useMemo(() => [...filteredDistricts].sort((a, b) => b.count - a.count)[0], [filteredDistricts]);
  const avgCases = filteredDistricts.length > 0 ? Math.round(totalCases / filteredDistricts.length) : 0;

  // Zoom helpers
  const zoomIn = useCallback(() => { mapInstanceRef.current?.zoomIn(); }, []);
  const zoomOut = useCallback(() => { mapInstanceRef.current?.zoomOut(); }, []);
  const resetView = useCallback(() => {
    mapInstanceRef.current?.setView([14.5, 76.5], 7);
  }, []);
  const focusBengaluru = useCallback(() => {
    mapInstanceRef.current?.flyTo([12.9716, 77.5946], 12, { duration: 1.2 });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <SectionHeader
          title="CRIME MAP"
          subtitle="Interactive Karnataka crime heatmap · Click districts to zoom"
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" className="h-7 text-xs font-mono" onClick={resetView}>
            Karnataka View
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs font-mono" onClick={focusBengaluru}>
            Bengaluru
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="ops-border">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px] h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c === 'All' ? 'All Categories' : c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[150px] h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map(s => <SelectItem key={s} value={s}>{s === 'All' ? 'All Severity' : s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[110px] h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map(y => <SelectItem key={y} value={y}>{y === 'All' ? 'All Years' : y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          <Skeleton className="h-[88px] col-span-2 lg:col-span-4" />
        ) : (
          <>
            <StatCard label="TOTAL DISTRICTS" value={filteredDistricts.length} icon={<Layers className="w-4 h-4" />} />
            <StatCard label="MAPPED CASES" value={totalCases} icon={<TrendingUp className="w-4 h-4" />} severity="warning" />
            <StatCard label="HIGHEST DENSITY" value={topDistrict ? topDistrict.district : '—'} icon={<Flame className="w-4 h-4" />} trend={topDistrict ? `${topDistrict.count} cases` : undefined} severity="critical" />
            <StatCard label="AVG / DISTRICT" value={avgCases} icon={<MapPin className="w-4 h-4" />} />
          </>
        )}
      </div>

      {/* Map */}
      <Card className="ops-border overflow-hidden">
        <CardContent className="p-0 relative">
          {loading ? (
            <Skeleton className="w-full h-[500px]" />
          ) : (
            <div id="crime-map-container" className="w-full h-[500px] md:h-[600px]" />
          )}

          {/* Map controls overlay */}
          <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1.5">
            <Button variant="outline" size="icon" className="h-8 w-8 bg-card/90 backdrop-blur border-border" onClick={zoomIn}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 bg-card/90 backdrop-blur border-border" onClick={zoomOut}>
              <ZoomOut className="w-4 h-4" />
            </Button>
          </div>

          {/* Legend overlay */}
          <div className="absolute bottom-14 left-3 z-[1000] bg-card/90 backdrop-blur border border-border rounded-md p-2.5">
            <p className="font-mono-label text-[9px] mb-1.5">CRIME DENSITY</p>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#22c55e] opacity-70" />
                <span className="font-mono text-[10px] text-muted-foreground">Low</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#eab308] opacity-70" />
                <span className="font-mono text-[10px] text-muted-foreground">Moderate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#f59e0b] opacity-70" />
                <span className="font-mono text-[10px] text-muted-foreground">High</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#dc2626] opacity-70" />
                <span className="font-mono text-[10px] text-muted-foreground">Critical</span>
              </div>
              <div className="flex items-center gap-2 mt-1 pt-1 border-t border-border">
                <span className="w-2 h-2 rounded-full bg-[#3b82f6]" style={{ boxShadow: '0 0 4px rgba(59,130,246,0.5)' }} />
                <span className="font-mono text-[10px] text-muted-foreground">Station</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* District list below map */}
      {districts && !loading && (
        <Card className="ops-border">
          <CardContent className="p-4">
            <p className="font-mono-label mb-3">DISTRICT BREAKDOWN ({filteredDistricts.length} districts)</p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="font-mono-label text-[10px] text-left py-1.5 px-2">#</th>
                    <th className="font-mono-label text-[10px] text-left py-1.5 px-2">DISTRICT</th>
                    <th className="font-mono-label text-[10px] text-right py-1.5 px-2">CASES</th>
                    <th className="font-mono-label text-[10px] text-left py-1.5 px-2 hidden sm:table-cell">TOP CATEGORY</th>
                    <th className="font-mono-label text-[10px] text-right py-1.5 px-2 hidden md:table-cell">AVG SEVERITY</th>
                    <th className="font-mono-label text-[10px] text-left py-1.5 px-2">DENSITY</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDistricts
                    .sort((a, b) => b.count - a.count)
                    .map((d, i) => {
                      const hs = hotspots?.find(h => h.district === d.district);
                      const maxCount = Math.max(...filteredDistricts.map(dd => dd.count), 1);
                      const pct = d.count / maxCount;
                      const barColor = pct >= 0.75 ? '#dc2626' : pct >= 0.5 ? '#f59e0b' : pct >= 0.25 ? '#eab308' : '#22c55e';
                      return (
                        <tr key={d.district} className="border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => {
                            const coords = DISTRICT_COORDS[d.district];
                            if (coords && mapInstanceRef.current) {
                              mapInstanceRef.current.flyTo(coords, 10, { duration: 1 });
                            }
                          }}>
                          <td className="py-1.5 px-2 font-mono text-[10px] text-muted-foreground">{i + 1}</td>
                          <td className="py-1.5 px-2 font-mono text-xs text-foreground">{d.district}</td>
                          <td className="py-1.5 px-2 font-mono text-xs text-right font-bold">{d.count}</td>
                          <td className="py-1.5 px-2 hidden sm:table-cell">
                            {hs?.topCategory ? (
                              <Badge variant="outline" className="font-mono text-[9px] px-1.5 py-0 h-4 border-border text-muted-foreground">
                                {hs.topCategory}
                              </Badge>
                            ) : <span className="text-muted-foreground/50 text-xs">—</span>}
                          </td>
                          <td className="py-1.5 px-2 hidden md:table-cell font-mono text-xs text-right text-muted-foreground">
                            {hs ? hs.severity_avg.toFixed(1) : '—'}
                          </td>
                          <td className="py-1.5 px-2 w-[120px]">
                            <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(5, pct * 100)}%`, backgroundColor: barColor }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
