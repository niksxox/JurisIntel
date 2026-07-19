"""
SQLAlchemy models for the Karnataka Police FIR System.
Mirrors Police_FIR_ER_Diagram.pdf exactly: same table names, columns, keys,
and FK relationships. Designed to run on SQLite for the prototype demo and
on PostgreSQL unchanged for production (see schema.sql for the DDL export).
"""
from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime, Boolean, ForeignKey, Text
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


# ---------- Lookup / master tables ----------

class State(Base):
    __tablename__ = "state"
    StateID = Column(Integer, primary_key=True)
    StateName = Column(String, nullable=False)
    NationalityID = Column(Integer)
    Active = Column(Boolean, default=True)


class District(Base):
    __tablename__ = "district"
    DistrictID = Column(Integer, primary_key=True)
    DistrictName = Column(String, nullable=False)
    StateID = Column(Integer, ForeignKey("state.StateID"))
    Active = Column(Boolean, default=True)
    state = relationship("State")


class UnitType(Base):
    __tablename__ = "unit_type"
    UnitTypeID = Column(Integer, primary_key=True)
    UnitTypeName = Column(String, nullable=False)
    CityDistState = Column(String)
    Hierarchy = Column(Integer)
    Active = Column(Boolean, default=True)


class Unit(Base):
    __tablename__ = "unit"
    UnitID = Column(Integer, primary_key=True)
    UnitName = Column(String, nullable=False)
    TypeID = Column(Integer, ForeignKey("unit_type.UnitTypeID"))
    ParentUnit = Column(Integer, ForeignKey("unit.UnitID"))
    NationalityID = Column(Integer)
    StateID = Column(Integer, ForeignKey("state.StateID"))
    DistrictID = Column(Integer, ForeignKey("district.DistrictID"))
    Active = Column(Boolean, default=True)
    ContactPhone = Column(String)
    ContactEmail = Column(String)
    unit_type = relationship("UnitType")
    state = relationship("State")
    district = relationship("District")


class Rank(Base):
    __tablename__ = "rank_master"
    RankID = Column(Integer, primary_key=True)
    RankName = Column(String, nullable=False)
    Hierarchy = Column(Integer)
    Active = Column(Boolean, default=True)


class Designation(Base):
    __tablename__ = "designation"
    DesignationID = Column(Integer, primary_key=True)
    DesignationName = Column(String, nullable=False)
    Active = Column(Boolean, default=True)
    SortOrder = Column(Integer)


class Employee(Base):
    __tablename__ = "employee"
    EmployeeID = Column(Integer, primary_key=True)
    DistrictID = Column(Integer, ForeignKey("district.DistrictID"))
    UnitID = Column(Integer, ForeignKey("unit.UnitID"))
    RankID = Column(Integer, ForeignKey("rank_master.RankID"))
    DesignationID = Column(Integer, ForeignKey("designation.DesignationID"))
    KGID = Column(String)
    FirstName = Column(String, nullable=False)
    EmployeeDOB = Column(Date)
    GenderID = Column(Integer)
    BloodGroupID = Column(Integer)
    PhysicallyChallenged = Column(Boolean, default=False)
    AppointmentDate = Column(Date)
    district = relationship("District")
    unit = relationship("Unit")
    rank = relationship("Rank")
    designation = relationship("Designation")


class CaseCategory(Base):
    __tablename__ = "case_category"
    CaseCategoryID = Column(Integer, primary_key=True)
    LookupValue = Column(String, nullable=False)  # FIR, UDR, PAR, Zero FIR


class GravityOffence(Base):
    __tablename__ = "gravity_offence"
    GravityOffenceID = Column(Integer, primary_key=True)
    LookupValue = Column(String, nullable=False)  # Heinous / Non-Heinous


class CrimeHead(Base):
    __tablename__ = "crime_head"
    CrimeHeadID = Column(Integer, primary_key=True)
    CrimeGroupName = Column(String, nullable=False)
    Active = Column(Boolean, default=True)


class CrimeSubHead(Base):
    __tablename__ = "crime_sub_head"
    CrimeSubHeadID = Column(Integer, primary_key=True)
    CrimeHeadID = Column(Integer, ForeignKey("crime_head.CrimeHeadID"))
    CrimeHeadName = Column(String, nullable=False)  # e.g. Murder, Robbery
    SeqID = Column(Integer)
    crime_head = relationship("CrimeHead")


class CaseStatusMaster(Base):
    __tablename__ = "case_status_master"
    CaseStatusID = Column(Integer, primary_key=True)
    CaseStatusName = Column(String, nullable=False)


class Court(Base):
    __tablename__ = "court"
    CourtID = Column(Integer, primary_key=True)
    CourtName = Column(String, nullable=False)
    DistrictID = Column(Integer, ForeignKey("district.DistrictID"))
    StateID = Column(Integer, ForeignKey("state.StateID"))
    Active = Column(Boolean, default=True)


class Act(Base):
    __tablename__ = "act"
    ActCode = Column(String, primary_key=True)
    ActDescription = Column(String, nullable=False)
    ShortName = Column(String)
    Active = Column(Boolean, default=True)


class Section(Base):
    __tablename__ = "section"
    # composite natural key (ActCode, SectionCode); surrogate PK for simplicity
    id = Column(Integer, primary_key=True, autoincrement=True)
    ActCode = Column(String, ForeignKey("act.ActCode"))
    SectionCode = Column(String, nullable=False)
    SectionDescription = Column(String)
    Active = Column(Boolean, default=True)
    act = relationship("Act")


class CrimeHeadActSection(Base):
    __tablename__ = "crime_head_act_section"
    id = Column(Integer, primary_key=True, autoincrement=True)
    CrimeHeadID = Column(Integer, ForeignKey("crime_head.CrimeHeadID"))
    ActCode = Column(String, ForeignKey("act.ActCode"))
    SectionCode = Column(String)


class ReligionMaster(Base):
    __tablename__ = "religion_master"
    ReligionID = Column(Integer, primary_key=True)
    ReligionName = Column(String, nullable=False)


class CasteMaster(Base):
    __tablename__ = "caste_master"
    caste_master_id = Column(Integer, primary_key=True)
    caste_master_name = Column(String, nullable=False)


class OccupationMaster(Base):
    __tablename__ = "occupation_master"
    OccupationID = Column(Integer, primary_key=True)
    OccupationName = Column(String, nullable=False)


# ---------- Core transactional tables ----------

class CaseMaster(Base):
    __tablename__ = "case_master"
    CaseMasterID = Column(Integer, primary_key=True)
    CrimeNo = Column(String, unique=True, nullable=False)
    CaseNo = Column(String)
    CrimeRegisteredDate = Column(Date)
    PolicePersonID = Column(Integer, ForeignKey("employee.EmployeeID"))
    PoliceStationID = Column(Integer, ForeignKey("unit.UnitID"))
    CaseCategoryID = Column(Integer, ForeignKey("case_category.CaseCategoryID"))
    GravityOffenceID = Column(Integer, ForeignKey("gravity_offence.GravityOffenceID"))
    CrimeMajorHeadID = Column(Integer, ForeignKey("crime_head.CrimeHeadID"))
    CrimeMinorHeadID = Column(Integer, ForeignKey("crime_sub_head.CrimeSubHeadID"))
    CaseStatusID = Column(Integer, ForeignKey("case_status_master.CaseStatusID"))
    CourtID = Column(Integer, ForeignKey("court.CourtID"))
    IncidentFromDate = Column(DateTime)
    IncidentToDate = Column(DateTime)
    InfoReceivedPSDate = Column(DateTime)
    latitude = Column(Float)
    longitude = Column(Float)
    BriefFacts = Column(Text)

    officer = relationship("Employee")
    station = relationship("Unit")
    category = relationship("CaseCategory")
    gravity = relationship("GravityOffence")
    crime_head = relationship("CrimeHead")
    crime_sub_head = relationship("CrimeSubHead")
    status = relationship("CaseStatusMaster")
    court = relationship("Court")

    complainants = relationship("ComplainantDetails", back_populates="case")
    victims = relationship("Victim", back_populates="case")
    accused = relationship("Accused", back_populates="case")
    act_sections = relationship("ActSectionAssociation", back_populates="case")
    arrests = relationship("ArrestSurrender", back_populates="case")
    chargesheets = relationship("ChargesheetDetails", back_populates="case")


class ComplainantDetails(Base):
    __tablename__ = "complainant_details"
    ComplainantID = Column(Integer, primary_key=True)
    CaseMasterID = Column(Integer, ForeignKey("case_master.CaseMasterID"))
    ComplainantName = Column(String, nullable=False)
    AgeYear = Column(Integer)
    OccupationID = Column(Integer, ForeignKey("occupation_master.OccupationID"))
    ReligionID = Column(Integer, ForeignKey("religion_master.ReligionID"))
    CasteID = Column(Integer, ForeignKey("caste_master.caste_master_id"))
    GenderID = Column(Integer)
    case = relationship("CaseMaster", back_populates="complainants")
    occupation = relationship("OccupationMaster")
    religion = relationship("ReligionMaster")
    caste = relationship("CasteMaster")


class ActSectionAssociation(Base):
    __tablename__ = "act_section_association"
    id = Column(Integer, primary_key=True, autoincrement=True)
    CaseMasterID = Column(Integer, ForeignKey("case_master.CaseMasterID"))
    ActID = Column(String, ForeignKey("act.ActCode"))
    SectionID = Column(String)
    ActOrderID = Column(Integer)
    SectionOrderID = Column(Integer)
    case = relationship("CaseMaster", back_populates="act_sections")
    act = relationship("Act")


class Victim(Base):
    __tablename__ = "victim"
    VictimMasterID = Column(Integer, primary_key=True)
    CaseMasterID = Column(Integer, ForeignKey("case_master.CaseMasterID"))
    VictimName = Column(String, nullable=False)
    AgeYear = Column(Integer)
    GenderID = Column(String)
    VictimPolice = Column(Boolean, default=False)
    case = relationship("CaseMaster", back_populates="victims")


class Accused(Base):
    __tablename__ = "accused"
    AccusedMasterID = Column(Integer, primary_key=True)
    CaseMasterID = Column(Integer, ForeignKey("case_master.CaseMasterID"))
    AccusedName = Column(String, nullable=False)
    AgeYear = Column(Integer)
    GenderID = Column(String)
    PersonID = Column(String)  # A1, A2, A3...
    case = relationship("CaseMaster", back_populates="accused")
    arrests = relationship("ArrestSurrender", back_populates="accused_person")


class ArrestSurrender(Base):
    __tablename__ = "arrest_surrender"
    ArrestSurrenderID = Column(Integer, primary_key=True)
    CaseMasterID = Column(Integer, ForeignKey("case_master.CaseMasterID"))
    ArrestSurrenderTypeID = Column(Integer)
    ArrestSurrenderDate = Column(Date)
    ArrestSurrenderStateId = Column(Integer, ForeignKey("state.StateID"))
    ArrestSurrenderDistrictId = Column(Integer, ForeignKey("district.DistrictID"))
    PoliceStationID = Column(Integer, ForeignKey("unit.UnitID"))
    IOID = Column(Integer, ForeignKey("employee.EmployeeID"))
    CourtID = Column(Integer, ForeignKey("court.CourtID"))
    AccusedMasterID = Column(Integer, ForeignKey("accused.AccusedMasterID"))
    IsAccused = Column(Boolean, default=True)
    IsComplainantAccused = Column(Boolean, default=False)
    case = relationship("CaseMaster", back_populates="arrests")
    accused_person = relationship("Accused", back_populates="arrests")
    io = relationship("Employee")


class User(Base):
    """
    Login accounts. Accounts can ONLY be created by an Admin (enforced in the
    API layer, not here) -- there is no public sign-up. `purpose` is the
    reason the user gave for needing access, captured at account-creation
    time for audit purposes (e.g. "Investigation", "Court Liaison").
    """
    __tablename__ = "user_account"
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    salt = Column(String, nullable=False)
    full_name = Column(String)
    role = Column(String, nullable=False)       # Admin | Investigating Officer | Analyst | Public Liaison
    purpose = Column(String)                     # why this account was created
    station_id = Column(Integer, ForeignKey("unit.UnitID"), nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime)
    created_by = Column(String)
    station = relationship("Unit")


class SessionToken(Base):
    __tablename__ = "session_token"
    token = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("user_account.id"))
    created_at = Column(DateTime)
    expires_at = Column(DateTime)
    user = relationship("User")


class WantedPerson(Base):
    """
    Cross-station wanted list. Any station can post; every station sees every
    posting -- that's the "shared" part. `station_id` records who posted it.
    """
    __tablename__ = "wanted_person"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    aliases = Column(String)
    case_id = Column(Integer, ForeignKey("case_master.CaseMasterID"), nullable=True)
    reason = Column(Text)
    danger_level = Column(String)  # Low | Medium | High | Extreme
    last_seen_location = Column(String)
    status = Column(String, default="Active")  # Active | Apprehended | Withdrawn
    posted_by_station_id = Column(Integer, ForeignKey("unit.UnitID"))
    posted_by_user = Column(String)
    created_at = Column(DateTime)
    station = relationship("Unit")
    case = relationship("CaseMaster")


class StationBulletin(Base):
    """Shared noticeboard: any station can post a message every other station sees."""
    __tablename__ = "station_bulletin"
    id = Column(Integer, primary_key=True, autoincrement=True)
    station_id = Column(Integer, ForeignKey("unit.UnitID"))
    author = Column(String)
    subject = Column(String)
    message = Column(Text)
    created_at = Column(DateTime)
    station = relationship("Unit")


class CrimeReviewStat(Base):
    """
    Real Karnataka SCRB monthly crime-review statistics (2021-2024), loaded
    verbatim from CRIME_REVIEW_2021_TO_2024_KARNATAKA.csv. State-level only
    (no district breakdown in the source data) -- used to ground the Trends
    tab in real published figures instead of only synthetic FIR data, until
    live district-level data is connected.
    """
    __tablename__ = "crime_review_stat"
    id = Column(Integer, primary_key=True, autoincrement=True)
    act_category = Column(String)      # normalized: IPC Crime / Special & Local Laws / etc.
    major_head = Column(String)
    minor_head = Column(String)
    month = Column(String)
    year = Column(Integer)
    count_current_month = Column(Integer)


class AuditLog(Base):
    """
    Explainable-AI / access audit trail. Every chatbot turn, NL search, profile
    lookup, and PDF export writes a row here: who asked, what was asked, what
    the system matched it to, and what was returned. This is what makes the
    AI's answers explainable after the fact -- you can always trace a response
    back to the exact filters and case IDs that produced it.
    """
    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime)
    user_role = Column(String)
    user_name = Column(String)
    purpose = Column(String)       # purpose of access declared at login
    action_type = Column(String)   # chat | nl_search | profile_view | pdf_export | scene_reconstruction
    query_text = Column(Text)
    matched_filters = Column(Text)     # JSON string
    referenced_case_ids = Column(Text)  # JSON string, e.g. "[3,17,42]"
    result_summary = Column(Text)


class ChargesheetDetails(Base):
    __tablename__ = "chargesheet_details"
    CSID = Column(Integer, primary_key=True)
    CaseMasterID = Column(Integer, ForeignKey("case_master.CaseMasterID"))
    csdate = Column(DateTime)
    cstype = Column(String)  # A=Chargesheet, B=False Case, C=Undetected
    PolicePersonID = Column(Integer, ForeignKey("employee.EmployeeID"))
    case = relationship("CaseMaster", back_populates="chargesheets")
