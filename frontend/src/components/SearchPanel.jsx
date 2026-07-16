import React, { useState } from "react";
import { api } from "../api";
import CaseTable from "./CaseTable";

const EXAMPLES = [
  "heinous murder cases in Bengaluru Urban",
  "cyber crime cases under investigation",
  "closed drug trafficking cases in Mysuru",
];

export default function SearchPanel({ onSelectCase }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);

  const runQuery = async (q) => {
    const query = q ?? text;
    if (!query.trim()) return;
    setText(query);
    setLoading(true);
    try {
      const res = await api.nlQuery(query);
      setResponse(res);
    } catch (e) {
      setResponse({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <p className="panel-title">Natural-language case search</p>
        <div className="nl-search">
          <input
            type="text"
            placeholder='Try "heinous murder cases in Bengaluru Urban last month"'
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runQuery()}
          />
          <button className="btn" onClick={() => runQuery()} disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
        <div className="chip-row">
          {EXAMPLES.map((ex) => (
            <span key={ex} className="chip" style={{ cursor: "pointer" }} onClick={() => runQuery(ex)}>
              {ex}
            </span>
          ))}
        </div>
        <p style={{ fontSize: 11.5, color: "#5a6786", marginTop: 10, lineHeight: 1.5 }}>
          Text is parsed into structured filters (district, crime type, gravity, status, date range)
          by the AI module, then run against the FIR database. This endpoint is a clean swap point
          for a full LLM-backed parser — the frontend only ever talks to <code>/api/nl-query</code>.
        </p>
      </div>

      {response?.error && <div className="empty-state">Error: {response.error}</div>}

      {response && !response.error && (
        <>
          <div className="explain-strip">{response.explanation}</div>
          <div className="panel">
            <p className="panel-title">{response.results.length} matching case(s)</p>
            <CaseTable cases={response.results} onSelect={onSelectCase} />
          </div>
        </>
      )}
    </div>
  );
}
