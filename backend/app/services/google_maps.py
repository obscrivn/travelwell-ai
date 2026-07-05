import os
import requests
from typing import Dict, Any, List

def get_maps_api_key() -> str:
    return os.getenv("GOOGLE_MAPS_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""

def geocode_address(address: str) -> Dict[str, float]:
    key = get_maps_api_key()
    if not key:
        return {"lat": 41.8817, "lng": -87.6278} # Chicago Loop fallback
    
    url = f"https://maps.googleapis.com/maps/api/geocode/json?address={requests.utils.quote(address)}&key={key}"
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        if data.get("status") == "OK" and data.get("results"):
            loc = data["results"][0]["geometry"]["location"]
            return {"lat": loc["lat"], "lng": loc["lng"]}
    except Exception as e:
        print(f"Geocoding error: {e}")
    return {"lat": 41.8817, "lng": -87.6278}

def search_places_live(location_query: str) -> List[Dict[str, Any]]:
    key = get_maps_api_key()
    if not key:
        return []
    
    query = f"gyms and fitness centers in {location_query}"
    url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={requests.utils.quote(query)}&key={key}"
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        if data.get("status") in ("OK", "ZERO_RESULTS"):
            results = data.get("results", [])
            places = []
            for item in results[:5]: # Take top 5 candidates
                places.append({
                    "place_id": item.get("place_id"),
                    "name": item.get("name"),
                    "formatted_address": item.get("formatted_address"),
                    "geometry": item.get("geometry", {}),
                    "rating": item.get("rating", 4.0),
                    "user_ratings_total": item.get("user_ratings_total", 0),
                    "photos": item.get("photos", [])
                })
            return places
    except Exception as e:
        print(f"Places Search error: {e}")
    return []

def get_place_details_live(place_id: str) -> Dict[str, Any]:
    key = get_maps_api_key()
    if not key:
        return {}
    
    fields = "name,formatted_address,geometry,rating,user_ratings_total,formatted_phone_number,website,url,opening_hours,photos"
    url = f"https://maps.googleapis.com/maps/api/place/details/json?place_id={place_id}&fields={fields}&key={key}"
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        if data.get("status") == "OK":
            return data.get("result", {})
    except Exception as e:
        print(f"Places Details error: {e}")
    return {}

def get_route_live(origin: str, destination: str, mode: str = "walking") -> Dict[str, Any]:
    key = get_maps_api_key()
    if not key:
        return {}
    
    url = f"https://maps.googleapis.com/maps/api/distancematrix/json?origins={requests.utils.quote(origin)}&destinations={requests.utils.quote(destination)}&mode={mode}&key={key}"
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        if data.get("status") == "OK" and data.get("rows"):
            elements = data["rows"][0].get("elements", [])
            if elements and elements[0].get("status") == "OK":
                elem = elements[0]
                return {
                    "distance_text": elem["distance"]["text"],
                    "distance_value_meters": elem["distance"]["value"],
                    "duration_text": elem["duration"]["text"],
                    "duration_value_seconds": elem["duration"]["value"]
                }
    except Exception as e:
        print(f"Distance Matrix error: {e}")
    return {}
