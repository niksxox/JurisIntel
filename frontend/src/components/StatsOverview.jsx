import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const GOLD = "#d4a62a";
const TEAL = "#2fbfa0";
const MUTED = "#7f8cab";

function toChartData(obj) {
  return Object.entries(obj || {}).map(([name, value]) => ({ name, value }));
}

export default function StatsOverview({ stats }) {
  if (!stats) return <div className="loading-line">LOADING STATISTICS...</div>;

  const byCrimeHead = toChartData(stats.by_crime_head);
  const byStatus = toChartData(stats.by_status);

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total_cases}</div>
          <div className="stat-label">Total cases on file</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total_accused}</div>
          <div className="stat-label">Accused persons named</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total_arrests}</div>
          <div className="stat-label">Arrests / surrenders logged</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{Object.keys(stats.by_district || {}).length}</div>
          <div className="stat-label">Districts represented</div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="panel">
          <p className="panel-title">Cases by crime head</p>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={byCrimeHead} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1b2439" horizontal={false} />
              <XAxis type="number" tick={{ fill: MUTED, fontSize: 11 }} axisLine={{ stroke: "#24304a" }} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                tick={{ fill: "#e8ecf5", fontSize: 12 }}
                axisLine={{ stroke: "#24304a" }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ background: "#121a2b", border: "1px solid #24304a", borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: "#ffffff08" }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {byCrimeHead.map((_, i) => (
                  <Cell key={i} fill={i % 2 === 0 ? GOLD : TEAL} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <p className="panel-title">Cases by status</p>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={byStatus} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1b2439" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 10 }} axisLine={{ stroke: "#24304a" }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fill: MUTED, fontSize: 11 }} axisLine={{ stroke: "#24304a" }} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#121a2b", border: "1px solid #24304a", borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: "#ffffff08" }}
              />
              <Bar dataKey="value" fill={GOLD} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
