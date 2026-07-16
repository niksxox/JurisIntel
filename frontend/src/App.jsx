import React, { useEffect, useState } from "react";
import { api } from "./api";
import StatsOverview from "./components/StatsOverview";
import FilterBar from "./components/FilterBar";
import CaseTable from "./components/CaseTable";
import CaseDetail from "./components/CaseDetail";
import NetworkGraph from "./components/NetworkGraph";
import SearchPanel from "./components/SearchPanel";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "network", label: "Criminal Network" },
  { id: "search", label: "AI Search" },
];

export default function App() {
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({});
  const [cases, setCases] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);

  const [networkData, setNetworkData] = useState({ nodes: [], edges: [] });
  const [networkCaseId, setNetworkCaseId] = useState(null);
  const [networkLoading, setNetworkLoading] = useState(false);

  useEffect(() => {
    api.stats().then(setStats).catch(console.error);
  }, []);

  useEffect(() => {
    if (tab !== "overview") return;
    setCases(null);
    api.cases(filters).then(setCases).catch(console.error);
  }, [filters, tab]);

  useEffect(() => {
    if (tab !== "network") return;
    setNetworkLoading(true);
    const params = networkCaseId ? { case_id: networkCaseId } : {};
    api.network(params)
      .then(setNetworkData)
      .catch(console.error)
      .finally(() => setNetworkLoading(false));
  }, [tab, networkCaseId]);

  const goToNetworkForCase = (caseId) => {
    setNetworkCaseId(caseId);
    setSelectedCase(null);
    setTab("network");
  };

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="brand-badge">KSP</div>
          <div>
            <div className="brand-title">FIR Intelligence Dashboard</div>
            <div className="brand-sub">Karnataka Police · Datathon 2026 Prototype</div>
          </div>
        </div>
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && (
        <>
          <StatsOverview stats={stats} />
          <div className="panel">
            <p className="panel-title">Case register</p>
            <FilterBar filters={filters} onChange={setFilters} />
            <CaseTable cases={cases} onSelect={setSelectedCase} />
          </div>
        </>
      )}

      {tab === "network" && (
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p className="panel-title" style={{ margin: 0 }}>
              {networkCaseId ? `Local network — case #${networkCaseId}` : "Repeat-offender network (cross-case)"}
            </p>
            {networkCaseId && (
              <button className="btn secondary" onClick={() => setNetworkCaseId(null)}>
                ← Back to full network
              </button>
            )}
          </div>
          {networkLoading ? (
            <div className="loading-line">BUILDING NETWORK GRAPH...</div>
          ) : (
            <NetworkGraph nodes={networkData.nodes} edges={networkData.edges} />
          )}
        </div>
      )}

      {tab === "search" && <SearchPanel onSelectCase={setSelectedCase} />}

      <CaseDetail caseId={selectedCase} onClose={() => setSelectedCase(null)} onViewNetwork={goToNetworkForCase} />
    </div>
  );
}
