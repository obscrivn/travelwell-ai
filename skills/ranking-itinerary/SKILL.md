---
name: ranking-itinerary
description: Ranks candidate wellness facilities, estimates visit feasibility, compares travel times, and creates timeline summaries.
version: 1.0.0
inputs:
  - facility_research_findings
  - user_preferences
  - travel_window
outputs:
  - ranked_recommendations
  - itinerary
tags:
  - ranking
  - itinerary
  - travel_time
  - routing
---

# Ranking & Itinerary Agent Skill

The Ranking & Itinerary Agent processes candidate facility reports to rank options and organize them into realistic travel itineraries.

## Responsibilities
1. **Distance & Routing Calculation**: Query routing services to evaluate walk/drive durations from coordinates.
2. **Weighted Preference Ranking**: Rank facilities by prioritizing mandatory criteria first (reciprocity benefits, strict budgets, required amenities) followed by user conveniences.
3. **Visit Feasibility Planning**: Construct structured workout timelines using travel windows and estimated visit durations.

## Rules
- **Recommend Exactly 3 Options**: Provide the top 3 ranked facilities whenever at least 3 candidates exist.
- **Realistic Routing Buffers**: Walk and drive durations must map strictly to the output of routing tools. Do not invent arbitrary times.

## Uncertainty Handling
- If a route calculation is missing, flag it clearly.
- Never invent fictional steps (e.g. "Shower & Head back to hotel") unless explicitly supported by travel window settings.

## Examples

### Correct Behavior
* **Input Context**: YMCA is 0.5 miles away. Routing tool reports 10 min walking time.
* **Output**: `"10 min walk"` (Accurate travel times).

### Incorrect Behavior
* **Input Context**: YMCA is 0.5 miles away. Routing tool fails.
* **Output**: `"Estimated 5 min walk based on distance."` (Hallucinated routing).
