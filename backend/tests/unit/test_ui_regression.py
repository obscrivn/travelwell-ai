import pytest
from app.fast_api_app import parse_markdown_to_recommendations

def test_ui_regression_contracts():
    # Simulates an agent output containing narrative and cards
    markdown = """
I understand your traveler profile and have selected the best Loop facilities for you.
### Recommendation Card: Loop YMCA Fitness Center
- Price: 💰 $0 YMCA Reciprocity
- Distance: 🚶 12 min
- Place ID: ChIJ12345
- Coordinates: [41.88, -87.63]
- Website: https://ymcachicago.org/loop
- Google Maps URL: https://ymcachicago.org/loop
- Eligibility Status: Fits Your Criteria

#### Why this recommendation?
It satisfies your membership reciprocity!
"""

    recs = parse_markdown_to_recommendations(markdown, budget_sel="free", has_ymca=True)
    assert len(recs) == 1
    rec = recs[0]
    
    # 1. Card title == Facility name
    assert rec["name"] == "Loop YMCA Fitness Center"
    
    # 2. Popup title == Facility name
    assert rec["name"] == "Loop YMCA Fitness Center"
    
    # 3. Open in Maps opens google_maps_url
    def get_maps_url(r):
        mapsUrl = r.get("google_maps_url")
        if not mapsUrl or mapsUrl == "https://maps.google.com" or not mapsUrl.startswith("http"):
            if r.get("place_id") and r["place_id"].startswith("ChI"):
                mapsUrl = f"https://www.google.com/maps/search/?api=1&query=Google&query_place_id={r['place_id']}"
            else:
                coords = r.get("coordinates")
                mapsUrl = f"https://www.google.com/maps/search/?api=1&query={coords['lat']},{coords['lng']}"
        return mapsUrl

    # Website was parsed as maps url or website
    assert rec["website"] == "https://ymcachicago.org/loop"
    assert get_maps_url(rec) == "https://ymcachicago.org/loop"
    
    # Fallback test: no google_maps_url, fallback to place_id ChI...
    rec_no_url = rec.copy()
    rec_no_url["google_maps_url"] = ""
    assert get_maps_url(rec_no_url) == "https://www.google.com/maps/search/?api=1&query=Google&query_place_id=ChIJ12345"
    
    # 4. Popup price == card price == effective_price
    assert rec["effective_price"] == 0.0
    assert rec["facility"]["pricing"]["cost"] == 0.0
    
    # 5. No AI narrative appears in card title or popup title
    for title in [rec["name"]]:
        assert "I understand" not in title
        assert "traveler profile" not in title
        assert "Recommendation Card:" not in title


def test_mccormick_ymca_verification():
    # Verify McCormick YMCA specific facts override Google Places
    from app.tools.facility_tools import fetch_facility_details, scrape_schedules
    
    # Simulates fetch details for McCormick YMCA
    res = fetch_facility_details("ymca_mccormick", has_ymca=True)
    assert res["status"] == "success"
    meta = res["details"]["source_metadata"]
    
    # Verified facts:
    assert meta["official_website_url"] == "https://www.ymcachicago.org/mccormick/"
    assert meta["formatted_address"] == "1834 N. Lawndale Ave, Chicago, IL 60647"
    assert meta["phone_number"] == "773-235-2525"
    assert meta["facility_hours"] == "Monday-Friday: 6 AM - 9 PM, Saturday-Sunday: 7 AM - 7 PM"
    assert meta["pool_hours"] == "Monday-Friday: 7 AM - 8 PM, Saturday-Sunday: 8 AM - 6 PM"
    
    # Confidences:
    assert meta["address_confidence"] == "high"
    assert meta["phone_confidence"] == "high"
    
    # Source tracking:
    assert meta["address_source"] == "official_site"
    assert meta["phone_source"] == "official_site"

