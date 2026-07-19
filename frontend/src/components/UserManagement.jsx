import React, { useEffect, useState } from "react";
import { api } from "../api";

const ROLES = ["Admin", "Investigating Officer", "Analyst", "Public Liaison"];

export default function UserManagement({ me }) {
  const [users, setUsers] = useState(null);
  const [purposes, setPurposes] = useState([]);
  const [stations, setStations] = useState([]);
  const [form, setForm] = useState({ username: "", password: "", full_name: "", role: "Investigating Officer", purpose: "", station_id: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = () => api.users().then(setUsers).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    api.purposes().then((d) => {
      setPurposes(d.purposes);
      setForm((f) => ({ ...f, purpose: d.purposes[0] }));
    });
    api.stations().then(setStations);
  }, []);

  if (me?.role !== "Admin") {
    return <div className="panel"><div className="empty-state">User management is restricted to Admins.</div></div>;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!form.username.trim() || !form.password || !form.full_name.trim()) {
      setError("Username, password, and full name are all required.");
      return;
    }
    try {
      await api.createUser({ ...form, station_id: form.station_id || null });
      setNotice(`Account "${form.username}" created.`);
      setForm({ username: "", password: "", full_name: "", role: "Investigating Officer", purpose: purposes[0], station_id: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deactivate = async (id) => {
    await api.deactivateUser(id);
    load();
  };

  return (
    <div className="network-wrap" style={{ gridTemplateColumns: "1fr 1.2fr" }}>
      <div className="panel">
        <p className="panel-title">Provision new account</p>
        <p style={{ fontSize: 12, color: "#7f8cab", marginBottom: 12 }}>
          There is no public sign-up — every account is created here by an Admin, with a
          declared purpose of access.
        </p>
        <form onSubmit={submit}>
          <label className="login-label" style={{ margin: "0 0 4px" }}>Username</label>
          <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <label className="login-label">Temporary password</label>
          <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <label className="login-label">Full name</label>
          <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <label className="login-label">Role</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <label className="login-label">Purpose of access</label>
          <select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
            {purposes.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <label className="login-label">Station (optional)</label>
          <select value={form.station_id} onChange={(e) => setForm({ ...form, station_id: e.target.value })}>
            <option value="">— none —</option>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          {error && <div className="login-error" style={{ marginTop: 10 }}>{error}</div>}
          {notice && <div className="explain-strip" style={{ marginTop: 10 }}>{notice}</div>}

          <button className="btn" type="submit" style={{ marginTop: 14 }}>Create account</button>
        </form>
      </div>

      <div className="panel">
        <p className="panel-title">{users?.length || 0} account(s)</p>
        {!users ? (
          <div className="loading-line">LOADING USERS...</div>
        ) : (
          <table className="case-table">
            <thead>
              <tr><th>User</th><th>Role</th><th>Purpose</th><th>Station</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name}<br /><span style={{ color: "#5a6786", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>{u.username}</span></td>
                  <td><span className="badge">{u.role}</span></td>
                  <td style={{ fontSize: 12 }}>{u.purpose}</td>
                  <td style={{ fontSize: 12 }}>{u.station || "—"}</td>
                  <td>{u.active ? <span className="badge status-closed">Active</span> : <span className="badge">Inactive</span>}</td>
                  <td>
                    {u.active && u.username !== me.username && (
                      <button className="btn secondary" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => deactivate(u.id)}>
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
