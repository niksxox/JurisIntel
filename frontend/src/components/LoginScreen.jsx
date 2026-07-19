import React, { useEffect, useState } from "react";
import { api, setToken } from "../api";

export default function LoginScreen({ onLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [purpose, setPurpose] = useState("");
  const [purposes, setPurposes] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.purposes().then((d) => {
      setPurposes(d.purposes);
      setPurpose(d.purposes[0]);
    }).catch(() => setPurposes([]));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Enter both username and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.login(username.trim(), password, purpose);
      setToken(res.token);
      onLoggedIn(res.user);
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-badge" style={{ width: 52, height: 52, fontSize: 18 }}>KSP</div>
          <div>
            <div className="brand-title" style={{ fontSize: 19 }}>FIR Intelligence Dashboard</div>
            <div className="brand-sub">KARNATAKA POLICE · RESTRICTED ACCESS SYSTEM</div>
          </div>
        </div>

        <p className="login-notice">
          This system is restricted to authorized personnel. Accounts are provisioned by an
          administrator only — there is no public self-registration. All access is logged.
        </p>

        <form onSubmit={submit}>
          <label className="login-label">Username</label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />

          <label className="login-label">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

          <label className="login-label">Purpose of access (this session)</label>
          <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            {purposes.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          {error && <div className="login-error">{error}</div>}

          <button className="btn" type="submit" disabled={loading} style={{ width: "100%", marginTop: 16, padding: "11px 0" }}>
            {loading ? "Verifying…" : "Sign in"}
          </button>
        </form>

        <p className="login-footnote">
          Every login, search, and export is written to the audit trail against your account.
        </p>
      </div>
    </div>
  );
}
