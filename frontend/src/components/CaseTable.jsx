import React from "react";

function statusBadgeClass(status) {
  if (status === "Closed" || status === "Charge Sheeted") return "badge status-closed";
  return "badge status-open";
}

export default function CaseTable({ cases, onSelect }) {
  if (!cases) return <div className="loading-line">LOADING CASES...</div>;
  if (cases.length === 0) return <div className="empty-state">No cases match these filters.</div>;

  return (
    <table className="case-table">
      <thead>
        <tr>
          <th>Crime No.</th>
          <th>Crime Type</th>
          <th>District</th>
          <th>Registered</th>
          <th>Gravity</th>
          <th>Status</th>
          <th>Accused</th>
        </tr>
      </thead>
      <tbody>
        {cases.map((c) => (
          <tr key={c.id} onClick={() => onSelect(c.id)}>
            <td className="crime-no">{c.crime_no}</td>
            <td>{c.crime_sub_head}</td>
            <td>{c.district}</td>
            <td>{c.registered_date}</td>
            <td>
              <span className={`badge ${c.gravity === "Heinous" ? "heinous" : "non-heinous"}`}>
                {c.gravity}
              </span>
            </td>
            <td><span className={statusBadgeClass(c.status)}>{c.status}</span></td>
            <td>{c.accused_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
