import json
from datetime import datetime

from . import models


def log_action(db, *, user_role, user_name, action_type, purpose="", query_text="",
                matched_filters=None, referenced_case_ids=None, result_summary=""):
    entry = models.AuditLog(
        timestamp=datetime.utcnow(),
        user_role=user_role or "Unknown",
        user_name=user_name or "anonymous",
        purpose=purpose or "",
        action_type=action_type,
        query_text=query_text or "",
        matched_filters=json.dumps(matched_filters or {}),
        referenced_case_ids=json.dumps(referenced_case_ids or []),
        result_summary=result_summary or "",
    )
    db.add(entry)
    db.commit()
    return entry


def log_to_dict(e: models.AuditLog) -> dict:
    return {
        "id": e.id,
        "timestamp": e.timestamp.isoformat() if e.timestamp else None,
        "user_role": e.user_role,
        "user_name": e.user_name,
        "purpose": e.purpose,
        "action_type": e.action_type,
        "query_text": e.query_text,
        "matched_filters": json.loads(e.matched_filters or "{}"),
        "referenced_case_ids": json.loads(e.referenced_case_ids or "[]"),
        "result_summary": e.result_summary,
    }
