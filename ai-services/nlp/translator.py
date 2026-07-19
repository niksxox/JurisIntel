"""
Translator Module
=================
Purpose : Detect query language and translate Kannada input to English.
Service : Uses Zoho Zia Translation API.
Scope   : Single responsibility — language detection + translation only.
          DataStore, Functions, AppSail, and Catalyst SDK integrations
          are handled by catalyst_client.py and app.py per roadmap architecture.
"""

import re
import requests
from typing import Dict, Any

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
# Prefer Pydantic Settings from config.py; fall back to dotenv for standalone
# testing so the module never crashes when imported outside the FastAPI app.
try:
    from config import settings  # type: ignore
except ImportError:
    from dotenv import load_dotenv
    load_dotenv()
    import os

    class _FallbackSettings:
        ZOHO_ZIA_API_KEY: str = os.environ.get("ZOHO_ZIA_API_KEY", "")
        ZOHO_ZIA_API_URL: str = os.environ.get(
            "ZOHO_ZIA_API_URL",
            "https://zia.zohoapis.com/zia/api/v1/translate",
        )
        MAX_QUERY_LENGTH: int = int(os.environ.get("MAX_QUERY_LENGTH", "1000"))

    settings = _FallbackSettings()  # type: ignore

# Optional dependency — graceful degradation if langdetect is unavailable
try:
    import langdetect  # type: ignore
    _HAS_LANGDETECT = True
except ImportError:
    _HAS_LANGDETECT = False


# ---------------------------------------------------------------------------
# Language Detection
# ---------------------------------------------------------------------------
def detect_language(raw_query: str) -> str:
    """
    Detect whether the input query is English or Kannada.

    Detection strategy:
      1. Kannada Unicode block (U+0C80–U+0CFF) → 'Kannada'
      2. langdetect library (if installed)
      3. ASCII fallback → 'English'

    Args:
        raw_query: Raw user input string.

    Returns:
        One of 'English', 'Kannada', or 'Unknown'.
    """
    if not isinstance(raw_query, str) or not raw_query.strip():
        return "Unknown"

    # Primary check: Kannada Unicode range
    if re.search(r"[\u0C80-\u0CFF]", raw_query):
        return "Kannada"

    # Secondary check: langdetect library
    if _HAS_LANGDETECT:
        try:
            detected = langdetect.detect(raw_query)
            if detected == "kn":
                return "Kannada"
            if detected == "en":
                return "English"
        except Exception:
            pass

    # Fallback: pure ASCII → assume English
    if raw_query.isascii():
        return "English"

    return "Unknown"


# ---------------------------------------------------------------------------
# Translation
# ---------------------------------------------------------------------------
def translate(query: str, language: str) -> Dict[str, str]:
    """
    Translate a Kannada query to English via the Zoho Zia Translation API.

    Args:
        query:    Text to translate.
        language: Detected source language ('English' | 'Kannada' | other).

    Returns:
        Dict with keys:
          - translated_text   : resulting text (original if translation fails)
          - translation_status: 'SUCCESS' | 'SKIPPED' | 'FAILED'
    """
    if not isinstance(query, str):
        query = str(query) if query is not None else ""

    # English input needs no translation
    if language == "English":
        return {"translated_text": query, "translation_status": "SKIPPED"}

    # Kannada → English via Zoho Zia
    if language == "Kannada":
        api_key = getattr(settings, "ZOHO_ZIA_API_KEY", "")
        api_url = getattr(
            settings,
            "ZOHO_ZIA_API_URL",
            "https://zia.zohoapis.com/zia/api/v1/translate",
        )

        if not api_key:
            return {"translated_text": query, "translation_status": "FAILED"}

        payload = {"text": query, "source": "kn", "target": "en"}
        headers = {
            "Authorization": f"Zoho-oauthtoken {api_key}",
            "Content-Type": "application/json",
        }

        try:
            response = requests.post(
                api_url, json=payload, headers=headers, timeout=10
            )
            response.raise_for_status()
            data = response.json()

            # Zia returns varying response shapes — handle all known formats
            translated_text = (
                data.get("translated_text")
                or data.get("data", {}).get("translatedText")
                or query
            )
            return {"translated_text": translated_text, "translation_status": "SUCCESS"}

        except requests.exceptions.Timeout:
            return {"translated_text": query, "translation_status": "FAILED"}
        except requests.exceptions.RequestException:
            return {"translated_text": query, "translation_status": "FAILED"}
        except (ValueError, KeyError):
            return {"translated_text": query, "translation_status": "FAILED"}

    # Unsupported language — never crash, return original
    return {"translated_text": query, "translation_status": "FAILED"}


# ---------------------------------------------------------------------------
# Normalization
# ---------------------------------------------------------------------------
def normalize(query: str) -> str:
    """
    Normalize translated text: collapse whitespace and enforce MAX_QUERY_LENGTH.

    Args:
        query: Text to normalize.

    Returns:
        Cleaned, length-bounded string.
    """
    if not isinstance(query, str):
        return ""

    normalized = re.sub(r"\s+", " ", query).strip()

    max_length = getattr(settings, "MAX_QUERY_LENGTH", 1000)
    if len(normalized) > max_length:
        normalized = normalized[:max_length]

    return normalized


# ---------------------------------------------------------------------------
# Main Pipeline
# ---------------------------------------------------------------------------
def process(raw_query: str) -> Dict[str, Any]:
    """
    Execute the full translation workflow:
        Detect → Translate → Normalize → Return

    Args:
        raw_query: Raw user input.

    Returns:
        Dict with keys:
          - language          : detected source language
          - translated_query  : final English text
          - translation_status: 'SUCCESS' | 'SKIPPED' | 'FAILED'
    """
    if not isinstance(raw_query, str):
        raw_query = str(raw_query) if raw_query is not None else ""

    if not raw_query.strip():
        return {
            "language": "Unknown",
            "translated_query": "",
            "translation_status": "FAILED",
        }

    language = detect_language(raw_query)
    translation_result = translate(raw_query, language)
    translated_query = normalize(translation_result["translated_text"])

    return {
        "language": language,
        "translated_query": translated_query,
        "translation_status": translation_result["translation_status"],
    }


# ---------------------------------------------------------------------------
# Standalone self-test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    test_queries = [
        "ಬೆಂಗಳೂರುದಲ್ಲಿನ ಸೈಬರ್ ಅಪರಾಧಗಳು",
        "Show cyber frauds in Bengaluru reported last month",
        "ಬೆಂಗಳೂರುದಲ್ಲಿ Show thefts",
        None,
        " ",
        "    ",
        "12345",
        "@#$%^ &*",
    ]

    for query in test_queries:
        result = process(query)
        print(f"Input:  {repr(query)}")
        print(f"Output: {result}")
        print("-" * 60)