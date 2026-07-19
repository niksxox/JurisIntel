import pandas as pd
import numpy as np
import xgboost as xgb
import joblib
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
from sklearn.preprocessing import LabelEncoder, StandardScaler

# Configuration alignment: Import from config.py (with fallback for standalone testing)
try:
    from config import MODEL_DIRECTORY, LOG_LEVEL
except ImportError:
    MODEL_DIRECTORY = "models"
    LOG_LEVEL = "INFO"

# Setup logging as per roadmap logging strategy
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO))
logger = logging.getLogger(__name__)

class HotspotPredictor:
    """
    Predictive model for crime hotspots.
    Context: Trained on the Kaggle 'Crime Review of Karnataka 2021-2024' dataset.
    Algorithm: XGBoost Classifier (as specified in Roadmap Part 3).
    Dynamically adapts to available dataset columns (District, Minor Head, Major Head, etc.).
    """
    
    def __init__(self, model_filename: str = "hotspot.pkl"):
        self.model_path = Path(MODEL_DIRECTORY) / model_filename
        self.model: Optional[xgb.XGBClassifier] = None
        self.label_encoder = LabelEncoder()
        self.scaler = StandardScaler()
        self.threshold: float = 0.0
        self.feature_columns: List[str] = []
        self.primary_cat_col: str = "District"  # Will be dynamically updated based on CSV

    def load_training_data(self, catalyst_client: Optional[Any] = None, local_csv_path: Optional[str] = None) -> pd.DataFrame:
        """
        Roadmap Alignment: Supports BOTH Catalyst DataStore (production) 
        and local CSV files (development/testing).
        """
        # 1. Try Catalyst DataStore (Production Mode)
        if catalyst_client is not None:
            logger.info("Fetching historical crime data from Catalyst DataStore...")
            try:
                records = catalyst_client.execute_query(
                    table="FIR",
                    filters="Status IS NOT NULL",
                    parameters=[]
                )
                df = pd.DataFrame(records)
                logger.info(f"Successfully loaded {len(df)} records from Catalyst DataStore.")
                return df
            except Exception as e:
                logger.error(f"Failed to load from Catalyst DataStore: {e}. Falling back to local data.")
        
        # 2. Try Local CSV Files (Local Development Mode)
        possible_paths = []
        if local_csv_path:
            possible_paths.append(Path(local_csv_path))
        
        possible_paths.extend([
            Path("data/CRIME_REVIEW_2021_TO_2024_KARNATAKA_CLEAN.csv"),
            Path("data/CRIME_REVIEW_2021_TO_2024_KARNATAKA.csv"),
            Path("data/karnataka_crime_2021_2024.csv")
        ])
        
        for csv_path in possible_paths:
            if csv_path.exists():
                logger.info(f"Loading dataset from {csv_path}...")
                try:
                    df = pd.read_csv(csv_path)
                    logger.info(f"Successfully loaded {len(df)} records from {csv_path.name}")
                    return df
                except Exception as e:
                    logger.warning(f"Failed to read {csv_path}: {e}. Trying next file...")
                    continue
        
        # 3. Generate Mock Data (Fallback Testing Mode)
        logger.warning("No local dataset found. Generating mock dataset for pipeline testing...")
        return self._generate_mock_data()

    def _generate_mock_data(self) -> pd.DataFrame:
        """Generates a mock dataset matching the Karnataka Crime Review schema for local testing."""
        np.random.seed(42)
        n_samples = 1000
        return pd.DataFrame({
            "MINOR HEAD": np.random.choice(["Theft", "Cyber Fraud", "Assault", "Burglary"], n_samples),
            "Month": np.random.randint(1, 13, n_samples),
            "Year": np.random.choice([2021, 2022, 2023, 2024], n_samples),
            "During the current month": np.random.randint(0, 100, n_samples)
        })

    def prepare_target(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        df = dataframe.copy()
        
        # 1. Dynamically find the primary categorical column
        possible_cat_cols = ['District', 'district', 'DISTRICT', 'Police Station', 'MINOR HEAD', 'MAJOR HEAD', 'ACT']
        self.primary_cat_col = next((col for col in possible_cat_cols if col in df.columns), None)
        
        if self.primary_cat_col is None:
            str_cols = df.select_dtypes(include=['object', 'string']).columns.tolist()
            if str_cols:
                self.primary_cat_col = str_cols[0]
            else:
                raise ValueError(f"No suitable categorical column found. Available columns: {list(df.columns)}")
                
        logger.info(f"Using '{self.primary_cat_col}' as the primary categorical feature for prediction.")
            
        # 2. Dynamically find the crime count column
        possible_count_cols = [
            'Crime_Count', 'Crime_Frequency', 'Total_Cases', 'Total Cases',
            'During the current month', 'During the current year upto the end of month under review',
            'During the previous month', 'During the corresponding month of previous year'
        ]
        count_column = next((col for col in possible_count_cols if col in df.columns), None)
        
        if count_column is None:
            df["Crime_Count"] = df.groupby(self.primary_cat_col)[self.primary_cat_col].transform("count")
        else:
            df["Crime_Count"] = pd.to_numeric(df[count_column], errors='coerce').fillna(0)
            
        # 3. Create target variable with robust thresholding
        self.threshold = float(df["Crime_Count"].median())
        df["is_hotspot"] = (df["Crime_Count"] >= self.threshold).astype(int)

        # CRITICAL FIX: Ensure we have both classes (0 and 1) for XGBoost
        if df["is_hotspot"].nunique() < 2:
            logger.warning(f"Median threshold resulted in only one class ({df['is_hotspot'].unique()}). Adjusting to 75th percentile.")
            self.threshold = float(df["Crime_Count"].quantile(0.75))
            df["is_hotspot"] = (df["Crime_Count"] >= self.threshold).astype(int)

            # Fallback if all values are perfectly identical
            if df["is_hotspot"].nunique() < 2:
                logger.warning("All Crime_Count values are identical. Creating synthetic split for pipeline validation.")
                half = len(df) // 2
                df["is_hotspot"] = [0] * half + [1] * (len(df) - half)

        return df

    def train(self, dataframe: pd.DataFrame, target_col: str = "is_hotspot") -> Dict[str, Any]:
        logger.info("Starting hotspot model training...")
        df = self.prepare_target(dataframe)
        df = df.dropna(subset=[self.primary_cat_col, "Crime_Count"])
        
        categorical_cols = [self.primary_cat_col]
        numerical_cols = [
            col for col in df.select_dtypes(include=[np.number]).columns 
            if col not in [target_col, "Crime_Count", "Sl. No."]
        ]
        
        for col in categorical_cols:
            df[col] = df[col].fillna("Unknown")
        for col in numerical_cols:
            df[col] = df[col].fillna(df[col].median())
            
        encoded_col_name = f"{self.primary_cat_col}_Encoded"
        df[encoded_col_name] = self.label_encoder.fit_transform(df[self.primary_cat_col].astype(str))
        self.feature_columns = [encoded_col_name] + numerical_cols
        
        X = df[self.feature_columns]
        y = df[target_col]
        X_scaled = self.scaler.fit_transform(X)
        
        # CRITICAL FIX: Use stratify=y to guarantee both 0s and 1s are in train/test sets
        stratify_param = y if y.nunique() == 2 else None
        
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42, stratify=stratify_param
        )
        
        # Roadmap specified parameters
        self.model = xgb.XGBClassifier(
            learning_rate=0.1,
            max_depth=6,
            n_estimators=100,
            random_state=42,
            eval_metric="logloss"
        )
        self.model.fit(X_train, y_train)
        logger.info("Model training completed. Evaluating...")
        
        return self.evaluate(X_test, y_test)

    def evaluate(self, X_test: np.ndarray, y_test: np.ndarray) -> Dict[str, Any]:
        y_pred = self.model.predict(X_test)
        y_prob = self.model.predict_proba(X_test)[:, 1]
        
        metrics = {
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "precision": float(precision_score(y_test, y_pred, zero_division=0)),
            "recall": float(recall_score(y_test, y_pred, zero_division=0)),
            "f1_score": float(f1_score(y_test, y_pred, zero_division=0)),
            "roc_auc": float(roc_auc_score(y_test, y_prob)),
            "confusion_matrix": confusion_matrix(y_test, y_pred).tolist()
        }
        logger.info(f"Evaluation Metrics: Accuracy={metrics['accuracy']:.4f}, F1={metrics['f1_score']:.4f}")
        return metrics

    def predict(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        if self.model is None:
            raise RuntimeError("Model must be trained or loaded before making predictions.")
            
        cat_val = "Unknown"
        for key in input_data:
            if key.lower() == self.primary_cat_col.lower():
                cat_val = str(input_data[key])
                break
        
        if cat_val == "Unknown":
            cat_val = str(input_data.get("district", input_data.get("District", input_data.get("MINOR HEAD", "Unknown"))))

        if cat_val in self.label_encoder.classes_:
            encoded_cat = int(self.label_encoder.transform([cat_val])[0])
        else:
            encoded_cat = -1
            
        encoded_col_name = f"{self.primary_cat_col}_Encoded"
        features = {encoded_col_name: [encoded_cat]}
        
        for col in self.feature_columns:
            if col == encoded_col_name:
                continue
            val = 0.0
            for key in input_data:
                if key.lower() == col.lower() or key.lower() == col.replace("_Encoded", "").lower():
                    val = input_data[key]
                    break
            
            if val is None or (isinstance(val, str) and not str(val).replace(".", "", 1).replace("-", "").isdigit()):
                val = 0.0
            features[col] = [float(val)]
            
        X_input = pd.DataFrame(features)
        X_input = X_input[self.feature_columns]
        X_scaled = self.scaler.transform(X_input)
        
        probability = float(self.model.predict_proba(X_scaled)[0][1])
        prediction_label = "High Risk" if probability >= 0.5 else "Low Risk"
        
        return {
            "prediction": prediction_label,
            "probability": round(probability, 4),
            "category": cat_val,
            "model_version": "1.0"
        }

    def save_model(self) -> None:
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({
            "model": self.model,
            "label_encoder": self.label_encoder,
            "scaler": self.scaler,
            "threshold": self.threshold,
            "feature_columns": self.feature_columns,
            "primary_cat_col": self.primary_cat_col
        }, self.model_path)
        logger.info(f"Model successfully saved to {self.model_path}")

    def load_model(self) -> None:
        if not self.model_path.exists():
            raise FileNotFoundError(f"Model file not found at {self.model_path}")
        artifacts = joblib.load(self.model_path)
        self.model = artifacts["model"]
        self.label_encoder = artifacts["label_encoder"]
        self.scaler = artifacts["scaler"]
        self.threshold = artifacts["threshold"]
        self.feature_columns = artifacts["feature_columns"]
        self.primary_cat_col = artifacts.get("primary_cat_col", "District")
        logger.info(f"Model successfully loaded from {self.model_path}")


if __name__ == "__main__":
    predictor = HotspotPredictor(model_filename="hotspot.pkl")
    df = predictor.load_training_data(catalyst_client=None)
    
    logger.info("Training model on dataset...")
    evaluation_metrics = predictor.train(df)
    
    print("\n--- Evaluation Metrics ---")
    for metric, value in evaluation_metrics.items():
        if metric != "confusion_matrix":
            print(f"  {metric}: {value:.4f}")
            
    predictor.save_model()
    
    sample_input = {
        "MINOR HEAD": "Theft",
        "Month": 8,
        "Year": 2023
    }
    prediction_result = predictor.predict(sample_input)
    
    print("\n--- Prediction Result ---")
    print(f"Category: {prediction_result['category']}")
    print(f"Risk Level: {prediction_result['prediction']}")
    print(f"Probability: {prediction_result['probability']}")
    print(f"Model Version: {prediction_result['model_version']}")