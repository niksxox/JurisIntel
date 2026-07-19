"""
Input validation utilities for the Catalyst Crime Analytics AI Module.

Single responsibility: validate every input/output boundary crossing the
NLP, Predictive Analytics, and Explainable AI pipelines before data reaches
Zoho Catalyst DataStore, AppSail-hosted FastAPI endpoints, or Catalyst
Functions background jobs.

Aligns with:
  - Part 1 §12 Development Principles (one responsibility, no hardcoding)
  - Part 2 §10 sql_generator validation (allow-listed tables/columns)
  - Part 2 §12 Security Checklist (parameterized SQL, injection prevention)
  - Part 5 §4  Security Architecture (character allow-list, binary rejection)
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List

# ---------------------------------------------------------------------------
# Configuration: imported from config.py (python-dotenv + Pydantic Settings)
# Never read os.getenv() directly in this module.
# ---------------------------------------------------------------------------
from config import (
    ALLOWED_COLUMNS,
    ALLOWED_ROLES,
    ALLOWED_TABLES,
    MAX_QUERY_LENGTH,
    SUPPORTED_INTENTS,
    SUPPORTED_LANGUAGES,
    VALID_CRIME_TYPES,
    VALID_DISTRICTS,
)

from .exceptions import SQLInjectionError, ValidationError

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
# Letters, numbers, spaces, and basic punctuation used in natural-language
# queries. Rejects binary data, control characters, and shell metacharacters.
_ALLOWED_CHARS_RE = re.compile(r"^[A-Za-z0-9\s.,\-_'\"?():/à-öø-ÿÀ-ÖØ-ß]+$")

# Forbidden SQL keywords — checked with word boundaries to avoid false
# positives on column names that happen to contain these substrings.
_FORBIDDEN_SQL_KEYWORDS: frozenset[str] = frozenset({
    "DROP", "DELETE", "UPDATE", "INSERT", "ALTER",
    "TRUNCATE", "EXEC", "UNION", "CREATE", "GRANT", "REVOKE",
})
_FORBIDDEN_SQL_RE = re.compile(
    r"\b(" + "|".join(_FORBIDDEN_SQL_KEYWORDS) + r")\b",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# JSON / payload validation
# ---------------------------------------------------------------------------
def validate_json_format(data: Any) -> None:
    """Reject malformed JSON and binary payloads."""
    if isinstance(data, (bytes, bytearray)):
        try:
            data = data.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ValidationError("Binary data is not permitted.") from exc
    if not isinstance(data, str):
        raise ValidationError("Payload must be a JSON string.")
    try:
        json.loads(data)
    except json.JSONDecodeError as exc:
        raise ValidationError("Malformed JSON payload.") from exc


def validate_query_length(query: str) -> None:
    """Enforce MAX_QUERY_LENGTH from config.py and reject empty input."""
    if not isinstance(query, str):
        raise ValidationError("Query must be a string.")
    if not query.strip():
        raise ValidationError("Query cannot be empty.")
    if len(query) > MAX_QUERY_LENGTH:
        raise ValidationError(
            f"Query exceeds maximum length of {MAX_QUERY_LENGTH} characters."
        )


def validate_allowed_characters(text: str) -> None:
    """Reject binary data and characters outside the allowed set."""
    if not isinstance(text, str):
        raise ValidationError("Input must be a string.")
    if "\x00" in text:
        raise ValidationError("Binary data is not permitted.")
    if not _ALLOWED_CHARS_RE.match(text):
        raise ValidationError("Input contains disallowed characters.")


# ---------------------------------------------------------------------------
# User / role validation
# ---------------------------------------------------------------------------
def validate_user_id(user_id: str) -> None:
    if not user_id or not isinstance(user_id, str) or not user_id.strip():
        raise ValidationError("Valid user ID is required.")


def validate_user_role(role: str) -> None:
    if not role or role not in ALLOWED_ROLES:
        raise ValidationError(
            f"Invalid role. Allowed roles: {', '.join(ALLOWED_ROLES)}."
        )


# ---------------------------------------------------------------------------
# NLP pipeline validation (language, intent, entities)
# ---------------------------------------------------------------------------
def validate_language(language: str) -> None:
    """Validate language detected by translator.py (Part 2 §7)."""
    if language and language not in SUPPORTED_LANGUAGES:
        raise ValidationError(
            f"Unsupported language: {language}. "
            f"Supported: {', '.join(SUPPORTED_LANGUAGES)}."
        )


def validate_intent(intent: str) -> None:
    """Validate intent classified by intent.py (Part 2 §8)."""
    if intent and intent not in SUPPORTED_INTENTS:
        raise ValidationError(
            f"Unsupported intent: {intent}. "
            f"Supported: {', '.join(SUPPORTED_INTENTS)}."
        )


def validate_extracted_entities(entities: Dict[str, Any]) -> None:
    """Validate entities produced by entity_parser.py (Part 2 §9)."""
    if not isinstance(entities, dict):
        raise ValidationError("Entities must be a dictionary.")

    district = entities.get("district")
    if district and district not in VALID_DISTRICTS:
        raise ValidationError(f"Invalid district: {district}.")

    crime_type = entities.get("crime_type")
    if crime_type and crime_type not in VALID_CRIME_TYPES:
        raise ValidationError(f"Invalid crime type: {crime_type}.")

    # Prediction / XAI entity bounds
    probability = entities.get("probability")
    if probability is not None:
        if not isinstance(probability, (int, float)) or not 0 <= probability <= 1:
            raise ValidationError("Probability must be a number between 0 and 1.")


# ---------------------------------------------------------------------------
# SQL validation — protects Catalyst DataStore (Part 2 §10, Part 5 §4)
# ---------------------------------------------------------------------------
def validate_table_access(table_name: str) -> None:
    """Ensure queries target only allow-listed tables."""
    if table_name.upper() not in ALLOWED_TABLES:
        raise SQLInjectionError(
            f"Access to table '{table_name}' is not permitted. "
            f"Allowed: {', '.join(ALLOWED_TABLES)}."
        )


def validate_column_access(columns: List[str]) -> None:
    """Ensure queries reference only allow-listed columns."""
    for col in columns:
        if col.upper() not in ALLOWED_COLUMNS:
            raise SQLInjectionError(
                f"Access to column '{col}' is not permitted. "
                f"Allowed: {', '.join(ALLOWED_COLUMNS)}."
            )


def validate_generated_sql(sql_query: str, parameters: List[Any]) -> None:
    """
    Enforce parameterized SELECT-only queries against Catalyst DataStore.
    Uses word-boundary matching to avoid false positives on column names.
    """
    if not isinstance(sql_query, str) or not sql_query.strip():
        raise SQLInjectionError("SQL query cannot be empty.")

    upper_sql = sql_query.upper().strip()

    if not upper_sql.startswith("SELECT"):
        raise SQLInjectionError("Only SELECT queries are permitted.")

    match = _FORBIDDEN_SQL_RE.search(upper_sql)
    if match:
        raise SQLInjectionError(
            f"Forbidden SQL keyword detected: {match.group(1)}."
        )

    if parameters and "?" not in sql_query:
        raise SQLInjectionError(
            "Parameterized queries are required when parameters are provided."
        )


# ---------------------------------------------------------------------------
# Composite request validation for the /chat endpoint (Part 2 §4)
# ---------------------------------------------------------------------------
def validate_request_payload(payload: Dict[str, Any]) -> None:
    """
    Validate the full incoming request for FastAPI's /chat endpoint.
    Covers NLP, Predictive Analytics, and XAI entry-point requirements.
    """
    if not isinstance(payload, dict):
        raise ValidationError("Request payload must be a JSON object.")

    # Required fields
    query = payload.get("query")
    if query is None:
        raise ValidationError("Field 'query' is required.")
    validate_query_length(query)
    validate_allowed_characters(query)

    user_id = payload.get("user_id")
    if user_id is None:
        raise ValidationError("Field 'user_id' is required.")
    validate_user_id(user_id)

    role = payload.get("role")
    if role is None:
        raise ValidationError("Field 'role' is required.")
    validate_user_role(role)

    # Optional fields — validated only when present
    if "language" in payload:
        validate_language(payload["language"])
    if "intent" in payload:
        validate_intent(payload["intent"])