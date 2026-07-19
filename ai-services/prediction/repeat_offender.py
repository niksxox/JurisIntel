import os
import joblib
import pandas as pd
import numpy as np
from typing import Dict, Any, Union

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.preprocessing import LabelEncoder, StandardScaler

# Configuration and Catalyst Integration
# Assumes config.py manages environment variables (e.g., MODEL_DIRECTORY) via python-dotenv/Pydantic Settings
# Assumes catalyst_client.py provides CatalystClient for DataStore interactions
try:
    from catalyst.catalyst_client import CatalystClient
except ImportError:
    CatalystClient = None  # Fallback for local testing without Catalyst SDK installed


class RepeatOffenderPredictor:
    def __init__(self, model_dir: str = None, encoders_path: str = None):
        # Align with config.py: use MODEL_DIRECTORY environment variable instead of hardcoded paths
        self.model_dir = model_dir or os.getenv("MODEL_DIRECTORY", "models")
        self.model_path = os.path.join(self.model_dir, "offender.pkl")
        self.encoders_path = encoders_path or os.path.join(self.model_dir, "encoders.pkl")
        
        # Roadmap specifies: Random Forest Classifier, Trees=100, Max Depth=8, Random State=42
        self.model = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
        self.label_encoders: Dict[str, LabelEncoder] = {}
        self.scaler = StandardScaler()
        
        self.feature_columns = [
            "Previous FIR Count",
            "Crime Type",
            "Previous Arrests",
            "Time Between Crimes",
            "District",
            "Age",
            "Gender"
        ]

    def load_training_data(self) -> pd.DataFrame:
        """
        Load historical records from Catalyst DataStore.
        Context: Crime Review of Karnataka 2021-2024 (https://www.kaggle.com/datasets/aayushrokade/crime-review-of-karnataka-2021-2024)
        Tables: FIR, Victim, Accused, CrimeLocation
        """
        if CatalystClient:
            client = CatalystClient()
            # Example: Fetch joined data from Catalyst DataStore
            # query = "SELECT * FROM FIR JOIN Accused ON FIR.FIR_ID = Accused.FIR_ID"
            # return client.execute_query(query)
            pass
        
        # Fallback to mock data reflecting the Karnataka 2021-2024 dataset structure for local testing
        return self._generate_mock_karnataka_data()

    def _generate_mock_karnataka_data(self) -> pd.DataFrame:
        """Generates mock data reflecting the Karnataka 2021-2024 Crime Review dataset structure."""
        np.random.seed(42)
        sample_size = 1000
        return pd.DataFrame({
            "Previous FIR Count": np.random.randint(0, 5, sample_size),
            "Crime Type": np.random.choice(["Theft", "Assault", "Fraud", "Burglary"], sample_size),
            "Previous Arrests": np.random.randint(0, 3, sample_size),
            "Time Between Crimes": np.random.randint(1, 365, sample_size),
            "District": np.random.choice(["Bengaluru", "Mysore", "Mangalore", "Hubli"], sample_size),
            "Age": np.random.randint(18, 65, sample_size),
            "Gender": np.random.choice(["Male", "Female"], sample_size)
        })

    def prepare_target(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        dataframe = dataframe.copy()
        # Roadmap: Repeat Offender TRUE if Previous FIRs >= 2
        dataframe["Target"] = (dataframe["Previous FIR Count"] >= 2).astype(int)
        return dataframe

    def _encode_features(self, dataframe: pd.DataFrame, fit: bool = False) -> pd.DataFrame:
        encoded_dataframe = dataframe.copy()
        for column in ["Crime Type", "District", "Gender"]:
            if fit:
                self.label_encoders[column] = LabelEncoder()
                encoded_dataframe[column] = self.label_encoders[column].fit_transform(encoded_dataframe[column].astype(str))
            else:
                if column in self.label_encoders:
                    encoded_dataframe[column] = self.label_encoders[column].transform(encoded_dataframe[column].astype(str))
        return encoded_dataframe

    def train(self, dataframe: pd.DataFrame = None) -> Dict[str, float]:
        if dataframe is None:
            dataframe = self.load_training_data()
            
        if dataframe is None or dataframe.empty:
            raise ValueError("Input dataframe cannot be empty")
            
        clean_dataframe = dataframe.dropna(subset=self.feature_columns).copy()
        clean_dataframe = self.prepare_target(clean_dataframe)
        encoded_dataframe = self._encode_features(clean_dataframe, fit=True)
        
        X = encoded_dataframe[self.feature_columns]
        y = encoded_dataframe["Target"]
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        numeric_features = ["Previous FIR Count", "Previous Arrests", "Time Between Crimes", "Age"]
        X_train[numeric_features] = self.scaler.fit_transform(X_train[numeric_features])
        X_test[numeric_features] = self.scaler.transform(X_test[numeric_features])
        
        self.model.fit(X_train, y_train)
        return self.evaluate(X_test, y_test)

    def evaluate(self, X_test: pd.DataFrame, y_test: pd.Series) -> Dict[str, float]:
        y_pred = self.model.predict(X_test)
        y_prob = self.model.predict_proba(X_test)[:, 1]
        return {
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "precision": float(precision_score(y_test, y_pred, zero_division=0)),
            "recall": float(recall_score(y_test, y_pred, zero_division=0)),
            "f1_score": float(f1_score(y_test, y_pred, zero_division=0)),
            "roc_auc": float(roc_auc_score(y_test, y_prob))
        }

    def predict(self, input_data: Union[Dict[str, Any], pd.DataFrame]) -> Dict[str, Any]:
        if isinstance(input_data, dict):
            previous_cases = int(input_data.get("Previous FIR Count", 0))
            input_dataframe = pd.DataFrame([input_data])
        elif isinstance(input_data, pd.DataFrame):
            previous_cases = int(input_data.iloc[0]["Previous FIR Count"])
            input_dataframe = input_data.copy()
        else:
            raise TypeError("Input must be a dictionary or pandas DataFrame")
            
        for column in self.feature_columns:
            if column not in input_dataframe.columns:
                raise ValueError(f"Missing required feature: {column}")
                
        input_dataframe = input_dataframe[self.feature_columns].copy()
        input_dataframe = self._encode_features(input_dataframe, fit=False)
        
        numeric_features = ["Previous FIR Count", "Previous Arrests", "Time Between Crimes", "Age"]
        input_dataframe[numeric_features] = self.scaler.transform(input_dataframe[numeric_features])
        
        probability = float(self.model.predict_proba(input_dataframe)[0][1])
        
        if probability <= 0.33:
            risk_level = "Low Risk"
        elif probability <= 0.66:
            risk_level = "Medium Risk"
        else:
            risk_level = "High Risk"
            
        # Matches Roadmap Part 3, Section 9 Prediction Output format
        return {
            "prediction": risk_level,
            "probability": round(probability, 2),
            "previous_cases": previous_cases
        }

    def save_model(self) -> None:
        os.makedirs(self.model_dir, exist_ok=True)
        joblib.dump(self.model, self.model_path)
        joblib.dump(self.label_encoders, self.encoders_path)


# =========================================================================
# Catalyst Functions Integration
# =========================================================================
def catalyst_function_retrain_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Catalyst Functions entry point for nightly model retraining.
    Aligns with Roadmap: 'Catalyst Functions: Background jobs. Examples: Nightly model retraining'
    Deployed and executed within the Catalyst AppSail environment.
    """
    try:
        predictor = RepeatOffenderPredictor()
        # Load data from Catalyst DataStore
        dataframe = predictor.load_training_data()
        metrics = predictor.train(dataframe)
        predictor.save_model()
        
        # Optional: Log success to Catalyst DataStore AuditLog via CatalystClient here
        
        return {
            "status": "success",
            "message": "Repeat Offender model retrained successfully",
            "metrics": metrics
        }
    except Exception as e:
        # Graceful degradation: log error and return structured failure
        return {
            "status": "error",
            "message": str(e)
        }


if __name__ == "__main__":
    # Local testing execution
    predictor = RepeatOffenderPredictor()
    
    print("Loading data (simulating Karnataka 2021-2024 Crime Review dataset)...")
    dataset = predictor.load_training_data()
    
    print("Training model...")
    metrics = predictor.train(dataset)
    print("Training Metrics:", metrics)
    
    test_input = {
        "Previous FIR Count": 3,
        "Crime Type": "Theft",
        "Previous Arrests": 1,
        "Time Between Crimes": 90,
        "District": "Bengaluru",
        "Age": 28,
        "Gender": "Male"
    }
    
    print("Running prediction...")
    prediction_result = predictor.predict(test_input)
    print("Prediction Result:", prediction_result)
    
    print("Saving model...")
    predictor.save_model()
    print(f"Model saved successfully to: {predictor.model_dir}")