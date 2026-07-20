# KSP FIR Intelligence Dashboard — Prototype

Built for the KSP Datathon 2026, from `Police_FIR_ER_Diagram.pdf` plus the real
`CRIME_REVIEW_2021_TO_2024_KARNATAKA.csv` dataset: a normalized FIR database,
a login-gated, role-based investigator dashboard, and an AI assistant that
returns clean case-file dossiers, covering the full feature brief.

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
