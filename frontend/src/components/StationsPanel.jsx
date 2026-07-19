import React, { useEffect, useState } from "react";
import { api } from "../api";

export default function StationsPanel() {
  const [stations, setStations] = useState(null);
  const [bulletin, setBulletin] = useState(null);
  const [form, setForm] = useState({ subject: "", message: "" });
  const [error, setError] = useState("");

  const loadBulletin = () => api.bulletin().then(setBulletin).catch((e) => setError(e.message));

  useEffect(() => {
    api.stations().then(setStations).catch((e) => setError(e.message));
    loadBulletin();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.subject.trim() || !form.message.trim()) {
      setError("Subject and message are both required.");
      return;
    }
    try {
      await api.postBulletin(form.subject, form.message);
      setForm({ subject: "", message: "" });
      loadBulletin();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="network-wrap" style={{ gridTemplateColumns: "1fr 1.3fr" }}>
      <div className="panel">
        <p className="panel-title">Police station directory</p>
        {!stations ? (
          <div className="loading-line">LOADING STATIONS...</div>
        ) : (
          <div className="station-list">
            {stations.map((s) => (
              <div key={s.id} className="station-row">
                <div>
                  <div className="name">{s.name}</div>
                  <div className="meta">{s.district}</div>
                </div>
                <div className="meta" style={{ textAlign: "right" }}>
                  {s.phone}<br />{s.email}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <p className="panel-title">Shared inter-station bulletin</p>
        <p style={{ fontSize: 12, color: "#7f8cab", marginBottom: 12 }}>
          Post a notice here and every station sees it — for cross-district coordination,
          shared leads, or alerts. Anyone signed in can post.
        </p>

        <form onSubmit={submit} style={{ marginBottom: 18 }}>
          <input
            type="text" placeholder="Subject"
            value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
            style={{ marginBottom: 8 }}
          />
          <textarea
            rows={3} placeholder="Message"
            value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
          {error && <div className="login-error" style={{ marginTop: 8 }}>{error}</div>}
          <button className="btn" type="submit" style={{ marginTop: 10 }}>Post notice</button>
        </form>

        {!bulletin ? (
          <div className="loading-line">LOADING BULLETIN...</div>
        ) : bulletin.length === 0 ? (
          <div className="empty-state">No notices yet.</div>
        ) : (
          bulletin.map((b) => (
            <div key={b.id} className="bulletin-item">
              <div className="subject">{b.subject}</div>
              <div className="message">{b.message}</div>
              <div className="byline">{b.author} · {b.station || "HQ"} · {b.created_at?.slice(0, 16).replace("T", " ")}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
