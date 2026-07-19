"""
nlp/intent.py
Purpose: Understand user intent using Semantic Similarity.
Architecture Note: Per roadmap Part 1 & 2, this file is strictly scoped to 
Intent Detection. Predictive Analytics (XGBoost), Explainable AI (SHAP), and 
Entity Parsing (spaCy) are handled by their respective dedicated modules.
"""

import json
import logging
from typing import Any

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# Integration with config.py (Pydantic Settings / python-dotenv)
from config import settings

# Fallback definitions in case config.py is missing them during local testing
INTENT_EXAMPLES = {
    "SEARCH_FIR": [
        "Show thefts in Mysore",
        "List all cyber fraud cases in Bengaluru reported last month",
        "Find vehicle theft records in Mangaluru",
        "Get FIR details for assault in Hubli",
        "Show crime records for Karnataka 2021 to 2024"
    ],
    "SEARCH_CASE": [
        "Find accused details for case number 12345",
        "Who is the accused in the recent robbery case",
        "Get victim and accused information for this FIR",
        "Search for suspect names in fraud cases",
        "Retrieve case files for the accused person"
    ],
    "HOTSPOT_PREDICTION": [
        "Predict tomorrow's hotspot in Bengaluru",
        "Which district is likely to become a crime hotspot next month",
        "Forecast areas with high cyber crime risk next week",
        "Predict burglary hotspots in Mysore",
        "Where will the next crime spike occur in Karnataka"
    ],
    "TREND_ANALYSIS": [
        "Crime trends in Karnataka over the last 3 years",
        "Analyze the increase in vehicle thefts this year",
        "Show me the trend of cyber frauds in Bengaluru",
        "What are the emerging crime patterns in Mysore",
        "Statistical analysis of crime rates in Karnataka 2021 to 2024"
    ],
    "REPEAT_OFFENDER": [
        "Is this accused likely to become a repeat offender",
        "Predict repeat offender probability for suspect ID 987",
        "List individuals with high repeat offense risk",
        "Calculate recidivism risk for the current accused",
        "Identify potential repeat offenders in the database"
    ]
}

# Zoho Catalyst SDK integration for Audit Logging & Functions
# Using a flexible import to prevent local crashes if the SDK is not yet installed
CATALYST_SDK_AVAILABLE = False
try:
    import catalyst_sdk  # type: ignore
    CATALYST_SDK_AVAILABLE = True
    logging.info("Zoho Catalyst SDK loaded successfully.")
except ImportError:
    logging.warning("Zoho Catalyst SDK not found. Audit logging to DataStore will be disabled until installed.")

logger = logging.getLogger(__name__)


class IntentDetector:
    """
    Detects user intent using Sentence Transformers and Cosine Similarity.
    Integrates with Catalyst DataStore for mandatory audit logging.
    """

    def __init__(self) -> None:
        # Get model name from config, with a safe, valid Hugging Face fallback
        raw_model_name = getattr(settings, 'MODEL_DIRECTORY', None)
        
        # Safety check: ensure it's a valid model name and not a broken path
        if not raw_model_name or raw_model_name == "sentence-transformers/models":
            model_name = "all-MiniLM-L6-v2"
        else:
            model_name = raw_model_name
            
        self.model = SentenceTransformer(model_name)
        
        # Load intents and thresholds from centralized configuration
        self.intent_examples = getattr(settings, 'INTENT_EXAMPLES', INTENT_EXAMPLES)
        self.confidence_threshold = getattr(settings, 'CONFIDENCE_THRESHOLD', 0.70)
        self.fallback_intent = getattr(settings, 'FALLBACK_INTENT', "SEARCH_FIR")
        
        self.example_texts: list[str] = []
        self.example_intents: list[str] = []
        
        self._build_embeddings()

    def _build_embeddings(self) -> None:
        """Pre-compute embeddings for all intent examples."""
        for intent, examples in self.intent_examples.items():
            for example in examples:
                # .strip() ensures no trailing spaces mess up the embeddings or output
                self.example_texts.append(example.strip())
                self.example_intents.append(intent.strip())
                
        self.example_embeddings = self.model.encode(
            self.example_texts, convert_to_numpy=True
        )

    def detect_intent(
        self, 
        user_query: str, 
        user_id: str | None = None, 
        role: str | None = None
    ) -> dict[str, Any]:
        """
        Main entry point for intent detection.
        Supports routing to Predictive Analytics and Explainable AI pipelines.
        """
        if not user_query or not user_query.strip():
            return self._format_response(self.fallback_intent, 0.0)

        query_embedding = self.model.encode([user_query.strip()], convert_to_numpy=True)[0]
        similarities = cosine_similarity(
            query_embedding.reshape(1, -1), self.example_embeddings
        )[0]

        max_similarity_index = int(np.argmax(similarities))
        max_confidence = float(similarities[max_similarity_index])
        predicted_intent = self.example_intents[max_similarity_index]

        if max_confidence < self.confidence_threshold:
            predicted_intent = self.fallback_intent

        result = self._format_response(predicted_intent, max_confidence)

        # Mandatory Audit Logging to Catalyst DataStore (Roadmap Part 1, Sec 17 & 18)
        if user_id:
            self._log_to_catalyst_datastore(user_query, result, user_id, role)

        return result

    def _format_response(self, intent: str, confidence: float) -> dict[str, Any]:
        """Standardize the output format."""
        return {
            "intent": intent,
            "confidence": round(confidence, 4)
        }

    def _log_to_catalyst_datastore(
        self, query: str, result: dict[str, Any], user_id: str, role: str | None
    ) -> None:
        """
        Integrates with Zoho Catalyst DataStore for mandatory audit logging.
        """
        if not CATALYST_SDK_AVAILABLE:
            return

        try:
            # Catalyst SDK DataStore integration
            # In production, this uses the CatalystClient wrapper to insert into AuditLog
            log_payload = {
                "User_ID": user_id,
                "Role": role or "Unknown",
                "Intent": result["intent"],
                "Confidence": result["confidence"],
                "Query": query,
                "Status": "Success"
            }
            logger.info(f"Audit Log Prepared for Catalyst DataStore: {log_payload}")
            # catalyst_client.insert_audit_log(log_payload) # Uncomment when CatalystClient is initialized
        except Exception as e:
            logger.error(f"Catalyst DataStore logging failed: {e}")

    def trigger_background_function(self, event_type: str) -> None:
        """
        Integrates with Zoho Catalyst Functions for background tasks.
        Example: Triggering nightly model retraining or batch predictions.
        (Roadmap Part 1, Section 10 & 11)
        """
        if not CATALYST_SDK_AVAILABLE:
            return

        try:
            logger.info(f"Triggering Catalyst Function for event: {event_type}")
            # catalyst_functions.invoke(event_type) # Uncomment when Catalyst Functions client is initialized
        except Exception as e:
            logger.error(f"Catalyst Functions trigger failed: {e}")


if __name__ == "__main__":
    # Note: AppSail (FastAPI) handles the actual HTTP routing in app.py.
    # This block is for local testing only.
    logging.basicConfig(level=logging.INFO)
    
    detector = IntentDetector()
    test_queries = [
        "Show thefts in Mysore",
        "Predict tomorrow's hotspot",
        "Find accused details",
        "Crime trends in Karnataka",
        "Is this person going to commit crime again",
        "What is the weather like today" # Should trigger FALLBACK_INTENT
    ]

    for query in test_queries:
        result = detector.detect_intent(query, user_id="TEST_USER_123", role="Investigator")
        print(json.dumps({"query": query, "result": result}, indent=4))