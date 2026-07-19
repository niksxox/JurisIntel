"""
Loads CRIME_REVIEW_2021_TO_2024_KARNATAKA.csv (real, published Karnataka SCRB
monthly crime-review statistics) into CrimeReviewStat, and provides summary
aggregations for the Trends tab. State-level only -- the source data has no
district breakdown, which is called out explicitly in the API response so
the frontend never implies a precision the data doesn't have.
"""
import csv
import os
from collections import defaultdict

from . import models

CSV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "CRIME_REVIEW_2021_TO_2024_KARNATAKA.csv")

MONTH_ORDER = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]


def _normalize_act(raw: str) -> str:
    s = (raw or "").strip().upper()
    if "IPC" in s:
        return "IPC Crime"
    if "SPECIAL" in s and "LOCAL" in s:
        return "Special & Local Laws"
    if "WOMEN" in s:
        return "Crimes Against Women"
    if "CHILDREN" in s:
        return "Crimes Against Children"
    if "SCHEDULED CASTE" in s or ("SC" in s and "ST" in s):
        return "Crimes Against SC/ST"
    return "Other"


def load_csv(db, path: str = CSV_PATH):
    if not os.path.exists(path):
        return 0
    if db.query(models.CrimeReviewStat).count() > 0:
        return db.query(models.CrimeReviewStat).count()  # already loaded

    rows_to_add = []
    with open(path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            major = (row.get("MAJOR HEAD") or "").strip()
            if not major:
                continue
            try:
                year = int(row.get("Year") or 0)
                count = int(row.get("During the current month") or 0)
            except ValueError:
                continue
            if not year:
                continue
            rows_to_add.append(models.CrimeReviewStat(
                act_category=_normalize_act(row.get("ACT")),
                major_head=major,
                minor_head=(row.get("MINOR HEAD") or "").strip(),
                month=(row.get("Month") or "").strip().upper(),
                year=year,
                count_current_month=max(count, 0),
            ))

    db.bulk_save_objects(rows_to_add)
    db.commit()
    return len(rows_to_add)


def summary(db):
    rows = db.query(models.CrimeReviewStat).all()
    if not rows:
        return {"loaded": False, "message": "Real crime-review dataset not loaded yet."}

    by_act = defaultdict(int)
    by_major_head = defaultdict(int)
    by_year = defaultdict(int)
    yearly_by_act = defaultdict(lambda: defaultdict(int))

    for r in rows:
        by_act[r.act_category] += r.count_current_month
        by_major_head[r.major_head] += r.count_current_month
        by_year[r.year] += r.count_current_month
        yearly_by_act[r.act_category][r.year] += r.count_current_month

    top_major_heads = sorted(by_major_head.items(), key=lambda x: -x[1])[:12]

    return {
        "loaded": True,
        "source": "Karnataka SCRB — CRIME_REVIEW_2021_TO_2024_KARNATAKA.csv (state-level, no district breakdown)",
        "total_incidents_2021_2024": sum(by_year.values()),
        "by_act_category": dict(by_act),
        "by_year": dict(sorted(by_year.items())),
        "top_major_heads": [{"name": n, "count": c} for n, c in top_major_heads],
        "yearly_by_act": {act: dict(sorted(years.items())) for act, years in yearly_by_act.items()},
    }
