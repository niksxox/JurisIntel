# JurisIntel

**AI-Powered Crime Intelligence Platform for Karnataka State Police**

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-blue?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/shadcn/ui-latest-black" alt="shadcn/ui" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License" />
</p>

---

JurisIntel transforms Karnataka police crime data into actionable intelligence through an interactive analytics dashboard, AI-powered conversational queries, criminal network analysis, financial crime tracking, and predictive policing — all in a single full-stack application.

## Overview

JurisIntel is a production-grade crime intelligence platform built with **Next.js 15**, **Prisma ORM**, and **PostgreSQL**. It provides law enforcement officers with a comprehensive suite of analytical tools powered by realistic Karnataka crime data spanning **32 districts**, **10 crime categories**, and **3000+ FIR records**.

The platform works **immediately out of the box** in Demo Mode — no database setup required. When you're ready to go live, flip a single flag and connect your PostgreSQL instance.

## Key Features

### 📊 Dashboard & KPIs
Real-time overview cards showing total cases, open/closed status, conviction rate, repeat offenders, critical cases, active stations, and district coverage.

### 🔍 Case Management
Full-text searchable FIR database with **3000+ demo cases** supporting pagination, filtering by category/status/priority/district, and detailed case views with accused, victims, evidence, and network links.

### 📈 Crime Trends
Multi-dimensional trend analysis — by crime type, modus operandi, district hotspots, monthly patterns, and yearly comparisons with percentage breakdowns.

### 🗺 Crime Heatmap
Interactive geospatial visualization with **300+ crime hotspot coordinates** across all 32 Karnataka districts, weighted by severity and categorized by crime type.

### 🕸 Network Analysis
Criminal relationship graphs showing case-to-case and accused-to-case connections with link strength, centrality scores, and relation types (co-accused, same modus operandi, shared evidence, connected networks).

### 💰 Financial Intelligence
Transaction monitoring with suspicious pattern detection — structuring, rapid movement, high-risk jurisdiction flags, and unusual patterns — with bank-wise breakdowns and monthly timelines.

### 🔮 Predictions & Forecasting
- **Early Warnings**: Crime spike detection by district and category with confidence scores
- **Hotspot Prediction**: 6-month linear trend projection per district
- **Crime Forecast**: Exponential smoothing (α=0.3) with 6-month forward forecast and confidence bounds

### ⚖ Risk Assessment
- **High-Risk Offenders**: Top 20 offenders ranked by risk score (prior convictions × severity)
- **Wanted List**: All absconding accused with case details and station information

### 📋 Socio-Demographic Analytics
Accused demographic profiling by age bucket (18–56+), gender, and occupation — plus risk factor correlation analysis.

### 🤖 AI Chat
Conversational intelligence assistant that answers natural language queries about crime data, providing contextual analysis with specific numbers, district breakdowns, category trends, and offender statistics.

### 🏢 Station Directory
Complete police station registry for Karnataka with locations, contact details, and active/total case counts.

### 🔐 Role-Based Access Control
Four user roles — **Admin**, **Analyst**, **Investigator**, **Supervisor** — with full audit logging.

## Demo Mode

JurisIntel ships with a built-in **Demo Mode** that makes the entire application fully functional without any database. When `DEMO_MODE` is enabled, all 31 API routes return realistic, deterministic mock data generated from the same seed dataset that powers the production database.

### How It Works

```
Every API route follows this pattern:

if (DEMO_MODE) {
    return NextResponse.json(mockData);   // ← instant response
}

try {
    // Existing Prisma queries run normally
} catch (error) {
    return NextResponse.json(mockData);   // ← graceful fallback
}
```

### Demo Data Volumes (matching seed.ts targets)

| Entity | Count |
|---|---|
| Cases (FIRs) | 3,000 |
| Victims | 5,000 |
| Accused | 6,500 |
| Evidence Records | 13,000 |
| Financial Transactions | 5,000 |
| Network Connections | 9,000 |
| Police Stations | 200+ |
| Districts | 32 |
| Users | 24 |
| Heatmap Coordinates | 300+ |

### Toggle Demo Mode

In `src/lib/demoMode.ts`:

```typescript
// Set to false to switch to live Prisma/PostgreSQL queries
export const DEMO_MODE = true;
```

When switched off, every route immediately falls back to live database queries with graceful degradation — if the database is unavailable, mock data is returned instead of HTTP 500 errors.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 (Strict Mode) |
| UI Library | React 19 + shadcn/ui |
| Styling | Tailwind CSS 4 |
| ORM | Prisma 6 |
| Database | PostgreSQL (Neon) / SQLite (dev) |
| Charts | Recharts |
| State | Zustand + React Query + React Table |
| Forms | React Hook Form + Zod |
| AI | z-ai-web-dev-sdk |
| Package Manager | Bun / npm |

## Database Schema

The platform models 12 entities:

```
User → ChatSession → ChatMessage
User → AuditLog

District
Station → Case
Case → Accused
Case → Victim
Case → Evidence
Case ↔ Case (NetworkEdge)
Case → FinancialTransaction
```

**Crime Categories**: Theft, Assault, Murder, Cybercrime, Fraud, Burglary, Kidnapping, Drug-Related, Sexual-Offense, Traffic

**Case Statuses**: Open, Under Investigation, Closed, Charge-Sheeted, Cancelled

**Priority Levels**: Low, Medium, High, Critical

**Karnataka Districts**: 32 districts across 5 regions (North, South, Central, Coastal, Malnad)

See [`prisma/schema.prisma`](prisma/schema.prisma) for the full schema definition.

## Project Structure

```
src/
├── app/
│   ├── api/                    # 31 API route handlers
│   │   ├── auth/login/         # Authentication
│   │   ├── cases/              # CRUD + search + network
│   │   ├── chat/               # AI conversation
│   │   ├── financial/          # Transaction intelligence
│   │   ├── network/            # Criminal network graph
│   │   ├── prediction/         # Forecasting & warnings
│   │   ├── rbac/               # Users & audit logs
│   │   ├── risk/               # Offenders & wanted list
│   │   ├── socio/              # Demographics & risk factors
│   │   ├── stations/           # Police station directory
│   │   ├── stats/              # KPI aggregation
│   │   └── trends/             # Crime pattern analysis
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── jurisintel/
│   │   ├── Layout.tsx          # App shell & sidebar
│   │   ├── Login.tsx           # Auth gate
│   │   └── views/              # 14 page-level view components
│   └── ui/                     # shadcn/ui primitives
├── lib/
│   ├── auth.ts                 # Client-side session helpers
│   ├── db.ts                   # Prisma client singleton
│   ├── demoMode.ts             # DEMO_MODE toggle
│   ├── mockData.ts             # Deterministic mock data generator
│   ├── mockApiResponses.ts     # 25 mock API response functions
│   └── utils.ts                # Utility functions
└── middleware.ts

prisma/
├── schema.prisma               # Database schema
└── seed (1).ts                  # Karnataka crime data seeder
```

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- npm or Bun package manager

### Quick Start (Demo Mode — No Database Required)

```bash
# Clone the repository
git clone https://github.com/niksxox/JurisIntel.git
cd JurisIntel

# Install dependencies
npm install

# Build and run — works immediately in Demo Mode
npm run build
npm run start
```

Open [http://localhost:3000](http://localhost:3000) and log in with:

| Username | Password | Role |
|---|---|---|
| `admin` | Any password | Administrator |
| `analyst1` | Any password | Analyst |
| `inv1` | Any password | Investigator |
| `sup1` | Any password | Supervisor |

> In Demo Mode, authentication accepts the 4 usernames above with any password.

### Production Setup (With Database)

```bash
# 1. Set your database URL
export DATABASE_URL="postgresql://user:password@host:5432/jurisintel?schema=public"

# 2. Update schema.prisma datasource to postgresql
#    provider = "postgresql"

# 3. Push schema to database
npm run db:push

# 4. Generate Prisma client
npm run db:generate

# 5. Seed the database (3000 cases, 6500 accused, etc.)
bun run "prisma/seed (1).ts"

# 6. Disable Demo Mode
#    In src/lib/demoMode.ts, set: export const DEMO_MODE = false;

# 7. Build and run
npm run build
npm run start
```

## API Reference

All API routes are under `/api/` and return JSON. In Demo Mode, every endpoint responds with realistic mock data. With `DEMO_MODE=false`, live Prisma queries are used.

### Statistics

| Endpoint | Description |
|---|---|
| `GET /api/stats/overview` | Dashboard KPIs (total cases, conviction rate, etc.) |
| `GET /api/stats/by-status` | Case count grouped by status |
| `GET /api/stats/by-category` | Case count grouped by crime category |
| `GET /api/stats/by-district?all=true` | Top 10 (or all) districts by case count |
| `GET /api/stats/monthly-trend?category=` | Monthly case counts 2021–2024 |

### Cases

| Endpoint | Description |
|---|---|
| `GET /api/cases?page=&limit=&q=&category=&status=&district=&priority=` | Paginated, filterable FIR list |
| `GET /api/cases/[id]` | Full case detail with accused, victims, evidence |
| `GET /api/cases/[id]/network` | Case-level network graph (nodes + edges) |
| `GET /api/cases/districts` | List of all districts with cases |

### Trends

| Endpoint | Description |
|---|---|
| `GET /api/trends/by-crime-type` | Category distribution with percentages |
| `GET /api/trends/modus-operandi` | Top 8 modus operandi by frequency |
| `GET /api/trends/hotspots` | Top 8 districts with avg severity + top category |
| `GET /api/trends/yearly` | Yearly case counts |

### Financial Intelligence

| Endpoint | Description |
|---|---|
| `GET /api/financial/overview` | Total/flagged transactions + bank breakdown |
| `GET /api/financial/suspicious-patterns` | Flagged transactions grouped by pattern type |
| `GET /api/financial/timeline` | Monthly transaction volume + flagged count |

### Network Analysis

| Endpoint | Description |
|---|---|
| `GET /api/network` | Global criminal network graph (top 30 severe cases) |

### Predictions

| Endpoint | Description |
|---|---|
| `GET /api/prediction/early-warnings` | Crime spike alerts with confidence scores |
| `GET /api/prediction/hotspots` | Top 5 district hotspot predictions |
| `GET /api/prediction/forecast` | 6-month crime forecast with confidence bounds |

### Risk Assessment

| Endpoint | Description |
|---|---|
| `GET /api/risk/offenders` | Top 20 high-risk offenders (risk score >= 60) |
| `GET /api/risk/wanted` | All wanted/absconding accused |

### Socio-Demographics

| Endpoint | Description |
|---|---|
| `GET /api/socio/demographics` | Accused age/gender/occupation breakdown |
| `GET /api/socio/risk-factors` | Risk factor correlation analysis |

### Other

| Endpoint | Description |
|---|---|
| `GET /api/stations` | All police stations with coordinates |
| `POST /api/auth/login` | User authentication |
| `POST /api/chat/send` | AI chat with context-aware responses |
| `GET /api/chat/history?sessionId=` | Chat session message history |
| `GET /api/rbac/users` | User directory (no passwords) |
| `GET /api/rbac/audit-logs` | Recent 50 audit log entries |

## Seed Data

The seed script (`prisma/seed (1).ts`) generates a comprehensive Karnataka crime dataset using a deterministic PRNG (mulberry32, seed 42) for full reproducibility.

### Data Sources

- **NCRB-style Karnataka Crime Master CSV** — when available, real district-wise and category-wise case totals from official statistical tables are used as distribution weights
- **Flat fallback weights** — when CSV is absent, manual proportional weights produce a realistic NCRB-style distribution

### Seed Configuration

```typescript
TARGET_CASES         = 3,000
TARGET_VICTIMS       = 5,000
TARGET_ACCUSED       = 6,500
TARGET_EVIDENCE      = 13,000
TARGET_FINANCIAL     = 5,000
TARGET_NETWORK_EDGES = 9,000
TARGET_CHAT_SESSIONS = 500
TARGET_CHAT_MESSAGES = 2,000
TARGET_AUDIT_LOGS    = 5,000
```

### Karnataka Coverage

- **32 districts** across 5 regions (North, South, Central, Coastal, Malnad)
- **10 crime categories** with realistic modus operandi and BNS/IPC sections
- **200+ police stations** distributed proportionally by district crime volume
- **Kannada names** (50 first names, 19 last names) for accused and victims
- **8 major banks** for financial transaction data
- **12 evidence types** per forensic science conventions

## Scripts

```bash
npm run dev          # Start dev server on port 3000
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:push      # Push Prisma schema to database
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run Prisma migrations
npm run db:reset     # Reset database and re-apply migrations
```

## Pages

| Page | Description |
|---|---|
| Dashboard | KPI cards, monthly trend mini-chart, category breakdown |
| Cases | Searchable, filterable FIR table with pagination |
| Crime Map | Geospatial heatmap of crime hotspots |
| Trends | Multi-axis trend analysis by type, MO, district, time |
| Network Analysis | Interactive criminal network graph |
| Financial Intelligence | Transaction monitoring and suspicious patterns |
| Forecast | 6-month crime prediction with exponential smoothing |
| Risk Assessment | Offender risk scoring and wanted list |
| Socio Analytics | Demographic profiling and risk factor analysis |
| AI Chat | Conversational crime intelligence assistant |
| Stations | Police station directory with map |
| Users | User management (admin) |
| Audit Log | Activity tracking and compliance |
| Search | Global search across all entities |

## License

This project is licensed under the MIT License.

---

<p align="center">
  Built for the Karnataka State Police<br/>
  <em>Intelligence-led policing through data-driven insights</em>
</p>
