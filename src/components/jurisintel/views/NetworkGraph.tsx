'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SectionHeader } from '@/components/jurisintel/SectionHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Share2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  FolderOpen,
  Users,
  Link2,
} from 'lucide-react';
import { safeFetch } from '@/lib/safeFetch';

// ── Types ──────────────────────────────────────────────────────────────
type NodeType = 'case' | 'accused' | 'victim';
interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  district: string;
  category?: string;
}
interface GraphEdge {
  source: string;
  target: string;
  strength: number;
  relationType: string;
}
interface NetworkResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  r: number;
}

// ── Theme constants ────────────────────────────────────────────────────
const AMBER = 'oklch(0.75 0.15 70)';
const EMERALD = 'oklch(0.72 0.19 162)';
const RED = 'oklch(0.65 0.24 25)';
const SKY = 'oklch(0.70 0.13 230)';
const GRID_BG = 'oklch(0.16 0.01 250)';

const NODE_FILL: Record<NodeType, string> = {
  case: AMBER,
  accused: RED, // accused default — wanted will be red, others sky
  victim: EMERALD,
};

const RELATION_COLOR: Record<string, string> = {
  member: EMERALD,
  related: AMBER,
  co_accused: RED,
  pattern: SKY,
};
function relationColor(rt: string): string {
  return RELATION_COLOR[rt] ?? 'oklch(0.55 0.02 250)';
}

// ── Layout computation ─────────────────────────────────────────────────
const VIEW_W = 900;
const VIEW_H = 600;
const CENTER_X = VIEW_W / 2;
const CENTER_Y = VIEW_H / 2;

function computeLayout(nodes: GraphNode[], edges: GraphEdge[]): PositionedNode[] {
  if (nodes.length === 0) return [];

  const caseNodes = nodes.filter((n) => n.type === 'case');
  const otherNodes = nodes.filter((n) => n.type !== 'case');

  // Place cases on an inner ring
  const caseRadius = Math.min(180, 60 + caseNodes.length * 6);
  const angleStep = (2 * Math.PI) / Math.max(caseNodes.length, 1);

  const positions = new Map<string, { x: number; y: number }>();
  caseNodes.forEach((n, i) => {
    const a = i * angleStep - Math.PI / 2;
    positions.set(n.id, {
      x: CENTER_X + caseRadius * Math.cos(a),
      y: CENTER_Y + caseRadius * Math.sin(a),
    });
  });

  // Build accused→cases adjacency (which cases each non-case node links to)
  const linkedCases = new Map<string, string[]>();
  for (const e of edges) {
    if (positions.has(e.source) && !positions.has(e.target)) {
      const arr = linkedCases.get(e.target) ?? [];
      arr.push(e.source);
      linkedCases.set(e.target, arr);
    } else if (positions.has(e.target) && !positions.has(e.source)) {
      const arr = linkedCases.get(e.source) ?? [];
      arr.push(e.target);
      linkedCases.set(e.source, arr);
    }
  }

  // Place other nodes on outer ring, angle = average of connected cases' angles
  const outerRadius = Math.min(280, 180 + otherNodes.length * 4);
  const otherAngleStep = (2 * Math.PI) / Math.max(otherNodes.length, 1);
  otherNodes.forEach((n, i) => {
    const baseAngle = i * otherAngleStep - Math.PI / 2;
    const linked = linkedCases.get(n.id);
    let a = baseAngle;
    if (linked && linked.length > 0) {
      let sumX = 0,
        sumY = 0,
        c = 0;
      for (const cid of linked) {
        const p = positions.get(cid);
        if (p) {
          sumX += p.x - CENTER_X;
          sumY += p.y - CENTER_Y;
          c += 1;
        }
      }
      if (c > 0 && (sumX !== 0 || sumY !== 0)) {
        a = Math.atan2(sumY, sumX);
      }
    }
    // Small jitter to avoid exact overlap
    const jitter = (Math.sin(n.id.charCodeAt(0) * 1.7 + i) * 0.5) * 0.05;
    a += jitter;
    positions.set(n.id, {
      x: CENTER_X + outerRadius * Math.cos(a),
      y: CENTER_Y + outerRadius * Math.sin(a),
    });
  });

  return nodes.map((n) => {
    const p = positions.get(n.id) ?? { x: CENTER_X, y: CENTER_Y };
    const r = n.type === 'case' ? 11 : 8;
    return { ...n, x: p.x, y: p.y, r };
  });
}

// ── Main component ─────────────────────────────────────────────────────
export function NetworkGraph() {
  const [data, setData] = useState<NetworkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: ReactNode } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await safeFetch<{nodes:any[],edges:any[]}>('/api/network');
      if (cancelled || !data?.nodes?.length) {
        if (!cancelled) setError('Failed to load network data');
        return;
      }
      setData(data as NetworkResponse);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── District options ──
  const districtOptions = useMemo(() => {
    if (!data) return [] as string[];
    const set = new Set<string>();
    for (const n of data.nodes) if (n.district) set.add(n.district);
    return Array.from(set).sort();
  }, [data]);

  // ── Filtered nodes/edges ──
  const filtered = useMemo(() => {
    if (!data) return { nodes: [] as GraphNode[], edges: [] as GraphEdge[] };
    if (districtFilter === 'all') return data;
    const keep = new Set(
      data.nodes.filter((n) => n.district === districtFilter).map((n) => n.id)
    );
    const nodes = data.nodes.filter((n) => keep.has(n.id));
    const edges = data.edges.filter((e) => keep.has(e.source) && keep.has(e.target));
    return { nodes, edges };
  }, [data, districtFilter]);

  // ── Positioned nodes ──
  const positioned = useMemo(
    () => computeLayout(filtered.nodes, filtered.edges),
    [filtered]
  );

  // ── Edge render data ──
  const edgeRender = useMemo(() => {
    const posMap = new Map(positioned.map((n) => [n.id, n]));
    return filtered.edges
      .map((e, idx) => {
        const s = posMap.get(e.source);
        const t = posMap.get(e.target);
        if (!s || !t) return null;
        return {
          key: `${e.source}-${e.target}-${idx}`,
          source: e.source,
          target: e.target,
          x1: s.x,
          y1: s.y,
          x2: t.x,
          y2: t.y,
          strength: e.strength,
          relationType: e.relationType,
        };
      })
      .filter(Boolean) as {
      key: string;
      source: string;
      target: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      strength: number;
      relationType: string;
    }[];
  }, [filtered, positioned]);

  // ── Adjacency for hover highlight + side panel ──
  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const e of filtered.edges) {
      if (!map.has(e.source)) map.set(e.source, new Set());
      if (!map.has(e.target)) map.set(e.target, new Set());
      map.get(e.source)!.add(e.target);
      map.get(e.target)!.add(e.source);
    }
    return map;
  }, [filtered]);

  const highlightedSet = useMemo(() => {
    if (!hoveredId && !selectedId) return null;
    const id = hoveredId ?? selectedId;
    if (!id) return null;
    const s = new Set<string>([id]);
    const neighbors = adjacency.get(id);
    if (neighbors) for (const n of neighbors) s.add(n);
    return s;
  }, [hoveredId, selectedId, adjacency]);

  // ── Node lookup ──
  const nodeMap = useMemo(
    () => new Map(positioned.map((n) => [n.id, n])),
    [positioned]
  );

  // ── Selected node + connected ──
  const selectedNode = selectedId ? nodeMap.get(selectedId) ?? null : null;
  const selectedConnected = useMemo(() => {
    if (!selectedId) return [];
    const neighbors = adjacency.get(selectedId);
    if (!neighbors) return [];
    return Array.from(neighbors)
      .map((id) => nodeMap.get(id))
      .filter(Boolean) as PositionedNode[];
  }, [selectedId, adjacency, nodeMap]);

  // ── Pan/zoom handlers ──
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0012;
    setTransform((t) => {
      const newK = Math.max(0.4, Math.min(2.5, t.k + delta));
      // Zoom toward mouse position
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { ...t, k: newK };
      const mx = ((e.clientX - rect.left) / rect.width) * VIEW_W;
      const my = ((e.clientY - rect.top) / rect.height) * VIEW_H;
      const dx = (mx - VIEW_W / 2 - t.x) * (newK / t.k - 1);
      const dy = (my - VIEW_H / 2 - t.y) * (newK / t.k - 1);
      return { x: t.x - dx, y: t.y - dy, k: newK };
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start pan when clicking on background
    if (e.target !== svgRef.current && (e.target as Element).tagName !== 'rect') return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: transform.x,
      baseY: transform.y,
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = (e.clientX - dragRef.current.startX) * (VIEW_W / (svgRef.current?.clientWidth ?? VIEW_W));
      const dy = (e.clientY - dragRef.current.startY) * (VIEW_H / (svgRef.current?.clientHeight ?? VIEW_H));
      setTransform((t) => ({ ...t, x: dragRef.current!.baseX + dx, y: dragRef.current!.baseY + dy }));
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const resetView = () => setTransform({ x: 0, y: 0, k: 1 });
  const zoomIn = () => setTransform((t) => ({ ...t, k: Math.min(2.5, t.k + 0.2) }));
  const zoomOut = () => setTransform((t) => ({ ...t, k: Math.max(0.4, t.k - 0.2) }));

  // ── Edge stroke opacity ──
  const edgeOpacity = (strength: number) => Math.max(0.12, Math.min(0.85, strength / 100));

  // ── Hover handlers ──
  const onNodeEnter = (n: PositionedNode, e: React.MouseEvent) => {
    setHoveredId(n.id);
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      // Project node coords (with transform) to screen
      const sx = ((n.x - VIEW_W / 2) * transform.k + transform.x + VIEW_W / 2) / VIEW_W * rect.width + rect.left;
      const sy = ((n.y - VIEW_H / 2) * transform.k + transform.y + VIEW_H / 2) / VIEW_H * rect.height + rect.top;
      setTooltip({
        x: sx,
        y: sy,
        content: (
          <div className="space-y-1">
            <div className="font-mono text-[11px] text-ops-amber font-bold">{n.label}</div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              {n.type}
            </div>
            <div className="font-mono text-[10px]">
              <span className="text-muted-foreground">DIST: </span>
              {n.district}
            </div>
            {n.category && (
              <div className="font-mono text-[10px]">
                <span className="text-muted-foreground">CAT: </span>
                {n.category}
              </div>
            )}
            <div className="font-mono text-[10px]">
              <span className="text-muted-foreground">LINKS: </span>
              {adjacency.get(n.id)?.size ?? 0}
            </div>
          </div>
        ),
      });
    }
  };

  const onNodeLeave = () => {
    setHoveredId(null);
    setTooltip(null);
  };

  const onNodeClick = (n: PositionedNode) => {
    setSelectedId(n.id);
  };

  // ── Loading / error ──
  if (error) {
    return (
      <div className="space-y-6">
        <SectionHeader title="CASE NETWORK" subtitle="Link analysis graph" />
        <div className="ops-border rounded-md bg-ops-red/10 border-ops-red/30 p-3">
          <p className="font-mono-label text-ops-red">NETWORK FEED ERROR: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="CASE NETWORK" subtitle="Link analysis & relationship graph" />

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[11px] px-2.5 py-1 h-6 border-ops-amber/40 text-ops-amber bg-ops-amber/10 gap-1.5">
            <FolderOpen className="w-3 h-3" />
            {positioned.filter((n) => n.type === 'case').length} CASES
          </Badge>
          <Badge variant="outline" className="font-mono text-[11px] px-2.5 py-1 h-6 border-ops-red/40 text-ops-red bg-ops-red/10 gap-1.5">
            <Users className="w-3 h-3" />
            {positioned.filter((n) => n.type === 'accused').length} ACCUSED
          </Badge>
          <Badge variant="outline" className="font-mono text-[11px] px-2.5 py-1 h-6 border-border text-muted-foreground gap-1.5">
            <Link2 className="w-3 h-3" />
            {edgeRender.length} EDGES
          </Badge>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="font-mono-label hidden sm:inline">FILTER:</span>
          <Select value={districtFilter} onValueChange={setDistrictFilter}>
            <SelectTrigger size="sm" className="w-[180px] font-mono text-xs">
              <SelectValue placeholder="All districts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-mono text-xs">ALL DISTRICTS</SelectItem>
              {districtOptions.map((d) => (
                <SelectItem key={d} value={d} className="font-mono text-xs">
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="h-6" />

          <Button variant="outline" size="icon" className="h-8 w-8" onClick={zoomOut} aria-label="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={zoomIn} aria-label="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={resetView} aria-label="Reset view">
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {!data ? (
        <Skeleton className="w-full h-[600px]" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* ── Graph ── */}
          <Card className="ops-border overflow-hidden">
            <CardContent className="p-0 relative">
              <div className="relative w-full" style={{ height: 600 }}>
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                  preserveAspectRatio="xMidYMid meet"
                  className="w-full h-full cursor-grab active:cursor-grabbing select-none"
                  style={{ background: GRID_BG }}
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                >
                  {/* Background drag target rect */}
                  <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="transparent" />

                  <g transform={`translate(${VIEW_W / 2 + transform.x}, ${VIEW_H / 2 + transform.y}) scale(${transform.k}) translate(${-VIEW_W / 2}, ${-VIEW_H / 2})`}>
                    {/* Edges */}
                    <g>
                      {edgeRender.map((e) => {
                        const isActive =
                          !highlightedSet ||
                          (highlightedSet.has(e.source) && highlightedSet.has(e.target));
                        return (
                          <line
                            key={e.key}
                            x1={e.x1}
                            y1={e.y1}
                            x2={e.x2}
                            y2={e.y2}
                            stroke={relationColor(e.relationType)}
                            strokeWidth={isActive ? 1.6 : 1}
                            strokeOpacity={isActive ? edgeOpacity(e.strength) : 0.06}
                          />
                        );
                      })}
                    </g>

                    {/* Nodes */}
                    <g>
                      {positioned.map((n) => {
                        const isHL = highlightedSet?.has(n.id) ?? false;
                        const isDim = highlightedSet !== null && !isHL;
                        const isSelected = selectedId === n.id;
                        const fill =
                          n.type === 'accused'
                            ? RED // accused are rendered red in our network (risk-colored)
                            : NODE_FILL[n.type];
                        return (
                          <g
                            key={n.id}
                            transform={`translate(${n.x}, ${n.y})`}
                            className="cursor-pointer"
                            onMouseEnter={(e) => onNodeEnter(n, e)}
                            onMouseLeave={onNodeLeave}
                            onClick={() => onNodeClick(n)}
                          >
                            {/* Glow ring for selected/hovered */}
                            {(isSelected || isHL) && (
                              <circle
                                r={n.r + 6}
                                fill="none"
                                stroke={fill}
                                strokeOpacity={0.45}
                                strokeWidth={1.5}
                              />
                            )}
                            <circle
                              r={n.r}
                              fill={fill}
                              fillOpacity={isDim ? 0.25 : 1}
                              stroke={isSelected ? AMBER : 'oklch(0.16 0.01 250)'}
                              strokeWidth={isSelected ? 2.5 : 1.5}
                            />
                            <text
                              y={n.r + 12}
                              textAnchor="middle"
                              fontSize={9}
                              fontFamily="monospace"
                              fill={isDim ? 'oklch(0.40 0.01 250)' : 'oklch(0.80 0.005 250)'}
                              className="pointer-events-none"
                            >
                              {n.label.length > 18 ? n.label.slice(0, 18) + '…' : n.label}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  </g>

                  {/* Legend (top-left, no transform) */}
                  <g transform="translate(12, 12)">
                    <rect
                      x={0}
                      y={0}
                      width={180}
                      height={92}
                      rx={6}
                      fill="oklch(0.20 0.01 250)"
                      stroke="oklch(0.30 0.01 250)"
                      fillOpacity={0.92}
                    />
                    <text x={10} y={16} fontSize={9} fontFamily="monospace" fill="oklch(0.55 0.01 250)" letterSpacing="0.08em" style={{ textTransform: 'uppercase' }}>
                      NODE TYPES
                    </text>
                    <circle cx={16} cy={30} r={5} fill={AMBER} />
                    <text x={28} y={33} fontSize={10} fontFamily="monospace" fill="oklch(0.80 0.005 250)">Case</text>
                    <circle cx={16} cy={48} r={5} fill={RED} />
                    <text x={28} y={51} fontSize={10} fontFamily="monospace" fill="oklch(0.80 0.005 250)">Accused</text>
                    <circle cx={100} cy={30} r={5} fill={EMERALD} />
                    <text x={112} y={33} fontSize={10} fontFamily="monospace" fill="oklch(0.80 0.005 250)">Victim</text>
                    <circle cx={100} cy={48} r={5} fill={SKY} />
                    <text x={112} y={51} fontSize={10} fontFamily="monospace" fill="oklch(0.80 0.005 250)">Other</text>
                    <line x1={10} y1={66} x2={24} y2={66} stroke={EMERALD} strokeWidth={1.5} />
                    <text x={28} y={69} fontSize={10} fontFamily="monospace" fill="oklch(0.80 0.005 250)">member</text>
                    <line x1={86} y1={66} x2={100} y2={66} stroke={AMBER} strokeWidth={1.5} />
                    <text x={104} y={69} fontSize={10} fontFamily="monospace" fill="oklch(0.80 0.005 250)">related</text>
                    <line x1={10} y1={82} x2={24} y2={82} stroke={RED} strokeWidth={1.5} />
                    <text x={28} y={85} fontSize={10} fontFamily="monospace" fill="oklch(0.80 0.005 250)">co-accused</text>
                  </g>

                  {/* Help text (bottom-left) */}
                  <text x={12} y={VIEW_H - 12} fontSize={9} fontFamily="monospace" fill="oklch(0.45 0.01 250)">
                    ▸ SCROLL TO ZOOM · DRAG TO PAN · CLICK NODE FOR DETAILS
                  </text>
                </svg>

                {/* Floating tooltip */}
                {tooltip && (
                  <div
                    className="absolute z-30 pointer-events-none ops-border rounded-md bg-popover/95 backdrop-blur-sm p-2 shadow-lg"
                    style={{
                      left: Math.min(tooltip.x + 14, (svgRef.current?.clientWidth ?? 0) - 200),
                      top: Math.max(8, tooltip.y - 60),
                      maxWidth: 200,
                    }}
                  >
                    {tooltip.content}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Side panel ── */}
          <Card className="ops-border">
            <CardContent className="p-4">
              {!selectedNode ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <Share2 className="w-8 h-8 text-muted-foreground/40" />
                  <p className="font-mono-label">NO NODE SELECTED</p>
                  <p className="font-mono text-[11px] text-muted-foreground/80 max-w-[200px]">
                    Click any node in the graph to view its details and connected entities.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono-label">SELECTED NODE</p>
                      <h3 className="font-mono text-sm font-bold text-ops-amber truncate mt-1">
                        {selectedNode.label}
                      </h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 -mr-1 -mt-1 flex-shrink-0"
                      onClick={() => setSelectedId(null)}
                      aria-label="Close panel"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="font-mono-label">TYPE</p>
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] px-1.5 py-0 h-5 mt-0.5"
                        style={{
                          borderColor: NODE_FILL[selectedNode.type] + '55',
                          color: NODE_FILL[selectedNode.type],
                        }}
                      >
                        {selectedNode.type.toUpperCase()}
                      </Badge>
                    </div>
                    <div>
                      <p className="font-mono-label">LINKS</p>
                      <p className="font-mono text-sm mt-0.5">
                        {adjacency.get(selectedNode.id)?.size ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono-label">DISTRICT</p>
                      <p className="font-mono text-xs mt-0.5 truncate">{selectedNode.district}</p>
                    </div>
                    {selectedNode.category && (
                      <div>
                        <p className="font-mono-label">CATEGORY</p>
                        <p className="font-mono text-xs mt-0.5 truncate">{selectedNode.category}</p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <p className="font-mono-label mb-2">
                      CONNECTED NODES ({selectedConnected.length})
                    </p>
                    {selectedConnected.length === 0 ? (
                      <p className="font-mono text-xs text-muted-foreground">No connections</p>
                    ) : (
                      <ScrollArea className="max-h-[320px]">
                        <div className="space-y-1.5 pr-2">
                          {selectedConnected.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => setSelectedId(c.id)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md border border-border hover:bg-accent/40 transition-colors text-left"
                            >
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: NODE_FILL[c.type] }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-mono text-xs truncate">{c.label}</p>
                                <p className="font-mono text-[10px] text-muted-foreground">
                                  {c.type} · {c.district}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
