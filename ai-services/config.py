from typing import Any, List, Literal
from pydantic import ValidationError, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class ConfigurationError(Exception):
    pass

class Settings(BaseSettings):
    
    # Required Environment Variables (Catalyst & Security)
    CATALYST_ACCOUNT_ID: str
    CATALYST_PROJECT_ID: str
    CATALYST_API_KEY: str
    JWT_SECRET: str
    MODEL_DIRECTORY: str
    # Add these to your config.py Settings class
    ZOHO_ZIA_API_KEY: str = ""
    ZOHO_ZIA_API_URL: str = "https://zia.zohoapis.com/zia/api/v1/translate"
    MAX_QUERY_LENGTH: int = 1000
    
    # Validated Environment Variables
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    MAX_QUERY_LENGTH: int = Field(
        default=1000, 
        le=1000, 
        description="Maximum allowed query length in characters"
    )

    # Constants (Hardcoded as per Roadmap Part 2, Section 5)
    SUPPORTED_LANGUAGES: List[str] = ["English", "Kannada"]
    SUPPORTED_INTENTS: List[str] = [
        "SEARCH_FIR",
        "SEARCH_CASE",
        "HOTSPOT_PREDICTION",
        "TREND_ANALYSIS",
        "REPEAT_OFFENDER",
    ]
    
    # Validation & Security Constants (Required by utils/validators.py)
    ALLOWED_ROLES: List[str] = ["Officer", "Investigator", "Administrator"]
    VALID_DISTRICTS: List[str] = ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi", "Belagavi"]
    VALID_CRIME_TYPES: List[str] = ["Theft", "Cyber Fraud", "Assault", "Burglary"]
    ALLOWED_TABLES: List[str] = ["FIR", "VICTIM", "ACCUSED", "STATION"]
    ALLOWED_COLUMNS: List[str] = ["CRIMETYPE", "DISTRICT", "DATE", "STATUS"]

    MAX_RESULTS: int = 100
    DEFAULT_TIMEOUT: int = 30

    model_config = SettingsConfigDict(
        env_file='.env', 
        env_file_encoding='utf-8', 
        case_sensitive=True,
        extra='ignore' # Ignore extra env vars not defined here
    )

    # -----------------------------------------------------------------------------
    # FIX: Allow comma-separated strings from .env to be parsed as Lists
    # -----------------------------------------------------------------------------
    @field_validator(
        "SUPPORTED_LANGUAGES", "SUPPORTED_INTENTS", 
        "ALLOWED_ROLES", "VALID_DISTRICTS", "VALID_CRIME_TYPES", 
        "ALLOWED_TABLES", "ALLOWED_COLUMNS", 
        mode="before"
    )
    @classmethod
    def parse_comma_separated_lists(cls, v: Any) -> Any:
        """
        Pydantic v2 expects JSON arrays for List[str] in .env files.
        This validator allows standard comma-separated strings (e.g., 'A,B,C') 
        to be parsed correctly without breaking JSON arrays.
        """
        if isinstance(v, str):
            if v.strip().startswith("["):
                return v  # Let Pydantic parse the JSON array normally
            return [item.strip() for item in v.split(",") if item.strip()]
        return v

# Instantiate settings and handle validation errors gracefully
try:
    settings = Settings()
except ValidationError as e:
    # Format Pydantic errors into a readable string for the custom exception
    error_messages = []
    for error in e.errors():
        field = error['loc'][0]
        msg = error['msg']
        error_messages.append(f" - {field}: {msg}")
    
    raise ConfigurationError(
        "Configuration validation failed. Please check your .env file:\n" 
        + "\n".join(error_messages)
    )

# -----------------------------------------------------------------------------
# Module-Level Exports 
# -----------------------------------------------------------------------------
# Catalyst & Environment
CATALYST_ACCOUNT_ID = settings.CATALYST_ACCOUNT_ID
CATALYST_PROJECT_ID = settings.CATALYST_PROJECT_ID
CATALYST_API_KEY = settings.CATALYST_API_KEY
JWT_SECRET = settings.JWT_SECRET
MODEL_DIRECTORY = settings.MODEL_DIRECTORY
LOG_LEVEL = settings.LOG_LEVEL
MAX_QUERY_LENGTH = settings.MAX_QUERY_LENGTH

# NLP & Pipeline Constants
SUPPORTED_LANGUAGES = settings.SUPPORTED_LANGUAGES
SUPPORTED_INTENTS = settings.SUPPORTED_INTENTS
MAX_RESULTS = settings.MAX_RESULTS
DEFAULT_TIMEOUT = settings.DEFAULT_TIMEOUT

# Validation & Security Constants (Exported for utils/validators.py)
ALLOWED_ROLES = settings.ALLOWED_ROLES
VALID_DISTRICTS = settings.VALID_DISTRICTS
VALID_CRIME_TYPES = settings.VALID_CRIME_TYPES
ALLOWED_TABLES = settings.ALLOWED_TABLES
ALLOWED_COLUMNS = settings.ALLOWED_COLUMNS