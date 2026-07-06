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
_, project_id = google.auth.default()
logging_client = google_cloud_logging.Client()
logger = logging_client.logger(__name__)
allow_origins = (
    os.getenv("ALLOW_ORIGINS", "").split(",") if os.getenv("ALLOW_ORIGINS") else None
)

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
    allow_origins=[
        "http://localhost:5173",
        "https://travelwell-frontend-163831374566.us-central1.run.app",
        "http://localhost:8000"
    ],
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


@app.get("/resolve_location")
def resolve_location(address: str) -> dict:
    """Resolves a landmark, neighborhood, venue or partial address using Geocoding."""
    from app.services.google_maps import geocode_address
    return geocode_address(address)


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
        
        session_service = services.get_session_service()
        session = await session_service.create_session(user_id=user_id, app_name=request.app.state.agent_app_name)
    except Exception as e:
        tb = traceback.format_exc()
        print(f"API initialization error: {e}\n{tb}")
        return JSONResponse(
            status_code=500,
            content={
                "error_type": type(e).__name__,
                "stage": "initialization",
                "message": str(e),
                "details": tb
            }
        )
    
    async def event_generator():
        message = types.Content(role="user", parts=[types.Part.from_text(text=prompt)])
        current_agent = "research_intelligence"
        try:
            events = runner.run(
                new_message=message,
                user_id=user_id,
                session_id=session.id,
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
                yield f"data: {json.dumps(event_dict)}\n\n"
        except Exception as e:
            tb = traceback.format_exc()
            print(f"Agent execution stream error during {current_agent}: {e}\n{tb}")
            
            err_msg = str(e)
            if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
                err_msg = "Google Vertex AI Rate limit exceeded (429 Resource Exhausted). Please wait a moment and try again."
                
            err_dict = {
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
