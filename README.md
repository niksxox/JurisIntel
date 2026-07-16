# KSP FIR Intelligence Dashboard — Prototype

Built for the **Data Normalization & Cleaning / Frontend / Integration** track of the
KSP Datathon 2026 submission, from `Police_FIR_ER_Diagram.pdf`.

A working full-stack prototype: a normalized relational database seeded with synthetic
FIR data, a FastAPI backend, and a React dashboard with criminal-network visualization,
PDF case-report export, and a natural-language search bar wired to a swappable AI module.

## What's here, mapped to your three deliverables

**1. Data normalization & cleaning**
`backend/app/models.py` implements every table from the ER diagram (CaseMaster,
ComplainantDetails, Accused, Victim, ActSectionAssociation, ArrestSurrender, all lookup
masters) as SQLAlchemy models with the same names, keys, and FK relationships as the PDF.
`schema.sql` is the exported DDL. It runs on SQLite out of the box for the demo; point
`DATABASE_URL` at Postgres and the same models create the same schema there — no query
logic changes. `backend/app/main.py` shows the multi-table joins working end to end
(`CaseMaster` joined with `Accused`, `Victim`, `ActSectionAssociation`, `Unit`→`District`,
etc.) in every endpoint.

**2. Frontend dashboard**
Three tabs: **Overview** (stats, charts, filterable case register), **Criminal Network**
(force-directed graph — case files as gold tags, accused as red nodes sized/ringed by how
many cases they appear in, so repeat offenders visually pop out of the board), and
**AI Search**. Every case row opens a detail drawer with a one-click **PDF export** button.

**3. Integration**
The search bar POSTs raw text to `/api/nl-query`. The backend (`nl_parser.py`) turns it
into structured filters (district, crime type, gravity, status, date range), runs them
against the database, and returns `{filters, explanation, results}` as JSON — which the
frontend renders directly into the case table and can push into the network view. The
parser is rule-based today (zero API keys needed to run this prototype), but it's isolated
behind one function specifically so it's a drop-in swap for a real Claude API call — see
the comment at the top of `nl_parser.py` for the exact swap.

## Running it

**Backend**
```bash
cd backend
pip install -r requirements.txt
python3 -m app.seed        # creates fir.db with 150 synthetic cases
uvicorn app.main:app --reload --port 8000
```

**Frontend** (separate terminal)
```bash
cd frontend
npm install
npm run dev                # http://localhost:5173, proxies /api to :8000
```

Open `http://localhost:5173`. No API keys or external services required — everything
runs locally against SQLite.

## Notes for your submission

- **All data is synthetic** (`backend/app/seed.py`), generated with a fixed random seed —
  no real case data is used anywhere. Say so explicitly if you demo this to judges.
- The "repeat offender" network view only pulls accused persons who appear in 2+ cases,
  so it's a meaningful graph by default rather than every accused person ever logged.
- Click any node in the network graph to see what it connects to; click a case row
  anywhere to open the full case file and export its PDF.
- For the deployed/demo link: `frontend` builds to static files (`npm run build`) that
  can go on Vercel/Netlify; `backend` is a plain FastAPI app that runs on Render/Railway/
  a VM — swap SQLite for Postgres via `DATABASE_URL` for anything beyond a demo.
- Swapping in a real LLM for the NL search: replace the body of `parse_query()` in
  `backend/app/nl_parser.py` with a Claude API call that returns the same
  `{filters, explanation}` shape — nothing else in the app needs to change.

## Project layout

```
backend/
  app/
    models.py       # ER-diagram-accurate SQLAlchemy models
    database.py      # engine/session (SQLite by default, Postgres via DATABASE_URL)
    seed.py          # synthetic data generator
    nl_parser.py      # NL -> structured filters ("AI module" integration point)
    pdf_export.py     # case report PDF generation (reportlab)
    main.py           # FastAPI routes: /cases, /network, /nl-query, /cases/{id}/pdf, /stats
  requirements.txt
schema.sql            # exported DDL for reference
frontend/
  src/
    App.jsx
    api.js
    components/
      StatsOverview.jsx
      FilterBar.jsx
      CaseTable.jsx
      CaseDetail.jsx
      NetworkGraph.jsx   # d3-force criminal network graph
      SearchPanel.jsx    # NL search UI
  package.json
```
