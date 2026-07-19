import sys
import os

if __name__ == "__main__":
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import time
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

# Import credentials directly from config.py
from config import (
    LOG_LEVEL, 
    DEFAULT_TIMEOUT, 
    CATALYST_ACCOUNT_ID, 
    CATALYST_PROJECT_ID, 
    CATALYST_API_KEY
)

try:
    from utils.exceptions import BaseApplicationError
except ImportError:
    class BaseApplicationError(Exception):
        def __init__(self, message="Application error"):
            self.message = message
            super().__init__(self.message)

logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("crime_analytics_audit")


class AuditLogger:
    def __init__(self) -> None:
        self.request_id: str = str(uuid.uuid4())
        self.start_time: float = time.time()
        self.user_id: Optional[str] = None
        self.role: Optional[str] = None
        self.endpoint: Optional[str] = None
        self.intent: Optional[str] = None
        self.prediction_status: Optional[str] = None
        self.status: str = "pending"
        self.ip_address: Optional[str] = None
        self.remarks: Optional[str] = None
        self.error_message: Optional[str] = None

    def set_user_context(self, user_id: str, role: str) -> None:
        self.user_id = user_id
        self.role = role

    def set_endpoint(self, endpoint: str) -> None:
        self.endpoint = endpoint

    def set_ip_address(self, ip_address: str) -> None:
        self.ip_address = ip_address

    def set_intent(self, intent: str) -> None:
        self.intent = intent

    def set_prediction_status(self, prediction_status: str) -> None:
        self.prediction_status = prediction_status

    def set_remarks(self, remarks: str) -> None:
        self.remarks = remarks

    def mark_success(self) -> None:
        self.status = "success"

    def mark_failure(self, error: Exception) -> None:
        self.status = "failure"
        if isinstance(error, BaseApplicationError):
            self.error_message = error.message
        else:
            self.error_message = "An unexpected error occurred."
        
        if not self.remarks and self.error_message:
            self.remarks = self.error_message

    def get_execution_time_ms(self) -> float:
        return round((time.time() - self.start_time) * 1000, 2)

    def generate_audit_record(self) -> Dict[str, Any]:
        return {
            "request_id": self.request_id,
            "user_id": self.user_id or "Unknown",
            "role": self.role or "Unknown",
            "endpoint": self.endpoint or "Unknown",
            "intent": self.intent or "Unknown",
            "status": self.status,
            "duration_ms": self.get_execution_time_ms(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ip_address": self.ip_address or "Unknown",
            "remarks": self.remarks or ("Success" if self.status == "success" else "Error"),
            "prediction_status": self.prediction_status,
            "error": self.error_message
        }

    def log_api_call(self) -> None:
        record = self.generate_audit_record()
        log_message = f"AuditLog: {record}"

        if self.status == "failure":
            logger.error(log_message)
        else:
            logger.info(log_message)

        try:
            from catalyst.catalyst_client import CatalystClient
            
            # FIX: Pass credentials from config.py so os.getenv() isn't needed
            client = CatalystClient(
                account_id=CATALYST_ACCOUNT_ID,
                project_id=CATALYST_PROJECT_ID,
                api_key=CATALYST_API_KEY,
                timeout=DEFAULT_TIMEOUT
            )
            
            if not client._is_connected:
                client.connect()
                
            client.insert_audit_log(record) 
            
        except Exception as persist_err:
            logger.error(f"Failed to persist AuditLog to Catalyst DataStore: {persist_err}")


def get_new_audit_logger() -> AuditLogger:
    return AuditLogger()


if __name__ == "__main__":
    print("Running direct logger test...")
    test_logger = get_new_audit_logger()
    
    test_logger.set_user_context("INV001", "Investigator")
    test_logger.set_endpoint("/chat")
    test_logger.set_ip_address("127.0.0.1")
    test_logger.set_intent("HOTSPOT_PREDICTION")
    test_logger.set_prediction_status("High Risk")
    test_logger.mark_success()
    
    test_logger.log_api_call() 
    print("✅ Direct execution test completed.")