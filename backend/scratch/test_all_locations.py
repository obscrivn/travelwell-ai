import sys
sys.path.insert(0, "/Users/olgascrivner/Documents/WTM Ambassador/Kaggle/travelwell-ai/backend")
from dotenv import load_dotenv
load_dotenv()

from app.services.google_maps import geocode_address

locations = [
    "McCormick Place, Chicago",
    "Willis Tower",
    "Chicago Loop",
    "Union Square San Francisco"
]

print("--- Geocoding Verification Results ---")
for loc in locations:
    res = geocode_address(loc)
    print(f"\nQuery: {loc}")
    print(f"  Coordinates: ({res.get('lat')}, {res.get('lng')})")
    print(f"  Formatted Address: {res.get('formatted_address')}")
    print(f"  Display Name: {res.get('display_name')}")
    print(f"  Place ID: {res.get('place_id')}")
    print(f"  Warning: {res.get('warning')}")
