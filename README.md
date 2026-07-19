# KSP FIR Intelligence Dashboard — Prototype

Built for the KSP Datathon 2026, from `Police_FIR_ER_Diagram.pdf` plus the real
`CRIME_REVIEW_2021_TO_2024_KARNATAKA.csv` dataset: a normalized FIR database,
a login-gated, role-based investigator dashboard, and an AI assistant that
returns clean case-file dossiers — covering the full feature brief.

## Login

There is no public sign-up. Every account is provisioned by an Admin, and
every login requires choosing a **purpose of access**, which is written to
the audit trail alongside everything that session does.

Default accounts (change these before any real deployment):

| Username | Password | Role |
|---|---|---|
| `admin` | `ChangeMe@2026` | Admin |
| `io_demo` | `Investigate@26` | Investigating Officer |
| `analyst_demo` | `Analyze@26` | Analyst |
| `liaison_demo` | `Liaison@26` | Public Liaison |

Log in as `admin` to reach **Manage Users** and provision real accounts.

## Feature checklist — what's real vs. what's stubbed

| Feature | Status |
|---|---|
| Normalized DB matching the ER diagram | ✅ full |
| Real crime statistics integrated (Karnataka SCRB 2021–2024) | ✅ full — cleaned, normalized, 805K+ incidents, see below |
| Username/password login, admin-only provisioning, purpose-of-access | ✅ full — session tokens, PBKDF2 hashing |
| Role-based access, derived from the real session (not a spoofable header) | ✅ full |
| Dashboard: stats, filters, case register | ✅ full |
| Criminal network visualization | ✅ full |
| PDF export (case reports + chat transcripts) | ✅ full |
| Chatbot — dossier-style criminal lookup, no formula shown | ✅ full — see below |
| Chatbot — English + Hindi + Kannada/Tamil/Telugu/Malayalam | ✅ full templates |
| Voice input/output | ✅ full — browser Web Speech API |
| Context-aware conversation (follow-ups, pronouns) | ✅ full |
| Explainable AI + audit trail (now includes purpose-of-access) | ✅ full |
| Crime trend & hotspot detection, predictive early warnings | ✅ full |
| Scene reconstruction (written + schematic SVG) | ✅ full |
| Police station directory | ✅ full |
| Shared inter-station bulletin (any station posts, all see it) | ✅ full |
| Wanted list (any station posts, network-wide visibility) | ✅ full |
| Shared database (Zoho Catalyst) | 🟡 adapter written, **not connected** — needs your Catalyst credentials |
| Photorealistic scene image generation | 🟡 not implemented — needs an external image-gen API key |
| Teammate's AI module | 🟡 not integrated — needs their API contract |

## The real dataset

`backend/data/CRIME_REVIEW_2021_TO_2024_KARNATAKA.csv` is the real, published
Karnataka SCRB monthly crime-review statistics you provided (30,940 rows).
It's **state-level aggregate data only** — no district, station, or
individual-case detail exists in the source file, so it cannot populate the
case register (that stays synthetic until real district/case-level data is
connected). What it does power: the real statewide trend charts on the
**Trends & Hotspots** tab.

The raw file needed real cleaning before use — `backend/app/crime_stats.py`
handles it:
- The `ACT` column had inconsistent whitespace/casing across 17 raw values
  for what are really 5 categories (`A - IPC Crime`, `A- IPC CRIME`,
  `A-IPC CRIME`, etc.) — normalized into `IPC Crime`, `Special & Local Laws`,
  `Crimes Against Women`, `Crimes Against Children`, `Crimes Against SC/ST`.
- The count column had blank/non-numeric rows — coerced safely, dropped rows
  that don't parse instead of crashing or silently zeroing them.
- Loaded once at seed time into a dedicated `CrimeReviewStat` table, kept
  completely separate from the synthetic FIR tables so real and synthetic
  data are never mixed or confused for each other.

The Trends tab labels real vs. synthetic data explicitly — it never implies
precision the data doesn't have.

## The chatbot — dossier style, not a formula dump

Ask "who is `<name>`?" and you get a rendered dossier card: avatar initials,
a risk-level pill (LOW/MEDIUM/HIGH, colored), a stat grid (cases on file,
arrest records, co-accused linked, risk score), and chips linking straight to
each case file — the way a records lookup reads in a procedural drama, not a
math writeup. The risk *formula* still exists and is fully documented (below,
and in every API response for admin/audit purposes) but it's never shown in
the chat itself.

Follow-ups work: ask "who is Ravi Gowda?" then "what about his arrests?" and
it resolves the pronoun from conversation context.

## Risk scoring formula (internal — not shown in chat)

```
risk_score = 0.5 * frequency_score + 0.5 * severity_score
frequency_score = min(case_count / 5, 1) * 100      # saturates at 5+ cases
severity_score  = avg over their cases of (gravity_weight*0.6 + crime_head_weight*0.4) * 100
band: High >= 67, Medium >= 34, else Low
```
Full breakdown is always in the API response (`/api/criminals/{name}/profile`)
for anyone auditing a decision — it's just not rendered in the chat bubble.

## Running it

**Backend**
```bash
cd backend
pip install -r requirements.txt
python3 -m app.seed        # creates fir.db: 150 synthetic cases + real crime stats + demo accounts
uvicorn app.main:app --reload --port 8000
```

**Frontend** (separate terminal)
```bash
cd frontend
npm install
npm run dev                # http://localhost:5173, proxies /api to :8000
```

No API keys required. Voice uses your browser's built-in speech APIs (works
best in Chrome).

## Tabs in the dashboard

- **Overview** — stats, charts, filterable case register
- **Criminal Network** — force-directed graph; repeat offenders ring-marked
- **AI Search** — natural-language box → structured filters → results
- **AI Assistant** — the chatbot: language picker, mic button, dossier cards,
  "Export chat (PDF)"
- **Trends & Hotspots** — real statewide 2021–2024 trend charts + synthetic
  district hotspot view + predictive early warnings
- **Wanted List** — any station posts, every station sees it immediately
  (Admin/Investigating Officer can post and mark apprehended/withdrawn)
- **Stations & Bulletin** — station directory with contact info, plus a
  shared noticeboard anyone signed in can post to
- **Audit Trail** (Admin only) — every login, search, chat turn, and export,
  with the declared purpose of access attached
- **Manage Users** (Admin only) — provision accounts; no public sign-up

## What I need from you to close the remaining 🟡 gaps

1. **Zoho Catalyst**: project ID, org ID, and an OAuth token (or a direct
   Postgres/MySQL connection string if your Data Store exposes one). Drop
   into `backend/app/zoho_catalyst.py` / `DATABASE_URL` — nothing else
   changes, the app is already database-agnostic.
2. **Teammate's AI module**: tell me what it exposes (URL? function?) and
   it's a swap into `nl_parser.py` / `chat.py`, both isolated for this.
3. **Real image generation**: send an API key (OpenAI/Gemini/Stability) and
   I'll wire it in alongside the existing SVG schematic in `scene.py`.
4. **District/station-level real crime data**, if/when it exists, to replace
   the synthetic hotspot view on the Trends tab with real numbers.

## Notes for your submission

- **Case-level data is synthetic** (`backend/app/seed.py`), fixed random
  seed — say so explicitly if you demo this to judges. The **statewide trend
  statistics are real** (Karnataka SCRB 2021–2024) — also worth saying.
- Sessions are in-memory-token based (12h expiry), which is enough to
  demonstrate real login-gated, admin-provisioned, audited access for a
  datathon prototype. For production, swap `auth.py`'s `login()` /
  `get_current_user()` for Zoho Catalyst Authentication (or any real auth
  provider) — every other endpoint already just depends on
  `get_current_user()` and doesn't care how the token was issued.
- Chatbot language support is templated, not machine-translated: fixed
  response phrases are professionally worded per language; free-text data
  (names, brief facts) stays as recorded in English.

## Project layout

```
backend/
  data/
    CRIME_REVIEW_2021_TO_2024_KARNATAKA.csv   # real dataset, as provided
  app/
    models.py         # ER-diagram models + User/SessionToken/WantedPerson/
                        # StationBulletin/CrimeReviewStat/AuditLog
    database.py         # engine/session (SQLite by default, Postgres via DATABASE_URL)
    seed.py               # synthetic FIR data + real CSV load + demo accounts
    auth.py                # login, password hashing, sessions, admin-only user creation
    crime_stats.py          # real CSV cleaning + loading + summary aggregation
    nl_parser.py             # NL -> structured filters (swappable for a real LLM)
    chat.py                    # chatbot intent router + context memory + dossier building
    i18n.py                     # multilingual response templates
    risk.py                      # risk scoring formula
    trends.py                     # hotspot detection + predictive early warnings
    scene.py                       # scene reconstruction (narrative + SVG schematic)
    rbac.py                         # role-based field-level redaction
    audit.py                         # audit trail logging (includes purpose-of-access)
    zoho_catalyst.py                  # Zoho Catalyst integration adapter (needs your credentials)
    pdf_export.py                      # case report + chat transcript PDF generation
    main.py                             # FastAPI routes
  requirements.txt
schema.sql              # exported DDL for reference
frontend/
  src/
    App.jsx
    api.js
    components/
      LoginScreen.jsx          # username/password/purpose
      DossierCard.jsx           # movie-style criminal lookup card
      StatsOverview.jsx
      FilterBar.jsx
      CaseTable.jsx
      CaseDetail.jsx             # includes scene reconstruction view
      NetworkGraph.jsx            # d3-force criminal network graph
      SearchPanel.jsx
      ChatbotPanel.jsx             # voice + language + context + dossier + PDF export
      TrendsPanel.jsx                # real + synthetic trend charts
      WantedList.jsx                  # cross-station wanted postings
      StationsPanel.jsx                # directory + shared bulletin
      UserManagement.jsx                # admin account provisioning
      AuditLogPanel.jsx                  # admin-only audit trail
  package.json
```
