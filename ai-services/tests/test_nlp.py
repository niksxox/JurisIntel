"""
NLP Module Test Suite
Covers: Translator, Intent Detection, Entity Parser, SQL Generator, and Integration.
Based on Phase 1 Testing Checklist.
"""
import pytest
from unittest.mock import patch, MagicMock
import sys
import os

# Add project root to PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from app import app
from nlp.translator import detect_language, translate, process
from nlp.intent import detect_intent
from nlp.entity_parser import parse_entities
from nlp.sql_generator import generate_sql

client = TestClient(app)


# ==========================================
# 1. Translator Tests
# ==========================================
class TestTranslator:
    def test_detect_english(self):
        query = "Show cyber frauds in Bengaluru"
        assert detect_language(query) == "English"

    def test_detect_kannada(self):
        query = "ಬೆಂಗಳೂರುದಲ್ಲಿನ ಸೈಬರ್ ಅಪರಾಧಗಳು"
        assert detect_language(query) == "Kannada"

    def test_detect_mixed_language(self):
        query = "Show ಬೆಂಗಳೂರು cyber frauds"
        # Should detect Kannada unicode presence or fallback gracefully
        lang = detect_language(query)
        assert lang in ["English", "Kannada"]

    @patch('nlp.translator.zia_translate_api')  # Mocking external Zoho Zia API
    def test_translate_kannada_to_english(self, mock_translate):
        mock_translate.return_value = "Cyber crimes in Bengaluru"
        result = translate("ಬೆಂಗಳೂರುದಲ್ಲಿನ ಸೈಬರ್ ಅಪರಾಧಗಳು")
        assert result == "Cyber crimes in Bengaluru"

    def test_process_pipeline_success(self):
        # Mock translation for pipeline test
        with patch('nlp.translator.translate', return_value="Cyber crimes in Bengaluru"):
            result = process("ಬೆಂಗಳೂರುದಲ್ಲಿನ ಸೈಬರ್ ಅಪರಾಧಗಳು")
            assert result["language"] == "Kannada"
            assert result["translated_query"] == "Cyber crimes in Bengaluru"


# ==========================================
# 2. Intent Detection Tests
# ==========================================
class TestIntentDetection:
    def test_correct_intent_search_fir(self):
        result = detect_intent("Show thefts in Mysore")
        assert result["intent"] == "SEARCH_FIR"
        assert result["confidence"] >= 0.70

    def test_correct_intent_hotspot_prediction(self):
        result = detect_intent("Predict tomorrow's hotspot")
        assert result["intent"] == "HOTSPOT_PREDICTION"

    def test_low_confidence_fallback(self):
        # Unknown query should fallback to SEARCH_FIR as per roadmap
        result = detect_intent("xyz abc random gibberish")
        assert result["intent"] == "SEARCH_FIR"


# ==========================================
# 3. Entity Parser Tests
# ==========================================
class TestEntityParser:
    def test_extract_district_and_crime(self):
        entities = parse_entities("Show cyber frauds in Bengaluru during January")
        assert entities["district"] == "Bengaluru"
        assert entities["crime_type"] == "Cyber Fraud"
        assert "start_date" in entities
        assert "end_date" in entities

    def test_date_resolution_last_month(self):
        entities = parse_entities("Show crimes last month")
        assert entities["start_date"] is not None
        assert entities["end_date"] is not None
        # Ensure dates are properly formatted strings
        assert len(entities["start_date"]) == 10  # YYYY-MM-DD


# ==========================================
# 4. SQL Generator Tests
# ==========================================
class TestSQLGenerator:
    def test_valid_sql_generation(self):
        intent = "SEARCH_FIR"
        entities = {"district": "Bengaluru", "crime_type": "Cyber Fraud"}
        sql, params = generate_sql(intent, entities)
        
        assert "SELECT" in sql.upper()
        assert "FIR" in sql.upper()
        assert "Cyber Fraud" in params
        assert "Bengaluru" in params

    def test_injection_blocked(self):
        intent = "SEARCH_FIR"
        # Malicious payload
        entities = {"district": "Bengaluru'; DROP TABLE FIR; --"}
        sql, params = generate_sql(intent, entities)
        
        # Generator should use parameterized queries, not string concatenation
        assert "DROP" not in sql.upper()
        assert "Bengaluru'; DROP TABLE FIR; --" in params  # Passed safely as parameter


# ==========================================
# 5. Integration Tests (End-to-End)
# ==========================================
class TestIntegration:
    @patch('nlp.translator.process')
    @patch('nlp.intent.detect_intent')
    @patch('nlp.entity_parser.parse_entities')
    @patch('nlp.sql_generator.generate_sql')
    @patch('catalyst.catalyst_client.CatalystClient.execute_query')
    def test_chat_endpoint_pipeline(self, mock_query, mock_sql, mock_entities, mock_intent, mock_process):
        # Mock Pipeline Steps
        mock_process.return_value = {"language": "English", "translated_query": "Show thefts"}
        mock_intent.return_value = {"intent": "SEARCH_FIR", "confidence": 0.95}
        mock_entities.return_value = {"district": "Mysore", "crime_type": "Theft"}
        mock_sql.return_value = ("SELECT * FROM FIR WHERE District=?", ["Mysore"])
        mock_query.return_value = [{"FIR_ID": 1, "CrimeType": "Theft"}]

        response = client.post("/chat", json={
            "query": "Show thefts in Mysore",
            "user_id": "12345",
            "role": "Investigator"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["intent"] == "SEARCH_FIR"
        assert len(data["results"]) > 0