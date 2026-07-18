import React, { useEffect, useState } from "react";
import { api } from "../api";

export default function CaseDetail({ caseId, onClose, onViewNetwork }) {
  const [detail, setDetail] = useState(null);
  const [scene, setScene] = useState(null);
  const [sceneLoading, setSceneLoading] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    setDetail(null);
    setScene(null);
    api.case(caseId).then(setDetail).catch(console.error);
  }, [caseId]);

  const loadScene = () => {
    if (scene) { setScene(null); return; }
    setSceneLoading(true);
    api.scene(caseId).then(setScene).catch(console.error).finally(() => setSceneLoading(false));
  };

  if (!caseId) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <button className="close-x" onClick={onClose}>×</button>
        {!detail ? (
          <div className="loading-line">LOADING CASE FILE...</div>
        ) : (
          <>
            <div className="crime-no">{detail.crime_no}</div>
            <h2>{detail.crime_sub_head} — {detail.crime_head}</h2>
            <div className="chip-row">
              <span className={`badge ${detail.gravity === "Heinous" ? "heinous" : "non-heinous"}`}>{detail.gravity}</span>
              <span className="badge status-open">{detail.status}</span>
              <span className="badge">{detail.category}</span>
            </div>

            <div className="drawer-section">
              <h4>Location & registration</h4>
              <p style={{ fontSize: 13, color: "#c4cce0", lineHeight: 1.6 }}>
                {detail.station}, {detail.district}<br />
                Registered {detail.registered_date} · IO: {detail.officer}<br />
                Court: {detail.court}
              </p>
            </div>

            <div className="drawer-section">
              <h4>Brief facts</h4>
              <p style={{ fontSize: 13, color: "#c4cce0", lineHeight: 1.6 }}>{detail.brief_facts}</p>
            </div>

            {detail.acts?.length > 0 && (
              <div className="drawer-section">
                <h4>Acts & sections</h4>
                <div className="chip-row">
                  {detail.acts.map((a, i) => (
                    <span key={i} className="chip">{a.act} § {a.section}</span>
                  ))}
                </div>
              </div>
            )}

            {detail.accused?.length > 0 && (
              <div className="drawer-section">
                <h4>Accused ({detail.accused.length})</h4>
                <div className="chip-row">
                  {detail.accused.map((a) => (
                    <span key={a.id} className="chip accused-chip">
                      {a.person_id}: {a.name} ({a.age}, {a.gender}){a.arrested ? " — arrested" : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {detail.victims?.length > 0 && (
              <div className="drawer-section">
                <h4>Victims ({detail.victims.length})</h4>
                <div className="chip-row">
                  {detail.victims.map((v) => (
                    <span key={v.id} className="chip">{v.name} ({v.age}, {v.gender})</span>
                  ))}
                </div>
              </div>
            )}

            <div className="drawer-section" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a className="btn" href={api.pdfUrl(detail.id)} download>
                Export case report (PDF)
              </a>
              <button className="btn secondary" onClick={() => onViewNetwork(detail.id)}>
                View network
              </button>
              <button className="btn secondary" onClick={loadScene}>
                {scene ? "Hide" : "Reconstruct"} scene
              </button>
            </div>

            {sceneLoading && <div className="loading-line">RECONSTRUCTING SCENE...</div>}

            {scene && (
              <div className="drawer-section">
                <h4>Scene reconstruction (generated)</h4>
                <div style={{ background: "#0a0f1a", border: "1px solid #24304a", borderRadius: 8, overflow: "hidden", marginBottom: 10 }}
                     dangerouslySetInnerHTML={{ __html: scene.svg }} />
                <p style={{ fontSize: 12.5, color: "#c4cce0", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {scene.narrative}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
