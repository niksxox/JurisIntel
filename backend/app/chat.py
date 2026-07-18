"""
Chatbot intent router. Rule-based (no external LLM key required to run this
prototype) but structured so the whole function body can be swapped for a
real Claude call later -- see the note in nl_parser.py, the same pattern
applies here. What this module adds beyond nl_parser is:

  1. Entity intents ("who is X", "risk score of X") that return a full
     criminal profile instead of a case list.
  2. Context memory: pronoun / follow-up resolution using the last entity
     mentioned in the conversation (passed in via `history`), so "what about
     his arrests?" works after "who is Ravi Gowda?".
  3. Localized reply templates via i18n.t().
"""
import re
from sqlalchemy import func

from . import models
from .i18n import t
from .nl_parser import parse_query
from .risk import compute_risk

PROFILE_PATTERNS = [
    r"who is ([a-z .]{3,40})\??$",
    r"(?:profile|info|information|details) (?:of|on|about) ([a-z .]{3,40})\??$",
    r"(?:risk score|risk) (?:of|for) ([a-z .]{3,40})\??$",
    r"tell me about ([a-z .]{3,40})\??$",
]

FOLLOWUP_PRONOUNS = ["his", "her", "their", "he", "she", "they", "that person", "this person", "them"]


def _extract_name(text_lower: str):
    for pat in PROFILE_PATTERNS:
        m = re.search(pat, text_lower.strip())
        if m:
            return m.group(1).strip().title()
    return None


def _is_followup(text_lower: str) -> bool:
    return any(re.search(rf"\b{p}\b", text_lower) for p in FOLLOWUP_PRONOUNS)


def _last_entity(history: list):
    for turn in reversed(history or []):
        meta = turn.get("meta") or {}
        if meta.get("entity_name"):
            return meta["entity_name"]
    return None


def build_profile(db, name: str) -> dict:
    accused_rows = db.query(models.Accused).filter(models.Accused.AccusedName.ilike(f"%{name}%")).all()
    if not accused_rows:
        return None

    canonical_name = accused_rows[0].AccusedName
    case_ids = sorted({a.CaseMasterID for a in accused_rows})
    cases = db.query(models.CaseMaster).filter(models.CaseMaster.CaseMasterID.in_(case_ids)).all()
    risk = compute_risk(cases)

    case_summaries = [
        {
            "id": c.CaseMasterID,
            "crime_no": c.CrimeNo,
            "crime_sub_head": c.crime_sub_head.CrimeHeadName if c.crime_sub_head else None,
            "gravity": c.gravity.LookupValue if c.gravity else None,
            "status": c.status.CaseStatusName if c.status else None,
            "district": c.station.district.DistrictName if c.station and c.station.district else None,
            "registered_date": str(c.CrimeRegisteredDate) if c.CrimeRegisteredDate else None,
        }
        for c in cases
    ]

    arrest_count = db.query(models.ArrestSurrender).join(
        models.Accused, models.ArrestSurrender.AccusedMasterID == models.Accused.AccusedMasterID
    ).filter(models.Accused.AccusedName.ilike(f"%{name}%")).count()

    # co-accused: other names appearing in the same cases
    co_accused = sorted({
        a.AccusedName for a in db.query(models.Accused).filter(models.Accused.CaseMasterID.in_(case_ids)).all()
        if a.AccusedName.lower() != canonical_name.lower()
    })

    return {
        "name": canonical_name,
        "case_count": len(cases),
        "arrest_count": arrest_count,
        "risk": risk,
        "cases": case_summaries,
        "co_accused": co_accused,
        "case_ids": case_ids,
    }


def handle_chat(db, message: str, history: list, language: str = "en"):
    text_lower = message.lower().strip()

    name = _extract_name(text_lower)
    if not name and _is_followup(text_lower):
        name = _last_entity(history)

    if name:
        profile = build_profile(db, name)
        if not profile:
            return {
                "reply": t("no_match", language),
                "referenced_case_ids": [],
                "matched_filters": {"entity_name": name},
                "meta": {},
                "profile": None,
            }
        intro = t("profile_intro", language, name=profile["name"])
        risk_line = t(
            "risk_summary", language,
            score=profile["risk"]["score"], band=profile["risk"]["band"],
            count=profile["risk"]["case_count"], formula=profile["risk"]["formula"],
        )
        reply = f"{intro} {profile['case_count']} case(s) on file, {profile['arrest_count']} arrest record(s).\n{risk_line}"
        return {
            "reply": reply,
            "referenced_case_ids": profile["case_ids"],
            "matched_filters": {"entity_name": profile["name"]},
            "meta": {"entity_name": profile["name"]},
            "profile": profile,
        }

    # fall back to structured case search
    parsed = parse_query(message)
    from .main import list_cases  # local import to avoid circular import at module load
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
    reply = t("search_results", language, count=len(results), explanation=parsed["explanation"])
    return {
        "reply": reply,
        "referenced_case_ids": [r["id"] for r in results],
        "matched_filters": parsed["filters"],
        "meta": {},
        "results": results,
    }
