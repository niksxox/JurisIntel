import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { api } from "../api";

export default function TrendsPanel() {
  const [data, setData] = useState(null);
  const [real, setReal] = useState(null);

  useEffect(() => {
    api.trends().then(setData).catch(console.error);
    api.stateCrimeStats().then(setReal).catch(console.error);
  }, []);

  if (!data) return <div className="loading-line">ANALYZING TRENDS...</div>;

  const hotspotData = data.top_hotspot_districts.map((d) => ({ name: d.district, value: d.total_cases }));
  const yearlyData = real?.loaded
    ? Object.entries(real.by_year).map(([year, count]) => ({ year, count }))
    : [];
  const topHeadsData = real?.loaded ? real.top_major_heads.slice(0, 8).map((h) => ({
    name: h.name.length > 28 ? h.name.slice(0, 26) + "…" : h.name, value: h.count,
  })) : [];

  return (
    <>
      {real?.loaded && (
        <div className="panel" style={{ marginBottom: 16, borderColor: "#1c3733" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <p className="panel-title" style={{ color: "#5fd9b8" }}>● Real data — Karnataka SCRB, 2021–2024</p>
            <span style={{ fontSize: 11, color: "#7f8cab" }}>{real.total_incidents_2021_2024.toLocaleString()} recorded incidents</span>
          </div>
          <p style={{ fontSize: 11.5, color: "#5a6786", marginBottom: 14 }}>{real.source}</p>
          <div className="chart-grid">
            <div>
              <p style={{ fontSize: 11.5, color: "#7f8cab", marginBottom: 8 }}>Statewide incidents by year</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1b2439" />
                  <XAxis dataKey="year" tick={{ fill: "#7f8cab", fontSize: 11 }} axisLine={{ stroke: "#24304a" }} tickLine={false} />
                  <YAxis tick={{ fill: "#7f8cab", fontSize: 11 }} axisLine={{ stroke: "#24304a" }} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#121a2b", border: "1px solid #24304a", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="count" stroke="#2fbfa0" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p style={{ fontSize: 11.5, color: "#7f8cab", marginBottom: 8 }}>Top reported crime categories (2021–2024)</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topHeadsData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1b2439" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#7f8cab", fontSize: 10 }} axisLine={{ stroke: "#24304a" }} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fill: "#c4cce0", fontSize: 10.5 }} axisLine={{ stroke: "#24304a" }} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#121a2b", border: "1px solid #24304a", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "#ffffff08" }} />
                  <Bar dataKey="value" fill="#2fbfa0" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {data.early_warnings.length > 0 && (
        <div className="panel" style={{ marginBottom: 16, borderColor: "#4a2323" }}>
          <p className="panel-title" style={{ color: "#e0837a" }}>⚠ Predictive early warnings</p>
          {data.early_warnings.map((w, i) => (
            <div key={i} style={{
              fontSize: 13, padding: "10px 12px", marginBottom: 8,
              background: "#221213", border: "1px solid #4a2323", borderRadius: 8,
            }}>
              {w.message}
            </div>
          ))}
        </div>
      )}
      {data.early_warnings.length === 0 && (
        <div className="explain-strip" style={{ marginBottom: 16 }}>
          No statistically significant spikes detected this period (current month vs trailing average across districts and crime heads).
        </div>
      )}

      <div className="panel" style={{ marginBottom: 16 }}>
        <p className="panel-title">Hotspot districts — synthetic FIR case volume (district-level real data not yet connected)</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={hotspotData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1b2439" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#7f8cab", fontSize: 11 }} axisLine={{ stroke: "#24304a" }} tickLine={false} />
            <YAxis type="category" dataKey="name" width={130} tick={{ fill: "#e8ecf5", fontSize: 12 }} axisLine={{ stroke: "#24304a" }} tickLine={false} />
            <Tooltip contentStyle={{ background: "#121a2b", border: "1px solid #24304a", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "#ffffff08" }} />
            <Bar dataKey="value" fill="#d4a62a" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <p className="panel-title">Methodology</p>
        <p style={{ fontSize: 12.5, color: "#7f8cab", lineHeight: 1.6 }}>
          Early warnings flag a district or crime head when its latest month's case count is at least
          1.6x its own trailing monthly average (minimum 3 cases, to avoid flagging noise in low-volume
          groups). This is a transparent statistical rule, not a black-box model — every warning traces
          back to the exact counts shown here, which matters for explainability in an audit.
        </p>
      </div>
    </>
  );
}
