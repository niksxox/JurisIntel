// JurisIntel Mock Data Generators
// All data structures derived from prisma/seed (1).ts
// Generates deterministic, realistic Karnataka crime data matching seed.ts schemas.

import { randomUUID } from 'crypto';

// =============================================================================
// Seeded PRNG (mulberry32) — same as seed.ts for consistency
// =============================================================================
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(42);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
const chance = (p: number) => rnd() < p;

function weightedPick(weights: Record<string, number>): string {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return entries.length ? entries[0][0] : '';
  let r = rnd() * total;
  for (const [k, w] of entries) {
    if (r < w) return k;
    r -= w;
  }
  return entries[entries.length - 1][0];
}

// =============================================================================
// Reference data — copied from seed.ts
// =============================================================================

const DISTRICTS = [
  ['Bengaluru Urban', 'South', 9650000, 2209],
  ['Bengaluru Rural', 'South', 1115000, 2259],
  ['Mysuru', 'South', 3220000, 6854],
  ['Mangaluru', 'Coastal', 1960000, 2344],
  ['Hubli-Dharwad', 'North', 1840000, 4255],
  ['Belagavi', 'North', 4770000, 13415],
  ['Kalaburagi', 'North', 2610000, 10951],
  ['Davanagere', 'Central', 2050000, 6028],
  ['Ballari', 'North', 2540000, 8461],
  ['Vijayapura', 'North', 2180000, 17069],
  ['Shivamogga', 'Malnad', 1760000, 8495],
  ['Tumakuru', 'Central', 2700000, 10598],
  ['Chikkamagaluru', 'Malnad', 1140000, 7201],
  ['Hassan', 'Central', 1840000, 6814],
  ['Dakshina Kannada', 'Coastal', 2200000, 4859],
  ['Udupi', 'Coastal', 1220000, 3880],
  ['Uttara Kannada', 'Coastal', 1450000, 10291],
  ['Kodagu', 'Malnad', 560000, 4102],
  ['Chamarajanagar', 'South', 1030000, 5101],
  ['Mandya', 'Central', 1930000, 4961],
  ['Chitradurga', 'Central', 1680000, 8440],
  ['Koppal', 'North', 1410000, 7190],
  ['Raichur', 'North', 1920000, 8286],
  ['Yadgir', 'North', 1170000, 5160],
  ['Bidar', 'North', 1720000, 5448],
  ['Gadag', 'North', 970000, 4657],
  ['Haveri', 'North', 1480000, 4823],
  ['Bagalkote', 'North', 1890000, 6575],
  ['Ramanagara', 'South', 960000, 3556],
  ['Chikkaballapura', 'South', 1250000, 4208],
  ['Kolar', 'South', 1650000, 3969],
  ['Vijayanagara', 'North', 1450000, 8384],
] as const;

const CANONICAL_DISTRICT_NAMES = DISTRICTS.map((d) => d[0] as string);

const CRIME_CATEGORIES = [
  'Theft', 'Assault', 'Murder', 'Cybercrime', 'Fraud',
  'Burglary', 'Kidnapping', 'Drug-Related', 'Sexual-Offense', 'Traffic',
] as const;
type CrimeCategory = (typeof CRIME_CATEGORIES)[number];

const STATION_NAMES = [
  'Central', 'Town', 'Rural', 'Cyber Crime', 'Women', 'Traffic',
  'Economic Offences', 'Railway', 'Airport', 'Industrial Area',
];

const OCCUPATIONS = [
  'Laborer', 'Farmer', 'Daily Wage', 'Driver', 'Shopkeeper', 'Student',
  'Unemployed', 'Businessman', 'IT Professional', 'Construction Worker',
  'Vendor', 'Mechanic', 'Domestic Worker', 'Retired', 'Self-Employed',
];

const MODUS_OPERANDI: Record<CrimeCategory, string[]> = {
  Theft: ['Snatched chain on road', 'Pickpocketed in crowded market', 'Stole unattended bag', 'Stole two-wheeler from parking lot'],
  Assault: ['Group clash over dispute', 'Attack under influence of alcohol', 'Land dispute turned violent', 'Altercation outside liquor shop'],
  Murder: ['Stabbed over personal enmity', 'Strangled during robbery', 'Contract killing suspected', 'Beaten to death during quarrel'],
  Cybercrime: ['Phishing scam via UPI', 'Fake job offer fraud', 'OTP fraud on OLX listing', 'Fake investment trading app fraud'],
  Fraud: ['Fake property sale', 'Ponzi scheme investment', 'Cheque bounce case', 'Fake loan approval scam'],
  Burglary: ['Broke lock during daytime', 'Entered through roof', 'Forced entry at night', 'Burgled shop after breaking shutter'],
  Kidnapping: ['Abducted for ransom', 'Elopement case', 'Child lured with sweets', 'Abducted over property dispute'],
  'Drug-Related': ['Possession of ganja', 'MDMA distribution network', 'Synthetic drug lab busted', 'Peddling near college campus'],
  'Sexual-Offense': ['Assault on minor', 'Workplace harassment complaint', 'POCSO case registered', 'Assault by known person'],
  Traffic: ['Drunken driving fatal accident', 'Hit and run', 'Overspeeding collision', 'Signal jumping caused collision'],
};

const IPC_BNS_SECTIONS: Record<CrimeCategory, string[]> = {
  Theft: ['Sec 303 BNS (Theft)', 'Sec 305 BNS (Theft in dwelling)'],
  Assault: ['Sec 115 BNS (Hurt)', 'Sec 118 BNS (Grievous hurt)'],
  Murder: ['Sec 103 BNS (Murder)', 'Sec 105 BNS (Culpable homicide)'],
  Cybercrime: ['Sec 66C IT Act', 'Sec 66D IT Act', 'Sec 67 IT Act'],
  Fraud: ['Sec 318 BNS (Cheating)', 'Sec 316 BNS (Criminal breach of trust)'],
  Burglary: ['Sec 331 BNS (House-breaking)', 'Sec 305 BNS (Theft in building)'],
  Kidnapping: ['Sec 137 BNS (Kidnapping)', 'Sec 140 BNS (Kidnapping for ransom)'],
  'Drug-Related': ['NDPS Act Sec 8(c)', 'NDPS Act Sec 20', 'NDPS Act Sec 22'],
  'Sexual-Offense': ['Sec 74 BNS', 'Sec 64 BNS', 'POCSO Act Sec 4'],
  Traffic: ['Sec 106 BNS (Death by negligence)', 'MV Act Sec 184'],
};

const FIRST_NAMES = ['Rajesh', 'Suresh', 'Mahesh', 'Lakshmi', 'Ganesh', 'Venkatesh', 'Nagaraj', 'Manjunatha', 'Ramesh', 'Anil', 'Prakash', 'Mohan', 'Krishna', 'Shiva', 'Arjun', 'Deepak', 'Kiran', 'Vijay', 'Ravi', 'Pradeep', 'Naveen', 'Harish', 'Sandeep', 'Girish', 'Srinivas', 'Chandrashekar', 'Bhaskar', 'Murali', 'Dinesh', 'Pramod', 'Sowmya', 'Latha', 'Geetha', 'Padma', 'Shobha', 'Rekha', 'Anita', 'Sunitha', 'Bhagya', 'Kavya', 'Meghana', 'Pooja', 'Divya', 'Shruti', 'Nandini', 'Vidya', 'Roopa', 'Ashwini', 'Vijaya', 'Jayamma'];
const LAST_NAMES = ['Kumar', 'Reddy', 'Gowda', 'Shetty', 'Rao', 'Naidu', 'Murthy', 'Naik', 'Patil', 'Desai', 'Hegde', 'Pai', 'Bhat', 'Swamy', 'Prasad', 'Iyer', 'Nair', 'Pillai', 'Menon'];

function fullName() { return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`; }

const EVIDENCE_DESCRIPTIONS = [
  'CCTV footage from nearby establishment', 'Fingerprint samples lifted from scene',
  'Mobile phone call detail records', 'Bank statement showing suspicious transactions',
  'Medical examination report', 'Weapon recovered from scene',
  'Witness statement (recorded)', 'Forensic blood sample',
  'Vehicle seized for examination', 'Digital device forensic image',
  'Torn clothing recovered from scene', 'Handwriting/signature sample for comparison',
];

const BANKS = ['SBI', 'Canara Bank', 'Bank of Baroda', 'ICICI', 'HDFC', 'Axis Bank', 'Karnataka Bank', 'Union Bank'];

const LOCATIONS = ['MG Road', 'Jayanagar', 'Malleshwaram', 'Indiranagar', 'Rajajinagar', 'Vijayanagar', 'Basavanagudi', 'Market Yard', 'Bus Stand', 'Railway Station', 'Hosur Road', 'Koramangala', 'Whitefield', 'Electronic City', 'Yelahanka'];

// =============================================================================
// Targets (from seed.ts)
// =============================================================================
const TARGET_CASES = 3000;
const TARGET_VICTIMS = 5000;
const TARGET_ACCUSED = 6500;
const TARGET_EVIDENCE = 13000;
const TARGET_FINANCIAL = 5000;
const TARGET_NETWORK_EDGES = 9000;

// =============================================================================
// Category / district weights (flat fallback — same as seed.ts no-CSV path)
// =============================================================================
const categoryWeights: Record<CrimeCategory, number> = {
  Theft: 24, Assault: 16, Murder: 3, Cybercrime: 10, Fraud: 10,
  Burglary: 12, Kidnapping: 6, 'Drug-Related': 6, 'Sexual-Offense': 8, Traffic: 5,
};

const districtWeights: Record<string, number> = {};
for (const d of CANONICAL_DISTRICT_NAMES) {
  districtWeights[d] = d === 'Bengaluru Urban' ? 280 : d === 'Belagavi' ? 180 : d === 'Mysuru' ? 150 : 25 + Math.floor(rnd() * 100);
}

// =============================================================================
// Generate all data deterministically
// =============================================================================

interface StationRec {
  id: string; name: string; district: string; address: string;
  phone: string; latitude: number; longitude: number;
  activeCases: number; totalCases: number; createdAt: string;
}

interface CaseRec {
  id: string; firNumber: string; title: string; category: string;
  status: string; priority: string; district: string; stationId: string;
  incidentDate: Date; registeredAt: Date; closedAt: Date | null;
  description: string; modusOperandi: string; location: string;
  weaponUsed: string | null; severity: number;
  station?: { name: string; district: string };
  accusedCount?: number; victimsCount?: number; evidenceCount?: number;
}

interface AccusedRec {
  id: string; caseId: string; name: string; age: number; gender: string;
  occupation: string; address: string; district: string;
  priorConvictions: number; riskScore: number; status: string; isWanted: boolean;
}

interface VictimRec {
  id: string; caseId: string; name: string; age: number; gender: string;
  occupation: string; injurySeverity: string; statement: string;
}

interface EvidenceRec {
  id: string; caseId: string; type: string; description: string;
  collectedBy: string; status: string;
}

interface NetworkEdgeRec {
  id: string; caseId: string; relatedCaseId: string;
  relationType: string; strength: number;
}

interface FinancialRec {
  id: string; transactionId: string; caseId: string; amount: number;
  currency: string; senderName: string; receiverName: string;
  bank: string; date: Date; flagged: boolean;
  flagReason: string | null; riskScore: number; district: string;
}

interface UserRec {
  id: string; username: string; name: string; role: string;
  district: string; createdAt: string;
}

// --- Lazy singleton generation ---

let _stations: StationRec[] | null = null;
let _stationMap: Record<string, string[]> | null = null;
let _cases: CaseRec[] | null = null;
let _accused: AccusedRec[] | null = null;
let _victims: VictimRec[] | null = null;
let _evidence: EvidenceRec[] | null = null;
let _edges: NetworkEdgeRec[] | null = null;
let _financial: FinancialRec[] | null = null;
let _users: UserRec[] | null = null;

function generateStations(): StationRec[] {
  if (_stations) return _stations;
  const totalWeight = Object.values(districtWeights).reduce((a, b) => a + b, 0);
  const stations: StationRec[] = [];
  const byDistrict: Record<string, string[]> = {};

  for (const name of CANONICAL_DISTRICT_NAMES) {
    const share = districtWeights[name] / totalWeight;
    const count = Math.max(2, Math.min(14, Math.round(share * 220)));
    byDistrict[name] = [];
    for (let i = 0; i < count; i++) {
      const id = randomUUID();
      const lat = name.includes('Bengaluru') ? 12.97 + (rnd() - 0.5) * 0.3
        : name === 'Mangaluru' || name === 'Dakshina Kannada' || name === 'Udupi' ? 12.92 + (rnd() - 0.5) * 0.3
        : name === 'Mysuru' ? 12.30 + (rnd() - 0.5) * 0.2
        : 12 + rnd() * 4 - 2;
      const lng = name.includes('Bengaluru') ? 77.59 + (rnd() - 0.5) * 0.3
        : name === 'Mangaluru' || name === 'Dakshina Kannada' || name === 'Udupi' ? 74.85 + (rnd() - 0.5) * 0.3
        : name === 'Mysuru' ? 76.65 + (rnd() - 0.5) * 0.2
        : 76 + rnd() * 4 - 2;
      stations.push({
        id,
        name: `${name} ${STATION_NAMES[i % STATION_NAMES.length]} PS`,
        district: name,
        address: `${name}, Karnataka`,
        phone: `+91 80 ${randInt(2200, 2999)} ${randInt(1000, 9999)}`,
        latitude: lat,
        longitude: lng,
        activeCases: 0,
        totalCases: 0,
        createdAt: new Date(2022, 0, 1).toISOString(),
      });
      byDistrict[name].push(id);
    }
  }
  _stationMap = byDistrict;
  _stations = stations;
  return stations;
}

function getStationMap(): Record<string, string[]> {
  if (!_stationMap) generateStations();
  return _stationMap!;
}

function generateUsers(): UserRec[] {
  if (_users) return _users;
  const base: UserRec[] = [
    { id: randomUUID(), username: 'admin', name: 'System Administrator', role: 'admin', district: 'Bengaluru Urban', createdAt: new Date(2022, 0, 1).toISOString() },
    { id: randomUUID(), username: 'analyst1', name: 'Priya Sharma', role: 'analyst', district: 'Bengaluru Urban', createdAt: new Date(2022, 0, 1).toISOString() },
    { id: randomUUID(), username: 'inv1', name: 'Inspector Kumar', role: 'investigator', district: 'Mysuru', createdAt: new Date(2022, 0, 1).toISOString() },
    { id: randomUUID(), username: 'sup1', name: 'DSP Anand Reddy', role: 'supervisor', district: 'Mangaluru', createdAt: new Date(2022, 0, 1).toISOString() },
  ];
  const extra: UserRec[] = Array.from({ length: 20 }).map((_, i) => ({
    id: randomUUID(),
    username: `officer${i + 1}`,
    name: `${pick(['Inspector', 'Sub-Inspector', 'ASI', 'DySP'])} ${fullName()}`,
    role: pick(['investigator', 'analyst']),
    district: pick(CANONICAL_DISTRICT_NAMES),
    createdAt: new Date(2022, 0, 1).toISOString(),
  }));
  _users = [...base, ...extra];
  return _users;
}

function generateCases(): CaseRec[] {
  if (_cases) return _cases;
  const stations = generateStations();
  const smap = getStationMap();
  const cases: CaseRec[] = [];
  const stationTotals: Record<string, number> = {};

  for (let i = 0; i < TARGET_CASES; i++) {
    const category = weightedPick(categoryWeights) as CrimeCategory;
    const district = weightedPick(districtWeights);
    const stationIds = smap[district]?.length ? smap[district] : stations.map((s) => s.id);
    const stationId = pick(stationIds);

    const year = randInt(2022, 2026);
    const month = randInt(0, 11);
    const day = randInt(1, 28);
    const incidentDate = new Date(year, month, day);
    const registeredAt = new Date(incidentDate.getTime() + randInt(1, 72) * 3600 * 1000);

    const statusRoll = rnd();
    let status: string;
    let closedAt: Date | null = null;
    if (statusRoll < 0.45) { status = 'closed'; closedAt = new Date(registeredAt.getTime() + randInt(30, 400) * 86400 * 1000); }
    else if (statusRoll < 0.7) status = 'charge-sheeted';
    else if (statusRoll < 0.85) status = 'under-investigation';
    else status = 'open';

    const priorityRoll = rnd();
    const priority = priorityRoll < 0.15 ? 'critical' : priorityRoll < 0.4 ? 'high' : priorityRoll < 0.75 ? 'medium' : 'low';
    const severity = category === 'Murder' ? randInt(8, 10)
      : category === 'Sexual-Offense' || category === 'Kidnapping' ? randInt(7, 10)
      : randInt(3, 8);

    const mo = pick(MODUS_OPERANDI[category]);
    const section = pick(IPC_BNS_SECTIONS[category]);
    const stName = stations.find((s) => s.id === stationId)?.name || `${district} PS`;

    cases.push({
      id: randomUUID(),
      firNumber: `FIR/${year}/${String(i + 1).padStart(5, '0')}`,
      title: `${category} — ${mo.split(' ').slice(0, 3).join(' ')}`,
      category,
      status,
      priority,
      district,
      stationId,
      incidentDate,
      registeredAt,
      closedAt,
      description: `First Information Report registered at ${stName}. ${mo}. Offence registered under ${section}. Investigation ongoing. Witness statements recorded, ${randInt(2, 8)} witnesses examined.`,
      modusOperandi: mo,
      location: `${pick(LOCATIONS)}, ${district}`,
      weaponUsed: category === 'Murder' || category === 'Assault' ? pick(['Knife', 'Iron Rod', 'Blunt Object', 'Firearm', 'Stone']) : null,
      severity,
      station: { name: stName, district },
    });
    stationTotals[stationId] = (stationTotals[stationId] || 0) + 1;
  }

  // Update station totals
  for (const s of _stations!) {
    const total = stationTotals[s.id] || 0;
    s.activeCases = Math.round(total * 0.4);
    s.totalCases = total;
  }

  _cases = cases;
  return cases;
}

function generateAccused(): AccusedRec[] {
  if (_accused) return _accused;
  const cases = generateCases();
  const accused: AccusedRec[] = [];
  const baseCounts = cases.map((c) =>
    c.category === 'Murder' || c.category === 'Assault' ? randInt(1, 4) : randInt(1, 2)
  );
  // Adjust to target
  let diff = TARGET_ACCUSED - baseCounts.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (diff !== 0 && guard < 500000) {
    guard++;
    const idx = randInt(0, baseCounts.length - 1);
    if (diff > 0 && baseCounts[idx] < 7) { baseCounts[idx]++; diff--; }
    else if (diff < 0 && baseCounts[idx] > 1) { baseCounts[idx]--; diff++; }
  }

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    for (let a = 0; a < baseCounts[i]; a++) {
      const age = randInt(18, 55);
      const prior = chance(0.4) ? randInt(1, 5) : 0;
      const riskScore = Math.min(100, prior * 15 + (c.severity - 5) * 8 + randInt(0, 30));
      const isWanted = c.status !== 'closed' && chance(0.12);
      accused.push({
        id: randomUUID(), caseId: c.id, name: fullName(), age,
        gender: chance(0.88) ? 'Male' : 'Female',
        occupation: pick(OCCUPATIONS),
        address: `${pick(['Gandhi Nagar', 'Nehru Nagar', 'Ambedkar Layout', 'Basaveshwar Nagar', 'Kuvempu Layout'])}, ${c.district}`,
        district: c.district, priorConvictions: prior, riskScore,
        status: isWanted ? 'absconding' : c.status === 'closed' ? (chance(0.6) ? 'on-bail' : 'in-custody') : 'in-custody',
        isWanted,
      });
    }
  }
  _accused = accused;
  return accused;
}

function generateVictims(): VictimRec[] {
  if (_victims) return _victims;
  const cases = generateCases();
  const victims: VictimRec[] = [];
  const baseCounts = cases.map((c) =>
    (c.category === 'Theft' || c.category === 'Burglary' || c.category === 'Fraud' || c.category === 'Cybercrime') ? 1 : randInt(1, 2)
  );
  let diff = TARGET_VICTIMS - baseCounts.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (diff !== 0 && guard < 500000) {
    guard++;
    const idx = randInt(0, baseCounts.length - 1);
    if (diff > 0 && baseCounts[idx] < 6) { baseCounts[idx]++; diff--; }
    else if (diff < 0 && baseCounts[idx] > 1) { baseCounts[idx]--; diff++; }
  }

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    for (let v = 0; v < baseCounts[i]; v++) {
      victims.push({
        id: randomUUID(), caseId: c.id, name: fullName(),
        age: randInt(16, 70),
        gender: chance(0.55) ? 'Male' : 'Female',
        occupation: pick(OCCUPATIONS),
        injurySeverity: c.category === 'Murder' ? 'fatal' : c.category === 'Assault' ? pick(['minor', 'major']) : 'none',
        statement: 'Statement recorded under Section 161 CrPC.',
      });
    }
  }
  _victims = victims;
  return victims;
}

function generateEvidence(): EvidenceRec[] {
  if (_evidence) return _evidence;
  const cases = generateCases();
  const users = generateUsers();
  const evidence: EvidenceRec[] = [];
  const baseCounts = cases.map(() => randInt(2, 6));
  let diff = TARGET_EVIDENCE - baseCounts.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (diff !== 0 && guard < 500000) {
    guard++;
    const idx = randInt(0, baseCounts.length - 1);
    if (diff > 0 && baseCounts[idx] < 9) { baseCounts[idx]++; diff--; }
    else if (diff < 0 && baseCounts[idx] > 1) { baseCounts[idx]--; diff++; }
  }

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    for (let e = 0; e < baseCounts[i]; e++) {
      evidence.push({
        id: randomUUID(), caseId: c.id,
        type: pick(['physical', 'digital', 'testimonial', 'documentary', 'forensic']),
        description: pick(EVIDENCE_DESCRIPTIONS),
        collectedBy: pick(users).name,
        status: pick(['collected', 'analyzed', 'submitted']),
      });
    }
  }
  _evidence = evidence;
  return evidence;
}

function generateEdges(): NetworkEdgeRec[] {
  if (_edges) return _edges;
  const cases = generateCases();
  const edges: NetworkEdgeRec[] = [];
  const seenPairs = new Set<string>();
  const casesByCD: Record<string, CaseRec[]> = {};
  for (const c of cases) {
    const key = `${c.category}|${c.district}`;
    (casesByCD[key] ||= []).push(c);
  }

  const addEdge = (a: CaseRec, b: CaseRec, rt: string) => {
    if (a.id === b.id) return;
    const k = [a.id, b.id].sort().join('|');
    if (seenPairs.has(k)) return;
    seenPairs.add(k);
    edges.push({ id: randomUUID(), caseId: a.id, relatedCaseId: b.id, relationType: rt, strength: randInt(30, 95) });
  };

  for (const c of cases) {
    if (edges.length >= TARGET_NETWORK_EDGES) break;
    const related = (casesByCD[`${c.category}|${c.district}`] || []).filter((x) => x.id !== c.id);
    const n = Math.min(related.length, randInt(0, 3));
    for (let j = 0; j < n && edges.length < TARGET_NETWORK_EDGES; j++) {
      addEdge(c, pick(related), pick(['same-modus', 'co-accused', 'shared-evidence', 'connected-network']));
    }
  }
  let guard = 0;
  while (edges.length < TARGET_NETWORK_EDGES && guard < TARGET_NETWORK_EDGES * 20) {
    guard++;
    addEdge(pick(cases), pick(cases), 'connected-network');
  }
  _edges = edges;
  return edges;
}

function generateFinancial(): FinancialRec[] {
  if (_financial) return _financial;
  const cases = generateCases();
  const financeEligible = cases.filter((c) => ['Fraud', 'Cybercrime', 'Theft', 'Burglary'].includes(c.category));
  const pool = financeEligible.length ? financeEligible : cases;
  const rows: FinancialRec[] = [];
  for (let i = 0; i < TARGET_FINANCIAL; i++) {
    const c = pick(pool);
    const flagged = chance(0.5);
    rows.push({
      id: randomUUID(),
      transactionId: `TXN${String(100000 + i).padStart(6, '0')}`,
      caseId: c.id,
      amount: randInt(10, 5000) * 1000,
      currency: 'INR',
      senderName: fullName(), receiverName: fullName(),
      bank: pick(BANKS),
      date: new Date(randInt(2023, 2026), randInt(0, 11), randInt(1, 28)),
      flagged,
      flagReason: flagged ? pick(['structuring', 'rapid-movement', 'high-risk-jurisdiction', 'unusual-pattern']) : null,
      riskScore: flagged ? randInt(50, 95) : randInt(5, 40),
      district: c.district,
    });
  }
  _financial = rows;
  return rows;
}

// =============================================================================
// Public accessors
// =============================================================================

export function getCases(): CaseRec[] { return generateCases(); }
export function getStations(): StationRec[] { return generateStations(); }
export function getUsers(): UserRec[] { return generateUsers(); }
export function getAccused(): AccusedRec[] { return generateAccused(); }
export function getVictims(): VictimRec[] { return generateVictims(); }
export function getEvidence(): EvidenceRec[] { return generateEvidence(); }
export function getEdges(): NetworkEdgeRec[] { return generateEdges(); }
export function getFinancial(): FinancialRec[] { return generateFinancial(); }
export function getDistrictNames(): string[] { return [...CANONICAL_DISTRICT_NAMES]; }
export function getCrimeCategories(): string[] { return [...CRIME_CATEGORIES]; }
