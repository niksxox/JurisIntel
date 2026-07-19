import React from "react";

function riskClass(band) {
  if (band === "High") return "high";
  if (band === "Medium") return "medium";
  return "low";
}

function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default function DossierCard({ profile, onSelectCase }) {
  if (!profile) return null;
  const band = profile.risk?.band || "Low";

  return (
    <div className="dossier">
      <div className="dossier-head">
        <div className="dossier-avatar">{initials(profile.name)}</div>
        <div>
          <div className="dossier-name">{profile.name}</div>
          <div className="dossier-meta">{profile.case_count} case(s) on file</div>
        </div>
        <span className={`risk-pill ${riskClass(band)}`}>{band.toUpperCase()} RISK</span>
      </div>
      <div className="dossier-body">
        <div className="dossier-stat">Cases on file<b>{profile.case_count}</b></div>
        <div className="dossier-stat">Arrest records<b>{profile.arrest_count}</b></div>
        <div className="dossier-stat">Co-accused linked<b>{profile.co_accused?.length || 0}</b></div>
        <div className="dossier-stat">Risk score<b>{profile.risk?.score}/100</b></div>
      </div>
      {profile.cases?.length > 0 && (
        <div className="dossier-foot">
          <div className="chip-row">
            {profile.cases.slice(0, 10).map((c) => (
              <span key={c.id} className="chip" style={{ cursor: "pointer" }} onClick={() => onSelectCase(c.id)}>
                {c.crime_sub_head || "Case"} · {c.district || ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
