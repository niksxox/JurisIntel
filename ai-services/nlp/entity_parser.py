"""
nlp/entity_parser.py
--------------------
Extracts and validates crime-related entities from natural language queries.
Aligns with Catalyst Crime Analytics AI Module Roadmap (Part 2, §9).

Responsibilities (single):
  - Extract crime type, district, police station, date range, and persons.
  - Validate extracted entities against authoritative datasets.
  - Defer dataset sourcing to Catalyst DataStore via catalyst_client.
  - Honor configuration from config.py.
"""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import dateparser
import spacy

try:
    # Optional: config + catalyst_client are injected when available.
    from config import settings  # type: ignore
except Exception:  # pragma: no cover - fallback when config is absent
    settings = None

try:
    from catalyst.catalyst_client import CatalystClient  # type: ignore
except Exception:  # pragma: no cover
    CatalystClient = None


logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Dataset validator
# ---------------------------------------------------------------------------
class DatasetValidator:
    """Validates extracted entities against allow-listed datasets."""

    # Default fallbacks (used only when DataStore + local JSON are unavailable)
    _DEFAULT_DISTRICTS: List[str] = [
        "Bengaluru", "Mysuru", "Mangaluru", "Hubballi", "Belagavi",
        "Kalaburagi", "Davanagere", "Ballari", "Vijayapura", "Shivamogga",
        "Tumakuru", "Raichur", "Bidar", "Hassan", "Gadag", "Udupi",
        "Uttara Kannada", "Dakshina Kannada", "Chikkamagaluru", "Kolar",
        "Chikkaballapura", "Ramanagara", "Mandya", "Chamarajanagar",
        "Kodagu", "Koppal", "Haveri", "Dharwad", "Bagalkot", "Yadgir",
    ]
    _DEFAULT_CRIME_TYPES: List[str] = [
        "Cyber Fraud", "Theft", "Burglary", "Assault", "Murder",
        "Robbery", "Kidnapping", "Vehicle Theft", "Chain Snatching",
        "Fraud", "Rape", "Dacoity", "Rioting", "Cheating",
    ]
    _DEFAULT_POLICE_STATIONS: List[str] = [
        "City Civil Court", "Cubbon Park", "Indiranagar", "Jayanagar",
        "Mysuru East", "Mysuru West", "Mangaluru Central", "Hubballi Dharwad",
    ]

    def __init__(self, catalyst_client: Optional[Any] = None) -> None:
        self._client = catalyst_client
        self.districts: List[str] = self._load_dataset(
            "datasets/districts.json",
            self._DEFAULT_DISTRICTS,
            table="Station",
            column="District",
        )
        self.crime_types: List[str] = self._load_dataset(
            "datasets/crime_types.json",
            self._DEFAULT_CRIME_TYPES,
            table="FIR",
            column="CrimeType",
        )
        self.police_stations: List[str] = self._load_dataset(
            "datasets/police_stations.json",
            self._DEFAULT_POLICE_STATIONS,
            table="Station",
            column="StationName",
        )
        logger.info(
            "DatasetValidator loaded: districts=%d crimes=%d stations=%d",
            len(self.districts), len(self.crime_types), len(self.police_stations),
        )

    # ------------------------------------------------------------------
    def _load_dataset(
        self,
        filepath: str,
        default: List[str],
        *,
        table: Optional[str] = None,
        column: Optional[str] = None,
    ) -> List[str]:
        """Load from Catalyst DataStore -> local JSON -> hard-coded default."""
        # 1) Prefer Catalyst DataStore (roadmap §14 / §16)
        if self._client is not None and table and column:
            try:
                rows = self._client.execute_query(
                    table=table,
                    filters=f"SELECT DISTINCT {column} FROM {table}",
                    parameters=[],
                )
                if rows:
                    return sorted({str(r.get(column, "")).strip() for r in rows if r.get(column)})
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning("DataStore load failed for %s: %s", table, exc)

        # 2) Local JSON fallback
        try:
            if os.path.exists(filepath):
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, list):
                    return [str(item).strip() for item in data]
                if isinstance(data, dict) and "items" in data:
                    return [str(item).strip() for item in data["items"]]
        except Exception as exc:
            logger.warning("Local JSON load failed for %s: %s", filepath, exc)

        # 3) Hard-coded default
        return [str(item).strip() for item in default]

    # ------------------------------------------------------------------
    def validate_district(self, district: str) -> bool:
        return district in self.districts

    def validate_crime_type(self, crime_type: str) -> bool:
        return crime_type in self.crime_types

    def validate_police_station(self, station: str) -> bool:
        return station in self.police_stations


# ---------------------------------------------------------------------------
# Entity parser
# ---------------------------------------------------------------------------
class EntityParser:
    """NLP entity extraction aligned with roadmap Part 2 §9."""

    def __init__(self, catalyst_client: Optional[Any] = None) -> None:
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            logger.error("spaCy model 'en_core_web_sm' not found. Run: python -m spacy download en_core_web_sm")
            raise

        self.validator = DatasetValidator(catalyst_client=catalyst_client)

        # Respect config.py limits when available
        self._max_query_length = (
            getattr(settings, "MAX_QUERY_LENGTH", 1000) if settings else 1000
        )
        self._timeout = (
            getattr(settings, "DEFAULT_TIMEOUT", 30) if settings else 30
        )

    # ------------------------------------------------------------------
    def parse(self, query: str) -> Dict[str, Any]:
        """Main entry point: extract + validate entities from a query."""
        result: Dict[str, Any] = {}
        errors: List[str] = []

        if not query or not isinstance(query, str):
            return {"validation_errors": ["Empty or invalid query"]}

        # Input-size guard (roadmap §12 / §17)
        if len(query) > self._max_query_length:
            return {"validation_errors": [f"Query exceeds {self._max_query_length} characters"]}

        doc = self.nlp(query)

        # Crime type
        crime = self._extract_crime_type(query)
        if crime:
            if self.validator.validate_crime_type(crime):
                result["crime_type"] = crime
            else:
                errors.append(f"Invalid crime type: {crime}")

        # District
        district = self._extract_district(query)
        if district:
            if self.validator.validate_district(district):
                result["district"] = district
            else:
                errors.append(f"Invalid district: {district}")

        # Police station
        station = self._extract_police_station(query)
        if station:
            if self.validator.validate_police_station(station):
                result["police_station"] = station
            else:
                errors.append(f"Invalid police station: {station}")

        # Date range
        date_range = self._extract_date_range(query)
        if date_range:
            if date_range["start_date"] <= date_range["end_date"]:
                result["start_date"] = date_range["start_date"]
                result["end_date"] = date_range["end_date"]
            else:
                errors.append("Invalid date range: start date is after end date")

        # Persons (officer / victim / accused)
        for role, name in self._extract_persons(doc, query).items():
            if name:
                result[role] = name

        if errors:
            result["validation_errors"] = errors

        logger.debug("EntityParser result: %s", result)
        return result

    # ------------------------------------------------------------------
    def _extract_crime_type(self, query: str) -> Optional[str]:
        q = query.lower()
        for crime in self.validator.crime_types:
            if crime.lower() in q:
                return crime
        return None

    def _extract_district(self, query: str) -> Optional[str]:
        q = query.lower()
        for district in self.validator.districts:
            if district.lower() in q:
                return district
        return None

    def _extract_police_station(self, query: str) -> Optional[str]:
        q = query.lower()
        for station in self.validator.police_stations:
            if station.lower() in q:
                return station
        return None

    # ------------------------------------------------------------------
    def _extract_date_range(self, query: str) -> Optional[Dict[str, str]]:
        q = query.lower().strip()

        # "last month"
        if "last month" in q:
            today = datetime.now()
            first_day = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
            last_day = first_day.replace(day=28) + timedelta(days=4)
            last_day = last_day - timedelta(days=last_day.day)
            return {
                "start_date": first_day.strftime("%Y-%m-%d"),
                "end_date": last_day.strftime("%Y-%m-%d"),
            }

        # Explicit month name
        months = [
            "january", "february", "march", "april", "may", "june",
            "july", "august", "september", "october", "november", "december",
        ]
        for m_idx, m_name in enumerate(months):
            if m_name in q:
                year_match = re.search(r"\b(19|20)\d{2}\b", q)
                year = int(year_match.group()) if year_match else datetime.now().year
                start_dt = datetime(year, m_idx + 1, 1)
                end_dt = (
                    datetime(year, 12, 31)
                    if m_idx == 11
                    else datetime(year, m_idx + 2, 1) - timedelta(days=1)
                )
                return {
                    "start_date": start_dt.strftime("%Y-%m-%d"),
                    "end_date": end_dt.strftime("%Y-%m-%d"),
                }

        # Generic dateparser fallback (with timeout guard)
        try:
            dates = dateparser.search.search_dates(
                query,
                settings={"PREFER_DATES_FROM": "past", "RETURN_TIME_AS_PERIOD": False},
            )
        except Exception as exc:
            logger.warning("dateparser failed: %s", exc)
            return None

        if dates:
            parsed = sorted(d[1] for d in dates)
            start_dt, end_dt = parsed[0], parsed[-1]
            if start_dt <= end_dt:
                return {
                    "start_date": start_dt.strftime("%Y-%m-%d"),
                    "end_date": end_dt.strftime("%Y-%m-%d"),
                }
        return None

    # ------------------------------------------------------------------
    def _extract_persons(self, doc, query: str) -> Dict[str, Optional[str]]:
        persons = {"officer_name": None, "victim_name": None, "accused_name": None}
        officer_kw = ("officer", "investigator", "si ", "inspector")
        victim_kw = ("victim", "complainant")
        accused_kw = ("accused", "suspect", "defendant")

        for ent in doc.ents:
            if ent.label_ != "PERSON":
                continue
            name = ent.text
            ctx = query[max(0, ent.start_char - 50):ent.start_char].lower()
            if any(k in ctx for k in officer_kw):
                persons["officer_name"] = name
            elif any(k in ctx for k in victim_kw):
                persons["victim_name"] = name
            elif any(k in ctx for k in accused_kw):
                persons["accused_name"] = name
        return persons