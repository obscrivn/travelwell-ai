import sys
sys.path.insert(0, "/Users/olgascrivner/Documents/WTM Ambassador/Kaggle/travelwell-ai/backend")

from app.fast_api_app import app
import google.adk.cli.fast_api

print("fast_api file path:", google.adk.cli.fast_api.__file__)

print("\n--- Available API Endpoints ---")
for route in app.routes:
    print(f"Path: {route.path} | Name: {route.name} | Methods: {getattr(route, 'methods', None)}")
