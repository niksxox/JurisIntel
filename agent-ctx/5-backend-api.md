# Task 5 — Backend API Routes

**Task ID:** 5
**Agent:** backend-api
**Task:** Build all backend API routes for JurisIntel Crime Intelligence Dashboard

## Routes Created (30 files)

### Stats (5)
- `src/app/api/stats/overview/route.ts` — GET → totalCases, openCases, closedCases, convictionRate, repeatOffenders, criticalCases, activeStations, totalDistricts
- `src/app/api/stats/by-category/route.ts` — GET → `[{ category, count }]`
- `src/app/api/stats/by-district/route.ts` — GET → top 10 `[{ district, count }]`
- `src/app/api/stats/by-status/route.ts` — GET → `[{ status, count }]`
- `src/app/api/stats/monthly-trend/route.ts` — GET → monthly aggregation 2021-01 → 2024-12, optional `?category=` filter

### Cases (3)
- `src/app/api/cases/route.ts` — GET → paginated list with `?page&limit&q&category&status&district&priority`. Each case has station info + accused/victim/evidence counts.
- `src/app/api/cases/[id]/route.ts` — GET → full case detail with station, accused, victims, evidence, networkEdgesFrom (with related case title)
- `src/app/api/cases/districts/route.ts` — GET → distinct district names from cases (for filter dropdowns)

### Trends (4)
- `src/app/api/trends/yearly/route.ts` — GET → `[{ year, count }]` by incidentDate
- `src/app/api/trends/by-crime-type/route.ts` — GET → `[{ category, count, percentage }]`
- `src/app/api/trends/modus-operandi/route.ts` — GET → top 8 modus operandi
- `src/app/api/trends/hotspots/route.ts` — GET → top 8 districts with count, severity_avg, topCategory

### Risk (2)
- `src/app/api/risk/offenders/route.ts` — GET → 20 accused with riskScore >= 60, sorted desc, with case info
- `src/app/api/risk/wanted/route.ts` — GET → all accused where isWanted = true, with case info

### Socio (2)
- `src/app/api/socio/demographics/route.ts` — GET → ageGroups / gender / occupation breakdowns
- `src/app/api/socio/risk-factors/route.ts` — GET → factor/count/avgRisk by prior-conviction bucket + top occupations

### Prediction (3)
- `src/app/api/prediction/forecast/route.ts` — GET → historical monthly series + 6-month exponential-smoothing forecast (alpha=0.3) with ±20% confidence band
- `src/app/api/prediction/hotspots/route.ts` — GET → top 5 districts by predicted 6-month case count + trend slope + confidence
- `src/app/api/prediction/early-warnings/route.ts` — GET → 4-6 dynamic warnings (crime-spike detection from 3-month window + high-risk-offender fallback)

### Financial (3)
- `src/app/api/financial/overview/route.ts` — GET → total/flagged amounts + per-bank breakdown
- `src/app/api/financial/suspicious-patterns/route.ts` — GET → grouped by flagReason with descriptions
- `src/app/api/financial/timeline/route.ts` — GET → monthly transaction counts/amounts/flagged

### Stations / Network (3)
- `src/app/api/stations/route.ts` — GET → all stations with activeCases/totalCases/district
- `src/app/api/network/route.ts` — GET → top-30-cases network graph (cases + accused nodes, networkEdges + accused→case edges)
- `src/app/api/cases/[id]/network/route.ts` — GET → single-case subgraph (case + accused + victims)

### RBAC (2)
- `src/app/api/rbac/users/route.ts` — GET → all users (id, username, name, role, district, createdAt) — no passwords
- `src/app/api/rbac/audit-logs/route.ts` — GET → recent 50 audit logs with user info

### Chat / Auth (3)
- `src/app/api/chat/send/route.ts` — POST → finds/creates ChatSession, builds DB context summary (totals, top districts/categories, recent cases, wanted count, + dynamic filtered stats if user mentions a specific district/category), calls z-ai-web-dev-sdk with SYSTEM_PROMPT, saves both messages, returns `{ sessionId, reply, context }`. Graceful fallback message on LLM failure.
- `src/app/api/chat/history/route.ts` — GET `?sessionId=` → all messages for session
- `src/app/api/auth/login/route.ts` — POST → SHA-256 password verify, writes login AuditLog, returns `{ id, username, name, role, district }` (no password)

## Verification
- All routes tested via curl against `localhost:3000` — 200 responses with expected JSON shape.
- `/api/chat/send` confirmed working with z-ai-web-dev-sdk: a "How many cases are in Bengaluru Urban?" prompt produced a markdown-formatted reply citing exact counts (4 total, 2 open, 1 charge-sheeted, 1 under-investigation).
- `/api/auth/login` returns 200 with correct credentials, 401 with wrong password.
- `/api/prediction/hotspots` and `/api/prediction/early-warnings` use the latest case `registeredAt` as the reference "now" instead of wall-clock time, since seed data only covers 2021-2024.
- `bun run lint` passes clean (0 errors).

## Implementation Notes
- All routes use try/catch + `NextResponse.json({ error }, { status: 500 })` on failure.
- SQLite date filtering uses Prisma `gte`/`lte` on DateTime fields; monthly aggregations are done in TypeScript (SQLite can't extract month cleanly in Prisma).
- The chat route dynamically imports `z-ai-web-dev-sdk` inside the route handler to keep it server-only and avoid any client bundling.
- LLM call is wrapped in its own try/catch — if z-ai-web-dev-sdk fails, returns a fallback reply with key stats pulled from the DB context.
- Login route uses `crypto.createHash('sha256').update(password).digest('hex')` matching the seed script.
- Audit logs are written on successful login.

## Stage Summary
All 30 backend API routes for JurisIntel are implemented and verified end-to-end. Frontend agents can now consume these endpoints to build the dashboard, trends, risk, network, financial, prediction, RBAC, and chat views. The chat assistant is genuinely powered by z-ai-web-dev-sdk with rich real-time DB context, including dynamic district/category detection from the user's natural language query.
