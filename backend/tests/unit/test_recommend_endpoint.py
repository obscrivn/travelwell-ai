import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Import the FastAPI app
from app.fast_api_app import app

def test_recommend_endpoint_initialization_error():
    # Test that the recommend endpoint returns 500 JSON response on invalid input/session exception
    client = TestClient(app)
    # Sending invalid body format to trigger initialization exception
    response = client.post("/api/recommend", data="not json")
    assert response.status_code == 500
    data = response.json()
    assert "error_type" in data
    assert "stage" in data
    assert "message" in data

def test_resolve_location_endpoint():
    # Test resolve_location geocoding mock endpoint response
    client = TestClient(app)
    with patch("app.services.google_maps.geocode_address") as mock_geocode:
        mock_geocode.return_value = {
            "display_name": "Mock Gym Location, Chicago",
            "formatted_address": "Mock Address",
            "lat": 41.88,
            "lng": -87.63,
            "warning": None
        }
        response = client.get("/resolve_location?address=Chicago")
        assert response.status_code == 200
        data = response.json()
        assert data["display_name"] == "Mock Gym Location, Chicago"
        assert data["lat"] == 41.88

def test_config_endpoint():
    # Test GET /api/config returns the maps API key
    client = TestClient(app)
    with patch.dict("os.environ", {"GOOGLE_MAPS_API_KEY": "test-key-123"}):
        response = client.get("/api/config")
        assert response.status_code == 200
        data = response.json()
        assert data["mapsApiKey"] == "test-key-123"

def test_recommend_endpoint_success():
    mock_event = MagicMock()
    mock_event.author = "policy_validation"
    mock_event.content.role = "model"
    mock_event.content.parts = [MagicMock(text="### Recommendation Card: Life Time")]
    
    with patch("google.adk.runners.Runner.run") as mock_run:
        mock_run.return_value = [mock_event]
        
        with TestClient(app) as client:
            response = client.post("/api/recommend", json={
                "location": "Chicago",
                "timeWindow": "6:00 PM - 9:00 PM",
                "budgetSelection": "20",
                "hasYmca": False,
                "showersReq": False,
                "parkingReq": False,
                "poolPref": False,
                "treadmillPref": False
            })
            assert response.status_code == 200
            assert "text/event-stream" in response.headers["content-type"]
            body_content = response.text
            assert "policy_validation" in body_content
            assert "Life Time" in body_content

def test_recommend_endpoint_returns_structured_recommendation():
    mock_event = MagicMock()
    mock_event.author = "policy_validation"
    mock_event.content.role = "model"
    markdown_payload = """
### Recommendation Card: Life Time Fitness
- Distance / Travel Time: 🚶 10 min
- Price: 💰 $20 Day Pass
- Place ID: mock_lifetime
- Address: 123 River North, Chicago
- Coordinates: [41.8962, -87.6287]
- Phone: (312) 555-0199
- Website: https://www.lifetime.life
- Google Maps URL: https://maps.google.com
- Eligibility Status: Fits Your Criteria
- Match Quality: Excellent Match

#### Constraint Satisfaction
- ✅ Budget ≤ $20
- ✅ Showers

#### Why this recommendation?
- **Satisfied Constraints:** Budget, Showers
- **Violated Constraints:** None
- **Recommendation Rationale:** Meets all traveler requirements.
"""
    mock_event.content.parts = [MagicMock(text=markdown_payload)]
    
    with patch("google.adk.runners.Runner.run") as mock_run:
        mock_run.return_value = [mock_event]
        
        with TestClient(app) as client:
            response = client.post("/api/recommend", json={
                "location": "Chicago",
                "timeWindow": "6:00 PM - 9:00 PM",
                "budgetSelection": "20",
                "hasYmca": False,
                "showersReq": True,
                "parkingReq": False,
                "poolPref": False,
                "treadmillPref": False
            })
            assert response.status_code == 200
            body_content = response.text
            
            final_result_line = None
            for line in body_content.split("\n"):
                if "final_result" in line:
                    final_result_line = line
                    break
            
            assert final_result_line is not None
            import json
            raw_data = json.loads(final_result_line.replace("data: ", "").strip())
            
            assert raw_data["type"] == "final_result"
            assert len(raw_data["recommendations"]) >= 1
            rec = raw_data["recommendations"][0]
            assert rec["facility"]["name"] == "Life Time Fitness"
            assert rec["facility"]["pricing"]["cost"] == 20.0
            assert rec["eligibility_status"] == "Fits Your Criteria"
