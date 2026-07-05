from typing import Dict, Any
from app.services.mock_data import load_mock_data

def calculate_route_distances(facility_id: str) -> Dict[str, Any]:
    """Calculates route walking times, driving times, and distances.

    Args:
        facility_id: The unique identifier for the facility.

    Returns:
        A dictionary containing walking time, driving time, and distance metrics.
    """
    data = load_mock_data()
    for scenario in data.get("scenarios", []):
        for fac in scenario.get("candidate_facilities_seed", []):
            if fac.get("id") == facility_id:
                return {
                    "status": "success",
                    "travel_metadata": fac.get("travel_metadata")
                }
    return {"status": "error", "message": f"Facility {facility_id} not found."}
