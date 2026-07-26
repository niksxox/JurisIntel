// JurisIntel seed script — generates realistic Karnataka crime data at scale
// Primary data source: uploaded NCRB-style "Karnataka Crime Master" statistical
// dataset (karnataka_crime_master.csv). That dataset is a set of ~136 official
// statistical tables (district-wise / crime-head-wise aggregates) — it does NOT
// contain row-level FIRs, so there is nothing to import 1:1 into the Case /
// Victim / Accused tables. Instead, this script:
//
//   1. Parses the CSV at runtime and extracts REAL district-wise and
//      category-wise case totals from several clean tables (1.3, 2A.1, 3.1,
//      9.1, 2B.1, 10.1).
//   2. Uses those real totals as weights so the ~3000 synthetic FIRs this
//      script generates are distributed across districts and crime
//      categories the same way the real Karnataka data is distributed.
//   3. Generates every record-level field (names, dates, evidence, financial
//      trails, etc.) synthetically with a seeded PRNG, since none of that
//      exists in the source dataset.
//
// If the CSV cannot be found on disk, the script logs a warning and falls
// back to flat/manual weights so it still runs end-to-end.
//
// Run: bun run prisma/seed.ts
//
// ---------------------------------------------------------------------------
// SCHEMA NOTE: This script was written without access to prisma/schema.prisma
// (it was not provided alongside the task). Field names for Case, Accused,
// Victim, Evidence, NetworkEdge, FinancialTransaction, Station, District and
// User are taken directly from the previous working version of this file, so
// those sections should compile as-is. The ChatSession, ChatMessage and
// AuditLog models were only referenced via `deleteMany()` in the previous
// version (never `create()`), so their field shapes were NOT visible anywhere
// in the code I had access to. I've implemented those three sections with the
// most conventional field names (see "ASSUMED SCHEMA" comments below) and
// wrapped each in its own try/catch so a mismatch there won't stop the rest
// of the seed from completing. Please check those three blocks against your
// real schema.prisma and adjust field names if needed.
// ---------------------------------------------------------------------------

import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const db = new PrismaClient();

// =============================================================================
// CONFIG — target volumes requested for the seed
// =============================================================================
const TARGET_CASES = 3000;
const TARGET_VICTIMS = 5000;
const TARGET_ACCUSED = 6500;
const TARGET_EVIDENCE = 13000;
const TARGET_FINANCIAL = 5000;
const TARGET_NETWORK_EDGES = 9000;
const TARGET_CHAT_SESSIONS = 500; // "Audit Sessions" in the brief == ChatSession records
const TARGET_CHAT_MESSAGES = 2000;
const TARGET_AUDIT_LOGS = 5000;
const BATCH_SIZE = 500;

// =============================================================================
// Seeded PRNG (mulberry32) for reproducibility
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

/** Nudges an array of per-case counts so their sum lands exactly on `target`. */
function adjustCountsToTarget(counts: number[], target: number, min = 0, max = 8): number[] {
  let diff = target - counts.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (diff !== 0 && guard < 500000 && counts.length > 0) {
    guard++;
    const idx = randInt(0, counts.length - 1);
    if (diff > 0 && counts[idx] < max) { counts[idx]++; diff--; }
    else if (diff < 0 && counts[idx] > min) { counts[idx]--; diff++; }
  }
  return counts;
}

function demoPwd(p: string) {
  return createHash('sha256').update(p).digest('hex');
}

async function insertBatches<T>(
  label: string,
  createMany: (data: T[]) => Promise<unknown>,
  rows: T[],
  batchSize = BATCH_SIZE
) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    await createMany(chunk);
    console.log(`  ...${label}: ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
  }
}

// =============================================================================
// 1. CSV LOADING — primary dataset
// =============================================================================

interface DistrictYearRow { district: string; y2022: number; y2023: number; y2024: number; }

function findCsvPath(): string | null {
  const candidates = [
    process.env.CRIME_DATA_CSV,
    path.join(__dirname, 'data', 'karnataka_crime_master.csv'),
    path.join(__dirname, 'karnataka_crime_master.csv'),
    path.join(__dirname, '..', 'data', 'karnataka_crime_master.csv'),
    path.join(__dirname, '..', 'karnataka_crime_master.csv'),
    path.join(process.cwd(), 'karnataka_crime_master.csv'),
    path.join(process.cwd(), 'prisma', 'data', 'karnataka_crime_master.csv'),
  ].filter((p): p is string => !!p);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/** Minimal RFC4180-ish CSV line splitter (handles quoted fields with commas). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function toNum(v: string | undefined): number {
  if (!v) return 0;
  const n = parseInt(v.replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Extracts a clean district-wise table (table_id, district, 2022, 2023, 2024 columns) by table_id. */
function extractDistrictTable(
  header: string[],
  lines: string[],
  tableId: string
): DistrictYearRow[] {
  const idxTableId = header.indexOf('table_id');
  const idxDistrict = header.indexOf('district');
  const idx2022 = header.indexOf('2022');
  const idx2023 = header.indexOf('2023');
  const idx2024 = header.indexOf('2024');
  if ([idxTableId, idxDistrict, idx2022, idx2023, idx2024].some((i) => i === -1)) return [];

  const out: DistrictYearRow[] = [];
  for (const line of lines) {
    if (!line) continue;
    const cells = splitCsvLine(line);
    if (cells[idxTableId] !== tableId) continue;
    const district = (cells[idxDistrict] || '').trim();
    if (!district || /^total/i.test(district)) continue;
    out.push({
      district,
      y2022: toNum(cells[idx2022]),
      y2023: toNum(cells[idx2023]),
      y2024: toNum(cells[idx2024]),
    });
  }
  return out;
}

interface DatasetExtract {
  found: boolean;
  path: string | null;
  districtTotals: DistrictYearRow[]; // table 1.3 — IPC/BNS Crimes (District-wise)
  murder: DistrictYearRow[];         // table 2A.1 — Murder Cases
  women: DistrictYearRow[];          // table 3.1 — Crime against Women
  economic: DistrictYearRow[];       // table 9.1 — Economic Offences
  kidnap: DistrictYearRow[];         // table 2B.1 — Kidnapping & Abduction
  cyber: DistrictYearRow[];          // table 10.1 — Cyber Crimes
}

function loadDataset(): DatasetExtract {
  const csvPath = findCsvPath();
  if (!csvPath) {
    console.warn('⚠️  karnataka_crime_master.csv not found on disk (checked common paths / CRIME_DATA_CSV env var).');
    console.warn('    Falling back to flat synthetic distributions for districts & categories.');
    return { found: false, path: null, districtTotals: [], murder: [], women: [], economic: [], kidnap: [], cyber: [] };
  }
  console.log(`Loading primary dataset from ${csvPath} ...`);
  const raw = fs.readFileSync(csvPath, 'utf-8');
  const lines = raw.split(/\r?\n/);
  const header = splitCsvLine(lines[0]);
  const body = lines.slice(1);

  const extract: DatasetExtract = {
    found: true,
    path: csvPath,
    districtTotals: extractDistrictTable(header, body, '1.3'),
    murder: extractDistrictTable(header, body, '2A.1'),
    women: extractDistrictTable(header, body, '3.1'),
    economic: extractDistrictTable(header, body, '9.1'),
    kidnap: extractDistrictTable(header, body, '2B.1'),
    cyber: extractDistrictTable(header, body, '10.1'),
  };
  console.log(`  parsed ${extract.districtTotals.length} district rows (table 1.3), ${extract.murder.length} murder rows, ${extract.women.length} women rows, ${extract.economic.length} economic rows, ${extract.kidnap.length} kidnap rows, ${extract.cyber.length} cyber rows.`);
  return extract;
}

// =============================================================================
// 2. CANONICAL REFERENCE DATA
// =============================================================================

// The 30 admin districts from the previous seed, PLUS Kolar and Vijayanagara
// (both real Karnataka districts present in the source dataset but missing
// from the earlier hard-coded list). Population/area are approximate 2024
// figures, consistent in style with the rest of the table.
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

// Maps the (messy, PDF-extracted) district labels found in the CSV to the
// canonical district names above, so real case-count weights can be summed
// into the districts this project already models.
const CSV_DISTRICT_ALIASES: Record<string, string> = {
  'Bagalkot': 'Bagalkote',
  'Bengaluru City': 'Bengaluru Urban',
  'Bengaluru District': 'Bengaluru Rural',
  'Belagavi District': 'Belagavi',
  'Belagavi City': 'Belagavi',
  'Ballari': 'Ballari',
  'Bidar': 'Bidar',
  'Vijayapura': 'Vijayapura',
  'Chikkaballapura': 'Chikkaballapura',
  'Chamarajnagar': 'Chamarajanagar',
  'Chikkamagaluru': 'Chikkamagaluru',
  'Chitradurga': 'Chitradurga',
  'Dakshina Kannada': 'Dakshina Kannada',
  'Davanagere': 'Davanagere',
  'Dharwad': 'Hubli-Dharwad',
  'Gadag': 'Gadag',
  'Kalaburgi': 'Kalaburagi',
  'Kalaburgi City': 'Kalaburagi',
  'Hassan': 'Hassan',
  'Haveri Hubballi Dharwad': 'Haveri',
  'Kodagu': 'Kodagu',
  'Kolar': 'Kolar',
  'Koppal': 'Koppal',
  'Mandya': 'Mandya',
  'Mangaluru City': 'Mangaluru',
  'Mysuru City': 'Mysuru',
  'Mysuru District': 'Mysuru',
  'Raichur': 'Raichur',
  'Ramanagara': 'Ramanagara',
  'Shimoga': 'Shivamogga',
  'Tumakuru': 'Tumakuru',
  'Udupi': 'Udupi',
  'Uttara Kannada': 'Uttara Kannada',
  'Yadgiri': 'Yadgir',
  'Vijayanagara': 'Vijayanagara',
  'KGF': 'Kolar',
  // 'City' and 'KRailways' rows are commissionerate/railway splits with no
  // clean 1:1 district mapping — intentionally skipped.
};

const CRIME_CATEGORIES = [
  'Theft', 'Assault', 'Murder', 'Cybercrime', 'Fraud',
  'Burglary', 'Kidnapping', 'Drug-Related', 'Sexual-Offense', 'Traffic',
] as const;
type CrimeCategory = typeof CRIME_CATEGORIES[number];

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

// =============================================================================
// 3. BUILD DATA-DRIVEN WEIGHTS FROM THE DATASET
// =============================================================================

function buildDistrictWeights(ds: DatasetExtract): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const name of CANONICAL_DISTRICT_NAMES) weights[name] = 25; // floor so every district gets some cases

  if (ds.found) {
    for (const row of ds.districtTotals) {
      const canonical = CSV_DISTRICT_ALIASES[row.district];
      if (!canonical) continue;
      weights[canonical] = (weights[canonical] || 0) + row.y2024;
    }
  }
  return weights;
}

function sumMapped(ds: DatasetExtract, rows: DistrictYearRow[]): number {
  return rows.reduce((s, r) => (CSV_DISTRICT_ALIASES[r.district] ? s + r.y2024 : s), 0);
}

function buildCategoryWeights(ds: DatasetExtract): Record<CrimeCategory, number> {
  // Real, dataset-derived totals for the categories that map cleanly onto a
  // single official table.
  const murderTotal = ds.found ? sumMapped(ds, ds.murder) : 0;
  const cyberTotal = ds.found ? sumMapped(ds, ds.cyber) : 0;
  const economicTotal = ds.found ? sumMapped(ds, ds.economic) : 0; // -> Fraud
  const kidnapTotal = ds.found ? sumMapped(ds, ds.kidnap) : 0;
  // "Crime against Women" table is broader than just sexual offenses, so we
  // scale it down to approximate the sexual-offense subset.
  const womenTotal = ds.found ? sumMapped(ds, ds.women) : 0;
  const sexualOffenseTotal = Math.round(womenTotal * 0.35);

  const grandTotal = ds.found ? sumMapped(ds, ds.districtTotals) : 0;
  const knownSum = murderTotal + cyberTotal + economicTotal + kidnapTotal + sexualOffenseTotal;
  const remainder = Math.max(grandTotal - knownSum, 0);

  if (!ds.found || grandTotal === 0) {
    // Flat/manual fallback distribution (roughly typical NCRB-style shape).
    return {
      Theft: 24, Assault: 16, Murder: 3, Cybercrime: 10, Fraud: 10,
      Burglary: 12, Kidnapping: 6, 'Drug-Related': 6, 'Sexual-Offense': 8, Traffic: 5,
    };
  }

  // Split the "everything else" remainder across categories without a clean
  // single-table equivalent, using realistic proportions.
  return {
    Theft: remainder * 0.32,
    Assault: remainder * 0.20,
    Burglary: remainder * 0.16,
    'Drug-Related': remainder * 0.10,
    Traffic: remainder * 0.22,
    Murder: murderTotal,
    Cybercrime: cyberTotal,
    Fraud: economicTotal,
    Kidnapping: kidnapTotal,
    'Sexual-Offense': sexualOffenseTotal,
  };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const dataset = loadDataset();
  const districtWeights = buildDistrictWeights(dataset);
  const categoryWeights = buildCategoryWeights(dataset);

  console.log('District weights (top 5):', Object.entries(districtWeights).sort((a, b) => b[1] - a[1]).slice(0, 5));
  console.log('Category weights:', categoryWeights);

  console.log('\nClearing existing data...');
  await db.$transaction([
    db.networkEdge.deleteMany(),
    db.evidence.deleteMany(),
    db.victim.deleteMany(),
    db.accused.deleteMany(),
    db.financialTransaction.deleteMany(),
    db.chatMessage.deleteMany(),
    db.chatSession.deleteMany(),
    db.auditLog.deleteMany(),
    db.case.deleteMany(),
    db.station.deleteMany(),
    db.district.deleteMany(),
    db.user.deleteMany(),
  ]);

  // ---------------------------------------------------------------------
  // 1. Users
  // ---------------------------------------------------------------------
  console.log('Creating users...');
  const baseUsers = [
    { username: 'admin', password: demoPwd('ChangeMe@2026'), name: 'System Administrator', role: 'admin', district: 'Bengaluru Urban' },
    { username: 'analyst1', password: demoPwd('Analyst@2026'), name: 'Priya Sharma', role: 'analyst', district: 'Bengaluru Urban' },
    { username: 'inv1', password: demoPwd('Inv@2026'), name: 'Inspector Kumar', role: 'investigator', district: 'Mysuru' },
    { username: 'sup1', password: demoPwd('Sup@2026'), name: 'DSP Anand Reddy', role: 'supervisor', district: 'Mangaluru' },
  ];
  // Extra investigator/analyst users spread across districts, used as
  // evidence collectors / audit actors so those fields don't all point to
  // the same 4 names across ~13,000 evidence records.
  const extraUsers = Array.from({ length: 20 }).map((_, i) => ({
    username: `officer${i + 1}`,
    password: demoPwd(`Officer${i + 1}@2026`),
    name: `${pick(['Inspector', 'Sub-Inspector', 'ASI', 'DySP'])} ${fullName()}`,
    role: pick(['investigator', 'analyst']),
    district: pick(CANONICAL_DISTRICT_NAMES),
  }));
  const userRows = [...baseUsers, ...extraUsers].map((u) => ({ id: randomUUID(), ...u }));
  await db.user.createMany({ data: userRows });
  console.log(`Created ${userRows.length} users`);

  // ---------------------------------------------------------------------
  // 2. Districts
  // ---------------------------------------------------------------------
  console.log('Creating districts...');
  const districtRows = DISTRICTS.map(([name, region, population, area]) => ({
    id: randomUUID(),
    name: name as string,
    region: region as string,
    population: population as number,
    areaSqKm: area as number,
  }));
  await db.district.createMany({ data: districtRows });
  console.log(`Created ${districtRows.length} districts`);

  // ---------------------------------------------------------------------
  // 3. Stations — count per district scaled to its (real) case-volume weight
  // ---------------------------------------------------------------------
  console.log('Creating stations...');
  const totalDistrictWeight = Object.values(districtWeights).reduce((a, b) => a + b, 0);
  const stationRows: { id: string; name: string; district: string; address: string; phone: string; latitude: number; longitude: number }[] = [];
  const stationsByDistrict: Record<string, string[]> = {};

  for (const name of CANONICAL_DISTRICT_NAMES) {
    const share = districtWeights[name] / totalDistrictWeight;
    const count = Math.max(2, Math.min(14, Math.round(share * 220)));
    stationsByDistrict[name] = [];
    for (let i = 0; i < count; i++) {
      const id = randomUUID();
      const station = {
        id,
        name: `${name} ${STATION_NAMES[i % STATION_NAMES.length]} PS`,
        district: name,
        address: `${name}, Karnataka`,
        phone: `+91 80 ${randInt(2200, 2999)} ${randInt(1000, 9999)}`,
        latitude: 12 + rnd() * 4 - 2,
        longitude: 76 + rnd() * 4 - 2,
      };
      stationRows.push(station);
      stationsByDistrict[name].push(id);
    }
  }
  await insertBatches('stations', (chunk) => db.station.createMany({ data: chunk }), stationRows);
  console.log(`Created ${stationRows.length} stations`);

  // ---------------------------------------------------------------------
  // 4. Cases (~3000), weighted by real district/category distribution
  // ---------------------------------------------------------------------
  console.log('Creating cases...');
  interface CaseRec {
    id: string; firNumber: string; title: string; category: CrimeCategory; status: string;
    priority: string; district: string; stationId: string; incidentDate: Date; registeredAt: Date;
    closedAt: Date | null; description: string; modusOperandi: string; location: string;
    weaponUsed: string | null; severity: number;
  }
  const caseRows: CaseRec[] = [];
  const stationTotals: Record<string, number> = {};

  for (let i = 0; i < TARGET_CASES; i++) {
    const category = weightedPick(categoryWeights) as CrimeCategory;
    const district = weightedPick(districtWeights);
    const stationIds = stationsByDistrict[district]?.length ? stationsByDistrict[district] : stationRows.map((s) => s.id);
    const stationId = pick(stationIds);

    const year = randInt(2022, 2026);
    const month = randInt(0, 11);
    const day = randInt(1, 28);
    const incidentDate = new Date(year, month, day);
    const registeredAt = new Date(incidentDate.getTime() + randInt(1, 72) * 3600 * 1000);

    const statusRoll = rnd();
    let status: string, closedAt: Date | null = null;
    if (statusRoll < 0.45) { status = 'closed'; closedAt = new Date(registeredAt.getTime() + randInt(30, 400) * 86400 * 1000); }
    else if (statusRoll < 0.7) status = 'charge-sheeted';
    else if (statusRoll < 0.85) status = 'under-investigation';
    else status = 'open';

    const priorityRoll = rnd();
    const priority = priorityRoll < 0.15 ? 'critical' : priorityRoll < 0.4 ? 'high' : priorityRoll < 0.75 ? 'medium' : 'low';
    const severity = category === 'Murder' ? randInt(8, 10) : category === 'Sexual-Offense' || category === 'Kidnapping' ? randInt(7, 10) : randInt(3, 8);

    const mo = pick(MODUS_OPERANDI[category]);
    const section = pick(IPC_BNS_SECTIONS[category]);
    const stationName = stationRows.find((s) => s.id === stationId)?.name || `${district} PS`;

    const c: CaseRec = {
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
      description: `First Information Report registered at ${stationName}. ${mo}. Offence registered under ${section}. Investigation ongoing. Witness statements recorded, ${randInt(2, 8)} witnesses examined.`,
      modusOperandi: mo,
      location: `${pick(['MG Road', 'Jayanagar', 'Malleshwaram', 'Indiranagar', 'Rajajinagar', 'Vijayanagar', 'Basavanagudi', 'Market Yard', 'Bus Stand', 'Railway Station'])}, ${district}`,
      weaponUsed: category === 'Murder' || category === 'Assault' ? pick(['Knife', 'Iron Rod', 'Blunt Object', 'Firearm', 'Stone']) : null,
      severity,
    };
    caseRows.push(c);
    stationTotals[stationId] = (stationTotals[stationId] || 0) + 1;
  }
  await insertBatches('cases', (chunk) => db.case.createMany({ data: chunk }), caseRows);

  // update station case counts
  const stationUpdates = Object.entries(stationTotals);
  for (const [id, total] of stationUpdates) {
    await db.station.update({ where: { id }, data: { activeCases: Math.round(total * 0.4), totalCases: total } });
  }
  console.log(`Created ${caseRows.length} cases`);

  // ---------------------------------------------------------------------
  // 5. Accused (~6500) and Victims (~5000) — per-case counts adjusted to hit targets
  // ---------------------------------------------------------------------
  console.log('Creating accused & victims...');
  const accusedBase = caseRows.map((c) => (c.category === 'Murder' || c.category === 'Assault' ? randInt(1, 4) : randInt(1, 2)));
  adjustCountsToTarget(accusedBase, TARGET_ACCUSED, 1, 7);

  const victimBase = caseRows.map((c) =>
    (c.category === 'Theft' || c.category === 'Burglary' || c.category === 'Fraud' || c.category === 'Cybercrime') ? 1 : randInt(1, 2)
  );
  adjustCountsToTarget(victimBase, TARGET_VICTIMS, 1, 6);

  const accusedRows: any[] = [];
  const victimRows: any[] = [];
  for (let i = 0; i < caseRows.length; i++) {
    const c = caseRows[i];
    for (let a = 0; a < accusedBase[i]; a++) {
      const age = randInt(18, 55);
      const prior = chance(0.4) ? randInt(1, 5) : 0;
      const riskScore = Math.min(100, prior * 15 + (c.severity - 5) * 8 + randInt(0, 30));
      const isWanted = c.status !== 'closed' && chance(0.12);
      accusedRows.push({
        id: randomUUID(),
        caseId: c.id,
        name: fullName(),
        age,
        gender: chance(0.88) ? 'Male' : 'Female',
        occupation: pick(OCCUPATIONS),
        address: `${pick(['Gandhi Nagar', 'Nehru Nagar', 'Ambedkar Layout', 'Basaveshwar Nagar', 'Kuvempu Layout'])}, ${c.district}`,
        district: c.district,
        priorConvictions: prior,
        riskScore,
        status: isWanted ? 'absconding' : c.status === 'closed' ? (chance(0.6) ? 'on-bail' : 'in-custody') : 'in-custody',
        isWanted,
      });
    }
    for (let v = 0; v < victimBase[i]; v++) {
      victimRows.push({
        id: randomUUID(),
        caseId: c.id,
        name: fullName(),
        age: randInt(16, 70),
        gender: chance(0.55) ? 'Male' : 'Female',
        occupation: pick(OCCUPATIONS),
        injurySeverity: c.category === 'Murder' ? 'fatal' : c.category === 'Assault' ? pick(['minor', 'major']) : 'none',
        statement: 'Statement recorded under Section 161 CrPC.',
      });
    }
  }
  await insertBatches('accused', (chunk) => db.accused.createMany({ data: chunk }), accusedRows);
  await insertBatches('victims', (chunk) => db.victim.createMany({ data: chunk }), victimRows);
  console.log(`Created ${accusedRows.length} accused, ${victimRows.length} victims`);

  // ---------------------------------------------------------------------
  // 6. Evidence (~13000)
  // ---------------------------------------------------------------------
  console.log('Creating evidence...');
  const evidenceBase = caseRows.map(() => randInt(2, 6));
  adjustCountsToTarget(evidenceBase, TARGET_EVIDENCE, 1, 9);
  const evidenceRows: any[] = [];
  for (let i = 0; i < caseRows.length; i++) {
    const c = caseRows[i];
    for (let e = 0; e < evidenceBase[i]; e++) {
      evidenceRows.push({
        id: randomUUID(),
        caseId: c.id,
        type: pick(['physical', 'digital', 'testimonial', 'documentary', 'forensic']),
        description: pick(EVIDENCE_DESCRIPTIONS),
        collectedBy: pick(userRows).name,
        status: pick(['collected', 'analyzed', 'submitted']),
      });
    }
  }
  await insertBatches('evidence', (chunk) => db.evidence.createMany({ data: chunk }), evidenceRows);
  console.log(`Created ${evidenceRows.length} evidence records`);

  // ---------------------------------------------------------------------
  // 7. Network edges (~9000) — same-category/same-district links, topped up
  //    with cross-district "connected-network" links to hit the target.
  // ---------------------------------------------------------------------
  console.log('Creating network edges...');
  const casesByCategoryDistrict: Record<string, CaseRec[]> = {};
  for (const c of caseRows) {
    const key = `${c.category}|${c.district}`;
    (casesByCategoryDistrict[key] ||= []).push(c);
  }
  const edgeRows: any[] = [];
  const seenPairs = new Set<string>();
  const addEdge = (a: CaseRec, b: CaseRec, relationType: string) => {
    if (a.id === b.id) return;
    const key = [a.id, b.id].sort().join('|');
    if (seenPairs.has(key)) return;
    seenPairs.add(key);
    edgeRows.push({
      id: randomUUID(),
      caseId: a.id,
      relatedCaseId: b.id,
      relationType,
      strength: randInt(30, 95),
    });
  };

  for (const c of caseRows) {
    if (edgeRows.length >= TARGET_NETWORK_EDGES) break;
    const related = casesByCategoryDistrict[`${c.category}|${c.district}`].filter((x) => x.id !== c.id);
    const numEdges = Math.min(related.length, randInt(0, 3));
    for (let j = 0; j < numEdges && edgeRows.length < TARGET_NETWORK_EDGES; j++) {
      addEdge(c, pick(related), pick(['same-modus', 'co-accused', 'shared-evidence', 'connected-network']));
    }
  }
  // Top up with random cross links if still short of target.
  let guard = 0;
  while (edgeRows.length < TARGET_NETWORK_EDGES && guard < TARGET_NETWORK_EDGES * 20) {
    guard++;
    addEdge(pick(caseRows), pick(caseRows), 'connected-network');
  }
  await insertBatches('network edges', (chunk) => db.networkEdge.createMany({ data: chunk }), edgeRows);
  console.log(`Created ${edgeRows.length} network edges`);

  // ---------------------------------------------------------------------
  // 8. Financial transactions (~5000)
  // ---------------------------------------------------------------------
  console.log('Creating financial transactions...');
  const financeEligible = caseRows.filter((c) => ['Fraud', 'Cybercrime', 'Theft', 'Burglary'].includes(c.category));
  const financePool = financeEligible.length ? financeEligible : caseRows;
  const financeRows: any[] = [];
  for (let i = 0; i < TARGET_FINANCIAL; i++) {
    const c = pick(financePool);
    const flagged = chance(0.5);
    financeRows.push({
      id: randomUUID(),
      transactionId: `TXN${String(100000 + i).padStart(6, '0')}`,
      caseId: c.id,
      amount: randInt(10, 5000) * 1000,
      currency: 'INR',
      senderName: fullName(),
      receiverName: fullName(),
      bank: pick(BANKS),
      date: new Date(randInt(2023, 2026), randInt(0, 11), randInt(1, 28)),
      flagged,
      flagReason: flagged ? pick(['structuring', 'rapid-movement', 'high-risk-jurisdiction', 'unusual-pattern']) : null,
      riskScore: flagged ? randInt(50, 95) : randInt(5, 40),
      district: c.district,
    });
  }
  await insertBatches('financial transactions', (chunk) => db.financialTransaction.createMany({ data: chunk }), financeRows);
  console.log(`Created ${financeRows.length} financial transactions`);

  // ---------------------------------------------------------------------
  // 9. Chat sessions / messages, and Audit logs
  // ASSUMED SCHEMA — see file header note. Wrapped in try/catch so a field
  // mismatch here doesn't take down the rest of the seed.
  // ---------------------------------------------------------------------
  console.log('Creating chat sessions & messages...');
  try {
    const sessionRows = Array.from({ length: TARGET_CHAT_SESSIONS }).map(() => {
      const user = pick(userRows);
      const c = pick(caseRows);
      return {
        id: randomUUID(),
        userId: user.id,
        caseId: chance(0.7) ? c.id : null,
        title: chance(0.7) ? `Investigation notes — ${c.firNumber}` : 'General query',
        createdAt: new Date(randInt(2023, 2026), randInt(0, 11), randInt(1, 28)),
      };
    });
    await insertBatches('chat sessions', (chunk) => db.chatSession.createMany({ data: chunk }), sessionRows);
    console.log(`Created ${sessionRows.length} chat sessions`);

    const CHAT_PROMPTS = [
      'Summarize the evidence collected so far for this case.',
      'Are there any related cases in the network graph?',
      'What is the risk score of the primary accused?',
      'Draft a case status update for the supervisor.',
      'List all financial transactions flagged as suspicious.',
    ];
    const CHAT_REPLIES = [
      'Based on the current records, here is a summary of the case status.',
      'I found related cases sharing the same modus operandi in this district.',
      'The risk score reflects prior convictions and offence severity.',
      'Here is a concise status update for the supervisor.',
      'Here are the flagged transactions linked to this case.',
    ];
    const messageBase = sessionRows.map(() => randInt(2, 6));
    adjustCountsToTarget(messageBase, TARGET_CHAT_MESSAGES, 1, 10);
    const messageRows: any[] = [];
    for (let i = 0; i < sessionRows.length; i++) {
      const s = sessionRows[i];
      for (let m = 0; m < messageBase[i]; m++) {
        const isUser = m % 2 === 0;
        messageRows.push({
          id: randomUUID(),
          sessionId: s.id,
          role: isUser ? 'user' : 'assistant',
          content: isUser ? pick(CHAT_PROMPTS) : pick(CHAT_REPLIES),
          createdAt: new Date(s.createdAt.getTime() + m * 60000),
        });
      }
    }
    await insertBatches('chat messages', (chunk) => db.chatMessage.createMany({ data: chunk }), messageRows);
    console.log(`Created ${messageRows.length} chat messages`);
  } catch (err) {
    console.error('⚠️  Skipped/partial chat session or message seeding — field names likely need to match your actual schema:', err);
  }

  console.log('Creating audit logs...');
  try {
    const AUDIT_ACTIONS = ['create', 'update', 'view', 'delete', 'export', 'login', 'status-change'];
    const AUDIT_ENTITIES = ['Case', 'Accused', 'Victim', 'Evidence', 'FinancialTransaction', 'User'];
    const auditRows = Array.from({ length: TARGET_AUDIT_LOGS }).map(() => {
      const user = pick(userRows);
      const entityType = pick(AUDIT_ENTITIES);
      const c = pick(caseRows);
      return {
        id: randomUUID(),
        userId: user.id,
        action: pick(AUDIT_ACTIONS),
        entityType,
        entityId: entityType === 'Case' ? c.id : randomUUID(),
        details: `${user.name} performed ${entityType.toLowerCase()} action on ${c.firNumber}`,
        createdAt: new Date(randInt(2023, 2026), randInt(0, 11), randInt(1, 28), randInt(0, 23), randInt(0, 59)),
      };
    });
    await insertBatches('audit logs', (chunk) => db.auditLog.createMany({ data: chunk }), auditRows);
    console.log(`Created ${auditRows.length} audit logs`);
  } catch (err) {
    console.error('⚠️  Skipped/partial audit log seeding — field names likely need to match your actual schema:', err);
  }

  console.log('\n✅ Seed complete!');
  console.log(`   Districts: ${districtRows.length}, Stations: ${stationRows.length}, Cases: ${caseRows.length}`);
  console.log(`   Accused: ${accusedRows.length}, Victims: ${victimRows.length}, Evidence: ${evidenceRows.length}`);
  console.log(`   Financial transactions: ${financeRows.length}, Network edges: ${edgeRows.length}`);
  console.log('Login credentials:');
  console.log('  admin / ChangeMe@2026');
  console.log('  analyst1 / Analyst@2026');
  console.log('  inv1 / Inv@2026');
  console.log('  sup1 / Sup@2026');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
