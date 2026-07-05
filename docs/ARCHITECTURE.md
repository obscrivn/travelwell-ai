# TravelWell AI Architecture

TravelWell AI utilizes a hybrid architecture featuring a Python backend powered by the Google Agent Development Kit (ADK) and FastAPI, combined with a TypeScript/React frontend.

## System Overview

```
+---------------------------------------------------+
|               React Frontend (UI)                 |
|   - Trip Request Form   - Interactive Maps        |
|   - Amenity Dashboard   - Agent Progress Trace    |
+-------------------------+-------------------------+
                          | JSON API (HTTP/SSE)
                          v
+---------------------------------------------------+
|               FastAPI App (Backend)               |
|   - Session Manager    - Event Streamer           |
+-------------------------+-------------------------+
                          | Orchestration
                          v
+---------------------------------------------------+
|               Google ADK Workflow                 |
|   - Concierge Orchestrator (Orchestration Pattern)|
|   - Research & Intelligence (LLM Agent Pattern)    |
|   - Ranking & Itinerary (LLM Agent Pattern)       |
+-------------------------+-------------------------+
                          | Tools / Services
                          v
+---------------------------------------------------+
|               Services & Integration              |
|   - Google Places API   - Web Scraper / Search    |
|   - Routing Engine      - Mock Data Seed          |
+---------------------------------------------------+
```

---

## 3 Core Agents vs. 7 User-Facing Workflow Stages

To optimize performance and minimize latency, the physical implementation uses **3 Core Agents** and deterministic tools. However, for a high-fidelity user experience, the system maps execution checkpoints to the **7 logical stages** in the frontend progress trace and Agent Cards:

| Logical Stage | Executed By | Implementation Detail |
| :--- | :--- | :--- |
| **1. Trip Context** | `Concierge Orchestrator` | Extracts and parses traveler preferences (Structured Outputs via Pydantic). |
| **2. Fitness Discovery** | `Research & Intelligence Agent` | Calls Places Discovery Service for nearby candidate facilities. |
| **3. Access & Membership** | `Research & Intelligence Agent` | Evaluates pricing, day passes, guest passes, and membership compatibility. |
| **4. Facility Intelligence** | `Research & Intelligence Agent` | Gathers schedules, reviews, crowd sentiment, and amenity checks. |
| **5. Ranking** | `Ranking & Itinerary Agent` | Scores candidates based on weighted preferences. |
| **6. Itinerary** | `Ranking & Itinerary Agent` | Maps transit buffers, durations, and calendar events. |
| **7. Policy & Validation Layer** | Frontend / Concierge | Deterministically evaluates recommendations against explicit user rules. |

---

## Clean Separation Project Structure

```
travelwell-ai/
├── .agents-cli-spec.md         # CLI Project Specification
├── docs/
│   ├── ARCHITECTURE.md         # Current Architecture Spec
│   ├── API_CONTRACTS.md        # API Schema definitions
│   └── PROJECT_CHARTER.md      # Primary project goals
├── backend/                    # Cleanly Isolated Python Backend
│   ├── src/
│   │   ├── agents/
│   │   │   ├── __init__.py
│   │   │   ├── cards.py        # Agent cards (metadata, roles, I/O specifications)
│   │   │   ├── registry.py     # Central Agent Registry
│   │   │   ├── orchestrator.py # Concierge Orchestrator Workflow
│   │   │   ├── research.py     # Research & Intelligence Agent
│   │   │   └── rank_itinerary.py # Ranking & Itinerary Agent
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── places.py       # Google Places / Mock Wrapper
│   │   │   ├── routing.py      # Google Maps Routing / Mock Wrapper
│   │   │   └── scraper.py      # Facility Schedule Scraper / Mock Wrapper
│   │   ├── types/
│   │   │   ├── __init__.py
│   │   │   └── schemas.py      # Pydantic schemas (TripProfile, Itinerary, etc.)
│   │   ├── main.py             # FastAPI Application entrypoint
│   │   └── config.py           # Env/API Configs
│   ├── pyproject.toml          # Python/UV dependency declaration
│   └── .env.example
├── frontend/                   # Cleanly Isolated TypeScript/React Frontend
│   ├── src/
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
└── tests/
    ├── mock_data.json          # Seed data for offline/deterministic runs
    └── test_workflow.py        # Code correctness tests
```

---

## Agent Definitions

### 1. Concierge Orchestrator Agent
* **Pattern:** ADK workflow/orchestration pattern
* **Purpose:** Orchestrates the flow. It accepts user input, coordinates the execution of the Research and Ranking/Itinerary agents, records trace updates in the execution state, and emits trace events for the UI.
* **Input Schema:** `UserRequest` (raw prompt, location, time constraints, memberships).
* **Output Schema:** `ConciergeResponse` (ranked recommendations, schedule, stages trace log).

### 2. Research & Intelligence Agent
* **Pattern:** ADK LLM agent pattern
* **Purpose:** Acts as a specialized research assistant. Discovers gyms and facilities using Places tools, queries day-pass pricing/rules, and analyzes details (hours, pool schedules, overcrowding feedback).
* **Tools:** `search_places`, `fetch_facility_details`, `scrape_schedules`.

### 3. Ranking & Itinerary Agent
* **Pattern:** ADK LLM agent pattern
* **Purpose:** Decides the best options using multi-criteria preference matching, calculates distances and travel durations using a routing tool, and creates a formatted timeline.
* **Tools:** `calculate_route_distances`.

---

## Trace & Execution Events

To stream the progress of the multi-agent execution, the backend emits workflow updates carrying a payload containing the current `stage` progress. The frontend listens to these updates to animate the Agent Cards progress list:

* `TRIP_CONTEXT_STARTED` ➔ Parsing parameters.
* `FITNESS_DISCOVERY_STARTED` ➔ Querying Google Places.
* `ACCESS_VERIFICATION_STARTED` ➔ Validating memberships & day pass pricing.
* `FACILITY_INTELLIGENCE_STARTED` ➔ Summarizing amenities, hours, and crowd warning.
* `RANKING_STARTED` ➔ Scoring candidates.
* `ITINERARY_STARTED` ➔ Computing routes and timeline buffers.
* `POLICY_VALIDATION_READY` ➔ Dispatching complete verified recommendation JSON.
