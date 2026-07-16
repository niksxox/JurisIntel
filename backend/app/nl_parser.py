"""
Natural-language -> structured query "AI module".

This is a rule-based parser so the prototype runs with zero external API
keys. It's intentionally isolated behind `parse_query()` so it's a drop-in
swap for a real LLM call later, e.g.:

    resp = anthropic_client.messages.create(
        model="claude-sonnet-5",
        system=NL_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": text}],
    )
    return json.loads(resp.content[0].text)

The frontend never needs to know which implementation is behind the
endpoint -- it always POSTs raw text to /api/nl-query and gets back the
same JSON shape: {filters, explanation}.
"""
import re
from datetime import date, timedelta

DISTRICTS = ["Bengaluru Urban", "Mysuru", "Mangaluru", "Belagavi", "Hubballi-Dharwad",
             "Kalaburagi", "Tumakuru", "Shivamogga", "Ballari", "Davanagere"]

CRIME_KEYWORDS = {
    "murder": "Murder", "homicide": "Murder", "kill": "Murder",
    "attempt to murder": "Attempt to Murder",
    "robbery": "Robbery", "robbed": "Robbery",
    "theft": "Theft", "stolen": "Theft", "stole": "Theft",
    "burglary": "Burglary",
    "kidnap": "Kidnapping",
    "dowry": "Dowry Harassment",
    "stalk": "Stalking",
    "cyber": "Online Fraud", "online fraud": "Online Fraud", "phishing": "Online Fraud",
    "drug": "Drug Possession", "narcotic": "Drug Possession", "trafficking": "Drug Trafficking",
    "assault": "Assault on Women",
    "grievous hurt": "Grievous Hurt", "hurt": "Grievous Hurt",
}

STATUS_KEYWORDS = {
    "under investigation": "Under Investigation", "pending": "Under Investigation",
    "charge sheet": "Charge Sheeted", "chargesheeted": "Charge Sheeted",
    "closed": "Closed", "solved": "Closed",
    "undetected": "Undetected", "unsolved": "Undetected",
    "court": "Court Trial", "trial": "Court Trial",
}

GRAVITY_KEYWORDS = {"heinous": "Heinous", "serious": "Heinous", "minor": "Non-Heinous"}


def _find_district(text_lower):
    for d in DISTRICTS:
        if d.lower() in text_lower or d.split()[0].lower() in text_lower:
            return d
    return None


def _find_date_range(text_lower):
    today = date.today()
    if "last month" in text_lower:
        end = today.replace(day=1) - timedelta(days=1)
        start = end.replace(day=1)
        return str(start), str(end)
    if "last week" in text_lower:
        return str(today - timedelta(days=7)), str(today)
    if "this year" in text_lower or "2026" in text_lower:
        return "2026-01-01", str(today)
    if "2025" in text_lower:
        return "2025-01-01", "2025-12-31"
    if "last 30 days" in text_lower or "last month" in text_lower:
        return str(today - timedelta(days=30)), str(today)
    m = re.search(r"last (\d+) days", text_lower)
    if m:
        n = int(m.group(1))
        return str(today - timedelta(days=n)), str(today)
    return None, None


def parse_query(text: str) -> dict:
    text_lower = text.lower()
    filters = {}
    matched_terms = []

    for kw, val in CRIME_KEYWORDS.items():
        if kw in text_lower:
            filters["crime_sub_head"] = val
            matched_terms.append(kw)
            break

    for kw, val in STATUS_KEYWORDS.items():
        if kw in text_lower:
            filters["status"] = val
            matched_terms.append(kw)
            break

    for kw, val in GRAVITY_KEYWORDS.items():
        if kw in text_lower:
            filters["gravity"] = val
            matched_terms.append(kw)
            break

    district = _find_district(text_lower)
    if district:
        filters["district"] = district
        matched_terms.append(district)

    start, end = _find_date_range(text_lower)
    if start:
        filters["date_from"] = start
        filters["date_to"] = end

    # free-text fallback: search accused/complainant/case-no if it looks like a name/number
    name_match = re.search(r"(?:accused|named?|suspect)\s+([a-z ]{3,30})", text_lower)
    if name_match:
        filters["accused_name"] = name_match.group(1).strip().title()

    if not filters:
        filters["keyword"] = text.strip()
        explanation = f"No structured fields matched -- falling back to a free-text search for '{text.strip()}'."
    else:
        explanation = "Interpreted as: " + ", ".join(f"{k}={v}" for k, v in filters.items())

    return {"filters": filters, "explanation": explanation, "matched_terms": matched_terms}
