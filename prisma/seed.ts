// JurisIntel seed script — generates realistic Karnataka crime data
// Run: bun run prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

const db = new PrismaClient();

// Seeded PRNG (mulberry32) for reproducibility
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

function hashPwd(p: string) {
  return createHash('sha256').createHash('sha256').update(p).update(randomBytes(16)).digest('hex');
}
// Simple deterministic hash for demo (not secure, but consistent across runs)
function demoPwd(p: string) {
  return createHash('sha256').update(p).digest('hex');
}

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
] as const;

const CRIME_CATEGORIES = [
  'Theft', 'Assault', 'Murder', 'Cybercrime', 'Fraud',
  'Burglary', 'Kidnapping', 'Drug-Related', 'Sexual-Offense', 'Traffic',
] as const;

const STATION_NAMES = [
  'Central', 'Town', 'Rural', 'Cyber Crime', 'Women', 'Traffic',
  'Economic Offences', 'Railway', 'Airport', 'Industrial Area',
];

const OCCUPATIONS = [
  'Laborer', 'Farmer', 'Daily Wage', 'Driver', 'Shopkeeper', 'Student',
  'Unemployed', 'Businessman', 'IT Professional', 'Construction Worker',
  'Vendor', 'Mechanic', 'Domestic Worker', 'Retired', 'Self-Employed',
];

const MODUS_OPERANDI: Record<string, string[]> = {
  Theft: ['Snatched chain on road', 'Pickpocketed in crowded market', 'Stole unattended bag'],
  Assault: ['Group clash over dispute', 'Attack under influence of alcohol', 'Land dispute turned violent'],
  Murder: ['Stabbed over personal enmity', 'Strangled during robbery', 'Contract killing suspected'],
  Cybercrime: ['Phishing scam via UPI', 'Fake job offer fraud', 'OTP fraud on OLX listing'],
  Fraud: ['Fake property sale', 'Ponzi scheme investment', 'Cheque bounce case'],
  Burglary: ['Broke lock during daytime', 'Entered through roof', 'Forced entry at night'],
  Kidnapping: ['Abducted for ransom', 'Elopement case', 'Child lured with sweets'],
  'Drug-Related': ['Possession of ganja', 'MDMA distribution network', 'Synthetic drug lab busted'],
  'Sexual-Offense': ['Assault on minor', 'Workplace harassment complaint', 'POCSO case registered'],
  Traffic: ['Drunken driving fatal accident', 'Hit and run', 'Overspeeding collision'],
};

const FIRST_NAMES = ['Rajesh', 'Suresh', 'Mahesh', 'Lakshmi', 'Ganesh', 'Venkatesh', 'Nagaraj', 'Manjunatha', 'Ramesh', 'Anil', 'Prakash', 'Mohan', 'Krishna', 'Shiva', 'Arjun', 'Deepak', 'Kiran', 'Vijay', 'Ravi', 'Pradeep', 'Naveen', 'Harish', 'Sandeep', 'Girish', 'Srinivas', 'Chandrashekar', 'Bhaskar', 'Murali', 'Dinesh', 'Pramod', 'Sowmya', 'Latha', 'Geetha', 'Padma', 'Shobha', 'Rekha', 'Anita', 'Sunitha', 'Bhagya', 'Kavya', 'Meghana', 'Pooja', 'Divya', 'Shruti', 'Nandini', 'Vidya', 'Roopa', 'Ashwini', 'Vijaya', 'Jayamma'];
const LAST_NAMES = ['Kumar', 'Reddy', 'Gowda', 'Shetty', 'Rao', 'Naidu', 'Murthy', 'Naik', 'Patil', 'Desai', 'Hegde', 'Pai', 'Bhat', 'Rao', 'Swamy', 'Prasad', 'Iyer', 'Nair', 'Pillai', 'Menon'];

function fullName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

async function main() {
  console.log('Clearing existing data...');
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

  // 1. Users
  console.log('Creating users...');
  const users = await Promise.all([
    db.user.create({ data: { username: 'admin', password: demoPwd('ChangeMe@2026'), name: 'System Administrator', role: 'admin', district: 'Bengaluru Urban' } }),
    db.user.create({ data: { username: 'analyst1', password: demoPwd('Analyst@2026'), name: 'Priya Sharma', role: 'analyst', district: 'Bengaluru Urban' } }),
    db.user.create({ data: { username: 'inv1', password: demoPwd('Inv@2026'), name: 'Inspector Kumar', role: 'investigator', district: 'Mysuru' } }),
    db.user.create({ data: { username: 'sup1', password: demoPwd('Sup@2026'), name: 'DSP Anand Reddy', role: 'supervisor', district: 'Mangaluru' } }),
  ]);
  console.log(`Created ${users.length} users`);

  // 2. Districts
  console.log('Creating districts...');
  const districts = await Promise.all(
    DISTRICTS.map(([name, region, population, area]) =>
      db.district.create({ data: { name: name as string, region: region as string, population: population as number, areaSqKm: area as number } })
    )
  );
  console.log(`Created ${districts.length} districts`);

  // 3. Stations (20)
  console.log('Creating stations...');
  const stationList = [
    ['Bengaluru Urban', 'Bengaluru'], ['Bengaluru Urban', 'Bengaluru'], ['Bengaluru Urban', 'Bengaluru'],
    ['Mysuru', 'Mysuru'], ['Mysuru', 'Mysuru'],
    ['Mangaluru', 'Mangaluru'],
    ['Hubli-Dharwad', 'Hubballi'], ['Hubli-Dharwad', 'Hubballi'],
    ['Belagavi', 'Belagavi'],
    ['Kalaburagi', 'Kalaburagi'],
    ['Davanagere', 'Davanagere'],
    ['Dakshina Kannada', 'Mangaluru'],
    ['Udupi', 'Udupi'],
    ['Shivamogga', 'Shivamogga'],
    ['Ballari', 'Ballari'],
    ['Vijayapura', 'Vijayapura'],
    ['Tumakuru', 'Tumakuru'],
    ['Hassan', 'Hassan'],
    ['Chikkamagaluru', 'Chikkamagaluru'],
    ['Bengaluru Rural', 'Bengaluru'],
  ] as const;
  const stations = [] as any[];
  for (const [district, city] of stationList) {
    const idx = stations.filter(s => s.district === district).length;
    const name = `${city} ${STATION_NAMES[idx % STATION_NAMES.length]} PS`;
    const s = await db.station.create({
      data: {
        name,
        district: district as string,
        address: `${city}, Karnataka`,
        phone: `+91 80 ${randInt(2200, 2999)} ${randInt(1000, 9999)}`,
        latitude: 12 + rnd() * 4 - 2,
        longitude: 76 + rnd() * 4 - 2,
      },
    });
    stations.push(s);
  }
  console.log(`Created ${stations.length} stations`);

  // 4. Cases (150)
  console.log('Creating cases...');
  const allCases = [] as any[];
  for (let i = 0; i < 150; i++) {
    const category = pick(CRIME_CATEGORIES as readonly string[]);
    const district = pick(DISTRICTS)[0];
    const stationOfDistrict = stations.filter(s => s.district === district);
    const station = stationOfDistrict.length ? pick(stationOfDistrict) : pick(stations);
    const year = randInt(2021, 2024);
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
    const accusedCount = category === 'Murder' || category === 'Assault' ? randInt(1, 4) : randInt(1, 2);
    const victimCount = category === 'Theft' || category === 'Burglary' || category === 'Fraud' || category === 'Cybercrime' ? 1 : randInt(1, 2);

    const c = await db.case.create({
      data: {
        firNumber: `FIR/${year}/${String(i + 1).padStart(4, '0')}`,
        title: `${category} — ${mo.split(' ').slice(0, 3).join(' ')}`,
        category,
        status,
        priority,
        district,
        stationId: station.id,
        incidentDate,
        registeredAt,
        closedAt,
        description: `First Information Report registered at ${station.name}. ${mo}. Investigation ongoing. Witness statements recorded, ${randInt(2, 8)} witnesses examined.`,
        modusOperandi: mo,
        location: `${pick(['MG Road', 'Jayanagar', 'Malleshwaram', 'Indiranagar', 'Rajajinagar', 'Vijayanagar', 'Basavanagudi', 'Market Yard', 'Bus Stand', 'Railway Station'])}, ${district}`,
        weaponUsed: category === 'Murder' || category === 'Assault' ? pick(['Knife', 'Iron Rod', 'Blunt Object', 'Firearm', 'Stone']) : null,
        severity,
      },
    });

    // Accused
    for (let a = 0; a < accusedCount; a++) {
      const age = randInt(18, 55);
      const prior = chance(0.4) ? randInt(1, 5) : 0;
      const riskScore = Math.min(100, prior * 15 + (severity - 5) * 8 + randInt(0, 30));
      const isWanted = status !== 'closed' && chance(0.12);
      await db.accused.create({
        data: {
          caseId: c.id,
          name: fullName(),
          age,
          gender: chance(0.88) ? 'Male' : 'Female',
          occupation: pick(OCCUPATIONS),
          address: `${pick(['Gandhi Nagar', 'Nehru Nagar', 'Ambedkar Layout', 'Basaveshwar Nagar', 'Kuvempu Layout'])}, ${district}`,
          district,
          priorConvictions: prior,
          riskScore,
          status: isWanted ? 'absconding' : status === 'closed' ? (chance(0.6) ? 'on-bail' : 'in-custody') : 'in-custody',
          isWanted,
        },
      });
    }

    // Victims
    for (let v = 0; v < victimCount; v++) {
      await db.victim.create({
        data: {
          caseId: c.id,
          name: fullName(),
          age: randInt(16, 70),
          gender: chance(0.55) ? 'Male' : 'Female',
          occupation: pick(OCCUPATIONS),
          injurySeverity: category === 'Murder' ? 'fatal' : category === 'Assault' ? pick(['minor', 'major']) : 'none',
          statement: 'Statement recorded under Section 161 CrPC.',
        },
      });
    }

    // Evidence (1-4 items)
    const evCount = randInt(1, 4);
    for (let e = 0; e < evCount; e++) {
      await db.evidence.create({
        data: {
          caseId: c.id,
          type: pick(['physical', 'digital', 'testimonial', 'documentary', 'forensic']),
          description: pick([
            'CCTV footage from nearby establishment',
            'Fingerprint samples lifted from scene',
            'Mobile phone call detail records',
            'Bank statement showing suspicious transactions',
            'Medical examination report',
            'Weapon recovered from scene',
            'Witness statement (recorded)',
            'Forensic blood sample',
          ]),
          collectedBy: pick(users).name,
          status: pick(['collected', 'analyzed', 'submitted']),
        },
      });
    }

    allCases.push(c);
    if (station.activeCases !== undefined) station.activeCases++;
    else (station as any).activeCases = 1;
    (station as any).totalCases = ((station as any).totalCases || 0) + 1;
  }

  // update station counts
  for (const s of stations) {
    await db.station.update({ where: { id: s.id }, data: { activeCases: (s as any).activeCases || 0, totalCases: (s as any).totalCases || 0 } });
  }
  console.log(`Created ${allCases.length} cases`);

  // 5. Network edges (connect related cases)
  console.log('Creating network edges...');
  let edgeCount = 0;
  for (let i = 0; i < allCases.length; i++) {
    const base = allCases[i];
    // find cases with same category in same district
    const related = allCases.filter((c, idx) => idx !== i && c.category === base.category && c.district === base.district);
    const numEdges = Math.min(related.length, randInt(0, 2));
    for (let j = 0; j < numEdges; j++) {
      const target = related[j];
      await db.networkEdge.create({
        data: {
          caseId: base.id,
          relatedCaseId: target.id,
          relationType: pick(['same-modus', 'co-accused', 'shared-evidence', 'connected-network']),
          strength: randInt(30, 95),
        },
      });
      edgeCount++;
    }
  }
  console.log(`Created ${edgeCount} network edges`);

  // 6. Financial transactions (suspicious)
  console.log('Creating financial transactions...');
  let finCount = 0;
  for (let i = 0; i < 60; i++) {
    const flagged = chance(0.5);
    const c = pick(allCases.filter(c => c.category === 'Fraud' || c.category === 'Cybercrime')) || pick(allCases);
    await db.financialTransaction.create({
      data: {
        transactionId: `TXN${String(100000 + i).padStart(6, '0')}`,
        caseId: c.id,
        amount: randInt(10, 5000) * 1000,
        currency: 'INR',
        senderName: fullName(),
        receiverName: fullName(),
        bank: pick(['SBI', 'Canara Bank', 'Bank of Baroda', 'ICICI', 'HDFC', 'Axis Bank', 'Karnataka Bank', 'Union Bank']),
        date: new Date(randInt(2023, 2024), randInt(0, 11), randInt(1, 28)),
        flagged,
        flagReason: flagged ? pick(['structuring', 'rapid-movement', 'high-risk-jurisdiction', 'unusual-pattern']) : null,
        riskScore: flagged ? randInt(50, 95) : randInt(5, 40),
        district: c.district,
      },
    });
    finCount++;
  }
  console.log(`Created ${finCount} financial transactions`);

  console.log('\n✅ Seed complete!');
  console.log('Login credentials:');
  console.log('  admin / ChangeMe@2026');
  console.log('  analyst1 / Analyst@2026');
  console.log('  inv1 / Inv@2026');
  console.log('  sup1 / Sup@2026');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
