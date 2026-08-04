// Mock API response generators for every JurisIntel endpoint
// Uses the shared mock data from mockData.ts

import {
  getCases, getStations, getUsers, getAccused, getVictims,
  getEvidence, getEdges, getFinancial, getDistrictNames, getCrimeCategories,
  type CaseRec, type AccusedRec, type VictimRec, type EvidenceRec,
} from './mockData';
import { DEMO_BANNER } from './demoMode';

// ==========================================================================
// Stats: Overview
// ==========================================================================
export function mockStatsOverview() {
  const cases = getCases();
  const accused = getAccused();
  const stations = getStations();
  const openCases = cases.filter((c) => c.status === 'open').length;
  const closedCases = cases.filter((c) => c.status === 'closed' || c.status === 'charge-sheeted').length;
  const criticalCases = cases.filter((c) => c.priority === 'critical').length;
  const repeatOffenders = accused.filter((a) => a.priorConvictions > 0).length;
  const convictionRate = cases.length > 0 ? Number((((closedCases) / cases.length) * 100).toFixed(1)) : 0;
  return {
    totalCases: cases.length,
    openCases,
    closedCases,
    convictionRate,
    repeatOffenders,
    criticalCases,
    activeStations: stations.filter((s) => s.activeCases > 0).length,
    totalDistricts: getDistrictNames().length,
  };
}

// ==========================================================================
// Stats: By Status
// ==========================================================================
export function mockStatsByStatus() {
  const cases = getCases();
  const map = new Map<string, number>();
  for (const c of cases) map.set(c.status, (map.get(c.status) || 0) + 1);
  return Array.from(map.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

// ==========================================================================
// Stats: By Category
// ==========================================================================
export function mockStatsByCategory() {
  const cases = getCases();
  const map = new Map<string, number>();
  for (const c of cases) map.set(c.category, (map.get(c.category) || 0) + 1);
  return Array.from(map.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

// ==========================================================================
// Stats: By District
// ==========================================================================
export function mockStatsByDistrict(all = false) {
  const cases = getCases();
  const map = new Map<string, number>();
  for (const c of cases) map.set(c.district, (map.get(c.district) || 0) + 1);
  const sorted = Array.from(map.entries())
    .map(([district, count]) => ({ district, count }))
    .sort((a, b) => b.count - a.count);
  return all ? sorted : sorted.slice(0, 10);
}

// ==========================================================================
// Stats: Monthly Trend
// ==========================================================================
export function mockStatsMonthlyTrend(category?: string) {
  const cases = getCases();
  const filtered = category ? cases.filter((c) => c.category === category) : cases;
  const buckets = new Map<string, number>();
  for (const c of filtered) {
    const k = `${c.registeredAt.getUTCFullYear()}-${String(c.registeredAt.getUTCMonth() + 1).padStart(2, '0')}`;
    buckets.set(k, (buckets.get(k) || 0) + 1);
  }
  // Determine actual date range from the data
  let minY = Infinity, maxY = -Infinity;
  for (const c of filtered) {
    const y = c.registeredAt.getUTCFullYear();
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!isFinite(minY)) { minY = 2022; maxY = 2026; }
  const result: { month: string; count: number; category?: string }[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let m = 1; m <= 12; m++) {
      const k = `${y}-${String(m).padStart(2, '0')}`;
      const count = buckets.get(k) || 0;
      if (count > 0) result.push({ month: k, count, ...(category ? { category } : {}) });
    }
  }
  return result;
}

// ==========================================================================
// Cases (paginated + filtered + searchable)
// ==========================================================================
export function mockCasesList(params: {
  page: number; limit: number; q?: string;
  category?: string; status?: string; district?: string; priority?: string;
}) {
  const { page, limit, q, category, status, district, priority } = params;
  let filtered = getCases();
  if (category) filtered = filtered.filter((c) => c.category === category);
  if (status) filtered = filtered.filter((c) => c.status === status);
  if (district) filtered = filtered.filter((c) => c.district === district);
  if (priority) filtered = filtered.filter((c) => c.priority === priority);
  if (q) {
    const ql = q.toLowerCase();
    filtered = filtered.filter((c) =>
      c.firNumber.toLowerCase().includes(ql) ||
      c.title.toLowerCase().includes(ql) ||
      c.description.toLowerCase().includes(ql)
    );
  }
  filtered.sort((a, b) => b.registeredAt.getTime() - a.registeredAt.getTime());
  const total = filtered.length;
  const rows = filtered.slice((page - 1) * limit, page * limit);
  const accused = getAccused();
  const victims = getVictims();
  const evidence = getEvidence();
  const data = rows.map((c) => {
    const ac = accused.filter((a) => a.caseId === c.id).length;
    const vc = victims.filter((v) => v.caseId === c.id).length;
    const ec = evidence.filter((e) => e.caseId === c.id).length;
    return {
      id: c.id, firNumber: c.firNumber, title: c.title, category: c.category,
      status: c.status, priority: c.priority, district: c.district,
      station: c.station, incidentDate: c.incidentDate.toISOString(),
      registeredAt: c.registeredAt.toISOString(), severity: c.severity,
      accusedCount: ac, victimsCount: vc, evidenceCount: ec,
    };
  });
  return { data, total, page, limit };
}

// ==========================================================================
// Cases: Detail by ID
// ==========================================================================
export function mockCaseDetail(id: string) {
  const cases = getCases();
  const c = cases.find((x) => x.id === id) || cases[0];
  if (!c) return null;
  const accused = getAccused().filter((a) => a.caseId === c.id);
  const victims = getVictims().filter((v) => v.caseId === c.id);
  const evidence = getEvidence().filter((e) => e.caseId === c.id);
  const edges = getEdges().filter((e) => e.caseId === c.id);
  const casesMap = new Map(cases.map((x) => [x.id, x]));
  const stations = getStations();
  const stationObj = stations.find((s) => s.id === c.stationId);
  const networkEdgesFrom = edges.map((e) => {
    const related = casesMap.get(e.relatedCaseId);
    return {
      id: e.id, relationType: e.relationType, strength: e.strength,
      relatedCaseId: e.relatedCaseId,
      relatedCase: related ? { id: related.id, firNumber: related.firNumber, title: related.title, category: related.category, district: related.district } : null,
    };
  });
  return {
    ...c,
    incidentDate: c.incidentDate.toISOString(),
    registeredAt: c.registeredAt.toISOString(),
    closedAt: c.closedAt?.toISOString() || null,
    station: {
      name: stationObj?.name || c.station.name,
      district: c.station.district,
      phone: stationObj?.phone || '+91 80 2200 0000',
    },
    accused, victims, evidence, networkEdgesFrom,
  };
}

// ==========================================================================
// Cases: Network by case ID
// ==========================================================================
export function mockCaseNetwork(id: string) {
  const cases = getCases();
  const c = cases.find((x) => x.id === id) || cases[0];
  if (!c) return { nodes: [], edges: [] };
  const accused = getAccused().filter((a) => a.caseId === c.id);
  const victims = getVictims().filter((v) => v.caseId === c.id);
  const nodes: { id: string; label: string; type: string; district?: string; category?: string }[] = [
    { id: c.id, label: c.firNumber, type: 'case', district: c.district, category: c.category },
  ];
  const edges: { source: string; target: string; strength: number; relationType: string }[] = [];
  for (const a of accused) {
    nodes.push({ id: a.id, label: a.name, type: 'accused', district: a.district });
    edges.push({ source: a.id, target: c.id, strength: a.riskScore, relationType: 'accused-of' });
  }
  for (const v of victims) {
    nodes.push({ id: v.id, label: v.name, type: 'victim' });
    edges.push({ source: c.id, target: v.id, strength: 100, relationType: 'victim-of' });
  }
  return { nodes, edges };
}

// ==========================================================================
// Cases: Districts list
// ==========================================================================
export function mockCaseDistricts() {
  return getDistrictNames();
}

// ==========================================================================
// Stations
// ==========================================================================
export function mockStations() {
  return getStations();
}

// ==========================================================================
// Network (global)
// ==========================================================================
export function mockNetwork() {
  const cases = getCases().slice().sort((a, b) => b.severity - a.severity).slice(0, 30);
  const caseIds = new Set(cases.map((c) => c.id));
  const edgesRaw = getEdges().filter((e) => caseIds.has(e.caseId) && caseIds.has(e.relatedCaseId));
  const accused = getAccused();
  const nodes: { id: string; label: string; type: string; district: string; category?: string; riskScore?: number }[] = [];
  const edges: { source: string; target: string; strength: number; relationType: string }[] = [];
  const seenAccused = new Set<string>();
  for (const c of cases) {
    nodes.push({ id: c.id, label: c.firNumber, type: 'case', district: c.district, category: c.category });
    for (const a of accused.filter((x) => x.caseId === c.id)) {
      if (!seenAccused.has(a.id)) {
        seenAccused.add(a.id);
        nodes.push({ id: a.id, label: a.name, type: 'accused', district: a.district, riskScore: a.riskScore });
      }
      edges.push({ source: a.id, target: c.id, strength: a.riskScore, relationType: 'member' });
    }
  }
  for (const e of edgesRaw) {
    edges.push({ source: e.caseId, target: e.relatedCaseId, strength: e.strength, relationType: e.relationType });
  }
  return { nodes, edges };
}

// ==========================================================================
// Financial: Overview
// ==========================================================================
export function mockFinancialOverview() {
  const txns = getFinancial();
  const totalTransactions = txns.length;
  const totalAmount = txns.reduce((s, t) => s + t.amount, 0);
  const flagged = txns.filter((t) => t.flagged);
  const flaggedCount = flagged.length;
  const flaggedAmount = flagged.reduce((s, t) => s + t.amount, 0);
  const bankMap = new Map<string, { count: number; amount: number }>();
  for (const t of txns) {
    const cur = bankMap.get(t.bank) || { count: 0, amount: 0 };
    cur.count += 1; cur.amount += t.amount;
    bankMap.set(t.bank, cur);
  }
  const byBank = Array.from(bankMap.entries())
    .map(([bank, v]) => ({ bank, count: v.count, amount: Number(v.amount.toFixed(2)) }))
    .sort((a, b) => b.amount - a.amount);
  return { totalTransactions, totalAmount: Number(totalAmount.toFixed(2)), flaggedCount, flaggedAmount: Number(flaggedAmount.toFixed(2)), byBank };
}

// ==========================================================================
// Financial: Suspicious Patterns
// ==========================================================================
const PATTERN_DESCRIPTIONS: Record<string, string> = {
  structuring: 'Multiple smaller transactions below reporting thresholds — likely designed to evade detection.',
  'rapid-movement': 'Funds moved quickly between accounts within a short window — classic layering behavior.',
  'high-risk-jurisdiction': 'Counterparty located in a high-risk jurisdiction with weak AML controls.',
  'unusual-pattern': 'Transaction pattern inconsistent with customer profile or historical behavior.',
};
export function mockSuspiciousPatterns() {
  const flagged = getFinancial().filter((t) => t.flagged && t.flagReason);
  const map = new Map<string, { count: number; totalAmount: number }>();
  for (const t of flagged) {
    const reason = t.flagReason || 'unknown';
    const cur = map.get(reason) || { count: 0, totalAmount: 0 };
    cur.count += 1; cur.totalAmount += t.amount;
    map.set(reason, cur);
  }
  return Array.from(map.entries())
    .map(([pattern, v]) => ({
      pattern, count: v.count, totalAmount: Number(v.totalAmount.toFixed(2)),
      description: PATTERN_DESCRIPTIONS[pattern] || 'Flagged transaction pattern requiring review.',
    }))
    .sort((a, b) => b.count - a.count);
}

// ==========================================================================
// Financial: Timeline
// ==========================================================================
export function mockFinancialTimeline() {
  const txns = getFinancial();
  const map = new Map<string, { count: number; amount: number; flagged: number }>();
  for (const t of txns) {
    const k = `${t.date.getUTCFullYear()}-${String(t.date.getUTCMonth() + 1).padStart(2, '0')}`;
    const cur = map.get(k) || { count: 0, amount: 0, flagged: 0 };
    cur.count += 1; cur.amount += t.amount;
    if (t.flagged) cur.flagged += 1;
    map.set(k, cur);
  }
  return Array.from(map.entries())
    .map(([month, v]) => ({ month, count: v.count, amount: Number(v.amount.toFixed(2)), flagged: v.flagged }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// ==========================================================================
// Prediction: Early Warnings
// ==========================================================================
export function mockEarlyWarnings() {
  const cases = getCases();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const recent = cases.filter((c) => c.registeredAt >= threeMonthsAgo);
  const spikeMap = new Map<string, { district: string; category: string; count: number; maxSeverity: number; latest: Date }>();
  for (const c of recent) {
    const key = `${c.district}|${c.category}`;
    const cur = spikeMap.get(key);
    if (cur) {
      cur.count += 1;
      if (c.severity > cur.maxSeverity) cur.maxSeverity = c.severity;
      if (c.registeredAt > cur.latest) cur.latest = c.registeredAt;
    } else {
      spikeMap.set(key, { district: c.district, category: c.category, count: 1, maxSeverity: c.severity, latest: c.registeredAt });
    }
  }
  const warnings: { id: string; district: string; category: string; type: string; severity: string; confidence: number; description: string; date: string }[] = [];
  let idx = 0;
  for (const [, v] of spikeMap) {
    if (v.count >= 5) {
      idx++;
      warnings.push({
        id: `EW-${String(idx).padStart(3, '0')}`, district: v.district, category: v.category,
        type: 'crime-spike',
        severity: v.maxSeverity >= 8 ? 'critical' : v.maxSeverity >= 6 ? 'high' : 'medium',
        confidence: Math.min(95, 60 + v.count * 4),
        description: `${v.count} ${v.category} cases registered in ${v.district} in the last 3 months. Maximum observed severity: ${v.maxSeverity}/10. Recommend increased patrols and intelligence-led operations.`,
        date: v.latest.toISOString().slice(0, 10),
      });
    }
  }
  warnings.sort((a, b) => b.confidence - a.confidence);
  let result = warnings.slice(0, 6);
  // Fill with high-risk offender warnings if not enough
  if (result.length < 4) {
    const topAccused = getAccused().filter((a) => a.riskScore >= 70).slice(0, 6);
    for (const o of topAccused) {
      idx++;
      if (result.length >= 6) break;
      const oc = cases.find((c) => c.id === o.caseId);
      if (!oc) continue;
      result.push({
        id: `EW-${String(idx).padStart(3, '0')}`, district: oc.district, category: oc.category,
        type: 'high-risk-offender',
        severity: o.riskScore >= 80 ? 'critical' : 'high',
        confidence: Number((50 + o.riskScore * 0.3).toFixed(1)),
        description: `High-risk offender (risk ${o.riskScore}/100, prior ${o.priorConvictions} convictions) active in ${oc.district} area related to ${oc.category} cases.`,
        date: oc.registeredAt.toISOString().slice(0, 10),
      });
    }
  }
  return result;
}

// ==========================================================================
// Prediction: Hotspots
// ==========================================================================
export function mockPredictionHotspots() {
  const cases = getCases();
  const now = new Date();
  const sixAgo = new Date(now); sixAgo.setMonth(now.getMonth() - 6);
  const twelveAgo = new Date(now); twelveAgo.setMonth(now.getMonth() - 12);
  const recentMap = new Map<string, number>();
  const priorMap = new Map<string, number>();
  for (const c of cases) {
    if (c.registeredAt >= sixAgo && c.registeredAt <= now) recentMap.set(c.district, (recentMap.get(c.district) || 0) + 1);
    if (c.registeredAt >= twelveAgo && c.registeredAt < sixAgo) priorMap.set(c.district, (priorMap.get(c.district) || 0) + 1);
  }
  const allD = new Set([...recentMap.keys(), ...priorMap.keys()]);
  const preds: { district: string; predictedCount: number; confidence: number; trend: string }[] = [];
  for (const d of allD) {
    const recent = recentMap.get(d) || 0;
    const prior = priorMap.get(d) || 0;
    const slope = recent - prior;
    const monthlyAvg = recent / 6;
    const predicted = Math.max(0, Math.round(monthlyAvg * 6 + slope));
    const confidence = Math.min(95, 50 + Math.abs(slope) * 5 + (recent > 0 ? 10 : 0));
    preds.push({ district: d, predictedCount: predicted, confidence: Number(confidence.toFixed(1)), trend: slope > 1 ? 'rising' : slope < -1 ? 'falling' : 'stable' });
  }
  preds.sort((a, b) => b.predictedCount - a.predictedCount);
  return preds.slice(0, 5);
}

// ==========================================================================
// Prediction: Forecast
// ==========================================================================
export function mockForecast() {
  const cases = getCases();
  const buckets = new Map<string, number>();
  for (const c of cases) {
    const k = `${c.registeredAt.getUTCFullYear()}-${String(c.registeredAt.getUTCMonth() + 1).padStart(2, '0')}`;
    buckets.set(k, (buckets.get(k) || 0) + 1);
  }
  // Determine actual date range from data
  let minY = Infinity, maxY = -Infinity, maxM = 0;
  for (const c of cases) {
    const y = c.registeredAt.getUTCFullYear();
    const m = c.registeredAt.getUTCMonth() + 1;
    if (y < minY) minY = y;
    if (y > maxY || (y === maxY && m > maxM)) { maxY = y; maxM = m; }
  }
  if (!isFinite(minY)) { minY = 2022; maxY = 2026; maxM = 1; }
  const months: string[] = [];
  for (let y = minY; y <= maxY; y++) {
    const m0 = y === minY ? 1 : 1;
    const m1 = y === maxY ? maxM : 12;
    for (let m = m0; m <= m1; m++) months.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  const historical = months.map((m) => ({ month: m, count: buckets.get(m) || 0 }));
  const series = historical.slice(-24);
  const counts = series.map((s) => s.count);
  const alpha = 0.3;
  let s = counts.length > 0 ? counts[0] : 0;
  for (let i = 1; i < counts.length; i++) s = alpha * counts[i] + (1 - alpha) * s;
  const last6 = counts.slice(-6);
  const trendSlope = last6.length > 1 ? (last6[last6.length - 1] - last6[0]) / (last6.length - 1) : 0;
  const lastMonth = months[months.length - 1];
  const [ly, lm] = lastMonth.split('-').map(Number);
  const forecast: { month: string; count: number; lower: number; upper: number }[] = [];
  let nextF = s;
  for (let i = 1; i <= 6; i++) {
    nextF = Math.max(0, nextF + trendSlope * 0.5);
    const rounded = Math.round(nextF);
    const y = ly + Math.floor((lm + i - 1) / 12);
    const m = ((lm + i - 1) % 12) + 1;
    forecast.push({
      month: `${y}-${String(m).padStart(2, '0')}`,
      count: rounded,
      lower: Math.max(0, Math.round(rounded * 0.8)),
      upper: Math.round(rounded * 1.2),
    });
  }
  return { historical, forecast, method: 'exponential-smoothing', alpha };
}

// ==========================================================================
// Risk: Offenders (top 20, riskScore >= 60)
// ==========================================================================
export function mockRiskOffenders() {
  const accused = getAccused().filter((a) => a.riskScore >= 60).sort((a, b) => b.riskScore - a.riskScore).slice(0, 20);
  const cases = getCases();
  const caseMap = new Map(cases.map((c) => [c.id, c]));
  return accused.map((o) => {
    const c = caseMap.get(o.caseId);
    return {
      id: o.id, name: o.name, age: o.age, gender: o.gender,
      occupation: o.occupation, district: o.district,
      priorConvictions: o.priorConvictions, riskScore: o.riskScore,
      status: o.status, isWanted: o.isWanted,
      case: c ? { firNumber: c.firNumber, category: c.category, district: c.district, status: c.status, priority: c.priority } : null,
    };
  });
}

// ==========================================================================
// Risk: Wanted
// ==========================================================================
export function mockWantedList() {
  const accused = getAccused().filter((a) => a.isWanted).sort((a, b) => b.riskScore - a.riskScore);
  const cases = getCases();
  const caseMap = new Map(cases.map((c) => [c.id, c]));
  const stations = getStations();
  const stationMap = new Map(stations.map((s) => [s.id, s]));
  return accused.map((o) => {
    const c = caseMap.get(o.caseId);
    const st = c ? stationMap.get(c.stationId) : undefined;
    return {
      id: o.id, name: o.name, age: o.age, gender: o.gender,
      occupation: o.occupation, address: o.address, district: o.district,
      priorConvictions: o.priorConvictions, riskScore: o.riskScore,
      status: o.status, photoUrl: null,
      case: c ? {
        id: c.id, firNumber: c.firNumber, title: c.title, category: c.category, district: c.district,
        station: st ? { name: st.name } : null,
      } : null,
    };
  });
}

// ==========================================================================
// Socio: Demographics
// ==========================================================================
function ageBucket(age: number): string {
  if (age <= 25) return '18-25';
  if (age <= 35) return '26-35';
  if (age <= 45) return '36-45';
  if (age <= 55) return '46-55';
  return '56+';
}
export function mockDemographics() {
  const accused = getAccused();
  const ageBuckets = ['18-25', '26-35', '36-45', '46-55', '56+'];
  const ageMap = new Map(ageBuckets.map((b) => [b, 0]));
  const genderMap = new Map<string, number>();
  const occMap = new Map<string, number>();
  for (const a of accused) {
    ageMap.set(ageBucket(a.age), (ageMap.get(ageBucket(a.age)) || 0) + 1);
    genderMap.set(a.gender, (genderMap.get(a.gender) || 0) + 1);
    if (a.occupation) occMap.set(a.occupation, (occMap.get(a.occupation) || 0) + 1);
  }
  return {
    ageGroups: ageBuckets.map((range) => ({ range, count: ageMap.get(range) || 0 })),
    gender: Array.from(genderMap.entries()).map(([gender, count]) => ({ gender, count })).sort((a, b) => b.count - a.count),
    occupation: Array.from(occMap.entries()).map(([occupation, count]) => ({ occupation, count })).sort((a, b) => b.count - a.count),
  };
}

// ==========================================================================
// Socio: Risk Factors
// ==========================================================================
function priorBucket(n: number): string {
  if (n === 0) return 'No prior';
  if (n <= 2) return '1-2 prior';
  return '3+ prior';
}
export function mockRiskFactors() {
  const accused = getAccused();
  const factorMap = new Map<string, { count: number; riskSum: number }>();
  for (const a of accused) {
    const factor = priorBucket(a.priorConvictions);
    const cur = factorMap.get(factor) || { count: 0, riskSum: 0 };
    cur.count += 1; cur.riskSum += a.riskScore;
    factorMap.set(factor, cur);
  }
  const occMap = new Map<string, { count: number; riskSum: number }>();
  for (const a of accused) {
    if (!a.occupation) continue;
    const cur = occMap.get(a.occupation) || { count: 0, riskSum: 0 };
    cur.count += 1; cur.riskSum += a.riskScore;
    occMap.set(a.occupation, cur);
  }
  const topOcc = Array.from(occMap.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, 6);
  const data = [
    ...Array.from(factorMap.entries()).map(([factor, v]) => ({
      factor, count: v.count, avgRisk: v.count > 0 ? Number((v.riskSum / v.count).toFixed(1)) : 0,
    })),
    ...topOcc.map(([factor, v]) => ({
      factor: `Occupation: ${factor}`, count: v.count, avgRisk: v.count > 0 ? Number((v.riskSum / v.count).toFixed(1)) : 0,
    })),
  ].sort((a, b) => b.avgRisk - a.avgRisk);
  return data;
}

// ==========================================================================
// Trends: Modus Operandi
// ==========================================================================
export function mockModusOperandi() {
  const cases = getCases();
  const map = new Map<string, number>();
  for (const c of cases) map.set(c.modusOperandi, (map.get(c.modusOperandi) || 0) + 1);
  return Array.from(map.entries())
    .map(([modusOperandi, count]) => ({ modusOperandi, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

// ==========================================================================
// Trends: Hotspots (district level)
// ==========================================================================
export function mockTrendsHotspots() {
  const cases = getCases();
  const districtMap = new Map<string, { count: number; severitySum: number; catMap: Map<string, number> }>();
  for (const c of cases) {
    const cur = districtMap.get(c.district) || { count: 0, severitySum: 0, catMap: new Map() };
    cur.count += 1; cur.severitySum += c.severity;
    cur.catMap.set(c.category, (cur.catMap.get(c.category) || 0) + 1);
    districtMap.set(c.district, cur);
  }
  return Array.from(districtMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([district, v]) => {
      const topCat = Array.from(v.catMap.entries()).sort((a, b) => b[1] - a[1])[0];
      return {
        district, count: v.count,
        severity_avg: Number((v.severitySum / v.count).toFixed(2)),
        topCategory: topCat?.[0] ?? null,
      };
    });
}

// ==========================================================================
// Trends: By Crime Type
// ==========================================================================
export function mockByCrimeType() {
  const cases = getCases();
  const map = new Map<string, number>();
  for (const c of cases) map.set(c.category, (map.get(c.category) || 0) + 1);
  const total = cases.length;
  return Array.from(map.entries())
    .map(([category, count]) => ({
      category, count,
      percentage: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

// ==========================================================================
// Trends: Yearly
// ==========================================================================
export function mockYearlyTrend() {
  const cases = getCases();
  const buckets = new Map<string, number>();
  for (const c of cases) {
    const y = String(c.incidentDate.getUTCFullYear());
    buckets.set(y, (buckets.get(y) || 0) + 1);
  }
  return Array.from(buckets.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year.localeCompare(b.year));
}

// ==========================================================================
// Heatmap (150+ Karnataka crime hotspot coordinates)
// ==========================================================================
export function mockHeatmap() {
  const cases = getCases();
  const districtCoords: Record<string, { lat: number; lng: number }> = {
    'Bengaluru Urban': { lat: 12.9716, lng: 77.5946 },
    'Bengaluru Rural': { lat: 13.0, lng: 77.5 },
    'Mysuru': { lat: 12.2958, lng: 76.6394 },
    'Mangaluru': { lat: 12.9141, lng: 74.8560 },
    'Hubli-Dharwad': { lat: 15.3647, lng: 75.1240 },
    'Belagavi': { lat: 15.8522, lng: 74.4987 },
    'Kalaburagi': { lat: 17.3297, lng: 76.8343 },
    'Davanagere': { lat: 14.4634, lng: 75.9234 },
    'Ballari': { lat: 15.1394, lng: 76.9210 },
    'Vijayapura': { lat: 16.8302, lng: 75.7104 },
    'Shivamogga': { lat: 13.9299, lng: 75.5679 },
    'Tumakuru': { lat: 13.0674, lng: 77.1006 },
    'Chikkamagaluru': { lat: 13.3177, lng: 75.7734 },
    'Hassan': { lat: 13.0077, lng: 76.0984 },
    'Dakshina Kannada': { lat: 12.9141, lng: 74.8560 },
    'Udupi': { lat: 13.3409, lng: 74.7420 },
    'Uttara Kannada': { lat: 14.5460, lng: 74.4940 },
    'Kodagu': { lat: 12.3375, lng: 75.8069 },
    'Chamarajanagar': { lat: 11.9228, lng: 76.9390 },
    'Mandya': { lat: 12.5236, lng: 76.8951 },
    'Chitradurga': { lat: 14.2271, lng: 76.3976 },
    'Koppal': { lat: 15.3527, lng: 76.1528 },
    'Raichur': { lat: 16.2076, lng: 77.3463 },
    'Yadgir': { lat: 16.7700, lng: 77.1300 },
    'Bidar': { lat: 17.9104, lng: 77.5199 },
    'Gadag': { lat: 15.4359, lng: 75.6148 },
    'Haveri': { lat: 14.7956, lng: 75.3989 },
    'Bagalkote': { lat: 16.1850, lng: 75.6901 },
    'Ramanagara': { lat: 12.7175, lng: 77.2713 },
    'Chikkaballapura': { lat: 13.4344, lng: 78.0486 },
    'Kolar': { lat: 13.1367, lng: 78.1291 },
    'Vijayanagara': { lat: 15.1833, lng: 76.3948 },
  };
  // Generate 150+ hotspot points from cases, jittered around district centers
  const hotspots: { lat: number; lng: number; weight: number; district: string; category: string }[] = [];
  // Use first 300 cases as hotspot sources to ensure 150+
  const source = cases.slice(0, 300);
  for (const c of source) {
    const base = districtCoords[c.district] || { lat: 14.0, lng: 76.0 };
    const lat = base.lat + (Math.random() - 0.5) * 0.5;
    const lng = base.lng + (Math.random() - 0.5) * 0.5;
    hotspots.push({ lat, lng, weight: c.severity, district: c.district, category: c.category });
  }
  return hotspots;
}

// ==========================================================================
// Auth: Login
// ==========================================================================
export function mockLogin(username: string, _password: string) {
  const users = getUsers();
  const user = users.find((u) => u.username === username);
  if (!user) return null;
  return { id: user.id, username: user.username, name: user.name, role: user.role, district: user.district };
}

// ==========================================================================
// RBAC: Users
// ==========================================================================
export function mockRbacUsers() {
  return getUsers();
}

// ==========================================================================
// RBAC: Audit Logs
// ==========================================================================
export function mockAuditLogs() {
  const users = getUsers();
  const cases = getCases();
  const actions = ['create', 'update', 'view', 'delete', 'export', 'login', 'status-change'];
  const entities = ['Case', 'Accused', 'Victim', 'Evidence', 'FinancialTransaction', 'User'];
  const logs = Array.from({ length: 50 }).map((_, i) => {
    const user = users[i % users.length];
    const c = cases[i % cases.length];
    const entity = entities[i % entities.length];
    return {
      id: `audit-${i + 1}`,
      action: actions[i % actions.length],
      entity,
      entityId: entity === 'Case' ? c.id : `entity-${i}`,
      details: `${user?.name || 'Unknown'} performed ${entity.toLowerCase()} action on ${c.firNumber}`,
      ipAddress: `192.168.${randInt(1, 254)}.${randInt(1, 254)}`,
      createdAt: new Date(2026, 0, 1 + i).toISOString(),
      user: user ? { name: user.name, username: user.username } : null,
    };
  });
  return logs;
}

// ==========================================================================
// Chat: Send (demo mode reply)
// ==========================================================================
export function mockChatSend(message: string) {
  const cases = getCases();
  const total = cases.length;
  const open = cases.filter((c) => c.status === 'open').length;
  const closed = cases.filter((c) => c.status === 'closed').length;
  const critical = cases.filter((c) => c.priority === 'critical').length;
  const wanted = getAccused().filter((a) => a.isWanted).length;
  const ml = message.toLowerCase();

  let reply = '';

  if (ml.includes('how many') || ml.includes('total') || ml.includes('overview') || ml.includes('summary')) {
    reply += `**JurisIntel System Overview:**\n\n`;
    reply += `- **Total Cases**: ${total}\n`;
    reply += `- **Open Cases**: ${open}\n`;
    reply += `- **Closed Cases**: ${closed}\n`;
    reply += `- **Charge-sheeted**: ${cases.filter(c => c.status === 'charge-sheeted').length}\n`;
    reply += `- **Critical Priority**: ${critical}\n`;
    reply += `- **Wanted Offenders**: ${wanted}\n`;
    reply += `- **Active Stations**: ${getStations().filter(s => s.activeCases > 0).length}\n\n`;
    reply += `Ask me about specific categories (theft, murder, cybercrime, drugs), districts, trends, or wanted offenders for detailed analysis.`;
  } else if (ml.includes('theft') || ml.includes('steal') || ml.includes('robbery')) {
    const theftCases = cases.filter((c) => c.category === 'Theft');
    reply += `**Theft Analysis:** There are **${theftCases.length}** theft cases in the database (${Math.round((theftCases.length / total) * 100)}% of all cases). `;
    reply += `Top districts for theft: ${mockStatsByDistrict(true).filter(d => theftCases.some(tc => tc.district === d.district)).slice(0, 3).map(d => `${d.district} (${d.count})`).join(', ')}. `;
    reply += `Common modus operandi includes chain snatching, pickpocketing, and vehicle theft.`;
  } else if (ml.includes('murder') || ml.includes('homicide') || ml.includes('kill')) {
    const murderCases = cases.filter((c) => c.category === 'Murder');
    reply += `**Murder Analysis:** There are **${murderCases.length}** murder cases recorded. `;
    reply += `Average severity score: ${(murderCases.reduce((s, c) => s + c.severity, 0) / murderCases.length).toFixed(1)}/10. `;
    reply += `Most murder cases involve personal enmity or robbery as motive. Weapons commonly recovered include knives and iron rods.`;
  } else if (ml.includes('cyber') || ml.includes('online') || ml.includes('phishing') || ml.includes('fraud')) {
    const cyberCases = cases.filter((c) => c.category === 'Cybercrime' || c.category === 'Fraud');
    reply += `**Cybercrime & Fraud Analysis:** Combined **${cyberCases.length}** cases. `;
    reply += `Financial intelligence has flagged **${getFinancial().filter(t => t.flagged).length}** suspicious transactions totaling **₹${(getFinancial().filter(t => t.flagged).reduce((s, t) => s + t.amount, 0) / 10000000).toFixed(2)} Cr**. `;
    reply += `Top fraud patterns: UPI phishing, fake job offers, and Ponzi schemes.`;
  } else if (ml.includes('district') || ml.includes('area') || ml.includes('region')) {
    const top5 = mockStatsByDistrict(true).slice(0, 5);
    reply += `**District-wise Crime Distribution:**\n`;
    for (const d of top5) {
      reply += `- **${d.district}**: ${d.count} cases\n`;
    }
    reply += `Bengaluru Urban leads due to its high population density and urbanization.`;
  } else if (ml.includes('wanted') || ml.includes('abscond') || ml.includes('missing')) {
    reply += `**Wanted Offenders:** Currently **${wanted}** accused persons are marked as wanted/absconding. `;
    reply += `High-risk offenders (risk score >= 80): **${getAccused().filter(a => a.riskScore >= 80).length}**. `;
    reply += `Priority districts for apprehension: Belagavi, Bengaluru Urban, and Kalaburagi.`;
  } else if (ml.includes('trend') || ml.includes('pattern') || ml.includes('forecast')) {
    const yearly = mockYearlyTrend();
    reply += `**Crime Trend Analysis:**\n`;
    for (const y of yearly) {
      reply += `- **${y.year}**: ${y.count} cases\n`;
    }
    reply += `Overall trend shows varying patterns. Theft and cybercrime categories show upward trends in recent years.`;
  } else if (ml.includes('drug') || ml.includes('narcotic')) {
    const drugCases = cases.filter((c) => c.category === 'Drug-Related');
    reply += `**Drug-Related Crimes:** **${drugCases.length}** cases registered. `;
    reply += `Common offences include ganja possession, MDMA distribution, and synthetic drug labs. NDPS Act sections are primarily applied.`;
  } else {
    reply += `**JurisIntel System Overview:**\n\n`;
    reply += `- **Total Cases**: ${total}\n`;
    reply += `- **Open Cases**: ${open}\n`;
    reply += `- **Closed Cases**: ${closed}\n`;
    reply += `- **Critical Priority**: ${critical}\n`;
    reply += `- **Wanted Offenders**: ${wanted}\n`;
    reply += `- **Total Accused**: ${getAccused().length}\n`;
    reply += `- **Total Victims**: ${getVictims().length}\n`;
    reply += `- **Evidence Records**: ${getEvidence().length}\n`;
    reply += `- **Financial Transactions**: ${getFinancial().length}\n`;
    reply += `- **Network Connections**: ${getEdges().length}\n\n`;
    reply += `Ask me about specific categories (theft, murder, cybercrime, drugs), districts, trends, wanted offenders, or financial intelligence for detailed analysis.`;
  }

  const contextSummary = {
    asOf: new Date().toISOString(),
    totals: { total, open, closed, chargeSheeted: cases.filter(c => c.status === 'charge-sheeted').length, critical },
    topDistricts: mockStatsByDistrict(true).slice(0, 5),
    topCategories: mockStatsByCategory().slice(0, 5),
    recentCases: cases.slice(-5).reverse().map(c => ({
      firNumber: c.firNumber, title: c.title, category: c.category,
      district: c.district, status: c.status, priority: c.priority,
    })),
    wantedCount: wanted,
  };

  return {
    sessionId: `demo-session-${Date.now()}`,
    reply,
    context: contextSummary,
  };
}

// ==========================================================================
// Chat: History
// ==========================================================================
export function mockChatHistory(_sessionId: string) {
  return {
    sessionId: _sessionId,
    messages: [
      { id: '1', role: 'user', content: 'Show me the crime overview for Karnataka.', metadata: null, createdAt: new Date().toISOString() },
      { id: '2', role: 'assistant', content: '**JurisIntel System Overview:**\n\n- **Total Cases**: 3,000\n- **Open Cases**: 450\n- **Closed Cases**: 1,350\n- **Critical Priority**: 450\n- **Wanted Offenders**: 780\n\nThis data is from the demo seed dataset. Ask me about specific categories, districts, or trends for detailed analysis.', metadata: null, createdAt: new Date().toISOString() },
    ],
  };
}
