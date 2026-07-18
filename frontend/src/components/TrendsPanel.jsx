import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../api";

export default function TrendsPanel() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.trends().then(setData).catch(console.error);
  }, []);

  if (!data) return <div className="loading-line">ANALYZING TRENDS...</div>;

  const hotspotData = data.top_hotspot_districts.map((d) => ({ name: d.district, value: d.total_cases }));

  return (
    <>
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
        <p className="panel-title">Hotspot districts (total case volume)</p>
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
