"""
Predictive Analytics Module Test Suite
Covers: Feature Engineering, Hotspot Model, Repeat Offender Model, and Integration.
Based on Phase 2 Testing Checklist.
"""
import pytest
import pandas as pd
import numpy as np
import os
import sys

# Add project root to PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from prediction.feature_engineering import FeatureEngineer
from prediction.hotspot_model import HotspotPredictor
from prediction.repeat_offender import RepeatOffenderPredictor


# ==========================================
# Fixtures
# ==========================================
@pytest.fixture
def mock_fir_data():
    """Mock historical crime data for testing"""
    data = {
        'FIR_ID': [1, 2, 3, 4, 5],
        'CrimeType': ['Cyber Fraud', 'Theft', 'Cyber Fraud', 'Theft', 'Murder'],
        'District': ['Bengaluru', 'Mysore', 'Bengaluru', 'Mysore', 'Bengaluru'],
        'Date': ['2023-01-01', '2023-01-02', '2023-02-01', '2023-02-02', '2023-03-01'],
        'Time': ['10:00', '14:00', '22:30', '08:00', '15:00'],
        'Latitude': [12.97, 12.29, 12.97, 12.29, 12.97],
        'Longitude': [77.59, 76.64, 77.59, 76.64, 77.59],
        'Status': ['Solved', 'Pending', 'Solved', 'Pending', 'Solved'],
        'VictimGender': ['Male', 'Female', 'Male', 'Female', 'Male'],
        'AccusedID': ['A1', 'A2', 'A1', 'A3', 'A4'],
        'PreviousFIRCount': [0, 1, 2, 0, 0]
    }
    return pd.DataFrame(data)


# ==========================================
# 1. Feature Engineering Tests
# ==========================================
class TestFeatureEngineering:
    def test_clean_data_removes_duplicates(self, mock_fir_data):
        fe = FeatureEngineer()
        df_with_dup = pd.concat([mock_fir_data, mock_fir_data.iloc[[0]]])
        cleaned = fe.clean_data(df_with_dup)
        assert len(cleaned) == len(mock_fir_data)

    def test_extract_temporal_features(self, mock_fir_data):
        fe = FeatureEngineer()
        df = fe.extract_temporal_features(mock_fir_data)
        assert 'Hour' in df.columns
        assert 'Weekday' in df.columns
        assert 'Month' in df.columns

    def test_encoding_and_scaling(self, mock_fir_data):
        fe = FeatureEngineer()
        df = fe.extract_temporal_features(mock_fir_data)
        df_encoded = fe.encode_features(df)
        df_scaled = fe.normalize_features(df_encoded)
        
        # Categorical columns should be encoded to numeric types
        assert df_encoded['District'].dtype in [np.int32, np.int64, np.float64]
        # Numerical columns should be scaled
        assert df_scaled['Latitude'].mean() == pytest.approx(0.0, abs=1e-2)


# ==========================================
# 2. Hotspot Model Tests
# ==========================================
class TestHotspotModel:
    def test_train_and_predict(self, mock_fir_data, tmp_path):
        fe = FeatureEngineer()
        df = fe.extract_temporal_features(mock_fir_data)
        df = fe.encode_features(df)
        
        # Mock target creation (Hotspot = TRUE if Crime Count >= Threshold)
        df['Hotspot'] = [1, 0, 1, 0, 1]
        
        predictor = HotspotPredictor()
        predictor.train(df, target_col='Hotspot')
        
        # Predict
        sample = df.iloc[[0]].drop(columns=['Hotspot'])
        pred = predictor.predict(sample)
        assert 'prediction' in pred
        assert 'probability' in pred
        assert 0.0 <= pred['probability'] <= 1.0
        
    def test_save_and_load_model(self, mock_fir_data, tmp_path):
        fe = FeatureEngineer()
        df = fe.extract_temporal_features(mock_fir_data)
        df = fe.encode_features(df)
        df['Hotspot'] = [1, 0, 1, 0, 1]
        
        predictor = HotspotPredictor()
        predictor.train(df, target_col='Hotspot')
        
        # Save
        model_path = tmp_path / "hotspot.pkl"
        predictor.save_model(str(model_path))
        assert model_path.exists()
        
        # Load
        new_predictor = HotspotPredictor()
        new_predictor.load_model(str(model_path))
        
        sample = df.iloc[[0]].drop(columns=['Hotspot'])
        pred1 = predictor.predict(sample)
        pred2 = new_predictor.predict(sample)
        
        assert pred1['prediction'] == pred2['prediction']


# ==========================================
# 3. Repeat Offender Model Tests
# ==========================================
class TestRepeatOffenderModel:
    def test_target_creation_and_prediction(self, mock_fir_data, tmp_path):
        fe = FeatureEngineer()
        df = fe.extract_temporal_features(mock_fir_data)
        df = fe.encode_features(df)
        
        # Target Definition: Repeat Offender if PreviousFIRCount >= 2
        df['RepeatOffender'] = (df['PreviousFIRCount'] >= 2).astype(int)
        
        predictor = RepeatOffenderPredictor()
        predictor.train(df, target_col='RepeatOffender')
        
        # Test with a known repeat offender (PreviousFIRCount = 2)
        sample = df.iloc[[2]].drop(columns=['RepeatOffender']) 
        pred = predictor.predict(sample)
        
        assert 'prediction' in pred
        assert 'probability' in pred
        # High probability expected for repeat offender based on training data
        assert pred['probability'] > 0.5 


# ==========================================
# 4. Integration Tests
# ==========================================
class TestPredictionIntegration:
    @patch('prediction.train.CatalystClient')
    def test_end_to_end_pipeline(self, mock_catalyst, mock_fir_data, tmp_path):
        # Mock Catalyst DataStore fetch
        mock_catalyst_instance = MagicMock()
        mock_catalyst.return_value = mock_catalyst_instance
        mock_catalyst_instance.execute_query.return_value = mock_fir_data
        
        # Run pipeline (Simulated)
        fe = FeatureEngineer()
        df = fe.load_training_data() # Uses mocked catalyst internally
        df = fe.clean_data(df)
        df = fe.extract_temporal_features(df)
        df = fe.encode_features(df)
        
        assert len(df) > 0
        assert 'Hour' in df.columns
        assert df['District'].dtype in [np.int32, np.int64, np.float64]