"""
Zoho Catalyst Integration Client

This module serves as the sole communication layer between the AI services 
and Zoho Catalyst. It handles DataStore queries, Functions triggers, 
audit logging, and prediction history, ensuring all interactions are 
secure, parameterized, and resilient (with retry logic).

Aligned with Roadmap:
- Section 10: Zoho Catalyst Services (DataStore, Functions, AppSail compatibility)
- Section 17: Security Principles (Parameterized queries, allow-lists, blocked keywords)
- Section 18: Logging Strategy (Audit logging to DataStore)
"""

import os
import time
import logging
import asyncio
from typing import List, Dict, Any, Optional, Tuple

try:
    import zcatalyst
except ImportError:
    zcatalyst = None

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from config import settings

# -----------------------------------------------------------------------------
# Logging Configuration
# -----------------------------------------------------------------------------
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

# -----------------------------------------------------------------------------
# Security Constants
# -----------------------------------------------------------------------------
ALLOWED_TABLES = {
    "FIR", "Victim", "Accused", "CrimeLocation", 
    "PredictionHistory", "AuditLog"
}

ALLOWED_COLUMNS: Dict[str, set] = {
    "FIR": {
        "fir_id", "crime_type", "district", "police_station", "date", "time", 
        "victim_gender", "crime_category", "latitude", "longitude", "status"
    },
    "Victim": {
        "victim_id", "fir_id", "name", "gender", "age", "address"
    },
    "Accused": {
        "accused_id", "fir_id", "name", "gender", "age", "address"
    },
    "CrimeLocation": {
        "location_id", "fir_id", "latitude", "longitude", "district", "station"
    },
    "PredictionHistory": {
        "prediction_id", "district", "crime_type", "prediction", 
        "probability", "model_version", "timestamp"
    },
    "AuditLog": {
        "log_id", "request_id", "user_id", "role", "endpoint", "intent", 
        "status", "duration_ms", "timestamp", "ip_address", "remarks"
    }
}

BLOCKED_SQL_KEYWORDS = {
    "DROP", "DELETE", "ALTER", "TRUNCATE", "INSERT", "UPDATE", 
    "EXEC", "UNION", "CREATE", "GRANT", "REVOKE", "MERGE"
}


# -----------------------------------------------------------------------------
# Custom Exceptions
# -----------------------------------------------------------------------------
class CatalystConnectionError(Exception):
    """Raised when connection to Zoho Catalyst fails."""
    pass


class CatalystQueryError(Exception):
    """Raised when a Catalyst query or operation fails."""
    pass


# -----------------------------------------------------------------------------
# Catalyst Client
# -----------------------------------------------------------------------------
class CatalystClient:
    """
    Communication layer between AI services and Zoho Catalyst.
    Integrates DataStore, Functions, and supports async FastAPI workflows.
    """

    def __init__(
        self,
        account_id: Optional[str] = None,
        project_id: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: Optional[int] = None
    ):
        self.account_id = account_id or settings.CATALYST_ACCOUNT_ID
        self.project_id = project_id or settings.CATALYST_PROJECT_ID
        self.api_key = api_key or settings.CATALYST_API_KEY
        self.timeout = timeout or settings.DEFAULT_TIMEOUT
        self.max_query_length = settings.MAX_QUERY_LENGTH
        self.max_results = settings.MAX_RESULTS
        
        self.client = None
        self.datastore = None
        self.functions = None
        self._is_connected = False

    # -------------------------------------------------------------------------
    # Connection Management
    # -------------------------------------------------------------------------
    def connect(self) -> None:
        """Establish connection to Zoho Catalyst DataStore and Functions."""
        if not zcatalyst:
            raise CatalystConnectionError("Zoho Catalyst SDK (zcatalyst) is not installed")
        
        if not all([self.account_id, self.project_id, self.api_key]):
            raise CatalystConnectionError("Missing Catalyst credentials. Check .env or config.")

        try:
            self.client = zcatalyst.CatalystClient(
                account_id=self.account_id,
                project_id=self.project_id,
                api_key=self.api_key
            )
            self.datastore = self.client.datastore()
            self.functions = self.client.functions()
            self._is_connected = True
            logger.info("Successfully connected to Catalyst DataStore and Functions")
        except Exception as error:
            logger.error(f"Failed to connect to Catalyst: {str(error)}")
            raise CatalystConnectionError(f"Connection failed: {str(error)}")

    def check_connection(self) -> bool:
        """Verify active connection to Catalyst DataStore."""
        if not self._is_connected or not self.client:
            return False
        try:
            self.datastore.get_tables()
            return True
        except Exception:
            self._is_connected = False
            return False

    def close(self) -> None:
        """Close Catalyst connection and release resources."""
        if self.client:
            try:
                self.client.close()
                self._is_connected = False
                logger.info("Catalyst connection closed cleanly")
            except Exception as error:
                logger.error(f"Error closing Catalyst connection: {str(error)}")
        
        self.client = None
        self.datastore = None
        self.functions = None

    # -------------------------------------------------------------------------
    # Security & Validation
    # -------------------------------------------------------------------------
    def _validate_query(self, table: str, filters: str, parameters: List[Any]) -> None:
        """Validate query for security: allowed tables, blocked keywords, parameterized format."""
        if table not in ALLOWED_TABLES:
            raise CatalystQueryError(f"Table '{table}' is not allowed. Allowed: {ALLOWED_TABLES}")
        
        if filters and len(filters) > self.max_query_length:
            raise CatalystQueryError(f"Query exceeds max length of {self.max_query_length}")
        
        if filters:
            filters_upper = filters.upper()
            for keyword in BLOCKED_SQL_KEYWORDS:
                if keyword in filters_upper:
                    raise CatalystQueryError(f"Blocked SQL keyword detected: {keyword}")
        
        if parameters and "?" not in filters:
            raise CatalystQueryError("Parameterized queries must use '?' placeholders")
        
        if filters and parameters and filters.count("?") != len(parameters):
            raise CatalystQueryError("Placeholder count must match parameter count")

    def _validate_columns(self, table: str, columns: List[str]) -> None:
        """Validate that requested columns are in the allow-list for the table."""
        if table in ALLOWED_COLUMNS and columns:
            invalid = set(columns) - ALLOWED_COLUMNS[table]
            if invalid:
                raise CatalystQueryError(f"Invalid columns for '{table}': {invalid}")

    # -------------------------------------------------------------------------
    # DataStore Operations (Read)
    # -------------------------------------------------------------------------
    def execute_query(
        self,
        table: str,
        filters: str,
        parameters: List[Any],
        columns: Optional[List[str]] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Execute a secure parameterized query against Catalyst DataStore.
        """
        self._validate_query(table, filters, parameters)
        if columns:
            self._validate_columns(table, columns)

        effective_limit = limit or self.max_results

        for attempt in range(3):
            try:
                start_time = time.time()
                table_ref = self.datastore.table(table)
                query_builder = table_ref.search()
                
                if columns:
                    query_builder = query_builder.select(columns)
                if filters:
                    query_builder = query_builder.where(filters, parameters)
                if effective_limit:
                    query_builder = query_builder.limit(effective_limit)

                result = query_builder.execute(timeout=self.timeout)
                execution_time = time.time() - start_time
                logger.info(f"Query on '{table}' completed in {execution_time:.3f}s")

                if isinstance(result, list):
                    return result
                if isinstance(result, dict):
                    return result.get("data", [])
                return []

            except Exception as error:
                logger.warning(f"Query attempt {attempt + 1} failed on '{table}': {str(error)}")
                if attempt == 2:
                    logger.error(f"Query failed after 3 attempts on '{table}'")
                    raise CatalystQueryError(f"Query execution failed: {str(error)}")
                time.sleep(1)

    async def execute_query_async(
        self,
        table: str,
        filters: str,
        parameters: List[Any],
        columns: Optional[List[str]] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Async wrapper for execute_query — required for FastAPI non-blocking I/O."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, 
            lambda: self.execute_query(table, filters, parameters, columns, limit)
        )

    def execute_batch_query(
        self,
        queries: List[Tuple[str, str, List[Any]]]
    ) -> List[List[Dict[str, Any]]]:
        """
        Execute multiple queries in batch for performance optimization.
        Aligns with roadmap requirement: 'Batch database requests'.
        """
        results = []
        for table, filters, parameters in queries:
            try:
                results.append(self.execute_query(table, filters, parameters))
            except Exception as error:
                logger.error(f"Batch query failed for '{table}': {str(error)}")
                results.append([])
        return results

    # -------------------------------------------------------------------------
    # DataStore Operations (Write)
    # -------------------------------------------------------------------------
    def insert_prediction(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a prediction record into PredictionHistory table."""
        required_fields = {"district", "crime_type", "prediction", "probability", "model_version"}
        missing = required_fields - set(data.keys())
        if missing:
            raise CatalystQueryError(f"Missing required fields: {missing}")
        
        data.setdefault("timestamp", int(time.time() * 1000))

        for attempt in range(3):
            try:
                table_ref = self.datastore.table("PredictionHistory")
                result = table_ref.insert(data, timeout=self.timeout)
                logger.info("Prediction record inserted successfully")
                return result
            except Exception as error:
                logger.warning(f"Prediction insert attempt {attempt + 1} failed: {str(error)}")
                if attempt == 2:
                    logger.error("Prediction insert failed after 3 attempts")
                    raise CatalystQueryError(f"Insert prediction failed: {str(error)}")
                time.sleep(1)

    def insert_audit_log(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert an audit log entry into AuditLog table."""
        required_fields = {"request_id", "user_id", "role", "endpoint", "intent", "status", "duration_ms"}
        missing = required_fields - set(data.keys())
        if missing:
            raise CatalystQueryError(f"Missing required audit fields: {missing}")
        
        data.setdefault("timestamp", int(time.time() * 1000))

        for attempt in range(3):
            try:
                table_ref = self.datastore.table("AuditLog")
                result = table_ref.insert(data, timeout=self.timeout)
                logger.info(f"Audit log inserted for request_id: {data.get('request_id')}")
                return result
            except Exception as error:
                logger.warning(f"Audit log insert attempt {attempt + 1} failed: {str(error)}")
                if attempt == 2:
                    logger.error("Audit log insert failed after 3 attempts")
                    raise CatalystQueryError(f"Insert audit log failed: {str(error)}")
                time.sleep(1)

    # -------------------------------------------------------------------------
    # Catalyst Functions (Background Jobs)
    # -------------------------------------------------------------------------
    def trigger_function(
        self, 
        function_name: str, 
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Trigger a Catalyst Function for background jobs.
        Supports: nightly retraining, batch predictions, scheduled evaluations.
        """
        if not self.functions:
            raise CatalystConnectionError("Catalyst Functions service not initialized. Call connect() first.")

        for attempt in range(3):
            try:
                result = self.functions.execute(function_name, data or {}, timeout=self.timeout)
                logger.info(f"Function '{function_name}' triggered successfully")
                return result
            except Exception as error:
                logger.warning(f"Function trigger attempt {attempt + 1} failed: {str(error)}")
                if attempt == 2:
                    logger.error(f"Function '{function_name}' failed after 3 attempts")
                    raise CatalystQueryError(f"Function trigger failed: {str(error)}")
                time.sleep(1)

    # -------------------------------------------------------------------------
    # Schema & Metadata
    # -------------------------------------------------------------------------
    def fetch_schema(self, table: str) -> Dict[str, Any]:
        """Fetch schema metadata for an allowed table."""
        if table not in ALLOWED_TABLES:
            raise CatalystQueryError(f"Table '{table}' is not allowed")

        for attempt in range(3):
            try:
                table_ref = self.datastore.table(table)
                schema = table_ref.get_schema(timeout=self.timeout)
                logger.info(f"Schema fetched for '{table}'")
                return schema
            except Exception as error:
                logger.warning(f"Schema fetch attempt {attempt + 1} failed for '{table}': {str(error)}")
                if attempt == 2:
                    logger.error(f"Schema fetch failed after 3 attempts for '{table}'")
                    raise CatalystQueryError(f"Fetch schema failed: {str(error)}")
                time.sleep(1)

    def fetch_all_tables(self) -> List[str]:
        """Return list of all table names in the DataStore."""
        try:
            tables = self.datastore.get_tables()
            return [t.name if hasattr(t, "name") else str(t) for t in tables]
        except Exception as error:
            logger.error(f"Failed to fetch tables: {str(error)}")
            raise CatalystQueryError(f"Fetch tables failed: {str(error)}")

    # -------------------------------------------------------------------------
    # Context Manager Support
    # -------------------------------------------------------------------------
    def __enter__(self):
        """Context manager entry — auto-connects."""
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit — auto-closes."""
        self.close()
        return False