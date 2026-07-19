from datetime import datetime
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func

from . import models
from .database import get_db, SessionLocal
from .nl_parser import parse_query
from .pdf_export import build_case_pdf, build_chat_pdf
from . import audit, rbac, trends, scene, auth, crime_stats
from .chat import handle_chat, build_profile
from .auth import get_current_user, require_admin

app = FastAPI(title="KSP FIR Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    db = SessionLocal()
    try:
        auth.seed_default_admin(db)
    finally:
        db.close()


# ---------- helpers ----------

def case_to_summary(c: models.CaseMaster) -> dict:
    return {
        "id": c.CaseMasterID,
        "crime_no": c.CrimeNo,
        "case_no": c.CaseNo,
        "registered_date": str(c.CrimeRegisteredDate) if c.CrimeRegisteredDate else None,
        "category": c.category.LookupValue if c.category else None,
        "gravity": c.gravity.LookupValue if c.gravity else None,
        "crime_head": c.crime_head.CrimeGroupName if c.crime_head else None,
        "crime_sub_head": c.crime_sub_head.CrimeHeadName if c.crime_sub_head else None,
        "status": c.status.CaseStatusName if c.status else None,
        "district": c.station.district.DistrictName if c.station and c.station.district else None,
        "station": c.station.UnitName if c.station else None,
        "accused_count": len(c.accused),
        "victim_count": len(c.victims),
        "latitude": c.latitude,
        "longitude": c.longitude,
    }


def case_to_detail(c: models.CaseMaster) -> dict:
    d = case_to_summary(c)
    d.update({
        "officer": c.officer.FirstName if c.officer else None,
        "court": c.court.CourtName if c.court else None,
        "brief_facts": c.BriefFacts,
        "complainants": [
            {"name": cp.ComplainantName, "age": cp.AgeYear,
             "occupation": cp.occupation.OccupationName if cp.occupation else None,
             "religion": cp.religion.ReligionName if cp.religion else None,
             "caste": cp.caste.caste_master_name if cp.caste else None}
            for cp in c.complainants
        ],
        "victims": [
            {"id": v.VictimMasterID, "name": v.VictimName, "age": v.AgeYear, "gender": v.GenderID}
            for v in c.victims
        ],
        "accused": [
            {"id": a.AccusedMasterID, "person_id": a.PersonID, "name": a.AccusedName,
             "age": a.AgeYear, "gender": a.GenderID, "arrested": len(a.arrests) > 0}
            for a in c.accused
        ],
        "acts": [
            {"act": asa.act.ShortName if asa.act else asa.ActID, "section": asa.SectionID}
            for asa in c.act_sections
        ],
    })
    return d


def user_label(user: models.User) -> str:
    return user.full_name or user.username


# ---------- auth ----------

@app.post("/api/auth/login")
def api_login(payload: dict, db: Session = Depends(get_db)):
    username = (payload or {}).get("username", "").strip()
    password = (payload or {}).get("password", "")
    session_purpose = (payload or {}).get("purpose", "").strip()
    if not username or not password:
        raise HTTPException(400, "username and password are required")
    result = auth.login(db, username, password)
    if not result:
        raise HTTPException(401, "Invalid username or password")
    token, user = result
    audit.log_action(db, user_role=user.role, user_name=user.full_name or user.username,
                      purpose=session_purpose or user.purpose or "",
                      action_type="login", query_text="login",
                      result_summary=f"{user.username} logged in")
    return {
        "token": token,
        "user": {
            "username": user.username, "full_name": user.full_name, "role": user.role,
            "purpose": user.purpose, "station": user.station.UnitName if user.station else None,
        },
    }


@app.get("/api/auth/me")
def api_me(user: models.User = Depends(get_current_user)):
    return {
        "username": user.username, "full_name": user.full_name, "role": user.role,
        "purpose": user.purpose, "station": user.station.UnitName if user.station else None,
    }


@app.get("/api/auth/purposes")
def api_purposes():
    return {"purposes": auth.PURPOSES, "roles": rbac.ROLES}


# ---------- user management (Admin only — no public sign-up) ----------

@app.get("/api/users")
def list_users(db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    return [
        {"id": u.id, "username": u.username, "full_name": u.full_name, "role": u.role,
         "purpose": u.purpose, "station": u.station.UnitName if u.station else None,
         "active": u.active, "created_at": u.created_at.isoformat() if u.created_at else None,
         "created_by": u.created_by}
        for u in users
    ]


@app.post("/api/users")
def create_user_endpoint(payload: dict, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    required = ["username", "password", "full_name", "role", "purpose"]
    missing = [f for f in required if not (payload or {}).get(f)]
    if missing:
        raise HTTPException(400, f"Missing fields: {', '.join(missing)}")
    if payload["role"] not in rbac.ROLES:
        raise HTTPException(400, f"role must be one of {rbac.ROLES}")
    try:
        u = auth.create_user(
            db, username=payload["username"], password=payload["password"],
            full_name=payload["full_name"], role=payload["role"], purpose=payload["purpose"],
            station_id=payload.get("station_id"), created_by=user_label(admin),
        )
    except ValueError as e:
        raise HTTPException(409, str(e))
    return {"id": u.id, "username": u.username}


@app.post("/api/users/{user_id}/deactivate")
def deactivate_user(user_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    u = db.query(models.User).get(user_id)
    if not u:
        raise HTTPException(404, "User not found")
    u.active = False
    db.commit()
    return {"ok": True}


# ---------- stats ----------

@app.get("/api/stats")
def stats(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    total = db.query(models.CaseMaster).count()
    by_category = dict(
        db.query(models.CaseCategory.LookupValue, func.count(models.CaseMaster.CaseMasterID))
        .join(models.CaseMaster, models.CaseMaster.CaseCategoryID == models.CaseCategory.CaseCategoryID)
        .group_by(models.CaseCategory.LookupValue).all()
    )
    by_status = dict(
        db.query(models.CaseStatusMaster.CaseStatusName, func.count(models.CaseMaster.CaseMasterID))
        .join(models.CaseMaster, models.CaseMaster.CaseStatusID == models.CaseStatusMaster.CaseStatusID)
        .group_by(models.CaseStatusMaster.CaseStatusName).all()
    )
    by_crime_head = dict(
        db.query(models.CrimeHead.CrimeGroupName, func.count(models.CaseMaster.CaseMasterID))
        .join(models.CaseMaster, models.CaseMaster.CrimeMajorHeadID == models.CrimeHead.CrimeHeadID)
        .group_by(models.CrimeHead.CrimeGroupName).all()
    )
    by_district = dict(
        db.query(models.District.DistrictName, func.count(models.CaseMaster.CaseMasterID))
        .join(models.Unit, models.Unit.DistrictID == models.District.DistrictID)
        .join(models.CaseMaster, models.CaseMaster.PoliceStationID == models.Unit.UnitID)
        .group_by(models.District.DistrictName).all()
    )
    total_accused = db.query(models.Accused).count()
    total_arrests = db.query(models.ArrestSurrender).count()
    return {
        "total_cases": total, "total_accused": total_accused, "total_arrests": total_arrests,
        "by_category": by_category, "by_status": by_status,
        "by_crime_head": by_crime_head, "by_district": by_district,
    }


# ---------- cases ----------

@app.get("/api/cases")
def list_cases(
    district: Optional[str] = None,
    crime_sub_head: Optional[str] = None,
    status: Optional[str] = None,
    gravity: Optional[str] = None,
    category: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    accused_name: Optional[str] = None,
    keyword: Optional[str] = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    q = db.query(models.CaseMaster)
    if district:
        q = q.join(models.Unit, models.CaseMaster.PoliceStationID == models.Unit.UnitID) \
             .join(models.District, models.Unit.DistrictID == models.District.DistrictID) \
             .filter(models.District.DistrictName.ilike(f"%{district}%"))
    if crime_sub_head:
        q = q.join(models.CrimeSubHead, models.CaseMaster.CrimeMinorHeadID == models.CrimeSubHead.CrimeSubHeadID) \
             .filter(models.CrimeSubHead.CrimeHeadName.ilike(f"%{crime_sub_head}%"))
    if status:
        q = q.join(models.CaseStatusMaster, models.CaseMaster.CaseStatusID == models.CaseStatusMaster.CaseStatusID) \
             .filter(models.CaseStatusMaster.CaseStatusName.ilike(f"%{status}%"))
    if gravity:
        q = q.join(models.GravityOffence, models.CaseMaster.GravityOffenceID == models.GravityOffence.GravityOffenceID) \
             .filter(models.GravityOffence.LookupValue.ilike(f"%{gravity}%"))
    if category:
        q = q.join(models.CaseCategory, models.CaseMaster.CaseCategoryID == models.CaseCategory.CaseCategoryID) \
             .filter(models.CaseCategory.LookupValue.ilike(f"%{category}%"))
    if date_from:
        q = q.filter(models.CaseMaster.CrimeRegisteredDate >= date_from)
    if date_to:
        q = q.filter(models.CaseMaster.CrimeRegisteredDate <= date_to)
    if accused_name:
        q = q.join(models.Accused, models.Accused.CaseMasterID == models.CaseMaster.CaseMasterID) \
             .filter(models.Accused.AccusedName.ilike(f"%{accused_name}%"))
    if keyword:
        q = q.filter(models.CaseMaster.BriefFacts.ilike(f"%{keyword}%"))

    cases = q.order_by(models.CaseMaster.CrimeRegisteredDate.desc()).limit(limit).all()
    return [case_to_summary(c) for c in cases]


@app.get("/api/cases/{case_id}")
def get_case(case_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    c = db.query(models.CaseMaster).get(case_id)
    if not c:
        raise HTTPException(404, "Case not found")
    detail = rbac.redact_case_detail(case_to_detail(c), user.role)
    audit.log_action(db, user_role=user.role, user_name=user_label(user), purpose=user.purpose, action_type="case_view",
                      query_text=str(case_id), referenced_case_ids=[case_id],
                      result_summary=f"Viewed case {c.CrimeNo}")
    return detail


@app.get("/api/cases/{case_id}/pdf")
def export_case_pdf(case_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    c = db.query(models.CaseMaster).get(case_id)
    if not c:
        raise HTTPException(404, "Case not found")
    pdf_bytes = build_case_pdf(rbac.redact_case_detail(case_to_detail(c), user.role))
    audit.log_action(db, user_role=user.role, user_name=user_label(user), purpose=user.purpose, action_type="pdf_export",
                      query_text=str(case_id), referenced_case_ids=[case_id])
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{c.CrimeNo}.pdf"'},
    )


# ---------- NL query ----------

@app.post("/api/nl-query")
def nl_query(payload: dict, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    text = (payload or {}).get("text", "")
    if not text.strip():
        raise HTTPException(400, "text is required")
    parsed = parse_query(text)
    results = list_cases(
        district=parsed["filters"].get("district"), crime_sub_head=parsed["filters"].get("crime_sub_head"),
        status=parsed["filters"].get("status"), gravity=parsed["filters"].get("gravity"),
        date_from=parsed["filters"].get("date_from"), date_to=parsed["filters"].get("date_to"),
        accused_name=parsed["filters"].get("accused_name"), keyword=parsed["filters"].get("keyword"),
        db=db, user=user,
    )
    audit.log_action(db, user_role=user.role, user_name=user_label(user), purpose=user.purpose, action_type="nl_search",
                      query_text=text, matched_filters=parsed["filters"],
                      referenced_case_ids=[r["id"] for r in results], result_summary=f"{len(results)} result(s)")
    return {"filters": parsed["filters"], "explanation": parsed["explanation"], "results": results}


# ---------- criminal network visualization ----------

@app.get("/api/network")
def network(
    case_id: Optional[int] = None,
    accused_name: Optional[str] = None,
    limit_cases: int = 40,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    nodes = {}
    edges = []

    def add_case_node(c: models.CaseMaster):
        nid = f"case-{c.CaseMasterID}"
        if nid not in nodes:
            nodes[nid] = {"id": nid, "type": "case", "label": c.CrimeNo,
                          "sub": c.crime_sub_head.CrimeHeadName if c.crime_sub_head else "",
                          "case_id": c.CaseMasterID}
        return nid

    def add_accused_node(a: models.Accused):
        nid = f"accused-{a.AccusedName.strip().lower()}"
        if nid not in nodes:
            nodes[nid] = {"id": nid, "type": "accused", "label": a.AccusedName, "case_count": 0}
        return nid

    if case_id:
        c = db.query(models.CaseMaster).get(case_id)
        if not c:
            raise HTTPException(404, "Case not found")
        case_nid = add_case_node(c)
        for a in c.accused:
            acc_nid = add_accused_node(a)
            edges.append({"source": case_nid, "target": acc_nid, "relation": "accused_in"})
        for v in c.victims:
            vid = f"victim-{v.VictimMasterID}"
            nodes[vid] = {"id": vid, "type": "victim", "label": v.VictimName}
            edges.append({"source": case_nid, "target": vid, "relation": "victim_in"})
    else:
        q = db.query(models.Accused)
        if accused_name:
            accused_rows = q.filter(models.Accused.AccusedName.ilike(f"%{accused_name}%")).all()
        else:
            repeat_names = [
                row[0] for row in
                db.query(models.Accused.AccusedName).group_by(models.Accused.AccusedName)
                .having(func.count(models.Accused.CaseMasterID) >= 2).limit(limit_cases).all()
            ]
            accused_rows = db.query(models.Accused).filter(models.Accused.AccusedName.in_(repeat_names)).all()

        for a in accused_rows:
            c = a.case
            if not c:
                continue
            case_nid = add_case_node(c)
            acc_nid = add_accused_node(a)
            nodes[acc_nid]["case_count"] += 1
            edges.append({"source": case_nid, "target": acc_nid, "relation": "accused_in"})

    return {"nodes": list(nodes.values()), "edges": edges}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/roles")
def roles(user: models.User = Depends(get_current_user)):
    return {"roles": rbac.ROLES}


# ---------- criminal profile (full history + risk score) ----------

@app.get("/api/criminals/{name}/profile")
def criminal_profile(name: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    profile = build_profile(db, name)
    if not profile:
        raise HTTPException(404, "No accused person matching that name")
    if user.role not in rbac.FULL_PII_ROLES:
        profile = {**profile, "name": profile["name"] if user.role in rbac.FULL_CASE_DETAIL_ROLES else "[redacted]"}
    audit.log_action(db, user_role=user.role, user_name=user_label(user), purpose=user.purpose, action_type="profile_view",
                      query_text=name, referenced_case_ids=profile["case_ids"],
                      result_summary=f"Risk {profile['risk']['score']} ({profile['risk']['band']})")
    return profile


# ---------- chatbot ----------

@app.post("/api/chat")
def chat(payload: dict, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    message = (payload or {}).get("message", "")
    history = (payload or {}).get("history", [])
    language = (payload or {}).get("language", "en")
    if not message.strip():
        raise HTTPException(400, "message is required")
    result = handle_chat(db, message, history, language)
    audit.log_action(
        db, user_role=user.role, user_name=user_label(user), purpose=user.purpose, action_type="chat",
        query_text=message, matched_filters=result.get("matched_filters"),
        referenced_case_ids=result.get("referenced_case_ids", []), result_summary=result["reply"][:200],
    )
    return result


@app.post("/api/chat/pdf")
def chat_pdf(payload: dict, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    messages = (payload or {}).get("messages", [])
    language = (payload or {}).get("language", "en")
    if not messages:
        raise HTTPException(400, "messages is required")
    pdf_bytes = build_chat_pdf(messages, language)
    audit.log_action(db, user_role=user.role, user_name=user_label(user), purpose=user.purpose, action_type="pdf_export",
                      query_text="chat_transcript", result_summary=f"{len(messages)} messages exported")
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="chat_transcript.pdf"'},
    )


# ---------- trends, hotspots, predictive early warnings ----------

@app.get("/api/trends")
def get_trends(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return trends.hotspot_summary(db)


@app.get("/api/state-crime-stats")
def state_crime_stats(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return crime_stats.summary(db)


# ---------- scene reconstruction ----------

@app.get("/api/cases/{case_id}/scene")
def case_scene(case_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    c = db.query(models.CaseMaster).get(case_id)
    if not c:
        raise HTTPException(404, "Case not found")
    detail = rbac.redact_case_detail(case_to_detail(c), user.role)
    narrative = scene.build_narrative(detail)
    svg = scene.build_scene_svg(detail)
    audit.log_action(db, user_role=user.role, user_name=user_label(user), purpose=user.purpose, action_type="scene_reconstruction",
                      query_text=str(case_id), referenced_case_ids=[case_id])
    return {"narrative": narrative, "svg": svg}


# ---------- audit trail (Admin only) ----------

@app.get("/api/audit-log")
def audit_log(limit: int = 100, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    rows = db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).limit(limit).all()
    return [audit.log_to_dict(r) for r in rows]


# ---------- police stations directory ----------

@app.get("/api/stations")
def list_stations(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    units = db.query(models.Unit).filter(models.Unit.TypeID == 1).order_by(models.Unit.UnitName).all()
    return [
        {
            "id": u.UnitID, "name": u.UnitName,
            "district": u.district.DistrictName if u.district else None,
            "phone": f"080-{2200 + (u.UnitID % 700):04d}-{1000 + u.UnitID:04d}",
            "email": f"{u.UnitName.lower().replace(' ', '.')}@ksp.gov.in",
        }
        for u in units
    ]


# ---------- shared station bulletin ----------

@app.get("/api/bulletin")
def list_bulletin(limit: int = 50, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    rows = db.query(models.StationBulletin).order_by(models.StationBulletin.created_at.desc()).limit(limit).all()
    return [
        {"id": b.id, "station": b.station.UnitName if b.station else None, "author": b.author,
         "subject": b.subject, "message": b.message,
         "created_at": b.created_at.isoformat() if b.created_at else None}
        for b in rows
    ]


@app.post("/api/bulletin")
def post_bulletin(payload: dict, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    subject = (payload or {}).get("subject", "").strip()
    message = (payload or {}).get("message", "").strip()
    if not subject or not message:
        raise HTTPException(400, "subject and message are required")
    b = models.StationBulletin(
        station_id=user.station_id, author=user_label(user), subject=subject, message=message,
        created_at=datetime.utcnow(),
    )
    db.add(b)
    db.commit()
    audit.log_action(db, user_role=user.role, user_name=user_label(user), purpose=user.purpose, action_type="bulletin_post",
                      query_text=subject, result_summary=message[:150])
    return {"ok": True, "id": b.id}


# ---------- wanted list (any station posts, every station sees) ----------

@app.get("/api/wanted")
def list_wanted(status: Optional[str] = None, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    q = db.query(models.WantedPerson)
    if status:
        q = q.filter(models.WantedPerson.status == status)
    rows = q.order_by(models.WantedPerson.created_at.desc()).all()
    return [
        {
            "id": w.id, "name": w.name, "aliases": w.aliases, "reason": w.reason,
            "danger_level": w.danger_level, "last_seen_location": w.last_seen_location,
            "status": w.status, "case_id": w.case_id,
            "posted_by_station": w.station.UnitName if w.station else None,
            "posted_by_user": w.posted_by_user,
            "created_at": w.created_at.isoformat() if w.created_at else None,
        }
        for w in rows
    ]


@app.post("/api/wanted")
def post_wanted(payload: dict, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role not in ("Admin", "Investigating Officer"):
        raise HTTPException(403, "Only investigating officers or admins can post to the wanted list")
    name = (payload or {}).get("name", "").strip()
    if not name:
        raise HTTPException(400, "name is required")
    w = models.WantedPerson(
        name=name, aliases=(payload or {}).get("aliases", ""), case_id=(payload or {}).get("case_id"),
        reason=(payload or {}).get("reason", ""), danger_level=(payload or {}).get("danger_level", "Medium"),
        last_seen_location=(payload or {}).get("last_seen_location", ""), status="Active",
        posted_by_station_id=user.station_id, posted_by_user=user_label(user), created_at=datetime.utcnow(),
    )
    db.add(w)
    db.commit()
    audit.log_action(db, user_role=user.role, user_name=user_label(user), purpose=user.purpose, action_type="wanted_post",
                      query_text=name, result_summary=w.danger_level)
    return {"ok": True, "id": w.id}


@app.post("/api/wanted/{wanted_id}/status")
def update_wanted_status(wanted_id: int, payload: dict, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.role not in ("Admin", "Investigating Officer"):
        raise HTTPException(403, "Only investigating officers or admins can update the wanted list")
    w = db.query(models.WantedPerson).get(wanted_id)
    if not w:
        raise HTTPException(404, "Not found")
    new_status = (payload or {}).get("status")
    if new_status not in ("Active", "Apprehended", "Withdrawn"):
        raise HTTPException(400, "status must be Active, Apprehended, or Withdrawn")
    w.status = new_status
    db.commit()
    return {"ok": True}
