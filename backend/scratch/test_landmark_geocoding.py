import sys
sys.path.insert(0, "/Users/olgascrivner/Documents/WTM Ambassador/Kaggle/travelwell-ai/backend")
from dotenv import load_dotenv
load_dotenv()

from app.services.google_maps import geocode_address

res = geocode_address("McCormick Place, Chicago")
print("Geocoding result:", res)
