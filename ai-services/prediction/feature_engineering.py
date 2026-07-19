"""
Feature Engineering Module
Prepares historical crime data for ML training.
Supports both Zoho Catalyst DataStore and local CSV datasets.
Dynamically adapts to aggregated or FIR-level schemas.
"""

import os
import pickle
import logging
from typing import Tuple, Dict, Any, Optional

import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, StandardScaler

# Zoho Catalyst SDK integration
try:
    import zcatalyst_sdk
    CATALYST_SDK_AVAILABLE = True
except ImportError:
    CATALYST_SDK_AVAILABLE = False

# Configuration integration
try:
    from config import settings
    DEFAULT_MODEL_DIR = settings.MODEL_DIRECTORY
    CATALYST_PROJECT_ID = settings.CATALYST_PROJECT_ID
    LOG_LEVEL = settings.LOG_LEVEL
except ImportError:
    DEFAULT_MODEL_DIR = "models/"
    CATALYST_PROJECT_ID = None
    LOG_LEVEL = "INFO"

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))

if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s | %(name)s | %(levelname)s | %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)


class FeatureEngineer:
    def __init__(self, catalyst_client: Optional[Any] = None, model_directory: Optional[str] = None) -> None:
        self.catalyst_client = catalyst_client
        self.model_directory = model_directory or DEFAULT_MODEL_DIR
        self.encoders: Dict[str, Any] = {}
        self.scaler = StandardScaler()
        logger.info("FeatureEngineer initialized | model_dir=%s | catalyst_project=%s", self.model_directory, CATALYST_PROJECT_ID)

    def load_training_data(self, csv_path: Optional[str] = None) -> pd.DataFrame:
        if csv_path is not None or self.catalyst_client is None:
            return self._load_from_csv(csv_path)
        return self._load_from_catalyst()

    def _load_from_catalyst(self) -> pd.DataFrame:
        try:
            logger.info("Loading training data from Catalyst DataStore...")
            fir_df = self.catalyst_client.fetch_table("FIR")
            victim_df = self.catalyst_client.fetch_table("Victim")
            accused_df = self.catalyst_client.fetch_table("Accused")
            location_df = self.catalyst_client.fetch_table("CrimeLocation")
            unified_df = fir_df.merge(victim_df, on="FIR_ID", how="left")
            unified_df = unified_df.merge(accused_df, on="FIR_ID", how="left")
            unified_df = unified_df.merge(location_df, on="FIR_ID", how="left")
            if unified_df.empty:
                raise ValueError("Loaded dataset is empty.")
            return unified_df
        except Exception as error:
            raise RuntimeError(f"Failed to load Catalyst data: {error}") from error

    def _load_from_csv(self, csv_path: Optional[str] = None) -> pd.DataFrame:
        try:
            if csv_path is None:
                csv_path = "data/"
            if os.path.isdir(csv_path):
                csv_files = [f for f in os.listdir(csv_path) if f.endswith('.csv')]
                if not csv_files:
                    raise ValueError(f"No CSV files found in: {csv_path}")
                target_file = next((f for f in csv_files if "CLEAN" in f.upper()), csv_files[0])
                df = pd.read_csv(os.path.join(csv_path, target_file))
                logger.info("Loaded CSV: %s | rows=%d | columns=%d", target_file, len(df), len(df.columns))
                return df
            return pd.read_csv(csv_path)
        except Exception as error:
            raise RuntimeError(f"Failed to load CSV data: {error}") from error

    def clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        initial_count = len(df)
        if "Sl. No." in df.columns:
            df = df.drop_duplicates(subset=["Sl. No."])
        
        # Construct Date from Month and Year if available
        if "Month" in df.columns and "Year" in df.columns:
            df["Date"] = pd.to_datetime(df["Month"].astype(str) + " 1 " + df["Year"].astype(str), errors="coerce")
            df = df.dropna(subset=["Date"])
            
        if "Latitude" in df.columns:
            df = df[(df["Latitude"] >= -90) & (df["Latitude"] <= 90)]
        if "Longitude" in df.columns:
            df = df[(df["Longitude"] >= -180) & (df["Longitude"] <= 180)]
            
        logger.info("Data cleaned | initial=%d | cleaned=%d", initial_count, len(df))
        return df.reset_index(drop=True)

    def extract_temporal_features(self, df: pd.DataFrame) -> pd.DataFrame:
        if "Date" in df.columns:
            df["Hour"] = df["Date"].dt.hour.fillna(0).astype(int)
            df["Weekday"] = df["Date"].dt.day_name()
            df["Month_Name"] = df["Date"].dt.month_name()
            df["Quarter"] = df["Date"].dt.quarter
            df["Weekend"] = df["Weekday"].isin(["Saturday", "Sunday"]).astype(int)
            df["Night"] = ((df["Hour"] >= 18) | (df["Hour"] <= 6)).astype(int)
        elif "Month" in df.columns:
            df["Month_Name"] = df["Month"]
            df["Weekend"] = df["Month_Name"].isin(["Saturday", "Sunday"]).astype(int) # Fallback
            
        df["Holiday"] = 0
        df["Festival"] = 0
        season_mapping = {
            "December": "Winter", "January": "Winter", "February": "Winter",
            "March": "Spring", "April": "Spring", "May": "Spring",
            "June": "Summer", "July": "Summer", "August": "Summer",
            "September": "Autumn", "October": "Autumn", "November": "Autumn"
        }
        df["Season"] = df["Month_Name"].map(season_mapping).fillna("Unknown")
        logger.info("Temporal features extracted")
        return df

    def extract_location_features(self, df: pd.DataFrame) -> pd.DataFrame:
        if "District" in df.columns:
            df["District_ID"] = df["District"].astype("category").cat.codes
        if "Police_Station" in df.columns:
            df["Station_ID"] = df["Police_Station"].astype("category").cat.codes
        if "Latitude" in df.columns and "Longitude" in df.columns:
            df["Grid_Cell"] = (df["Latitude"] // 0.1).astype(str) + "_" + (df["Longitude"] // 0.1).astype(str)
        logger.info("Location features extracted (skipped missing geo columns if any)")
        return df

    def extract_crime_features(self, df: pd.DataFrame) -> pd.DataFrame:
        crime_col = "ACT" if "ACT" in df.columns else ("MAJOR HEAD" if "MAJOR HEAD" in df.columns else "CrimeType")
        if crime_col in df.columns:
            df["Crime_Category"] = df[crime_col].astype(str).str.split().str[0].fillna("Unknown")
            df["Severity"] = df[crime_col].astype(str).apply(
                lambda x: 3 if any(w in x for w in ["Murder", "Rape", "Kidnapping"]) 
                else 2 if any(w in x for w in ["Cyber", "Fraud", "Assault", "Robbery"]) 
                else 1
            )
        if "Status" in df.columns:
            df["Solved"] = (df["Status"] == "Solved").astype(int)
        logger.info("Crime features extracted")
        return df

    def extract_history_features(self, df: pd.DataFrame) -> pd.DataFrame:
        # Create lag features for time-series forecasting on aggregated data
        target_col = "During the current month"
        if target_col in df.columns and "ACT" in df.columns:
            df = df.sort_values(by=["ACT", "Year", "Month"])
            df["Previous_Month_Count"] = df.groupby("ACT")[target_col].shift(1).fillna(0)
            df["Previous_Year_Same_Month_Count"] = df.groupby("ACT")[target_col].shift(12).fillna(0)
            df["Crime_Frequency"] = df.groupby("ACT")[target_col].transform("mean")
        elif "Accused_ID" in df.columns: # Fallback for FIR-level data
            df["Accused_ID"] = df["Accused_ID"].fillna("Unknown")
            df["Previous_FIR_Count"] = df.groupby("Accused_ID")["FIR_ID"].transform(lambda x: x.cumcount())
        logger.info("History/Trend features extracted")
        return df

    def encode_features(self, df: pd.DataFrame) -> pd.DataFrame:
        categorical_columns = ["ACT", "MAJOR HEAD", "MINOR HEAD", "Month", "Season", "Weekday", "District", "CrimeType"]
        for column in categorical_columns:
            if column in df.columns:
                encoder = LabelEncoder()
                df[column + "_Encoded"] = encoder.fit_transform(df[column].astype(str))
                self.encoders[column] = encoder
        logger.info("Features encoded")
        return df

    def normalize_features(self, df: pd.DataFrame) -> pd.DataFrame:
        numeric_columns = [
            "During the current year upto the end of month under review",
            "During the corresponding month of previous year",
            "During the previous month",
            "During the current month",
            "Previous_Month_Count",
            "Previous_Year_Same_Month_Count",
            "Crime_Frequency",
            "Latitude", "Longitude", "Severity"
        ]
        existing_numeric = [col for col in numeric_columns if col in df.columns]
        if existing_numeric:
            df[existing_numeric] = self.scaler.fit_transform(df[existing_numeric].fillna(0))
            self.encoders["StandardScaler"] = self.scaler
        logger.info("Features normalized")
        return df

    def save_encoders(self) -> None:
        os.makedirs(self.model_directory, exist_ok=True)
        encoder_path = os.path.join(self.model_directory, "encoders.pkl")
        with open(encoder_path, "wb") as file:
            pickle.dump(self.encoders, file)
        logger.info("Encoders saved | path=%s", encoder_path)

    def register_catalyst_function(self) -> None:
        if not CATALYST_SDK_AVAILABLE:
            logger.warning("Zoho Catalyst SDK not available. Skipping function registration.")
            return
        logger.info("Catalyst Functions integration ready | schedule=nightly | job=feature_engineering_retrain")

    def run_pipeline(self, csv_path: Optional[str] = None) -> Tuple[pd.DataFrame, pd.Series, Dict[str, Any]]:
        logger.info("Starting feature engineering pipeline...")
        raw_data = self.load_training_data(csv_path=csv_path)
        
        cleaned_data = self.clean_data(raw_data)
        temporal_data = self.extract_temporal_features(cleaned_data)
        location_data = self.extract_location_features(temporal_data)
        crime_data = self.extract_crime_features(location_data)
        history_data = self.extract_history_features(crime_data)
        encoded_data = self.encode_features(history_data)
        normalized_data = self.normalize_features(encoded_data)

        self.save_encoders()
        self.register_catalyst_function()

        # Dynamically select target: prefer crime count, else 'Solved', else first numeric
        target_col = "During the current month" if "During the current month" in normalized_data.columns else ("Solved" if "Solved" in normalized_data.columns else normalized_data.columns[0])
        target_labels = normalized_data[target_col]

        drop_columns = [
            "Sl. No.", "Date", "Month", "Year", "ACT", "MAJOR HEAD", "MINOR HEAD", 
            "Weekday", "Month_Name", "Season", target_col, "FIR_ID", "CrimeType", 
            "District", "Police_Station", "Gender", "Status", "Accused_ID"
        ]
        existing_drop = [col for col in drop_columns if col in normalized_data.columns]
        processed_feature_matrix = normalized_data.drop(columns=existing_drop)

        logger.info("Pipeline complete | features=%d | samples=%d", processed_feature_matrix.shape[1], processed_feature_matrix.shape[0])
        return processed_feature_matrix, target_labels, self.encoders


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)s | %(message)s')
    engineer = FeatureEngineer(catalyst_client=None, model_directory="models/")
    
    print("Starting feature engineering pipeline with local CSV data...")
    features, targets, encoders = engineer.run_pipeline(csv_path="data/")
    
    print("\n" + "="*60)
    print("PIPELINE COMPLETED SUCCESSFULLY")
    print("="*60)
    print(f"Features Shape: {features.shape}")
    print(f"Targets Shape: {targets.shape}")
    print(f"Number of Encoders Saved: {len(encoders)}")
    print(f"\nFeature Columns:\n{features.columns.tolist()}")
    print(f"\nFirst 3 Rows:\n{features.head(3)}")
    print(f"\nEncoders saved to: models/encoders.pkl")