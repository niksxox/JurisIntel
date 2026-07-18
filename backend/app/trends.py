"""
Trend / hotspot / early-warning analytics.

This is intentionally a transparent statistical method, not a black-box ML
model, which matters for a police-facing tool: every "early warning" here
can be explained in one sentence ("this district's monthly case count is
2.3x its 6-month average"). A real deployment could swap in a trained
time-series model behind the same `detect_spikes()` signature later.
"""
from collections import defaultdict
from datetime import date, timedelta

from . import models

SPIKE_THRESHOLD = 1.6  # current month vs trailing average multiplier that triggers a warning


def monthly_counts_by_district(db):
    cases = db.query(models.CaseMaster).all()
    buckets = defaultdict(lambda: defaultdict(int))  # district -> "YYYY-MM" -> count
    for c in cases:
        if not c.CrimeRegisteredDate or not c.station or not c.station.district:
            continue
        month_key = c.CrimeRegisteredDate.strftime("%Y-%m")
        buckets[c.station.district.DistrictName][month_key] += 1
    return buckets


def monthly_counts_by_crime_head(db):
    cases = db.query(models.CaseMaster).all()
    buckets = defaultdict(lambda: defaultdict(int))
    for c in cases:
        if not c.CrimeRegisteredDate or not c.crime_head:
            continue
        month_key = c.CrimeRegisteredDate.strftime("%Y-%m")
        buckets[c.crime_head.CrimeGroupName][month_key] += 1
    return buckets


def detect_spikes(buckets: dict):
    """buckets: {group_name: {month_key: count}}. Flags the latest month if it
    exceeds SPIKE_THRESHOLD times the trailing average of prior months."""
    warnings = []
    for group, months in buckets.items():
        if len(months) < 2:
            continue
        sorted_months = sorted(months.keys())
        latest = sorted_months[-1]
        prior = sorted_months[:-1]
        if not prior:
            continue
        prior_avg = sum(months[m] for m in prior) / len(prior)
        latest_count = months[latest]
        if prior_avg > 0 and latest_count >= 3 and latest_count / prior_avg >= SPIKE_THRESHOLD:
            warnings.append({
                "group": group,
                "month": latest,
                "count": latest_count,
                "trailing_average": round(prior_avg, 1),
                "ratio": round(latest_count / prior_avg, 2),
                "message": f"{group}: {latest_count} cases in {latest} vs a trailing average of "
                           f"{prior_avg:.1f}/month ({latest_count / prior_avg:.1f}x) -- worth a closer look.",
            })
    warnings.sort(key=lambda w: -w["ratio"])
    return warnings


def hotspot_summary(db):
    by_district = monthly_counts_by_district(db)
    by_crime = monthly_counts_by_crime_head(db)

    district_totals = {d: sum(m.values()) for d, m in by_district.items()}
    top_districts = sorted(district_totals.items(), key=lambda x: -x[1])[:5]

    district_warnings = detect_spikes(by_district)
    crime_warnings = detect_spikes(by_crime)

    return {
        "top_hotspot_districts": [{"district": d, "total_cases": n} for d, n in top_districts],
        "district_monthly": {d: dict(m) for d, m in by_district.items()},
        "crime_head_monthly": {c: dict(m) for c, m in by_crime.items()},
        "early_warnings": district_warnings + crime_warnings,
    }
