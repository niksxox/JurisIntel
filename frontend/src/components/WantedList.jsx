import React, { useEffect, useState } from "react";
import { api } from "../api";

const DANGER_LEVELS = ["Low", "Medium", "High", "Extreme"];

function danger(level) {
  return (level || "medium").toLowerCase();
}

export default function WantedList({ me }) {
  const [wanted, setWanted] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", aliases: "", reason: "", danger_level: "Medium", last_seen_location: "" });
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("Active");

  const canPost = me?.role === "Admin" || me?.role === "Investigating Officer";

  const load = () => {
    api.wanted(filter).then(setWanted).catch((e) => setError(e.message));
  };

  useEffect(load, [filter]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    try {
      await api.postWanted(form);
      setForm({ name: "", aliases: "", reason: "", danger_level: "Medium", last_seen_location: "" });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const markStatus = async (id, status) => {
    await api.updateWantedStatus(id, status);
    load();
  };

  return (
    <div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p className="panel-title" style={{ margin: 0 }}>
            Wanted list — shared across every station
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="Active">Active</option>
              <option value="Apprehended">Apprehended</option>
              <option value="Withdrawn">Withdrawn</option>
              <option value="">All</option>
            </select>
            {canPost && (
              <button className="btn" onClick={() => setShowForm((s) => !s)}>
                {showForm ? "Cancel" : "+ Post to wanted list"}
              </button>
            )}
          </div>
        </div>
        <p style={{ fontSize: 12, color: "#7f8cab", marginTop: 8 }}>
          Any station can post here — every other station sees it immediately. Only Admins and
          Investigating Officers can post or update status.
        </p>

        {showForm && (
          <form onSubmit={submit} style={{ marginTop: 14, borderTop: "1px solid #1b2439", paddingTop: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="login-label" style={{ margin: "0 0 4px" }}>Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="login-label" style={{ margin: "0 0 4px" }}>Aliases</label>
                <input type="text" value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} />
              </div>
              <div>
                <label className="login-label" style={{ margin: "0 0 4px" }}>Danger level</label>
                <select value={form.danger_level} onChange={(e) => setForm({ ...form, danger_level: e.target.value })}>
                  {DANGER_LEVELS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="login-label" style={{ margin: "0 0 4px" }}>Last seen location</label>
                <input type="text" value={form.last_seen_location} onChange={(e) => setForm({ ...form, last_seen_location: e.target.value })} />
              </div>
            </div>
            <label className="login-label" style={{ margin: "10px 0 4px" }}>Reason wanted</label>
            <textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            {error && <div className="login-error" style={{ marginTop: 10 }}>{error}</div>}
            <button className="btn" type="submit" style={{ marginTop: 12 }}>Post</button>
          </form>
        )}
      </div>

      {!wanted ? (
        <div className="loading-line">LOADING WANTED LIST...</div>
      ) : wanted.length === 0 ? (
        <div className="empty-state">No entries for this filter.</div>
      ) : (
        <div className="wanted-grid">
          {wanted.map((w) => (
            <div key={w.id} className={`wanted-card ${danger(w.danger_level)}`}>
              <div className={`wanted-stripe ${danger(w.danger_level)}`} />
              <span className={`wanted-danger ${danger(w.danger_level)}`}>{w.danger_level}</span>
              <div className="wanted-name">{w.name}</div>
              {w.aliases && <div style={{ fontSize: 11.5, color: "#7f8cab", marginBottom: 6 }}>alias: {w.aliases}</div>}
              <div className="wanted-reason">{w.reason}</div>
              {w.last_seen_location && (
                <div style={{ fontSize: 11.5, color: "#7f8cab", marginBottom: 8 }}>📍 {w.last_seen_location}</div>
              )}
              <div className="wanted-foot">
                Posted by {w.posted_by_station || "unknown station"} · {w.posted_by_user}
                <br />
                {w.created_at?.slice(0, 10)} · status: {w.status}
              </div>
              {canPost && w.status === "Active" && (
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <button className="btn secondary" style={{ fontSize: 11, padding: "5px 9px" }} onClick={() => markStatus(w.id, "Apprehended")}>
                    Mark apprehended
                  </button>
                  <button className="btn secondary" style={{ fontSize: 11, padding: "5px 9px" }} onClick={() => markStatus(w.id, "Withdrawn")}>
                    Withdraw
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
