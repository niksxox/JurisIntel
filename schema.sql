CREATE TABLE act (
	"ActCode" VARCHAR NOT NULL, 
	"ActDescription" VARCHAR NOT NULL, 
	"ShortName" VARCHAR, 
	"Active" BOOLEAN, 
	PRIMARY KEY ("ActCode")
);

CREATE TABLE case_category (
	"CaseCategoryID" INTEGER NOT NULL, 
	"LookupValue" VARCHAR NOT NULL, 
	PRIMARY KEY ("CaseCategoryID")
);

CREATE TABLE case_status_master (
	"CaseStatusID" INTEGER NOT NULL, 
	"CaseStatusName" VARCHAR NOT NULL, 
	PRIMARY KEY ("CaseStatusID")
);

CREATE TABLE caste_master (
	caste_master_id INTEGER NOT NULL, 
	caste_master_name VARCHAR NOT NULL, 
	PRIMARY KEY (caste_master_id)
);

CREATE TABLE crime_head (
	"CrimeHeadID" INTEGER NOT NULL, 
	"CrimeGroupName" VARCHAR NOT NULL, 
	"Active" BOOLEAN, 
	PRIMARY KEY ("CrimeHeadID")
);

CREATE TABLE designation (
	"DesignationID" INTEGER NOT NULL, 
	"DesignationName" VARCHAR NOT NULL, 
	"Active" BOOLEAN, 
	"SortOrder" INTEGER, 
	PRIMARY KEY ("DesignationID")
);

CREATE TABLE gravity_offence (
	"GravityOffenceID" INTEGER NOT NULL, 
	"LookupValue" VARCHAR NOT NULL, 
	PRIMARY KEY ("GravityOffenceID")
);

CREATE TABLE occupation_master (
	"OccupationID" INTEGER NOT NULL, 
	"OccupationName" VARCHAR NOT NULL, 
	PRIMARY KEY ("OccupationID")
);

CREATE TABLE rank_master (
	"RankID" INTEGER NOT NULL, 
	"RankName" VARCHAR NOT NULL, 
	"Hierarchy" INTEGER, 
	"Active" BOOLEAN, 
	PRIMARY KEY ("RankID")
);

CREATE TABLE religion_master (
	"ReligionID" INTEGER NOT NULL, 
	"ReligionName" VARCHAR NOT NULL, 
	PRIMARY KEY ("ReligionID")
);

CREATE TABLE state (
	"StateID" INTEGER NOT NULL, 
	"StateName" VARCHAR NOT NULL, 
	"NationalityID" INTEGER, 
	"Active" BOOLEAN, 
	PRIMARY KEY ("StateID")
);

CREATE TABLE unit_type (
	"UnitTypeID" INTEGER NOT NULL, 
	"UnitTypeName" VARCHAR NOT NULL, 
	"CityDistState" VARCHAR, 
	"Hierarchy" INTEGER, 
	"Active" BOOLEAN, 
	PRIMARY KEY ("UnitTypeID")
);

CREATE TABLE crime_head_act_section (
	id INTEGER NOT NULL, 
	"CrimeHeadID" INTEGER, 
	"ActCode" VARCHAR, 
	"SectionCode" VARCHAR, 
	PRIMARY KEY (id), 
	FOREIGN KEY("CrimeHeadID") REFERENCES crime_head ("CrimeHeadID"), 
	FOREIGN KEY("ActCode") REFERENCES act ("ActCode")
);

CREATE TABLE crime_sub_head (
	"CrimeSubHeadID" INTEGER NOT NULL, 
	"CrimeHeadID" INTEGER, 
	"CrimeHeadName" VARCHAR NOT NULL, 
	"SeqID" INTEGER, 
	PRIMARY KEY ("CrimeSubHeadID"), 
	FOREIGN KEY("CrimeHeadID") REFERENCES crime_head ("CrimeHeadID")
);

CREATE TABLE district (
	"DistrictID" INTEGER NOT NULL, 
	"DistrictName" VARCHAR NOT NULL, 
	"StateID" INTEGER, 
	"Active" BOOLEAN, 
	PRIMARY KEY ("DistrictID"), 
	FOREIGN KEY("StateID") REFERENCES state ("StateID")
);

CREATE TABLE section (
	id INTEGER NOT NULL, 
	"ActCode" VARCHAR, 
	"SectionCode" VARCHAR NOT NULL, 
	"SectionDescription" VARCHAR, 
	"Active" BOOLEAN, 
	PRIMARY KEY (id), 
	FOREIGN KEY("ActCode") REFERENCES act ("ActCode")
);

CREATE TABLE court (
	"CourtID" INTEGER NOT NULL, 
	"CourtName" VARCHAR NOT NULL, 
	"DistrictID" INTEGER, 
	"StateID" INTEGER, 
	"Active" BOOLEAN, 
	PRIMARY KEY ("CourtID"), 
	FOREIGN KEY("DistrictID") REFERENCES district ("DistrictID"), 
	FOREIGN KEY("StateID") REFERENCES state ("StateID")
);

CREATE TABLE unit (
	"UnitID" INTEGER NOT NULL, 
	"UnitName" VARCHAR NOT NULL, 
	"TypeID" INTEGER, 
	"ParentUnit" INTEGER, 
	"NationalityID" INTEGER, 
	"StateID" INTEGER, 
	"DistrictID" INTEGER, 
	"Active" BOOLEAN, 
	PRIMARY KEY ("UnitID"), 
	FOREIGN KEY("TypeID") REFERENCES unit_type ("UnitTypeID"), 
	FOREIGN KEY("ParentUnit") REFERENCES unit ("UnitID"), 
	FOREIGN KEY("StateID") REFERENCES state ("StateID"), 
	FOREIGN KEY("DistrictID") REFERENCES district ("DistrictID")
);

CREATE TABLE employee (
	"EmployeeID" INTEGER NOT NULL, 
	"DistrictID" INTEGER, 
	"UnitID" INTEGER, 
	"RankID" INTEGER, 
	"DesignationID" INTEGER, 
	"KGID" VARCHAR, 
	"FirstName" VARCHAR NOT NULL, 
	"EmployeeDOB" DATE, 
	"GenderID" INTEGER, 
	"BloodGroupID" INTEGER, 
	"PhysicallyChallenged" BOOLEAN, 
	"AppointmentDate" DATE, 
	PRIMARY KEY ("EmployeeID"), 
	FOREIGN KEY("DistrictID") REFERENCES district ("DistrictID"), 
	FOREIGN KEY("UnitID") REFERENCES unit ("UnitID"), 
	FOREIGN KEY("RankID") REFERENCES rank_master ("RankID"), 
	FOREIGN KEY("DesignationID") REFERENCES designation ("DesignationID")
);

CREATE TABLE case_master (
	"CaseMasterID" INTEGER NOT NULL, 
	"CrimeNo" VARCHAR NOT NULL, 
	"CaseNo" VARCHAR, 
	"CrimeRegisteredDate" DATE, 
	"PolicePersonID" INTEGER, 
	"PoliceStationID" INTEGER, 
	"CaseCategoryID" INTEGER, 
	"GravityOffenceID" INTEGER, 
	"CrimeMajorHeadID" INTEGER, 
	"CrimeMinorHeadID" INTEGER, 
	"CaseStatusID" INTEGER, 
	"CourtID" INTEGER, 
	"IncidentFromDate" DATETIME, 
	"IncidentToDate" DATETIME, 
	"InfoReceivedPSDate" DATETIME, 
	latitude FLOAT, 
	longitude FLOAT, 
	"BriefFacts" TEXT, 
	PRIMARY KEY ("CaseMasterID"), 
	UNIQUE ("CrimeNo"), 
	FOREIGN KEY("PolicePersonID") REFERENCES employee ("EmployeeID"), 
	FOREIGN KEY("PoliceStationID") REFERENCES unit ("UnitID"), 
	FOREIGN KEY("CaseCategoryID") REFERENCES case_category ("CaseCategoryID"), 
	FOREIGN KEY("GravityOffenceID") REFERENCES gravity_offence ("GravityOffenceID"), 
	FOREIGN KEY("CrimeMajorHeadID") REFERENCES crime_head ("CrimeHeadID"), 
	FOREIGN KEY("CrimeMinorHeadID") REFERENCES crime_sub_head ("CrimeSubHeadID"), 
	FOREIGN KEY("CaseStatusID") REFERENCES case_status_master ("CaseStatusID"), 
	FOREIGN KEY("CourtID") REFERENCES court ("CourtID")
);

CREATE TABLE accused (
	"AccusedMasterID" INTEGER NOT NULL, 
	"CaseMasterID" INTEGER, 
	"AccusedName" VARCHAR NOT NULL, 
	"AgeYear" INTEGER, 
	"GenderID" VARCHAR, 
	"PersonID" VARCHAR, 
	PRIMARY KEY ("AccusedMasterID"), 
	FOREIGN KEY("CaseMasterID") REFERENCES case_master ("CaseMasterID")
);

CREATE TABLE act_section_association (
	id INTEGER NOT NULL, 
	"CaseMasterID" INTEGER, 
	"ActID" VARCHAR, 
	"SectionID" VARCHAR, 
	"ActOrderID" INTEGER, 
	"SectionOrderID" INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY("CaseMasterID") REFERENCES case_master ("CaseMasterID"), 
	FOREIGN KEY("ActID") REFERENCES act ("ActCode")
);

CREATE TABLE chargesheet_details (
	"CSID" INTEGER NOT NULL, 
	"CaseMasterID" INTEGER, 
	csdate DATETIME, 
	cstype VARCHAR, 
	"PolicePersonID" INTEGER, 
	PRIMARY KEY ("CSID"), 
	FOREIGN KEY("CaseMasterID") REFERENCES case_master ("CaseMasterID"), 
	FOREIGN KEY("PolicePersonID") REFERENCES employee ("EmployeeID")
);

CREATE TABLE complainant_details (
	"ComplainantID" INTEGER NOT NULL, 
	"CaseMasterID" INTEGER, 
	"ComplainantName" VARCHAR NOT NULL, 
	"AgeYear" INTEGER, 
	"OccupationID" INTEGER, 
	"ReligionID" INTEGER, 
	"CasteID" INTEGER, 
	"GenderID" INTEGER, 
	PRIMARY KEY ("ComplainantID"), 
	FOREIGN KEY("CaseMasterID") REFERENCES case_master ("CaseMasterID"), 
	FOREIGN KEY("OccupationID") REFERENCES occupation_master ("OccupationID"), 
	FOREIGN KEY("ReligionID") REFERENCES religion_master ("ReligionID"), 
	FOREIGN KEY("CasteID") REFERENCES caste_master (caste_master_id)
);

CREATE TABLE victim (
	"VictimMasterID" INTEGER NOT NULL, 
	"CaseMasterID" INTEGER, 
	"VictimName" VARCHAR NOT NULL, 
	"AgeYear" INTEGER, 
	"GenderID" VARCHAR, 
	"VictimPolice" BOOLEAN, 
	PRIMARY KEY ("VictimMasterID"), 
	FOREIGN KEY("CaseMasterID") REFERENCES case_master ("CaseMasterID")
);

CREATE TABLE arrest_surrender (
	"ArrestSurrenderID" INTEGER NOT NULL, 
	"CaseMasterID" INTEGER, 
	"ArrestSurrenderTypeID" INTEGER, 
	"ArrestSurrenderDate" DATE, 
	"ArrestSurrenderStateId" INTEGER, 
	"ArrestSurrenderDistrictId" INTEGER, 
	"PoliceStationID" INTEGER, 
	"IOID" INTEGER, 
	"CourtID" INTEGER, 
	"AccusedMasterID" INTEGER, 
	"IsAccused" BOOLEAN, 
	"IsComplainantAccused" BOOLEAN, 
	PRIMARY KEY ("ArrestSurrenderID"), 
	FOREIGN KEY("CaseMasterID") REFERENCES case_master ("CaseMasterID"), 
	FOREIGN KEY("ArrestSurrenderStateId") REFERENCES state ("StateID"), 
	FOREIGN KEY("ArrestSurrenderDistrictId") REFERENCES district ("DistrictID"), 
	FOREIGN KEY("PoliceStationID") REFERENCES unit ("UnitID"), 
	FOREIGN KEY("IOID") REFERENCES employee ("EmployeeID"), 
	FOREIGN KEY("CourtID") REFERENCES court ("CourtID"), 
	FOREIGN KEY("AccusedMasterID") REFERENCES accused ("AccusedMasterID")
);
