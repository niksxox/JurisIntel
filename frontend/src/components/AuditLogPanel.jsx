import React, { useEffect, useState } from "react";
import { api } from "../api";

export default function AuditLogPanel({ role }) {
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLogs(null);
    setError(null);
    api.auditLog(150).then(setLogs).catch((e) => setError(e.message));
  }, [role]);

  if (role !== "Admin") {
    return (
      <div className="panel">
        <div className="empty-state">
          The audit trail is restricted to the Admin role.
        </div>
      </div>
    );
  }

  if (error) return <div className="empty-state">{error}</div>;
  if (!logs) return <div className="loading-line">LOADING AUDIT TRAIL...</div>;

  return (
    <div className="panel">
      <p className="panel-title">{logs.length} logged action(s) — every login, search, chat turn, and PDF export</p>
      <table className="case-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>User</th>
            <th>Role</th>
            <th>Purpose</th>
            <th>Action</th>
            <th>Query</th>
            <th>Cases referenced</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>{l.timestamp?.replace("T", " ").slice(0, 19)}</td>
              <td>{l.user_name}</td>
              <td>{l.user_role}</td>
              <td style={{ fontSize: 11.5, color: "#7f8cab" }}>{l.purpose}</td>
              <td><span className="badge">{l.action_type}</span></td>
              <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.query_text}</td>
              <td>{l.referenced_case_ids?.length || 0}</td>
              <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#7f8cab" }}>{l.result_summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
