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
