'use client';

import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import { SectionHeader } from '@/components/jurisintel/SectionHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Share2, ZoomIn, ZoomOut, Maximize2, X, FolderOpen, Users, Link2,
} from 'lucide-react';
import { safeFetch } from '@/lib/safeFetch';

// ── Types ──────────────────────────────────────────────────────────────
type NodeType = 'case' | 'accused' | 'victim';
interface GraphNode {
  id: string; label: string; type: NodeType;
  district: string; category?: string; riskScore?: number;
}
interface GraphEdge {
  source: string; target: string;
  strength: number; relationType: string;
}
interface NetworkResponse { nodes: GraphNode[]; edges: GraphEdge[]; }
interface SimNode {
  id: string; label: string; type: NodeType;
  district: string; category?: string; riskScore?: number;
  x: number; y: number; vx: number; vy: number; r: number;
}

// ── Theme constants ────────────────────────────────────────────────────
const AMBER = 'oklch(0.75 0.15 70)';
const EMERALD = 'oklch(0.72 0.19 162)';
const RED = 'oklch(0.65 0.24 25)';
const SKY = 'oklch(0.70 0.13 230)';
const GRID_BG = 'oklch(0.16 0.01 250)';

const NODE_FILL: Record<NodeType, string> = { case: AMBER, accused: RED, victim: EMERALD };
const RELATION_COLOR: Record<string, string> = {
  member: EMERALD, related: AMBER, co_accused: RED, pattern: SKY,
  'accused-of': RED, 'victim-of': EMERALD, 'connected-network': SKY,
  'same-modus': AMBER, 'co-accused': RED, 'shared-evidence': SKY,
};
function relationColor(rt: string): string { return RELATION_COLOR[rt] ?? 'oklch(0.55 0.02 250)'; }

// ── Force-directed layout simulation ───────────────────────────────────
const SIM_W = 1200;
const SIM_H = 800;
const CX = SIM_W / 2;
const CY = SIM_H / 2;

function runForceSimulation(nodes: GraphNode[], edges: GraphEdge[], iterations = 200): SimNode[] {
  if (nodes.length === 0) return [];

  // Initialize positions in a spread-out pattern
  const sim: SimNode[] = nodes.map((n, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI;
    const radius = 100 + Math.random() * 200;
    return {
      ...n,
      x: CX + radius * Math.cos(angle) + (Math.random() - 0.5) * 80,
      y: CY + radius * Math.sin(angle) + (Math.random() - 0.5) * 80,
      vx: 0, vy: 0,
      r: n.type === 'case' ? 10 : 6,
    };
  });

  const nodeMap = new Map(sim.map(n => [n.id, n]));
  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
 if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }

  const REPULSION = 8000;
  const ATTRACTION = 0.005;
  const CENTER_PULL = 0.01;
  const DAMPING = 0.85;
  const MIN_DIST = 30;

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations;
    const scaledAlpha = alpha * alpha;

    // Repulsion between all pairs
    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        let dx = sim[j].x - sim[i].x;
        let dy = sim[j].y - sim[i].y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; dist = 1; }
        const minD = sim[i].r + sim[j].r + MIN_DIST;
        if (dist < minD) dist = minD;
        const force = (REPULSION * scaledAlpha) / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        sim[i].vx -= fx; sim[i].vy -= fy;
        sim[j].vx += fx; sim[j].vy += fy;
      }
    }

    // Attraction along edges
    for (const e of edges) {
      const a = nodeMap.get(e.source);
      const b = nodeMap.get(e.target);
      if (!a || !b) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = dist * ATTRACTION * scaledAlpha * (e.strength / 100);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }

    // Center gravity
    for (const n of sim) {
      n.vx += (CX - n.x) * CENTER_PULL * scaledAlpha;
      n.vy += (CY - n.y) * CENTER_PULL * scaledAlpha;
    }

    // Apply velocity with damping
    for (const n of sim) {
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x += n.vx;
      n.y += n.vy;
    }
  }

  return sim;
}

// ── Memoized graph renderer ────────────────────────────────────────────
const GraphCanvas = memo(function GraphCanvas({
  nodes, edges, transform, hoveredId, selectedId, onHover, onSelect, onNodeClick,
}: {
  nodes: SimNode[];
  edges: GraphEdge[];
  transform: { x: number; y: number; k: number };
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null, x: number, y: number) => void;
  onSelect: (id: string | null) => void;
  onNodeClick: (node: SimNode) => void;
}) {
  const { x: tx, y: ty, k } = transform;
  const showLabels = k >= 1.2;

  // Connected node/edge highlighting
  const connectedIds = useMemo(() => {
    const activeId = hoveredId || selectedId;
    if (!activeId) return null;
    const ids = new Set<string>();
    ids.add(activeId);
    for (const e of edges) {
      if (e.source === activeId) ids.add(e.target);
      if (e.target === activeId) ids.add(e.source);
    }
    return ids;
  }, [hoveredId, selectedId, edges]);

  return (
    <g transform={`translate(${tx},${ty}) scale(${k})`}>
      {/* Grid dots */}
      {Array.from({ length: 20 }).map((_, i) =>
        Array.from({ length: 14 }).map((_, j) => (
          <circle key={`g${i}-${j}`} cx={i * 60} cy={j * 60} r={0.8}
            fill="oklch(0.25 0.01 250)" />
        ))
      )}

      {/* Edges */}
      {edges.map((e, i) => {
        const a = nodes.find(n => n.id === e.source);
        const b = nodes.find(n => n.id === e.target);
        if (!a || !b) return null;
        const highlighted = !connectedIds || connectedIds.has(e.source) && connectedIds.has(e.target);
        return (
          <line key={`e${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={relationColor(e.relationType)}
            strokeWidth={highlighted ? 1.5 / k : 0.5 / k}
            opacity={connectedIds ? (highlighted ? 0.7 : 0.08) : 0.25}
            strokeDasharray={e.relationType === 'connected-network' ? '4 2' : undefined}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((n) => {
        const isHovered = hoveredId === n.id;
        const isSelected = selectedId === n.id;
        const isConnected = !connectedIds || connectedIds.has(n.id);
        const opacity = connectedIds ? (isConnected ? 1 : 0.15) : 1;
        const fill = NODE_FILL[n.type];
        const r = n.r * (isHovered || isSelected ? 1.4 : 1);

        // Glow for selected/hovered
        if (isHovered || isSelected) {
          return (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={r + 8 / k}
                fill={fill} opacity={0.15} />
              <circle cx={n.x} cy={n.y} r={r + 3 / k}
                fill={fill} opacity={0.25} />
              <circle cx={n.x} cy={n.y} r={r}
                fill={fill} opacity={opacity}
                stroke={isSelected ? '#fff' : fill} strokeWidth={isSelected ? 2 / k : 1 / k}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(ev) => onHover(n.id, ev.clientX, ev.clientY)}
                onMouseLeave={() => onHover(null, 0, 0)}
                onClick={() => onNodeClick(n)}
              />
              <text x={n.x} y={n.y - r - 6 / k} textAnchor="middle"
                fill="oklch(0.93 0.005 250)" fontSize={10 / k}
                fontFamily="monospace" fontWeight="bold">
                {n.label.length > 20 ? n.label.slice(0, 18) + '…' : n.label}
              </text>
              <text x={n.x} y={n.y - r + 2 / k} textAnchor="middle"
                fill={fill} fontSize={8 / k} fontFamily="monospace" opacity={0.7}>
                {n.type.toUpperCase()}
              </text>
            </g>
          );
        }

        return (
          <g key={n.id} opacity={opacity}>
            <circle cx={n.x} cy={n.y} r={r}
              fill={fill}
              stroke={fill} strokeWidth={0.5 / k}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(ev) => onHover(n.id, ev.clientX, ev.clientY)}
              onMouseLeave={() => onHover(null, 0, 0)}
              onClick={() => onNodeClick(n)}
            />
            {(showLabels || isConnected) && (
              <text x={n.x} y={n.y - r - 4 / k} textAnchor="middle"
                fill="oklch(0.70 0.01 250)" fontSize={9 / k}
                fontFamily="monospace">
                {n.label.length > 16 ? n.label.slice(0, 14) + '…' : n.label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
});

// ── Main component ─────────────────────────────────────────────────────
export function NetworkGraph() {
  const [rawData, setRawData] = useState<NetworkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [detailNode, setDetailNode] = useState<SimNode | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ type: 'pan' | 'node'; startX: number; startY: number; baseX: number; baseY: number; nodeId?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await safeFetch<{ nodes: any[]; edges: any[] }>('/api/network');
      if (cancelled || !data?.nodes?.length) {
        if (!cancelled) setError('Failed to load network data');
        return;
      }
      setRawData(data as NetworkResponse);
    })();
    return () => { cancelled = true; };
  }, []);

  // District options
  const districtOptions = useMemo(() => {
    if (!rawData) return [];
    const set = new Set(rawData.nodes.map(n => n.district));
    return Array.from(set).sort();
  }, [rawData]);

  // Filter by district
  const filtered = useMemo(() => {
    if (!rawData) return null;
    if (districtFilter === 'all') return rawData;
    const ids = new Set(rawData.nodes.filter(n => n.district === districtFilter).map(n => n.id));
    return {
      nodes: rawData.nodes.filter(n => ids.has(n.id)),
      edges: rawData.edges.filter(e => ids.has(e.source) && ids.has(e.target)),
    };
  }, [rawData, districtFilter]);

  // Run force simulation
  const layoutNodes = useMemo(() => {
    if (!filtered) return [];
    return runForceSimulation(filtered.nodes, filtered.edges, 250);
  }, [filtered]);

  // Fit graph on load/filter change
  useEffect(() => {
    if (layoutNodes.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of layoutNodes) {
      if (n.x - n.r < minX) minX = n.x - n.r;
      if (n.x + n.r > maxX) maxX = n.x + n.r;
      if (n.y - n.r < minY) minY = n.y - n.r;
      if (n.y + n.r > maxY) maxY = n.y + n.r;
    }
    const gw = maxX - minX + 100;
    const gh = maxY - minY + 100;
    const gcx = (minX + maxX) / 2;
    const gcy = (minY + maxY) / 2;
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    const sw = svgRect.width;
    const sh = svgRect.height;
    const k = Math.min(sw / gw, sh / gh, 2);
    setTransform({
      x: sw / 2 - gcx * k,
      y: sh / 2 - gcy * k,
      k,
    });
  }, [layoutNodes]);

  // Selected node details
  const selectedNode = useMemo(() => {
    if (!selectedId || layoutNodes.length === 0) return null;
    return layoutNodes.find(n => n.id === selectedId) ?? null;
  }, [selectedId, layoutNodes]);

  const hoveredNode = useMemo(() => {
    if (!hoveredId || layoutNodes.length === 0) return null;
    return layoutNodes.find(n => n.id === hoveredId) ?? null;
  }, [hoveredId, layoutNodes]);

  const connectedEdges = useMemo(() => {
    const activeId = hoveredId || selectedId;
    if (!activeId || !filtered) return [];
    return filtered.edges.filter(e => e.source === activeId || e.target === activeId);
  }, [hoveredId, selectedId, filtered]);

  // Stats
  const stats = useMemo(() => {
    if (!layoutNodes.length) return null;
    const cases = layoutNodes.filter(n => n.type === 'case').length;
    const accused = layoutNodes.filter(n => n.type === 'accused').length;
    const victims = layoutNodes.filter(n => n.type === 'victim').length;
    const edges = filtered?.edges.length ?? 0;
    return { cases, accused, victims, edges, total: layoutNodes.length };
  }, [layoutNodes, filtered]);

  // Zoom
  const zoomIn = useCallback(() => {
    setTransform(t => {
      const newK = Math.min(4, t.k * 1.3);
      const cx = (svgRef.current?.getBoundingClientRect().width ?? 900) / 2;
      const cy = (svgRef.current?.getBoundingClientRect().height ?? 600) / 2;
      return { x: cx - (cx - t.x) * (newK / t.k), y: cy - (cy - t.y) * (newK / t.k), k: newK };
    });
  }, []);

  const zoomOut = useCallback(() => {
    setTransform(t => {
      const newK = Math.max(0.2, t.k / 1.3);
      const cx = (svgRef.current?.getBoundingClientRect().width ?? 900) / 2;
      const cy = (svgRef.current?.getBoundingClientRect().height ?? 600) / 2;
      return { x: cx - (cx - t.x) * (newK / t.k), y: cy - (cy - t.y) * (newK / t.k), k: newK };
    });
  }, []);

  const fitGraph = useCallback(() => {
    if (layoutNodes.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of layoutNodes) {
      if (n.x - n.r < minX) minX = n.x - n.r;
      if (n.x + n.r > maxX) maxX = n.x + n.r;
      if (n.y - n.r < minY) minY = n.y - n.r;
      if (n.y + n.r > maxY) maxY = n.y + n.r;
    }
    const gw = maxX - minX + 100;
    const gh = maxY - minY + 100;
    const gcx = (minX + maxX) / 2;
    const gcy = (minY + maxY) / 2;
    const sw = svgRef.current?.getBoundingClientRect().width ?? 900;
    const sh = svgRef.current?.getBoundingClientRect().height ?? 600;
    const k = Math.min(sw / gw, sh / gh, 2);
    setTransform({ x: sw / 2 - gcx * k, y: sh / 2 - gcy * k, k });
  }, [layoutNodes]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setTransform(t => {
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const newK = Math.max(0.15, Math.min(5, t.k * factor));
      return { x: mx - (mx - t.x) * (newK / t.k), y: my - (my - t.y) * (newK / t.k), k: newK };
    });
  }, []);

  // Pan / drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const rect = svgRef.current?.getBoundingClientRect();
    dragRef.current = { type: 'pan', startX: e.clientX, startY: e.clientY, baseX: transform.x, baseY: transform.y };
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (dragRef.current.type === 'pan') {
      setTransform(t => ({ ...t, x: dragRef.current!.baseX + dx, y: dragRef.current!.baseY + dy }));
    }
  }, []);

  const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);

  const handleHover = useCallback((id: string | null, x: number, y: number) => {
    setHoveredId(id);
    if (id) setTooltipPos({ x, y });
    else setTooltipPos(null);
  }, []);

  const handleNodeClick = useCallback((node: SimNode) => {
    setSelectedId(prev => prev === node.id ? null : node.id);
    setDetailNode(node);
  }, []);

  const activeNode = hoveredNode || selectedNode;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <SectionHeader title="NETWORK GRAPH" subtitle="Case-accused-offender relationship network" />
        <div className="flex items-center gap-2 flex-shrink-0">
          <Select value={districtFilter} onValueChange={setDistrictFilter}>
            <SelectTrigger className="w-[180px] h-7 text-xs"><SelectValue placeholder="All Districts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Districts</SelectItem>
              {districtOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'CASES', value: stats.cases, color: AMBER },
            { label: 'ACCUSED', value: stats.accused, color: RED },
            { label: 'VICTIMS', value: stats.victims, color: EMERALD },
            { label: 'CONNECTIONS', value: stats.edges, color: SKY },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="font-mono-label text-[10px]">{s.label}</span>
              <span className="font-mono text-sm font-bold">{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Graph */}
      <Card className="ops-border overflow-hidden relative">
        <CardContent className="p-0">
          {error ? (
            <div className="h-[500px] flex items-center justify-center">
              <p className="font-mono text-muted-foreground">{error}</p>
            </div>
          ) : layoutNodes.length === 0 ? (
            <Skeleton className="w-full h-[500px]" />
          ) : (
            <div className="relative">
              <svg
                ref={svgRef}
                className="w-full h-[500px] md:h-[600px] select-none"
                style={{ background: GRID_BG }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <GraphCanvas
                  nodes={layoutNodes}
                  edges={filtered?.edges ?? []}
                  transform={transform}
                  hoveredId={hoveredId}
                  selectedId={selectedId}
                  onHover={handleHover}
                  onSelect={setSelectedId}
                  onNodeClick={handleNodeClick}
                />
              </svg>

              {/* Controls overlay */}
              <div className="absolute top-3 right-3 flex flex-col gap-1.5">
                <Button variant="outline" size="icon" className="h-8 w-8 bg-card/90 backdrop-blur border-border" onClick={zoomIn}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 bg-card/90 backdrop-blur border-border" onClick={zoomOut}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 bg-card/90 backdrop-blur border-border" onClick={fitGraph}>
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Legend overlay */}
              <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur border border-border rounded-md p-2.5">
                <p className="font-mono-label text-[9px] mb-1.5">NODE LEGEND</p>
                <div className="flex flex-col gap-1">
                  {([['case', 'Case', AMBER], ['accused', 'Accused', RED], ['victim', 'Victim', EMERALD]] as const).map(([t, l, c]) => (
                    <div key={t} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                      <span className="font-mono text-[10px] text-muted-foreground">{l}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Zoom level indicator */}
              <div className="absolute bottom-3 right-3 bg-card/90 backdrop-blur border border-border rounded-md px-2 py-1">
                <span className="font-mono text-[10px] text-muted-foreground">{Math.round(transform.k * 100)}%</span>
              </div>

              {/* Tooltip */}
              {tooltipPos && activeNode && (
                <div
                  className="absolute pointer-events-none z-50 bg-card/95 backdrop-blur border border-border rounded-md p-2.5 max-w-[220px]"
                  style={{ left: tooltipPos.x + 16, top: tooltipPos.y - 10 }}
                >
                  <p className="font-mono text-xs font-bold truncate" style={{ color: NODE_FILL[activeNode.type] }}>
                    {activeNode.label}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="font-mono text-[9px] px-1.5 py-0 h-4 border-border">
                      {activeNode.type.toUpperCase()}
                    </Badge>
                    <span className="font-mono text-[10px] text-muted-foreground">{activeNode.district}</span>
                  </div>
                  {activeNode.category && (
                    <p className="font-mono text-[10px] text-muted-foreground mt-1">{activeNode.category}</p>
                  )}
                  {activeNode.riskScore !== undefined && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="font-mono-label text-[9px]">RISK</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${activeNode.riskScore}%`, backgroundColor: activeNode.riskScore >= 70 ? RED : AMBER }} />
                      </div>
                      <span className="font-mono text-[10px]">{activeNode.riskScore}</span>
                    </div>
                  )}
                  <p className="font-mono text-[9px] text-muted-foreground/60 mt-1">{connectedEdges.length} connections</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail panel */}
      {selectedId && detailNode && (
        <Card className="ops-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_FILL[detailNode.type] }} />
                <p className="font-mono text-sm font-bold" style={{ color: NODE_FILL[detailNode.type] }}>{detailNode.label}</p>
                <Badge variant="outline" className="font-mono text-[9px] px-1.5 py-0 h-4 border-border">{detailNode.type.toUpperCase()}</Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedId(null); setDetailNode(null); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="font-mono-label text-[9px] mb-0.5">DISTRICT</p>
                <p className="font-mono text-foreground">{detailNode.district}</p>
              </div>
              {detailNode.category && (
                <div>
                  <p className="font-mono-label text-[9px] mb-0.5">CATEGORY</p>
                  <p className="font-mono text-foreground">{detailNode.category}</p>
                </div>
              )}
              {detailNode.riskScore !== undefined && (
                <div>
                  <p className="font-mono-label text-[9px] mb-0.5">RISK SCORE</p>
                  <p className="font-mono text-foreground font-bold">{detailNode.riskScore}/100</p>
                </div>
              )}
              <div>
                <p className="font-mono-label text-[9px] mb-0.5">CONNECTIONS</p>
                <p className="font-mono text-foreground font-bold">{connectedEdges.length}</p>
              </div>
            </div>
            {connectedEdges.length > 0 && (
              <div className="mt-3">
                <p className="font-mono-label text-[9px] mb-1.5">CONNECTED RELATIONSHIPS</p>
                <div className="flex flex-wrap gap-1.5">
                  {connectedEdges.slice(0, 12).map((e, i) => {
                    const otherId = e.source === selectedId ? e.target : e.source;
                    const otherNode = layoutNodes.find(n => n.id === otherId);
                    return (
                      <Badge key={i} variant="outline" className="font-mono text-[9px] px-1.5 py-0 h-5 border-border">
                        <span className="w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: NODE_FILL[otherNode?.type ?? 'case'] }} />
                        {otherNode?.label.length > 20 ? otherNode.label.slice(0, 18) + '…' : otherNode?.label ?? otherId.slice(-6)}
                        <span className="ml-1 text-muted-foreground">{e.relationType.replace(/-/g, ' ')}</span>
                      </Badge>
                    );
                  })}
                  {connectedEdges.length > 12 && (
                    <span className="font-mono text-[9px] text-muted-foreground self-center">+{connectedEdges.length - 12} more</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
