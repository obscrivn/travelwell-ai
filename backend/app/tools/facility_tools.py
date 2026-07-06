# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

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
    from app.services.google_maps import get_maps_api_key, search_places_live, geocode_address
    key = get_maps_api_key()
    if key:
        resolved = geocode_address(location)
        search_query = resolved.get("formatted_address") or location
        places = search_places_live(search_query)
        if places:
            facilities = []
            for p in places:
                loc = (p.get("geometry") or {}).get("location") or {}
                lat = loc.get("lat") or resolved.get("lat") or 41.8817
                lng = loc.get("lng") or resolved.get("lng") or -87.6278
                facilities.append({
                    "id": p["place_id"],
                    "name": p["name"],
                    "address": p["formatted_address"],
                    "coordinates": {"lat": lat, "lng": lng},
                    "rating": p.get("rating", 4.0),
                    "user_ratings_total": p.get("user_ratings_total", 0),
                    "pricing": {
                        "access_type": "unknown",
                        "cost": -1.0,
                        "pass_detail": "Pricing information not identified in Places data."
                    },
                    "hours": {
                        "open": "unknown",
                        "close": "unknown",
                        "warning": None
                    },
                    "amenities": [],
                    "emoji_badges": []
                })
            return {
                "status": "success",
                "facilities": facilities,
                "data_mode": "live",
                "resolved_location": resolved
            }

    # Fallback to mock data
    data = load_mock_data()
    scenario = None
    
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

def fetch_facility_details(facility_id: str, has_ymca: bool = False) -> Dict[str, Any]:
    """Retrieves access rules, day pass pricing, and verified details for a facility.

    Args:
        facility_id: The unique identifier for the facility.
        has_ymca: Whether the user has an active YMCA membership.

    Returns:
        A dictionary containing pricing structure and verification status.
    """
    from app.services.google_maps import get_maps_api_key, get_place_details_live
    key = get_maps_api_key()
    
    # 1. Live mode
    if key and not facility_id.startswith("mock_"):
        details = get_place_details_live(facility_id) or {}
        name = details.get("name", "")
        is_ymca = "ymca" in name.lower()
        
        pricing = {
            "access_type": "unknown",
            "cost": -1.0,
            "pass_detail": "Pricing information not identified in Places details."
        }
        
        if has_ymca and is_ymca:
            pricing = {
                "access_type": "membership_reciprocity",
                "cost": 0.0,
                "pass_detail": "Free access via national YMCA membership reciprocity."
            }
            
        return {
            "status": "success",
            "details": {
                "pricing": pricing,
                "source_metadata": {
                    "provider": "google_places",
                    "verified": bool(details),
                    "phone": details.get("formatted_phone_number", "Unknown") or "Unknown",
                    "website": details.get("website", "Unknown") or "Unknown",
                    "url": details.get("url", "Unknown") or "Unknown"
                }
            }
        }

    # 2. Mock mode fallback
    data = load_mock_data()
    for scenario in data.get("scenarios", []):
        for fac in scenario.get("candidate_facilities_seed", []):
            if fac.get("id") == facility_id:
                name = fac.get("name", "")
                is_ymca = "ymca" in name.lower()
                pricing = fac.get("pricing").copy()
                
                if is_ymca:
                    if has_ymca:
                        pricing["access_type"] = "membership_reciprocity"
                        pricing["cost"] = 0.0
                        pricing["pass_detail"] = "Free access via national YMCA membership reciprocity."
                    else:
                        pricing["access_type"] = "day_pass"
                        pricing["cost"] = 25.0
                        pricing["pass_detail"] = "estimated_guest_pass: $25 day pass without active membership."
                else:
                    if pricing.get("access_type") == "membership_reciprocity":
                        pricing["access_type"] = "day_pass"
                        pricing["cost"] = 20.0
                
                return {
                    "status": "success",
                    "details": {
                        "pricing": pricing,
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
    from app.services.google_maps import get_maps_api_key, get_place_details_live
    key = get_maps_api_key()
    if key and not facility_id.startswith("mock_"):
        details = get_place_details_live(facility_id) or {}
        opening_hours = details.get("opening_hours") or {}
        weekday_text = opening_hours.get("weekday_text", []) if opening_hours else []
        hours_str = ", ".join(weekday_text) if weekday_text else "Hours unknown"
        return {
            "status": "success",
            "hours": {
                "open": "unknown",
                "close": "unknown",
                "warning": f"Opening hours schedule: {hours_str}"
            },
            "amenities": [],
            "emoji_badges": [],
            "reviews_summary": f"Google reviews score: {details.get('rating', 'N/A')} ({details.get('user_ratings_total', 0)} reviews). Website: {details.get('website', 'None')}",
            "crowd_warning": None,
            "recommendation_metadata": {
                "best_for": "Workout access via Google Places findings.",
                "limitations": "Pricing and amenities are not verified via Places API."
            }
        }

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
