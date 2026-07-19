import os
import json
import logging
import pickle
from datetime import datetime
from typing import Tuple, Dict, Any, Optional
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

# Zoho Catalyst SDK Integration
try:
    import zcatalyst_sdk
    CATALYST_SDK_AVAILABLE = True
except ImportError:
    CATALYST_SDK_AVAILABLE = False
    logging.warning("zcatalyst-sdk not installed. Catalyst integration will be skipped in local dev.")

# Configuration Alignment (Mirroring config.py environment variables)
CATALYST_PROJECT_ID = os.getenv("CATALYST_PROJECT_ID", "")
CATALYST_API_KEY = os.getenv("CATALYST_API_KEY", "")
MODEL_DIRECTORY = os.getenv("MODEL_DIRECTORY", "models")
# Default to the Kaggle dataset filename
DATA_PATH = os.getenv("DATA_PATH", "CRIME_REVIEW_2021_TO_2024_KARNATAKA.csv")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

def initialize_catalyst() -> Optional[Any]:
    """Initializes Zoho Catalyst SDK for DataStore and Functions integration."""
    if not CATALYST_SDK_AVAILABLE:
        logger.info("Local development mode: Zoho Catalyst SDK not available.")
        return None
    try:
        app = zcatalyst_sdk.initialize()
        logger.info("Zoho Catalyst SDK initialized successfully.")
        return app
    except Exception as e:
        logger.warning(f"Failed to initialize Zoho Catalyst SDK (Expected in local dev): {e}")
        return None

def load_from_datastore(app: Any) -> pd.DataFrame:
    """Reads historical records from Catalyst DataStore."""
    if not app:
        return pd.DataFrame()
    try:
        datastore = app.datastore()
        # Conceptual connection check. Full fetch requires valid Catalyst environment.
        logger.info("Catalyst DataStore connected. Attempting to fetch historical records...")
        # Placeholder for actual zcatalyst_sdk fetch logic
        return pd.DataFrame() 
    except Exception as e:
        logger.warning(f"Could not load data from Catalyst DataStore: {e}")
    return pd.DataFrame()

def load_dataset(app: Optional[Any]) -> pd.DataFrame:
    """Orchestrates data loading: DataStore first, then local CSV fallback."""
    df = load_from_datastore(app)
    
    if df.empty:
        logger.info("DataStore empty or unavailable. Loading local Kaggle CSV dataset for development.")
        if os.path.exists(DATA_PATH):
            logger.info(f"Found local dataset: {DATA_PATH}")
            dataframe = pd.read_csv(DATA_PATH)
            return adapt_aggregated_dataset(dataframe)
        else:
            logger.warning(f"Local dataset '{DATA_PATH}' not found. Generating synthetic dataset for pipeline execution.")
            return generate_synthetic_dataset()
            
    return adapt_aggregated_dataset(df)

def adapt_aggregated_dataset(dataframe: pd.DataFrame) -> pd.DataFrame:
    """Adapts the Kaggle Crime Review dataset to the expected schema robustly."""
    # Clean column names: strip whitespace and convert to uppercase for reliable matching
    dataframe.columns = dataframe.columns.str.strip().str.upper()
    
    # Map common Kaggle dataset variations to our standard schema
    column_mapping = {
        "MAJOR HEAD": "Crime_Type",
        "DURING THE CURRENT MONTH": "Crime_Frequency",
        "DISTRICT": "District",
        "YEAR": "Year",
        "MONTH": "Month"
    }
    dataframe = dataframe.rename(columns=column_mapping)
    
    # Ensure required columns exist, provide defaults if missing
    if "Year" in dataframe.columns and "Month" in dataframe.columns:
        dataframe["Date"] = pd.to_datetime(
            dataframe["Year"].astype(str) + "-" + dataframe["Month"].astype(str) + "-01",
            errors="coerce"
        )
    else:
        dataframe["Date"] = pd.to_datetime("2021-01-01")
        
    if "District" not in dataframe.columns:
        dataframe["District"] = "Karnataka_Statewide"
    if "Accused_ID" not in dataframe.columns:
        dataframe["Accused_ID"] = "Aggregated_Unknown"
    if "Previous_FIRs" not in dataframe.columns:
        dataframe["Previous_FIRs"] = 0
        
    # Drop rows where Date parsing failed
    dataframe = dataframe.dropna(subset=["Date"])
    logger.info(f"Successfully adapted dataset. Shape: {dataframe.shape}")
    return dataframe

def generate_synthetic_dataset() -> pd.DataFrame:
    """Generates synthetic data only if no CSV or DataStore is available."""
    np.random.seed(42)
    sample_size = 10000
    districts = ["Bengaluru", "Mysore", "Mangalore", "Hubli", "Belgaum"]
    crime_types = ["Theft", "Cyber Fraud", "Assault", "Burglary", "Vehicle Theft"]
    stations = [f"Station_{i}" for i in range(1, 21)]
    
    return pd.DataFrame({
        "District": np.random.choice(districts, sample_size),
        "Police_Station": np.random.choice(stations, sample_size),
        "Crime_Type": np.random.choice(crime_types, sample_size),
        "Date": pd.date_range(start="2021-01-01", periods=sample_size, freq="h").tolist(), # 'h' fixes pandas warning
        "Latitude": np.random.uniform(11.0, 18.0, sample_size),
        "Longitude": np.random.uniform(74.0, 78.0, sample_size),
        "Accused_ID": [f"A{np.random.randint(1000, 9999)}" for _ in range(sample_size)],
        "Previous_FIRs": np.random.poisson(1.5, sample_size),
        "Crime_Frequency": np.random.poisson(5, sample_size),
        "Status": np.random.choice(["Pending", "Solved", "Charge Sheet Filed"], sample_size)
    })

def engineer_features(dataframe: pd.DataFrame) -> Tuple[pd.DataFrame, LabelEncoder, LabelEncoder]:
    """Prepares historical data for Machine Learning."""
    processed_df = dataframe.copy()
    date_series = pd.to_datetime(processed_df["Date"])
    
    processed_df["Hour"] = date_series.dt.hour
    processed_df["Month"] = date_series.dt.month
    processed_df["Weekday"] = date_series.dt.dayofweek
    processed_df["Weekend"] = processed_df["Weekday"].isin([5, 6]).astype(int)
    processed_df["Crime_Frequency"] = processed_df.get("Crime_Frequency", np.random.poisson(5, len(processed_df)))
    
    district_encoder = LabelEncoder()
    processed_df["District_Encoded"] = district_encoder.fit_transform(processed_df["District"].astype(str))
    
    crime_encoder = LabelEncoder()
    processed_df["Crime_Type_Encoded"] = crime_encoder.fit_transform(processed_df["Crime_Type"].astype(str))
    
    return processed_df, district_encoder, crime_encoder

def train_hotspot(X_train: pd.DataFrame, y_train: pd.Series, X_test: pd.DataFrame, y_test: pd.Series) -> Tuple[XGBClassifier, Dict[str, float]]:
    """Trains the XGBoost Hotspot Prediction Model."""
    model = XGBClassifier(random_state=42, learning_rate=0.1, max_depth=6, n_estimators=100)
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    metrics = validate_models(y_test, predictions)
    return model, metrics

def train_repeat_offender(X_train: pd.DataFrame, y_train: pd.Series, X_test: pd.DataFrame, y_test: pd.Series) -> Tuple[RandomForestClassifier, Dict[str, float]]:
    """Trains the Random Forest Repeat Offender Model."""
    model = RandomForestClassifier(random_state=42, n_estimators=100, max_depth=8)
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    metrics = validate_models(y_test, predictions)
    return model, metrics

def validate_models(y_true: pd.Series, y_pred: np.ndarray) -> Dict[str, float]:
    """Calculates evaluation metrics."""
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0))
    }

def generate_metadata(model_name: str, algorithm: str, accuracy: float, feature_count: int) -> Dict[str, Any]:
    """Generates and saves metadata.json for the XAI and FastAPI layers."""
    metadata = {
        "model": model_name,
        "algorithm": algorithm,
        "accuracy": round(accuracy, 4),
        "trained_on": datetime.now().strftime("%Y-%m-%d"),
        "version": "v1",
        "feature_count": feature_count
    }
    
    os.makedirs(MODEL_DIRECTORY, exist_ok=True)
    filename = f"{model_name.lower().replace(' ', '_')}_metadata.json"
    filepath = os.path.join(MODEL_DIRECTORY, filename)
    
    with open(filepath, "w") as file:
        json.dump(metadata, file, indent=4)
    logger.info(f"Metadata saved to {filepath}")
    return metadata

def run_pipeline():
    """Main execution pipeline for Catalyst Functions or local execution."""
    os.makedirs(MODEL_DIRECTORY, exist_ok=True)
    
    logger.info("Step 1: Initializing Catalyst & Loading Dataset")
    catalyst_app = initialize_catalyst()
    dataset = load_dataset(catalyst_app)
    logger.info(f"Dataset loaded successfully with {len(dataset)} records")
    
    logger.info("Step 2: Feature Engineering")
    engineered_df, district_encoder, crime_encoder = engineer_features(dataset)
    feature_columns = ["District_Encoded", "Crime_Type_Encoded", "Month", "Weekday", "Weekend", "Crime_Frequency"]
    
    if "Previous_FIRs" in engineered_df.columns:
        feature_columns.append("Previous_FIRs")
        
    X = engineered_df[feature_columns].fillna(0)
    feature_count = len(feature_columns)
    
    logger.info("Step 3: Splitting Dataset")
    # Target: Hotspot if Crime Frequency > 10
    X_train, X_test, y_train_hotspot, y_test_hotspot = train_test_split(
        X, (engineered_df["Crime_Frequency"] > 10).astype(int), test_size=0.2, random_state=42
    )
    # Target: Repeat Offender if Previous FIRs >= 2
    X_train_off, X_test_off, y_train_off, y_test_off = train_test_split(
        X, (engineered_df["Previous_FIRs"] >= 2).astype(int), test_size=0.2, random_state=42
    )
    
    logger.info("Step 4 & 5: Training and Evaluating Hotspot Model")
    hotspot_model, hotspot_metrics = train_hotspot(X_train, y_train_hotspot, X_test, y_test_hotspot)
    logger.info(f"Hotspot Model Metrics: {hotspot_metrics}")
    
    logger.info("Step 6: Saving Hotspot Model & Encoders")
    with open(os.path.join(MODEL_DIRECTORY, "hotspot.pkl"), "wb") as file:
        pickle.dump(hotspot_model, file)
    with open(os.path.join(MODEL_DIRECTORY, "encoders.pkl"), "wb") as file:
        pickle.dump({"district": district_encoder, "crime": crime_encoder}, file)
    generate_metadata("Hotspot", "XGBoost", hotspot_metrics["accuracy"], feature_count)
    
    logger.info("Step 7 & 8: Training and Evaluating Repeat Offender Model")
    offender_model, offender_metrics = train_repeat_offender(X_train_off, y_train_off, X_test_off, y_test_off)
    logger.info(f"Repeat Offender Model Metrics: {offender_metrics}")
    
    logger.info("Step 9: Saving Repeat Offender Model")
    with open(os.path.join(MODEL_DIRECTORY, "offender.pkl"), "wb") as file:
        pickle.dump(offender_model, file)
    generate_metadata("Repeat Offender", "RandomForest", offender_metrics["accuracy"], feature_count)
    
    logger.info("Step 10: Pipeline Completed Successfully")

if __name__ == "__main__":
    run_pipeline()