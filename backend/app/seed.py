"""
Generates realistic-looking synthetic FIR data so the dashboard has
something to query, visualize, and export. No real case data is used.

Deliberately reuses a pool of "known offender" names across multiple cases
so the criminal-network graph has real cross-case links to show.
"""
import random
from datetime import date, datetime, timedelta

from .database import engine, SessionLocal
from .models import (
    Base, State, District, UnitType, Unit, Rank, Designation, Employee,
    CaseCategory, GravityOffence, CrimeHead, CrimeSubHead, CaseStatusMaster,
    Court, Act, Section, ReligionMaster, CasteMaster, OccupationMaster,
    CaseMaster, ComplainantDetails, ActSectionAssociation, Victim, Accused,
    ArrestSurrender,
)

random.seed(42)

DISTRICTS = ["Bengaluru Urban", "Mysuru", "Mangaluru", "Belagavi", "Hubballi-Dharwad",
             "Kalaburagi", "Tumakuru", "Shivamogga", "Ballari", "Davanagere"]

CRIME_GROUPS = {
    "Crimes Against Body": ["Murder", "Attempt to Murder", "Grievous Hurt", "Kidnapping"],
    "Crimes Against Property": ["Theft", "Robbery", "Burglary", "Criminal Trespass"],
    "Crimes Against Women": ["Assault on Women", "Dowry Harassment", "Stalking"],
    "Cyber Crime": ["Online Fraud", "Identity Theft", "Cyberstalking"],
    "Narcotics": ["Drug Possession", "Drug Trafficking"],
}

ACTS = [
    ("IPC", "Indian Penal Code", ["302", "307", "323", "379", "392", "420", "376", "506"]),
    ("NDPS", "Narcotic Drugs and Psychotropic Substances Act", ["8", "20", "21", "22"]),
    ("IT_ACT", "Information Technology Act", ["66", "66C", "66D", "67"]),
    ("MV_ACT", "Motor Vehicles Act", ["184", "185", "196"]),
]

CASE_CATEGORIES = ["FIR", "UDR", "Zero FIR", "PAR"]
GRAVITY = ["Heinous", "Non-Heinous"]
STATUSES = ["Under Investigation", "Charge Sheeted", "Closed", "Undetected", "Court Trial"]
RELIGIONS = ["Hindu", "Muslim", "Christian", "Jain", "Sikh"]
CASTES = ["General", "OBC", "SC", "ST"]
OCCUPATIONS = ["Farmer", "Government Employee", "Private Employee", "Business", "Student", "Unemployed", "Daily Wage Labour"]

FIRST_NAMES = ["Ravi", "Suresh", "Manjunath", "Arjun", "Vikram", "Prakash", "Ganesh", "Naveen",
               "Deepak", "Santosh", "Anitha", "Lakshmi", "Sunitha", "Kavya", "Divya", "Pooja",
               "Rahul", "Karthik", "Srinivas", "Mahesh", "Iqbal", "Rafiq", "Salim", "Yusuf",
               "Chandru", "Basavaraj", "Nagesh", "Shivu", "Ramesh", "Girish"]
LAST_NAMES = ["Gowda", "Reddy", "Naik", "Shetty", "Kumar", "Rao", "Hegde", "Patil", "Khan", "Sharma"]

# Pool of "known offenders" reused across several cases -> creates a real network
KNOWN_OFFENDERS = [f"{f} {l}" for f, l in zip(
    random.sample(FIRST_NAMES, 12), random.sample(LAST_NAMES * 2, 12)
)]


def rand_name():
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"


def rand_date(start_year=2024, end_year=2026):
    start = date(start_year, 1, 1)
    end = date(end_year, 7, 17)
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))


def seed():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # --- masters ---
    state = State(StateID=1, StateName="Karnataka")
    db.add(state)

    districts = []
    for i, name in enumerate(DISTRICTS, start=1):
        d = District(DistrictID=i, DistrictName=name, StateID=1)
        districts.append(d)
        db.add(d)

    unit_type = UnitType(UnitTypeID=1, UnitTypeName="Police Station", CityDistState="City", Hierarchy=1)
    db.add(unit_type)

    units = []
    for i, d in enumerate(districts, start=1):
        for j in range(1, 3):  # 2 stations per district
            u = Unit(UnitID=len(units) + 1, UnitName=f"{d.DistrictName} PS {j}",
                      TypeID=1, StateID=1, DistrictID=d.DistrictID)
            units.append(u)
            db.add(u)

    ranks = [Rank(RankID=i, RankName=n, Hierarchy=i) for i, n in
             enumerate(["Constable", "Head Constable", "Sub-Inspector", "Inspector", "DSP"], start=1)]
    db.add_all(ranks)

    designations = [Designation(DesignationID=1, DesignationName="Investigating Officer", SortOrder=1),
                     Designation(DesignationID=2, DesignationName="SHO", SortOrder=2)]
    db.add_all(designations)

    employees = []
    for i in range(1, 41):
        u = random.choice(units)
        e = Employee(EmployeeID=i, DistrictID=u.DistrictID, UnitID=u.UnitID,
                      RankID=random.randint(1, 5), DesignationID=random.choice([1, 2]),
                      KGID=f"KGID{1000+i}", FirstName=rand_name(),
                      EmployeeDOB=rand_date(1975, 1998), GenderID=random.choice([1, 2]),
                      AppointmentDate=rand_date(2000, 2020))
        employees.append(e)
        db.add(e)

    categories = [CaseCategory(CaseCategoryID=i, LookupValue=c) for i, c in enumerate(CASE_CATEGORIES, start=1)]
    db.add_all(categories)

    gravities = [GravityOffence(GravityOffenceID=i, LookupValue=g) for i, g in enumerate(GRAVITY, start=1)]
    db.add_all(gravities)

    crime_heads = []
    crime_sub_heads = []
    for i, (group, subs) in enumerate(CRIME_GROUPS.items(), start=1):
        ch = CrimeHead(CrimeHeadID=i, CrimeGroupName=group)
        crime_heads.append(ch)
        db.add(ch)
        for j, s in enumerate(subs, start=1):
            csh = CrimeSubHead(CrimeSubHeadID=len(crime_sub_heads) + 1, CrimeHeadID=i,
                                CrimeHeadName=s, SeqID=j)
            crime_sub_heads.append(csh)
            db.add(csh)

    statuses = [CaseStatusMaster(CaseStatusID=i, CaseStatusName=s) for i, s in enumerate(STATUSES, start=1)]
    db.add_all(statuses)

    courts = []
    for i, d in enumerate(districts, start=1):
        c = Court(CourtID=i, CourtName=f"District & Sessions Court, {d.DistrictName}",
                  DistrictID=d.DistrictID, StateID=1)
        courts.append(c)
        db.add(c)

    acts = []
    sections = []
    for code, desc, secs in ACTS:
        a = Act(ActCode=code, ActDescription=desc, ShortName=code)
        acts.append(a)
        db.add(a)
        for sc in secs:
            s = Section(ActCode=code, SectionCode=sc, SectionDescription=f"{code} Section {sc}")
            sections.append(s)
            db.add(s)

    religions = [ReligionMaster(ReligionID=i, ReligionName=r) for i, r in enumerate(RELIGIONS, start=1)]
    db.add_all(religions)
    castes = [CasteMaster(caste_master_id=i, caste_master_name=c) for i, c in enumerate(CASTES, start=1)]
    db.add_all(castes)
    occupations = [OccupationMaster(OccupationID=i, OccupationName=o) for i, o in enumerate(OCCUPATIONS, start=1)]
    db.add_all(occupations)

    db.commit()

    # --- transactional data: 150 cases ---
    accused_master_rows = []  # keep for arrest linking
    for i in range(1, 151):
        unit = random.choice(units)
        district_id = unit.DistrictID
        cat = random.choice(categories)
        cat_code = {"FIR": "1", "UDR": "3", "Zero FIR": "8", "PAR": "4"}[cat.LookupValue]
        year = random.choice([2025, 2026])
        crime_no = f"{cat_code}{district_id:04d}{unit.UnitID:04d}{year}{i:05d}"
        case_no = f"{year}{i:05d}"
        crime_head = random.choice(crime_heads)
        sub_heads = [s for s in crime_sub_heads if s.CrimeHeadID == crime_head.CrimeHeadID]
        sub_head = random.choice(sub_heads)
        reg_date = rand_date()
        officer = random.choice([e for e in employees if e.UnitID == unit.UnitID] or employees)

        case = CaseMaster(
            CaseMasterID=i, CrimeNo=crime_no, CaseNo=case_no,
            CrimeRegisteredDate=reg_date, PolicePersonID=officer.EmployeeID,
            PoliceStationID=unit.UnitID, CaseCategoryID=cat.CaseCategoryID,
            GravityOffenceID=random.choice(gravities).GravityOffenceID,
            CrimeMajorHeadID=crime_head.CrimeHeadID, CrimeMinorHeadID=sub_head.CrimeSubHeadID,
            CaseStatusID=random.choice(statuses).CaseStatusID,
            CourtID=random.choice([c for c in courts if c.DistrictID == district_id] or courts).CourtID,
            IncidentFromDate=datetime.combine(reg_date, datetime.min.time()) - timedelta(hours=random.randint(1, 48)),
            IncidentToDate=datetime.combine(reg_date, datetime.min.time()),
            InfoReceivedPSDate=datetime.combine(reg_date, datetime.min.time()),
            latitude=12.9 + random.uniform(-2, 2), longitude=77.5 + random.uniform(-2, 2),
            BriefFacts=f"Complaint regarding {sub_head.CrimeHeadName.lower()} reported at {unit.UnitName}.",
        )
        db.add(case)

        # complainant
        db.add(ComplainantDetails(
            ComplainantID=i, CaseMasterID=i, ComplainantName=rand_name(),
            AgeYear=random.randint(18, 70), OccupationID=random.choice(occupations).OccupationID,
            ReligionID=random.choice(religions).ReligionID, CasteID=random.choice(castes).caste_master_id,
            GenderID=random.choice([1, 2]),
        ))

        # act-sections (1-3 per case, matching the act pool)
        act_code, _, secs = random.choice(ACTS)
        chosen_secs = random.sample(secs, k=min(len(secs), random.randint(1, 3)))
        for order, sc in enumerate(chosen_secs, start=1):
            db.add(ActSectionAssociation(CaseMasterID=i, ActID=act_code, SectionID=sc,
                                          ActOrderID=1, SectionOrderID=order))

        # victims (0-3)
        for _ in range(random.randint(0, 3)):
            Victim.__table__  # noop reference
        for v in range(random.randint(0, 3)):
            db.add(Victim(CaseMasterID=i, VictimName=rand_name(),
                           AgeYear=random.randint(5, 80), GenderID=random.choice(["M", "F", "T"]),
                           VictimPolice=False))

        # accused (1-4): mix of known-offender pool (creates network links) and one-offs
        n_accused = random.randint(1, 4)
        for p in range(1, n_accused + 1):
            if random.random() < 0.55 and KNOWN_OFFENDERS:
                name = random.choice(KNOWN_OFFENDERS)
            else:
                name = rand_name()
            am_id = len(accused_master_rows) + 1
            acc = Accused(AccusedMasterID=am_id, CaseMasterID=i, AccusedName=name,
                           AgeYear=random.randint(18, 55), GenderID=random.choice(["M", "F"]),
                           PersonID=f"A{p}")
            accused_master_rows.append(acc)
            db.add(acc)
            db.flush()

            if random.random() < 0.5:
                arrest_district = district_id
                db.add(ArrestSurrender(
                    CaseMasterID=i, ArrestSurrenderTypeID=random.choice([1, 2]),
                    ArrestSurrenderDate=reg_date + timedelta(days=random.randint(0, 20)),
                    ArrestSurrenderStateId=1, ArrestSurrenderDistrictId=arrest_district,
                    PoliceStationID=unit.UnitID, IOID=officer.EmployeeID,
                    CourtID=case.CourtID, AccusedMasterID=am_id,
                    IsAccused=True, IsComplainantAccused=False,
                ))

        if i % 25 == 0:
            db.commit()

    db.commit()
    db.close()
    print(f"Seeded {len(units)} units, {len(employees)} employees, 150 cases, "
          f"{len(accused_master_rows)} accused records, {len(KNOWN_OFFENDERS)} known-offender identities.")


if __name__ == "__main__":
    seed()
