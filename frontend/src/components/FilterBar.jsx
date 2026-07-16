import React from "react";

const DISTRICTS = ["Bengaluru Urban", "Mysuru", "Mangaluru", "Belagavi", "Hubballi-Dharwad",
  "Kalaburagi", "Tumakuru", "Shivamogga", "Ballari", "Davanagere"];
const STATUSES = ["Under Investigation", "Charge Sheeted", "Closed", "Undetected", "Court Trial"];
const GRAVITIES = ["Heinous", "Non-Heinous"];
const CATEGORIES = ["FIR", "UDR", "Zero FIR", "PAR"];

export default function FilterBar({ filters, onChange }) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value });

  return (
    <div className="filter-bar">
      <select value={filters.district || ""} onChange={set("district")}>
        <option value="">All districts</option>
        {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <select value={filters.status || ""} onChange={set("status")}>
        <option value="">All statuses</option>
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={filters.gravity || ""} onChange={set("gravity")}>
        <option value="">Any gravity</option>
        {GRAVITIES.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
      <select value={filters.category || ""} onChange={set("category")}>
        <option value="">All categories</option>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      {(filters.district || filters.status || filters.gravity || filters.category) && (
        <button className="btn secondary" onClick={() => onChange({})}>Clear filters</button>
      )}
    </div>
  );
}
