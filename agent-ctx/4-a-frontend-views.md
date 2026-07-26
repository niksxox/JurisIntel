# Task 4-a — Frontend Views Agent

## Task
Build 4 JurisIntel views: Trends, Forecast, NetworkGraph, CrimeMap.

## Outputs
- `src/components/jurisintel/views/Trends.tsx` (named export `Trends`)
- `src/components/jurisintel/views/Forecast.tsx` (named export `Forecast`)
- `src/components/jurisintel/views/NetworkGraph.tsx` (named export `NetworkGraph`)
- `src/components/jurisintel/views/CrimeMap.tsx` (named export `CrimeMap`)
- `src/app/api/stats/by-district/route.ts` — extended to honour `?all=true`

## Approach
- Read prior worklog to confirm APIs + layout shipped by Tasks 1, 2, 5.
- All 4 views were PENDING placeholders → replaced with full implementations.
- Each view: `'use client'`, named export, `useEffect+useState` for fetch, loading Skeletons, error state, responsive grid, dark ops theme (amber/emerald/red/sky — no indigo/blue).
- Recharts for all charts: dark `CartesianGrid stroke="oklch(0.28 0.008 250)"`, axis ticks `oklch(0.62 0.01 250)` size 11, dark tooltip background.
- Used existing shadcn primitives: Card, Badge, Select, Table, Alert, Separator, ScrollArea, Skeleton, Button.

## Per-view notes
- **Trends**: 5 parallel fetches, 4 StatCards + 4 ChartCards (yearly BarChart, monthly ComposedChart with amber gradient area, horizontal crime-type & modus-operandi BarCharts) + District Hotspots table with HIGH/MED/LOW severity badges.
- **Forecast**: model badges row, ComposedChart splicing last historical point into forecast for seamless dashed-line handoff, emerald confidence band, predicted hotspots list with trend icons + density bars, early-warning alert cards (critical=red/high=amber/medium=sky left-border), bonus district-comparison bar chart.
- **NetworkGraph**: custom SVG concentric layout (cases inner ring, accused outer ring at avg-angle of their connected cases). Hover highlights connected edges + floating tooltip. Click opens 320px side panel with connected-node list. District Select filter (client-side). Mouse-wheel zoom centered on cursor + drag-to-pan + zoom buttons. In-SVG legend. Fixed invalid `textTransform` SVG attribute (moved to style).
- **CrimeMap**: density heat-grid grouped by 5 Karnataka regions (North/South/Central/Coastal/Malnad). Per-card density tint (4 tiers), gradient density bar, top-category badge, severity avg, radial glow background. Top summary StatCards + LOW→HIGH gradient legend.

## Verification
- `bun run lint` → 0 errors.
- agent-browser: logged in as admin, navigated each view, captured screenshots, checked console/errors — all clean.
- NetworkGraph interaction test: clicked FIR/2021/0026 → side panel populated with 4 connected accused. District filter (Chikkamagaluru) → 1 case / 4 accused / 4 edges. Zoom in/out/reset buttons functional.

## Issues / Follow-ups
- `/api/network` returns only `case` + `accused` node types (no `victim` nodes). NetworkGraph includes victim styling in the legend/code for forward-compat, but currently no victim nodes appear.
- `/api/stats/by-district?all=true` returns all 30 districts; CrimeMap handles districts with 0 hotspot enrichment (falls back to null topCategory/severity_avg → "—" rendering).
- Forecast's `last6` trend slope can produce flat forecasts when recent counts are stable; this is correct given the seeded data.
