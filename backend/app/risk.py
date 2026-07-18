"""
Risk score = 50% frequency + 50% severity, both normalized to 0-100.

frequency_score: how many distinct cases this person is named as an accused
in, scaled against a saturation point (5+ cases = max frequency score, since
a person with 5+ separate FIRs is unambiguously a repeat offender regardless
of how much higher the true count runs).

severity_score: average of each case's severity weight, where severity blends
the case's Gravity (Heinous/Non-Heinous) with how serious its crime head is.
This means one heinous crime against the body counts for more than several
minor property cases.

Both components and the final score are returned together so the number is
always explainable -- never a bare "72", always "72 = 0.5*frequency(80) +
0.5*severity(64)".
"""

FREQUENCY_SATURATION = 5  # case count at which frequency_score maxes out at 100

CRIME_HEAD_WEIGHT = {
    "Crimes Against Body": 1.0,
    "Narcotics": 0.9,
    "Crimes Against Women": 0.85,
    "Crimes Against Property": 0.6,
    "Cyber Crime": 0.5,
}

GRAVITY_WEIGHT = {
    "Heinous": 1.0,
    "Non-Heinous": 0.4,
}


def _case_severity(case) -> float:
    gravity_w = GRAVITY_WEIGHT.get(case.gravity.LookupValue if case.gravity else None, 0.5)
    head_w = CRIME_HEAD_WEIGHT.get(case.crime_head.CrimeGroupName if case.crime_head else None, 0.5)
    return (gravity_w * 0.6 + head_w * 0.4)


def compute_risk(cases: list) -> dict:
    """cases: list of CaseMaster ORM objects this person is accused in."""
    n = len(cases)
    frequency_score = round(min(n / FREQUENCY_SATURATION, 1.0) * 100, 1)

    if n == 0:
        severity_score = 0.0
    else:
        severity_score = round(sum(_case_severity(c) for c in cases) / n * 100, 1)

    final = round(0.5 * frequency_score + 0.5 * severity_score, 1)
    if final >= 67:
        band = "High"
    elif final >= 34:
        band = "Medium"
    else:
        band = "Low"

    return {
        "score": final,
        "band": band,
        "case_count": n,
        "components": {
            "frequency_score": frequency_score,
            "severity_score": severity_score,
        },
        "formula": "score = 0.5 * frequency_score + 0.5 * severity_score, "
                    f"where frequency_score saturates at {FREQUENCY_SATURATION}+ cases "
                    "and severity_score blends case gravity (60%) with crime-head severity (40%).",
    }
