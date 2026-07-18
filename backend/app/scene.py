"""
Scene reconstruction, two forms:

1. Written narrative: a structured timeline stitched from the case's own
   fields (incident window, info-received time, registration, arrests).
   No generation model involved -- it's a deterministic template, which
   means it can never hallucinate a fact that isn't in the record.

2. Schematic SVG: a simple top-down sketch (incident marker, involved
   parties positioned around it, a legend) built programmatically from
   structured fields. This is NOT photorealistic scene generation -- that
   needs an external image-generation API key, which isn't wired up here.
   This is a real generated visual today; swapping in DALL-E/Imagen later
   is a matter of adding one function alongside this one.
"""


def build_narrative(case: dict) -> str:
    lines = []
    lines.append(f"Case {case['crime_no']} — {case.get('crime_sub_head', 'Unspecified')} "
                 f"({case.get('crime_head', '')})")
    lines.append(f"Location: {case.get('station', '?')}, {case.get('district', '?')}")
    lines.append("")
    lines.append("Timeline:")

    events = []
    if case.get("registered_date"):
        events.append((case["registered_date"], "FIR registered"))
    lines.append(f"  • Incident reported at {case.get('station', 'the station')}.")
    if case.get("brief_facts"):
        lines.append(f"  • Summary on file: {case['brief_facts']}")
    if case.get("victims"):
        names = ", ".join(v["name"] for v in case["victims"])
        lines.append(f"  • Victim(s) named: {names}.")
    if case.get("accused"):
        names = ", ".join(f"{a['person_id']} ({a['name']})" for a in case["accused"])
        lines.append(f"  • Accused named: {names}.")
        arrested = [a for a in case["accused"] if a.get("arrested")]
        if arrested:
            lines.append(f"  • {len(arrested)} of {len(case['accused'])} accused have an arrest/surrender record.")
    if case.get("acts"):
        acts = ", ".join(f"{a['act']} §{a['section']}" for a in case["acts"])
        lines.append(f"  • Charges invoked: {acts}.")
    lines.append("")
    lines.append(f"Status: {case.get('status', 'Unknown')}, under investigating officer {case.get('officer', '?')}, "
                 f"court of jurisdiction: {case.get('court', '?')}.")
    lines.append("")
    lines.append("Note: this reconstruction is generated deterministically from structured case "
                 "fields only. It does not infer or invent any detail not already on file.")
    return "\n".join(lines)


def build_scene_svg(case: dict) -> str:
    W, H = 640, 420
    accused = case.get("accused", [])[:6]
    victims = case.get("victims", [])[:6]
    cx, cy = W / 2, H / 2 - 20

    def ring_positions(items, radius):
        import math
        n = max(len(items), 1)
        pts = []
        for i in range(len(items)):
            angle = (2 * math.pi * i / n) - math.pi / 2
            pts.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
        return pts

    accused_pts = ring_positions(accused, 150)
    victim_pts = ring_positions(victims, 90)

    parts = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" font-family="JetBrains Mono, monospace">']
    parts.append(f'<rect width="{W}" height="{H}" fill="#0a0f1a"/>')
    parts.append(f'<circle cx="{cx}" cy="{cy}" r="180" fill="none" stroke="#1b2439" stroke-width="1"/>')
    parts.append(f'<circle cx="{cx}" cy="{cy}" r="110" fill="none" stroke="#1b2439" stroke-width="1"/>')

    # incident marker
    parts.append(f'<circle cx="{cx}" cy="{cy}" r="12" fill="#d4a62a" stroke="#0a0f1a" stroke-width="2"/>')
    parts.append(f'<text x="{cx}" y="{cy+28}" fill="#d4a62a" font-size="11" text-anchor="middle">INCIDENT</text>')

    for (x, y), v in zip(victim_pts, victims):
        parts.append(f'<line x1="{cx}" y1="{cy}" x2="{x}" y2="{y}" stroke="#2fbfa055" stroke-width="1" stroke-dasharray="2,3"/>')
        parts.append(f'<circle cx="{x}" cy="{y}" r="9" fill="#2fbfa0" stroke="#0a0f1a" stroke-width="1.5"/>')
        parts.append(f'<text x="{x}" y="{y+20}" fill="#c4cce0" font-size="9.5" text-anchor="middle">{v["name"].split(" ")[0]}</text>')

    for (x, y), a in zip(accused_pts, accused):
        parts.append(f'<line x1="{cx}" y1="{cy}" x2="{x}" y2="{y}" stroke="#c2554a55" stroke-width="1"/>')
        parts.append(f'<rect x="{x-10}" y="{y-8}" width="20" height="16" rx="3" fill="#c2554a" stroke="#0a0f1a" stroke-width="1.5"/>')
        parts.append(f'<text x="{x}" y="{y+24}" fill="#c4cce0" font-size="9.5" text-anchor="middle">{a["person_id"]}</text>')

    parts.append(f'<text x="16" y="24" fill="#7f8cab" font-size="11">SCHEMATIC — {case.get("crime_no","")}</text>')
    parts.append(f'<text x="16" y="{H-14}" fill="#5a6786" font-size="9">Generated from structured case fields. Not a photographic reconstruction.</text>')
    parts.append(f'<circle cx="{W-110}" cy="{H-34}" r="5" fill="#d4a62a"/><text x="{W-100}" y="{H-30}" fill="#7f8cab" font-size="9">Incident</text>')
    parts.append(f'<circle cx="{W-110}" cy="{H-20}" r="5" fill="#2fbfa0"/><text x="{W-100}" y="{H-16}" fill="#7f8cab" font-size="9">Victim</text>')
    parts.append(f'<rect x="{W-116}" y="{H-9}" width="10" height="8" fill="#c2554a"/><text x="{W-100}" y="{H-2}" fill="#7f8cab" font-size="9">Accused</text>')

    parts.append('</svg>')
    return "".join(parts)
