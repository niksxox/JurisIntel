"""
Role-based access. The role comes from the authenticated user's session
(see auth.py's `get_current_user`) -- never from a client-supplied header --
so a user can't just claim a different role. What matters here is that the
SAME endpoint returns DIFFERENT payloads depending on the logged-in user's
role: lower-privilege roles get names redacted, not just a blocked screen.
"""
ROLES = ["Admin", "Investigating Officer", "Analyst", "Public Liaison"]

FULL_PII_ROLES = {"Admin", "Investigating Officer"}
FULL_CASE_DETAIL_ROLES = {"Admin", "Investigating Officer", "Analyst"}


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
