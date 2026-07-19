from typing import List, Union, Dict, Any

class ReasoningEngine:
    """
    Converts crime prediction outputs into human-readable, trustworthy explanations.
    Designed for the Catalyst Crime Analytics AI Module to provide transparent 
    and context-aware reasoning for law enforcement investigators.
    """

    # Contextual mappings for realistic feature explanations based on Karnataka crime data
    FEATURE_CONTEXT_MAP = {
        "crime frequency": "this area has experienced increasing crime frequency",
        "district": "this district has historical trends matching the current situation",
        "holiday": "upcoming holidays or festival seasons typically correlate with specific crime patterns",
        "month": "seasonal trends for this time of year indicate elevated activity",
        "police station": "localized data from this police station shows similar historical patterns",
        "previous fir count": "there is a high volume of previous FIRs in this locality",
        "repeat offender count": "known repeat offender activity has been detected in this area",
        "latitude": "geographical clustering of incidents supports this assessment",
        "longitude": "geographical clustering of incidents supports this assessment",
        "crime category": "the specific category of crime shows a rising trend in this region",
        "victim gender": "demographic vulnerability patterns align with historical data"
    }

    def confidence_level(self, probability: float) -> str:
        """
        Maps a numeric probability to a confidence category.
        Handles both 0-100 and 0.0-1.0 scales gracefully.
        
        Args:
            probability: Numeric probability value.
            
        Returns:
            A string representing the confidence category ("Very High", "High", "Medium", "Low").
        """
        # Normalize to 0-100 scale if provided as 0.0-1.0
        if 0.0 <= probability <= 1.0:
            prob_scaled = probability * 100
        else:
            prob_scaled = probability
            
        # Clamp to valid range to handle edge cases
        prob_scaled = max(0.0, min(100.0, prob_scaled))
        
        if prob_scaled >= 90.0:
            return "Very High"
        elif prob_scaled >= 80.0:
            return "High"
        elif prob_scaled >= 60.0:
            return "Medium"
        else:
            return "Low"

    def risk_summary(self, prediction_label: str) -> str:
        """
        Generates a short, one-sentence summary based on the prediction label.
        
        Args:
            prediction_label: The raw prediction string (e.g., "High Risk", "Low Risk").
            
        Returns:
            A concise, one-sentence risk summary.
        """
        normalized_label = prediction_label.strip().lower()
        
        if "very high" in normalized_label:
            return "Very high crime risk expected."
        elif "high" in normalized_label:
            return "High crime risk expected."
        elif "moderate" in normalized_label or "medium" in normalized_label:
            return "Moderate crime risk expected."
        elif "low" in normalized_label:
            return "Low crime risk expected."
        else:
            # Fallback for unrecognized labels
            return "Crime risk assessment completed based on available data."

    def generate_reason(self, prediction: str, top_features: Union[List[str], List[Dict[str, Any]]]) -> str:
        """
        Generates a natural language explanation connecting the prediction to 
        the top contributing features.
        
        Args:
            prediction: The prediction label (e.g., "High Risk").
            top_features: A list of feature names (strings) or feature dictionaries 
                          (e.g., [{"name": "Crime Frequency", "score": 0.22}]).
                          
        Returns:
            A natural language explanation string.
        """
        # Determine risk level wording for the sentence
        normalized_pred = prediction.lower()
        if "very high" in normalized_pred or "high" in normalized_pred:
            risk_level = "high"
        elif "moderate" in normalized_pred or "medium" in normalized_pred:
            risk_level = "moderate"
        else:
            risk_level = "low"

        # Extract feature names if dictionaries are provided
        feature_names = []
        for feature in top_features:
            if isinstance(feature, dict):
                name = feature.get("name", "")
            else:
                name = str(feature)
            
            if name:
                feature_names.append(name.strip())

        # Handle empty or missing features
        if not feature_names:
            return (f"The prediction indicates a {risk_level} likelihood of crime based on general "
                    "historical crime patterns, though specific feature contributions are unavailable.")

        # Map features to contextual explanations
        explanations = []
        for feature in feature_names[:3]:  # Limit to top 3 to keep the sentence readable
            lower_feature = feature.lower()
            # Find the best matching context, or use a generic fallback
            context = next(
                (ctx for key, ctx in self.FEATURE_CONTEXT_MAP.items() if key in lower_feature),
                f"{lower_feature} data indicates elevated risk"
            )
            explanations.append(context)

        # Construct the final sentence
        if len(explanations) == 1:
            feature_clause = explanations[0]
        elif len(explanations) == 2:
            feature_clause = f"{explanations[0]}, and {explanations[1]}"
        else:
            feature_clause = f"{explanations[0]}, {explanations[1]}, and {explanations[2]}"

        return (f"The prediction indicates a {risk_level} likelihood of crime because {feature_clause}, "
                "and historical records show comparable crime patterns.")

    def build_response(self, prediction: str, probability: float, top_features: Union[List[str], List[Dict[str, Any]]]) -> Dict[str, Any]:
        """
        Orchestrates the reasoning engine methods to build a standardized response.
        
        Args:
            prediction: The prediction label (e.g., "High Risk").
            probability: The numeric probability of the prediction.
            top_features: List of top contributing features (strings or dicts).
            
        Returns:
            A dictionary containing "summary", "confidence", and "reason".
        """
        return {
            "summary": self.risk_summary(prediction),
            "confidence": self.confidence_level(probability),
            "reason": self.generate_reason(prediction, top_features)
        }