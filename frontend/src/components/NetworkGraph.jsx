import React, { useEffect, useMemo, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from "d3-force";

const WIDTH = 900;
const HEIGHT = 620;

const COLORS = {
  case: "#d4a62a",
  accused: "#c2554a",
  victim: "#2fbfa0",
};

function layout(nodes, edges) {
  const nodeCopies = nodes.map((n) => ({ ...n }));
  const linkCopies = edges.map((e) => ({ ...e }));
  const sim = forceSimulation(nodeCopies)
    .force("link", forceLink(linkCopies).id((d) => d.id).distance((d) =>
      d.relation === "victim_in" ? 40 : 70
    ).strength(0.5))
    .force("charge", forceManyBody().strength(-160))
    .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
    .force("collide", forceCollide().radius((d) => (d.type === "accused" ? 10 + Math.min(d.case_count || 1, 8) * 2 : 14)))
    .stop();

  for (let i = 0; i < 300; i++) sim.tick();

  const clampedNodes = nodeCopies.map((n) => ({
    ...n,
    x: Math.max(30, Math.min(WIDTH - 30, n.x)),
    y: Math.max(30, Math.min(HEIGHT - 30, n.y)),
  }));

  return { nodes: clampedNodes, edges: linkCopies };
}

export default function NetworkGraph({ nodes, edges }) {
  const [selected, setSelected] = useState(null);
  const positioned = useMemo(() => layout(nodes, edges), [nodes, edges]);
  const nodeById = useMemo(() => {
    const m = {};
    positioned.nodes.forEach((n) => (m[n.id] = n));
    return m;
  }, [positioned]);

  const selectedNode = selected ? nodeById[selected] : null;
  const connectedEdges = selected
    ? positioned.edges.filter((e) => e.source.id === selected || e.target.id === selected)
    : [];
  const connectedNodes = connectedEdges.map((e) =>
    e.source.id === selected ? e.target : e.source
  );

  if (!nodes.length) {
    return <div className="empty-state" style={{ padding: 100 }}>No network data for this selection.</div>;
  }

  return (
    <div className="network-wrap">
      <div className="network-canvas">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height="100%">
          <defs>
            <radialGradient id="bgGlow" cx="50%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#182238" />
              <stop offset="100%" stopColor="#0a0f1a" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="url(#bgGlow)" />

          {positioned.edges.map((e, i) => {
            const isConn = selected && (e.source.id === selected || e.target.id === selected);
            return (
              <line
                key={i}
                x1={e.source.x} y1={e.source.y}
                x2={e.target.x} y2={e.target.y}
                stroke={isConn ? COLORS.case : "#2a3550"}
                strokeWidth={isConn ? 1.6 : 1}
                strokeDasharray={e.relation === "victim_in" ? "2,3" : undefined}
                opacity={selected ? (isConn ? 0.9 : 0.15) : 0.5}
              />
            );
          })}

          {positioned.nodes.map((n) => {
            const dim = selected && n.id !== selected && !connectedNodes.some((c) => c.id === n.id);
            const r = n.type === "accused" ? 7 + Math.min(n.case_count || 1, 8) * 1.6 : n.type === "case" ? 9 : 5;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                onClick={() => setSelected(n.id === selected ? null : n.id)}
                style={{ cursor: "pointer" }}
                opacity={dim ? 0.25 : 1}
              >
                {n.type === "case" ? (
                  <rect x={-r} y={-r * 0.75} width={r * 2} height={r * 1.5} rx={3}
                        fill={COLORS.case} stroke="#0a0f1a" strokeWidth={1} />
                ) : (
                  <circle r={r} fill={COLORS[n.type]} stroke="#0a0f1a" strokeWidth={1.4}
                          opacity={n.type === "accused" && n.case_count > 1 ? 1 : 0.85} />
                )}
                {n.type === "accused" && n.case_count > 1 && (
                  <circle r={r + 3} fill="none" stroke={COLORS.accused} strokeWidth={0.8} opacity={0.5} />
                )}
                {(n.type !== "victim") && (
                  <text
                    y={r + 12}
                    textAnchor="middle"
                    fontSize={9.5}
                    fontFamily="JetBrains Mono, monospace"
                    fill={dim ? "#5a6786" : "#c4cce0"}
                  >
                    {n.type === "case" ? n.label.slice(-6) : n.label.split(" ")[0]}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="network-sidebar">
        <div className="legend">
          <span><span className="legend-dot" style={{ background: COLORS.case }} />Case</span>
          <span><span className="legend-dot" style={{ background: COLORS.accused }} />Accused</span>
          <span><span className="legend-dot" style={{ background: COLORS.victim }} />Victim</span>
        </div>
        {!selectedNode ? (
          <p style={{ color: "#7f8cab", fontSize: 12.5, lineHeight: 1.6 }}>
            Click a node to inspect it. Accused nodes with a ring are linked to more than
            one case — that overlap is the network signal worth chasing.
          </p>
        ) : (
          <div>
            <h4 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#7f8cab", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              {selectedNode.type}
            </h4>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{selectedNode.label}</p>
            {selectedNode.type === "accused" && (
              <p style={{ fontSize: 12.5, color: "#7f8cab", marginBottom: 12 }}>
                Linked to {connectedNodes.length} case{connectedNodes.length !== 1 ? "s" : ""}
              </p>
            )}
            {selectedNode.type === "case" && selectedNode.sub && (
              <p style={{ fontSize: 12.5, color: "#7f8cab", marginBottom: 12 }}>{selectedNode.sub}</p>
            )}
            <div className="chip-row">
              {connectedNodes.map((c) => (
                <span key={c.id} className={`chip ${c.type === "accused" ? "accused-chip" : ""}`}>
                  {c.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
