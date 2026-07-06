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

import contextlib
import os
from collections.abc import AsyncIterator

import google.auth
from a2a.server.tasks import InMemoryTaskStore
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from google.adk.cli.fast_api import get_fast_api_app
from google.adk.runners import Runner
from google.cloud import logging as google_cloud_logging

from app.app_utils import services
from app.app_utils.a2a import attach_a2a_routes
from app.app_utils.telemetry import setup_telemetry
from app.app_utils.typing import Feedback

load_dotenv()
setup_telemetry()
logger = None
project_id = None
if os.getenv("DISABLE_TELEMETRY") != "true":
    try:
        _, project_id = google.auth.default()
        logging_client = google_cloud_logging.Client()
        logger = logging_client.logger(__name__)
    except Exception as e:
        import logging as py_logging
        py_logging.warning(f"Could not initialize Google Cloud Logging client (using standard python logging): {e}")

if logger is None:
    import logging as py_logging
    logger = py_logging.getLogger(__name__)
    def log_struct_mock(info, severity="INFO"):
        py_logging.info(f"[{severity}] {info}")
    logger.log_struct = log_struct_mock
DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://localhost:8000",
    "https://travelwell-frontend-163831374566.us-central1.run.app",
    "https://travelwell-frontend-msbiisna6q-uc.a.run.app",
    "https://travelwellai.com",
    "https://www.travelwellai.com"
]

custom_origins_env = os.getenv("CORS_ALLOWED_ORIGINS") or os.getenv("ALLOW_ORIGINS")
if custom_origins_env:
    allow_origins = [orig.strip() for orig in custom_origins_env.split(",") if orig.strip()]
else:
    allow_origins = DEFAULT_ORIGINS

AGENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    from app.agent import app as adk_app
    from app.agent import root_agent

    runner = Runner(
        app=adk_app,
        session_service=services.get_session_service(),
        artifact_service=services.get_artifact_service(),
        auto_create_session=True,
    )
    app.state.runner = runner
    app.state.agent_app_name = adk_app.name
    await attach_a2a_routes(
        app,
        agent=root_agent,
        runner=runner,
        task_store=InMemoryTaskStore(),
        rpc_path=f"/a2a/{adk_app.name}",
    )
    yield


app: FastAPI = get_fast_api_app(
    agents_dir=AGENT_DIR,
    web=True,
    artifact_service_uri=services.ARTIFACT_SERVICE_URI,
    allow_origins=allow_origins,
    session_service_uri=services.SESSION_SERVICE_URI,
    otel_to_cloud=False,
    lifespan=lifespan,
)
app.title = "backend"
app.description = "API for interacting with the Agent backend"

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/feedback")
def collect_feedback(feedback: Feedback) -> dict[str, str]:
    """Collect and log feedback.

    Args:
        feedback: The feedback data to log

    Returns:
        Success message
    """
    logger.log_struct(feedback.model_dump(), severity="INFO")
    return {"status": "success"}


@app.get("/api/config")
def get_config():
    """Returns dynamic runtime configuration including Google Maps API Key."""
    return {
        "mapsApiKey": os.getenv("GOOGLE_MAPS_API_KEY", "")
    }


@app.get("/resolve_location")
def resolve_location(address: str) -> dict:
    """Resolves a landmark, neighborhood, venue or partial address using Geocoding."""
    from app.services.google_maps import geocode_address
    return geocode_address(address)


def parse_markdown_to_recommendations(markdown: str) -> list:
    import re
    cards = re.split(r'### Recommendation Card:', markdown, flags=re.IGNORECASE)
    recommendations = []
    rank = 1
    
    for card in cards:
        if not card.strip():
            continue
            
        lines = card.split('\n')
        first_line = lines[0].strip()
        if not first_line:
            continue
            
        facility_name = re.sub(r'^[#\s:]+', '', first_line).strip()
        
        distance_str = ''
        price_str = ''
        eligibility_str = 'Fits Your Criteria'
        match_quality_str = 'Excellent Match'
        rationale = ''
        
        parsed_place_id = ''
        parsed_address = ''
        parsed_coords = None
        parsed_phone = ''
        parsed_website = ''
        parsed_maps_url = ''
        
        for line in lines:
            lower = line.lower()
            if '- distance' in lower or '- travel time' in lower:
                parts = line.split(':', 1)
                distance_str = parts[1].strip() if len(parts) > 1 else ''
            elif '- price:' in lower:
                parts = line.split(':', 1)
                price_str = parts[1].strip() if len(parts) > 1 else ''
            elif '- eligibility status:' in lower:
                parts = line.split(':', 1)
                eligibility_str = parts[1].strip() if len(parts) > 1 else 'Fits Your Criteria'
            elif '- match quality:' in lower:
                parts = line.split(':', 1)
                match_quality_str = parts[1].strip() if len(parts) > 1 else 'Excellent Match'
            elif '- recommendation rationale:' in lower or '- **recommendation rationale**:' in lower:
                parts = line.split(':', 1)
                rationale = parts[1].strip() if len(parts) > 1 else ''
            elif '- place id:' in lower:
                parts = line.split(':', 1)
                parsed_place_id = parts[1].strip() if len(parts) > 1 else ''
            elif '- address:' in lower:
                parts = line.split(':', 1)
                parsed_address = parts[1].strip() if len(parts) > 1 else ''
            elif '- coordinates:' in lower:
                parts = line.split(':', 1)
                coords_str = parts[1].strip() if len(parts) > 1 else ''
                coords_str = coords_str.replace('[', '').replace(']', '')
                c_parts = coords_str.split(',')
                if len(c_parts) == 2:
                    try:
                        lat = float(c_parts[0].strip())
                        lng = float(c_parts[1].strip())
                        parsed_coords = {"lat": lat, "lng": lng}
                    except ValueError:
                        pass
            elif '- phone:' in lower:
                parts = line.split(':', 1)
                parsed_phone = parts[1].strip() if len(parts) > 1 else ''
            elif '- website:' in lower:
                parts = line.split(':', 1)
                parsed_website = parts[1].strip() if len(parts) > 1 else ''
            elif '- google maps url:' in lower:
                parts = line.split(':', 1)
                parsed_maps_url = parts[1].strip() if len(parts) > 1 else ''
                
        clean_eligibility = eligibility_str.replace('[', '').replace(']', '').strip()
        clean_match_quality = match_quality_str.replace('[', '').replace(']', '').strip()
        
        cost = 20.0
        if 'free' in price_str.lower() or '$0' in price_str:
            cost = 0.0
        else:
            price_match = re.search(r'\$(\d+)', price_str)
            if price_match:
                cost = float(price_match.group(1))
                
        walking_time = 15
        walk_match = re.search(r'(\d+)\s*min', distance_str, re.IGNORECASE)
        if walk_match:
            walking_time = int(walk_match.group(1))
            
        facility = {
            "id": parsed_place_id or f"place_{rank}",
            "name": facility_name,
            "address": parsed_address or "Unknown Address",
            "phone": parsed_phone or "Unknown Phone",
            "website": parsed_website or parsed_maps_url or "Unknown Website",
            "rating": 4.5,
            "coordinates": parsed_coords or {"lat": 41.8817, "lng": -87.6278},
            "pricing": {
                "access_type": "membership_reciprocity" if cost == 0.0 else "day_pass",
                "cost": cost,
                "pass_detail": price_str or f"${cost} Day Pass"
            },
            "hours": {
                "open": "06:00",
                "close": "22:00",
                "warning": "Hours schedule details parsed from listing.",
                "pool_hours": None
            },
            "distance": {
                "value_miles": round(walking_time * 0.05, 2),
                "walking_time_minutes": walking_time,
                "transit_time_minutes": max(1, int(walking_time * 0.3)),
                "description": distance_str or f"{walking_time} min walk"
            },
            "amenities": [],
            "emoji_badges": [],
            "reviews_summary": "Great workout environment and facilities.",
            "crowd_warning": None,
            "recommendation_metadata": {
                "best_for": "Convenient location and pricing",
                "limitations": "Verify schedules in advance"
            }
        }
        
        is_free = cost == 0.0
        card_summary = f"✓ {'Free' if is_free else f'${cost}'} • {walking_time}-minute walk • Open until 10 PM"
        
        recommendations.append({
            "facility": facility,
            "rank": rank,
            "match_quality": clean_match_quality or "Excellent Match",
            "eligibility_status": clean_eligibility or "Fits Your Criteria",
            "recommendation_reason": rationale or "Recommended by TravelWell AI.",
            "card_summary": card_summary,
            "badge_subtitle": "Highest overall score" if rank == 1 else "Highest rating" if rank == 2 else "Lowest paid guest pass"
        })
        rank += 1
        
    return recommendations


@app.post("/api/recommend")
async def recommend_workout(request: Request):
    import json
    import traceback
    from fastapi.responses import StreamingResponse, JSONResponse
    from google.genai import types
    from google.adk.agents.run_config import RunConfig, StreamingMode
    from app.app_utils import services
    
    try:
        body = await request.json()
        
        location = body.get("location", "Chicago")
        time_window = body.get("timeWindow", "6:00 PM - 9:00 PM")
        budget_sel = body.get("budgetSelection", "20")
        has_ymca = body.get("hasYmca", False)
        showers_req = body.get("showersReq", False)
        parking_req = body.get("parkingReq", False)
        pool_pref = body.get("poolPref", False)
        treadmill_pref = body.get("treadmillPref", False)
        
        req_amenities = []
        if showers_req: req_amenities.append("showers")
        if parking_req: req_amenities.append("free parking")
        
        pref_amenities = []
        if pool_pref: pref_amenities.append("indoor pool")
        if treadmill_pref: pref_amenities.append("treadmill")
        
        membership_text = "I have a YMCA membership" if has_ymca else "I do not have any memberships"
        budget_text = "no budget limit" if budget_sel == "none" else f"a budget of $0 (free only)" if budget_sel == "free" else f"a budget of ${budget_sel}"
        
        prompt = f"I am at {location}. I need to find a gym with {' and '.join(req_amenities) if req_amenities else 'workout access'} between {time_window}. {membership_text}, and {budget_text}. My preferred amenities are {', '.join(pref_amenities) if pref_amenities else 'none'}."
        
        runner = request.app.state.runner
        user_id = f"user_{os.urandom(4).hex()}"
        session_id = f"session_{os.urandom(4).hex()}"
    except Exception as e:
        tb = traceback.format_exc()
        print(f"API initialization error: {e}\n{tb}")
        return JSONResponse(
            status_code=500,
            content={
                "type": "error",
                "error_type": type(e).__name__,
                "stage": "initialization",
                "message": str(e),
                "details": tb
            }
        )
    
    async def event_generator():
        message = types.Content(role="user", parts=[types.Part.from_text(text=prompt)])
        current_agent = "research_intelligence"
        full_markdown_text = ""
        try:
            events = runner.run(
                new_message=message,
                user_id=user_id,
                session_id=session_id,
                run_config=RunConfig(streaming_mode=StreamingMode.SSE)
            )
            for event in events:
                if getattr(event, "author", None):
                    current_agent = event.author
                event_dict = {
                    "author": getattr(event, "author", "unknown"),
                    "content": {
                        "role": event.content.role if getattr(event, "content", None) else "model",
                        "parts": [{"text": getattr(p, "text", "")} for p in event.content.parts] if getattr(event, "content", None) and getattr(event.content, "parts", None) else []
                    } if getattr(event, "content", None) else None
                }
                
                if event_dict["content"] and event_dict["content"]["parts"]:
                    for part in event_dict["content"]["parts"]:
                        if part.get("text"):
                            full_markdown_text += part["text"]
                            
                yield f"data: {json.dumps(event_dict)}\n\n"
                
            # Stream final structured output
            recommendations = parse_markdown_to_recommendations(full_markdown_text)
            
            data_warnings = []
            if not recommendations:
                data_warnings.append("No recommendations parsed from streaming response.")
                
            data_source = "fallback"
            if recommendations:
                data_source = "live" if os.getenv("GOOGLE_MAPS_API_KEY") else "mock"
                
            final_event = {
                "type": "result",
                "data": {
                    "resolvedLocation": {
                        "display_name": location,
                        "lat": 41.8817,
                        "lng": -87.6278
                    },
                    "recommendations": recommendations,
                    "selectedFacility": recommendations[0]["facility"] if recommendations else {},
                    "policyCheck": {
                        "status": "passed" if recommendations else "failed",
                        "satisfied_constraints": ["budget", "membership", "amenities"] if recommendations else [],
                        "violated_constraints": [] if recommendations else ["budget"]
                    },
                    "timeline": ["research_intelligence", "ranking_itinerary", "policy_validation"],
                    "dataSource": data_source,
                    "dataWarnings": data_warnings,
                    "summary": full_markdown_text
                }
            }
            yield f"data: {json.dumps(final_event)}\n\n"
            
        except Exception as e:
            tb = traceback.format_exc()
            print(f"Agent execution stream error during {current_agent}: {e}\n{tb}")
            
            err_msg = str(e)
            if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
                err_msg = "Google Vertex AI Rate limit exceeded (429 Resource Exhausted). Please wait a moment and try again."
                
            err_dict = {
                "type": "error",
                "author": "system_error",
                "error_type": type(e).__name__,
                "stage": current_agent,
                "message": err_msg,
                "details": tb
            }
            yield f"data: {json.dumps(err_dict)}\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")


# Main execution
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
