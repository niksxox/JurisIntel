from collections import defaultdict
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func

from . import models
from .database import get_db, engine
from .nl_parser import parse_query
from .pdf_export import build_case_pdf

app = FastAPI(title="KSP FIR Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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


# ---------- stats ----------

@app.get("/api/stats")
def stats(db: Session = Depends(get_db)):
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
        "total_cases": total,
        "total_accused": total_accused,
        "total_arrests": total_arrests,
        "by_category": by_category,
        "by_status": by_status,
        "by_crime_head": by_crime_head,
        "by_district": by_district,
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
def get_case(case_id: int, db: Session = Depends(get_db)):
    c = db.query(models.CaseMaster).get(case_id)
    if not c:
        raise HTTPException(404, "Case not found")
    return case_to_detail(c)


@app.get("/api/cases/{case_id}/pdf")
def export_case_pdf(case_id: int, db: Session = Depends(get_db)):
    c = db.query(models.CaseMaster).get(case_id)
    if not c:
        raise HTTPException(404, "Case not found")
    pdf_bytes = build_case_pdf(case_to_detail(c))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{c.CrimeNo}.pdf"'},
    )


# ---------- NL query (AI module integration point) ----------

@app.post("/api/nl-query")
def nl_query(payload: dict, db: Session = Depends(get_db)):
    text = (payload or {}).get("text", "")
    if not text.strip():
        raise HTTPException(400, "text is required")
    parsed = parse_query(text)
    results = list_cases(
        district=parsed["filters"].get("district"),
        crime_sub_head=parsed["filters"].get("crime_sub_head"),
        status=parsed["filters"].get("status"),
        gravity=parsed["filters"].get("gravity"),
        date_from=parsed["filters"].get("date_from"),
        date_to=parsed["filters"].get("date_to"),
        accused_name=parsed["filters"].get("accused_name"),
        keyword=parsed["filters"].get("keyword"),
        db=db,
    )
    return {"filters": parsed["filters"], "explanation": parsed["explanation"], "results": results}


# ---------- criminal network visualization ----------

@app.get("/api/network")
def network(
    case_id: Optional[int] = None,
    accused_name: Optional[str] = None,
    limit_cases: int = 40,
    db: Session = Depends(get_db),
):
    """
    Builds a graph of Case <-> Accused nodes. Passing `case_id` returns just
    that case's local network (co-accused, victims). Passing `accused_name`
    (or nothing) surfaces the wider network: every case any matching accused
    person appears in, revealing shared offenders across FIRs.
    """
    nodes = {}
    edges = []

    def add_case_node(c: models.CaseMaster):
        nid = f"case-{c.CaseMasterID}"
        if nid not in nodes:
            nodes[nid] = {
                "id": nid, "type": "case", "label": c.CrimeNo,
                "sub": c.crime_sub_head.CrimeHeadName if c.crime_sub_head else "",
                "case_id": c.CaseMasterID,
            }
        return nid

    def add_accused_node(a: models.Accused):
        # group same-name accused as one node to reveal repeat offenders
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
            q = q.filter(models.Accused.AccusedName.ilike(f"%{accused_name}%"))
            accused_rows = q.all()
        else:
            # surface only repeat offenders (appear in 2+ cases) for a meaningful default graph
            repeat_names = [
                row[0] for row in
                db.query(models.Accused.AccusedName)
                .group_by(models.Accused.AccusedName)
                .having(func.count(models.Accused.CaseMasterID) >= 2)
                .limit(limit_cases).all()
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
