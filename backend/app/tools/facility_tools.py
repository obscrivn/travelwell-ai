from typing import Dict, Any
from app.services.mock_data import load_mock_data

def search_places(location: str, budget: float) -> Dict[str, Any]:
    """Finds candidate fitness and wellness facilities near a location based on budget.

    Args:
        location: The search query or destination address (e.g. 'Chicago Loop').
        budget: The user's maximum day-pass budget.

    Returns:
        A dictionary containing the search status and a list of candidate facilities.
    """
    data = load_mock_data()
    scenario = None
    
    # Try to find a matching scenario based on budget
    for s in data.get("scenarios", []):
        if "chicago" in location.lower() or "chicago" in s.get("scenario_id", "").lower():
            if budget <= 5.0 and s.get("scenario_id") == "chicago_impossible_budget":
                scenario = s
                break
            elif budget > 5.0 and s.get("scenario_id") == "chicago_downtown_ymca":
                scenario = s
                break
            
    if not scenario and data.get("scenarios"):
        scenario = data["scenarios"][0]
        
    if not scenario:
        return {"status": "error", "message": "No scenarios found in mock data."}
        
    return {
        "status": "success",
        "facilities": scenario.get("candidate_facilities_seed", [])
    }

def fetch_facility_details(facility_id: str) -> Dict[str, Any]:
    """Retrieves access rules, day pass pricing, and verified details for a facility.

    Args:
        facility_id: The unique identifier for the facility.

    Returns:
        A dictionary containing pricing structure and verification status.
    """
    data = load_mock_data()
    for scenario in data.get("scenarios", []):
        for fac in scenario.get("candidate_facilities_seed", []):
            if fac.get("id") == facility_id:
                return {
                    "status": "success",
                    "details": {
                        "pricing": fac.get("pricing"),
                        "source_metadata": fac.get("source_metadata")
                    }
                }
    return {"status": "error", "message": f"Facility {facility_id} not found."}

def scrape_schedules(facility_id: str) -> Dict[str, Any]:
    """Scrapes or retrieves open hours, reviews, crowd warning, and amenities.

    Args:
        facility_id: The unique identifier for the facility.

    Returns:
        A dictionary containing open hours, amenities list, and crowd warnings.
    """
    data = load_mock_data()
    for scenario in data.get("scenarios", []):
        for fac in scenario.get("candidate_facilities_seed", []):
            if fac.get("id") == facility_id:
                return {
                    "status": "success",
                    "hours": fac.get("hours"),
                    "amenities": fac.get("amenities"),
                    "emoji_badges": fac.get("emoji_badges"),
                    "reviews_summary": fac.get("reviews_summary"),
                    "crowd_warning": fac.get("crowd_warning"),
                    "recommendation_metadata": fac.get("recommendation_metadata")
                }
    return {"status": "error", "message": f"Facility {facility_id} not found."}
