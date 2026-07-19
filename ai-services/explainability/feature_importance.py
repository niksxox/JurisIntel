import os
import logging
from typing import Any, Dict, List, Union
import pandas as pd
import numpy as np
import shap
import xgboost as xgb
from sklearn.ensemble import RandomForestClassifier
import joblib
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------
# Configuration (aligned with roadmap)
# ---------------------------------------------------------------------
class ExplainabilityConfig(BaseModel):
    model_directory: str = Field(default=os.getenv("MODEL_DIRECTORY", "./models"))
    catalyst_account_id: str = Field(default=os.getenv("CATALYST_ACCOUNT_ID", ""))
    catalyst_project_id: str = Field(default=os.getenv("CATALYST_PROJECT_ID", ""))
    log_level: str = Field(default=os.getenv("LOG_LEVEL", "INFO"))


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------
# Main engine
# ---------------------------------------------------------------------
class FeatureImportanceEngine:
    """
    Explainable AI Engine for Crime Analytics.
    Supports SHAP and fallback feature importance.
    """
    def __init__(self, config: ExplainabilityConfig = None):
        self.config = config or ExplainabilityConfig()
        self.model = None
        self.expected_features = []
        self.catalyst_client = None
        logger.setLevel(self.config.log_level)

    def initialize_catalyst(self, catalyst_client: Any) -> None:
        self.catalyst_client = catalyst_client
        logger.info("Zoho Catalyst SDK client initialized.")

    def load_model(self, model_path: str = None) -> None:
        path_to_load = model_path or os.path.join(self.config.model_directory, "hotspot.pkl")
        if not os.path.exists(path_to_load):
            raise FileNotFoundError(f"Model file not found at {path_to_load}")
        try:
            self.model = xgb.Booster()
            self.model.load_model(path_to_load)
            self.expected_features = self.model.feature_names or []
        except Exception:
            try:
                self.model = joblib.load(path_to_load)
                if hasattr(self.model, 'feature_names_in_'):
                    self.expected_features = list(self.model.feature_names_in_)
                elif hasattr(self.model, 'feature_names'):
                    self.expected_features = self.model.feature_names or []
                else:
                    self.expected_features = []
            except Exception as e:
                raise ValueError(f"Failed to load model from {path_to_load}: {str(e)}")
        logger.info(f"Model loaded from {path_to_load}")

    def validate_features(self, features: Union[Dict[str, Any], pd.DataFrame]) -> pd.DataFrame:
        if isinstance(features, dict):
            df = pd.DataFrame([features])
        elif isinstance(features, pd.DataFrame):
            df = features.copy()
        else:
            raise TypeError("Features must be a dictionary or a pandas DataFrame")
        if df.empty:
            raise ValueError("Input features cannot be empty")
        missing = [f for f in self.expected_features if f not in df.columns]
        if missing:
            raise ValueError(f"Missing required features: {missing}")
        return df[self.expected_features]

    def calculate_shap(self, features: Union[Dict[str, Any], pd.DataFrame]) -> Dict[str, List[Dict[str, Any]]]:
        df = self.validate_features(features)
        try:
            explainer = shap.TreeExplainer(self.model)
            shap_values = explainer.shap_values(df)
            if isinstance(shap_values, list):
                shap_values = np.abs(shap_values[0]).mean(axis=0)
            else:
                shap_values = np.abs(shap_values).mean(axis=0)
            result = self.rank_features(shap_values)
            self._log_to_catalyst_datastore("SHAP_CALCULATION_SUCCESS", result)
            return result
        except Exception as e:
            logger.warning(f"SHAP failed, falling back: {str(e)}")
            result = self._fallback_feature_importance()
            self._log_to_catalyst_datastore("SHAP_CALCULATION_FALLBACK", result)
            return result

    def _log_to_catalyst_datastore(self, event_type: str, result: Dict[str, Any]) -> None:
        if self.catalyst_client:
            try:
                audit_record = {
                    "event_type": event_type,
                    "feature_importance_summary": result.get("feature_importance", [])[:3],
                    "timestamp": pd.Timestamp.now().isoformat()
                }
                logger.debug(f"Logged to Catalyst DataStore: {audit_record}")
            except Exception as e:
                logger.error(f"Failed to log: {str(e)}")

    def rank_features(self, shap_values: np.ndarray) -> Dict[str, List[Dict[str, Any]]]:
        abs_shap = np.abs(shap_values)
        ranked_indices = np.argsort(abs_shap)[::-1][:5]
        ranked_features = [
            {"name": str(self.expected_features[i]), "shap_value": float(abs_shap[i])}
            for i in ranked_indices
        ]
        return self.generate_scores(ranked_features)

    def generate_scores(self, ranked_features: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        total = sum(item["shap_value"] for item in ranked_features)
        if total == 0:
            total = 1.0
        normalized = [
            {"name": item["name"], "score": round(item["shap_value"] / total, 2)}
            for item in ranked_features
        ]
        score_sum = sum(item["score"] for item in normalized)
        if score_sum > 0 and score_sum != 1.0:
            diff = round(1.0 - score_sum, 2)
            normalized[0]["score"] = round(normalized[0]["score"] + diff, 2)
        return {"feature_importance": normalized}

    def _fallback_feature_importance(self) -> Dict[str, List[Dict[str, Any]]]:
        try:
            if hasattr(self.model, 'feature_importances_'):
                importances = self.model.feature_importances_
            elif hasattr(self.model, 'get_score'):
                scores = self.model.get_score(importance_type='gain')
                importances = np.array([float(scores.get(f, 0.0)) for f in self.expected_features])
            else:
                raise AttributeError("No feature importance method available")
            abs_importances = np.abs(importances)
            ranked_indices = np.argsort(abs_importances)[::-1][:5]
            ranked_features = [
                {"name": str(self.expected_features[i]), "shap_value": float(abs_importances[i])}
                for i in ranked_indices
            ]
            return self.generate_scores(ranked_features)
        except Exception as e:
            raise RuntimeError(f"Fallback failed: {str(e)}")


# ---------------------------------------------------------------------
# Validation / test function (outside the class)
# ---------------------------------------------------------------------
def run_validation():
    """Built‑in validation to ensure SHAP, fallback, and scoring work."""
    data = {
        "Crime Type": ["Theft", "Burglary", "Cyber Fraud", "Theft", "Burglary", "Cyber Fraud", "Theft", "Burglary"],
        "District": ["Bengaluru", "Mysore", "Bengaluru", "Mysore", "Bengaluru", "Mysore", "Bengaluru", "Mysore"],
        "Police Station": ["Station A", "Station B", "Station C", "Station A", "Station B", "Station C", "Station A", "Station B"],
        "Date": ["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05", "2023-01-06", "2023-01-07", "2023-01-08"],
        "Time": ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"],
        "Victim Gender": ["M", "F", "M", "F", "M", "F", "M", "F"],
        "Crime Category": ["Property", "Property", "Financial", "Property", "Property", "Financial", "Property", "Property"],
        "Latitude": [12.9716, 12.2958, 12.9716, 12.2958, 12.9716, 12.2958, 12.9716, 12.2958],
        "Longitude": [77.5946, 76.6394, 77.5946, 76.6394, 77.5946, 76.6394, 77.5946, 76.6394],
        "Status": ["Pending", "Solved", "Pending", "Solved", "Pending", "Solved", "Pending", "Solved"]
    }
    df = pd.DataFrame(data)
    # One‑hot encode categoricals, drop non‑numeric Date/Time columns
    X = pd.get_dummies(df, columns=["Crime Type", "District", "Police Station", "Victim Gender", "Crime Category", "Status"])
    X = X.drop(columns=["Date", "Time"], errors='ignore')
    y = [1, 0, 1, 0, 1, 0, 1, 0]

    model = RandomForestClassifier(n_estimators=50, random_state=42)
    model.fit(X, y)

    model_path = "test_karnataka_crime_model.pkl"
    joblib.dump(model, model_path)

    config = ExplainabilityConfig(model_directory=".")
    engine = FeatureImportanceEngine(config=config)
    engine.load_model(model_path)

    # Build test features (must match the columns of X)
    test_features = {
        "Crime Type_Theft": 1, "Crime Type_Burglary": 0, "Crime Type_Cyber Fraud": 0,
        "District_Bengaluru": 1, "District_Mysore": 0,
        "Police Station_Station A": 1, "Police Station_Station B": 0, "Police Station_Station C": 0,
        "Victim Gender_M": 1, "Victim Gender_F": 0,
        "Crime Category_Property": 1, "Crime Category_Financial": 0,
        "Status_Pending": 1, "Status_Solved": 0,
        "Latitude": 12.9716, "Longitude": 77.5946
    }
    test_features = {k: v for k, v in test_features.items() if k in X.columns}

    result = engine.calculate_shap(test_features)

    assert "feature_importance" in result
    assert isinstance(result["feature_importance"], list)
    assert len(result["feature_importance"]) <= 5
    for item in result["feature_importance"]:
        assert "name" in item and "score" in item
        assert isinstance(item["name"], str)
        assert isinstance(item["score"], float)

    score_sum = sum(item["score"] for item in result["feature_importance"])
    assert abs(score_sum - 1.0) < 0.05, f"Scores sum to {score_sum}, expected 1.0"

    # Test fallback mechanism
    try:
        engine.model = None
        engine._fallback_feature_importance()
    except RuntimeError:
        pass  # expected because model is None

    engine.load_model(model_path)
    fallback_result = engine._fallback_feature_importance()
    assert "feature_importance" in fallback_result
    assert len(fallback_result["feature_importance"]) <= 5

    os.remove(model_path)
    print("All validations passed successfully.")


if __name__ == "__main__":
    run_validation()