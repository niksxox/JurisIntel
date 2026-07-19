"""
SQL Generator Module
====================
Converts a classified intent + extracted entities into a **secure,
parameterized** SQL query for Catalyst DataStore.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from config import MAX_QUERY_LENGTH

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Allow-lists. (Fixed trailing spaces from original draft)
# ---------------------------------------------------------------------------
ALLOWED_TABLES: set[str] = {"FIR", "Victim", "Accused", "Station"}
ALLOWED_COLUMNS: set[str] = {"CrimeType", "District", "Date", "Status"}

FORBIDDEN_OPERATIONS: set[str] = {
    "DROP", "DELETE", "ALTER", "TRUNCATE", "INSERT", "UPDATE",
}

# Pre-compiled word-boundary pattern to avoid false positives (e.g., "DROPOFF")
_FORBIDDEN_RE = re.compile(
    r"\b(" + "|".join(re.escape(op) for op in FORBIDDEN_OPERATIONS) + r")\b",
    re.IGNORECASE,
)

def _reject_forbidden(text: str, context: str) -> None:
    """Raise ValueError if a forbidden SQL operation is detected."""
    match = _FORBIDDEN_RE.search(text)
    if match:
        logger.warning("Forbidden operation '%s' in %s", match.group(0), context)
        raise ValueError(
            f"Forbidden operation '{match.group(0).upper()}' detected in {context}."
        )

def _resolve_table(intent: str) -> str:
    """Derive the target table from an intent like SEARCH_FIR."""
    raw = intent.strip().split("_")[-1]
    lowered = raw.lower()
    for allowed in ALLOWED_TABLES:
        if allowed.lower() == lowered:
            return allowed
    logger.warning("Table '%s' (from intent '%s') not in allow-list", raw, intent)
    raise ValueError(f"Table '{raw}' derived from intent is not in the allowed tables list.")

def _resolve_column(column: str) -> str:
    """Return the canonical column name if allow-listed, else raise."""
    cleaned = column.strip()
    lowered = cleaned.lower()
    for allowed in ALLOWED_COLUMNS:
        if allowed.lower() == lowered:
            return allowed
    logger.warning("Column '%s' not in allow-list", cleaned)
    raise ValueError(f"Column '{cleaned}' is not in the allowed columns list.")

def generate_secure_sql(intent: str, entities: dict[str, Any]) -> dict[str, Any]:
    """Build a parameterized SELECT query from intent and entities."""
    # --- Input validation ---------------------------------------------------
    if not isinstance(intent, str) or not intent.strip():
        raise ValueError("Intent must be a non-empty string.")
    if not isinstance(entities, dict):
        raise TypeError("Entities must be a dictionary.")

    intent_clean = intent.strip()

    # --- Safety: scan intent for forbidden operations -----------------------
    _reject_forbidden(intent_clean, "intent")
    table_name = _resolve_table(intent_clean)

    # --- Build parameterized WHERE clause -----------------------------------
    conditions: list[str] = []
    parameters: list[Any] = []

    for column, value in entities.items():
        if not isinstance(column, str):
            raise TypeError("Column names must be strings.")

        # Check column name for forbidden operations
        _reject_forbidden(column, f"column name '{column}'")
        canonical_column = _resolve_column(column)

        # Defense-in-depth: Check string values for forbidden operations
        if isinstance(value, str):
            _reject_forbidden(value, f"value for column '{column}'")

        conditions.append(f"{canonical_column}=?")
        parameters.append(value)

    query = f"SELECT * FROM {table_name}"
    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    # --- Enforce configured max query length --------------------------------
    if len(query) > MAX_QUERY_LENGTH:
        raise ValueError(f"Generated query exceeds MAX_QUERY_LENGTH ({MAX_QUERY_LENGTH}).")

    logger.info("SQL generated | intent=%s table=%s params=%d", intent_clean, table_name, len(parameters))
    return {"query": query, "parameters": parameters}