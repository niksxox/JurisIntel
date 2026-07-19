"""
Application-wide exception hierarchy for the Catalyst Crime Analytics AI Module.

All exceptions derive from BaseApplicationError so FastAPI can register a
single global handler that returns a standardized JSON envelope:

    {
        "status": "error",
        "code": "<ExceptionClassName>",
        "message": "<user-facing message>"
    }

Internal details (stack traces, SQL, etc.) are kept off the wire and only
written to the AuditLog via the logging layer.
"""
from __future__ import annotations

from typing import Any, Dict, Optional


class BaseApplicationError(Exception):
    """Root of every domain-specific error in the AI module."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        internal_details: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.internal_details = internal_details or message

    def get_api_response(self) -> Dict[str, Any]:
        """Return the standardized JSON envelope for the HTTP response."""
        return {
            "status": "error",
            "code": self.__class__.__name__,
            "message": self.message,
        }

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"{self.__class__.__name__}(status={self.status_code}, msg={self.message!r})"


# ---------------------------------------------------------------------------
# HTTP-aligned errors (4xx)
# ---------------------------------------------------------------------------
class ValidationError(BaseApplicationError):
    """Raised when request payload fails Pydantic / business validation."""

    def __init__(
        self,
        message: str = "Invalid request data.",
        internal_details: Optional[str] = None,
    ) -> None:
        super().__init__(message, status_code=400, internal_details=internal_details)


class AuthenticationError(BaseApplicationError):
    """Raised when the JWT / Zoho auth token is missing or invalid."""

    def __init__(
        self,
        message: str = "Authentication failed.",
        internal_details: Optional[str] = None,
    ) -> None:
        super().__init__(message, status_code=401, internal_details=internal_details)


class AuthorizationError(BaseApplicationError):
    """Raised when the authenticated user lacks the required role."""

    def __init__(
        self,
        message: str = "Insufficient permissions.",
        internal_details: Optional[str] = None,
    ) -> None:
        super().__init__(message, status_code=403, internal_details=internal_details)


class SQLInjectionError(ValidationError):
    """Raised when a query contains disallowed tokens (DROP, DELETE, ...)."""

    def __init__(
        self,
        message: str = "Invalid query structure.",
        internal_details: Optional[str] = None,
    ) -> None:
        super().__init__(message=message, internal_details=internal_details)


# ---------------------------------------------------------------------------
# Server-side errors (5xx)
# ---------------------------------------------------------------------------
class DatabaseError(BaseApplicationError):
    """Raised on Catalyst DataStore failures after retries are exhausted."""

    def __init__(
        self,
        message: str = "Database operation failed.",
        internal_details: Optional[str] = None,
    ) -> None:
        super().__init__(message, status_code=500, internal_details=internal_details)


class ProcessingError(BaseApplicationError):
    """Generic pipeline failure (NLP, feature engineering, etc.)."""

    def __init__(
        self,
        message: str = "Data processing failed.",
        internal_details: Optional[str] = None,
    ) -> None:
        super().__init__(message, status_code=500, internal_details=internal_details)


# ---------------------------------------------------------------------------
# Component-specific errors (degrade gracefully, do NOT crash the request)
# ---------------------------------------------------------------------------
class TranslationError(Exception):
    """Translation service failure — pipeline falls back to the original query."""

    def __init__(self, message: str = "Translation service unavailable.") -> None:
        super().__init__(message)
        self.message = message


class PredictionError(Exception):
    """Prediction engine failure — results are returned without the prediction block."""

    def __init__(self, message: str = "Prediction service unavailable.") -> None:
        super().__init__(message)
        self.message = message


class ExplainabilityError(Exception):
    """SHAP / reasoning failure — prediction is returned without explanation."""

    def __init__(self, message: str = "Explainability service unavailable.") -> None:
        super().__init__(message)
        self.message = message