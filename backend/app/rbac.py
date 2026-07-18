"""
Role-based access, kept intentionally simple for the prototype: role comes in
as an `X-User-Role` header (no real auth/session yet -- see README for how to
wire this to Zoho Catalyst's Authentication service). What matters for the
demo is that the SAME endpoint returns DIFFERENT payloads depending on role,
which is the actual RBAC behavior judges will want to see, not just a login
screen.
"""
from typing import Optional

ROLES = ["Admin", "Investigating Officer", "Analyst", "Public Liaison"]

FULL_PII_ROLES = {"Admin", "Investigating Officer"}
FULL_CASE_DETAIL_ROLES = {"Admin", "Investigating Officer", "Analyst"}


def resolve_role(role_header: Optional[str]) -> str:
    if role_header in ROLES:
        return role_header
    return "Public Liaison"  # least-privilege default


def redact_case_detail(detail: dict, role: str) -> dict:
    if role in FULL_PII_ROLES:
        return detail

    d = dict(detail)
    if role not in FULL_CASE_DETAIL_ROLES:
        d["complainants"] = [{**c, "name": "[redacted]"} for c in d.get("complainants", [])]

    d["accused"] = [{**a, "name": a["name"] if role in FULL_PII_ROLES else f"Accused {a['person_id']}"}
                     for a in d.get("accused", [])]
    d["victims"] = [{**v, "name": v["name"] if role in FULL_PII_ROLES else "[redacted]"}
                     for v in d.get("victims", [])]
    return d


def redact_case_summary(summary: dict, role: str) -> dict:
    return summary
