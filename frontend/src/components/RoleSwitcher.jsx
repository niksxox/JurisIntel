import React from "react";

const ROLES = ["Admin", "Investigating Officer", "Analyst", "Public Liaison"];

export default function RoleSwitcher({ role, onChange }) {
  return (
    <select
      value={role}
      onChange={(e) => onChange(e.target.value)}
      title="Switch role to see RBAC redaction in action"
      style={{ fontSize: 12, padding: "7px 9px" }}
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  );
}
