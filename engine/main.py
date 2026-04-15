"""
SICHER — FastAPI Safety Scoring Engine

Exposes /score, /health, and /grid/stats endpoints for route safety assessment.
Designed to run alongside the Express gateway on port 8001.

Usage:
    uvicorn engine.main:app --port 8001 --reload
"""

import time
import uuid
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .scorer import SafetyGrid, load_grid_from_file, score_route, haversine
from .models import (
    RouteScoreRequest,
    RouteScoreResponse,
    ScoredRoute,
    ScoreDetails,
    HealthResponse,
)

# Global state
grid: SafetyGrid | None = None
start_time: float = 0


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize safety grid on startup."""
    global grid, start_time
    start_time = time.time()
    grid = load_grid_from_file()
    print(f"[SICHER Engine] Safety grid loaded: {len(grid.cells)} cells")
    yield
    print("[SICHER Engine] Shutting down")


app = FastAPI(
    title="SICHER Safety Engine",
    description="Route safety scoring API for the SICHER navigation platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

OSRM_BASE_URL = "https://router.project-osrm.org"


@app.post("/score", response_model=RouteScoreResponse)
async def score_routes(request: RouteScoreRequest):
    """
    Score walking routes between two points.

    1. Fetches 2-3 alternative routes from OSRM
    2. Scores each route against the safety grid
    3. Returns routes sorted by safety score (highest first)
    """
    request_id = str(uuid.uuid4())
    t0 = time.time()

    # Edge case: same start and end
    dist = haversine(
        request.start.lat, request.start.lng,
        request.end.lat, request.end.lng,
    )
    if dist < 0.05:
        return RouteScoreResponse(
            request_id=request_id,
            routes=[],
            advisory="🎉 You're already there!",
            destination=request.destination_name or "Unknown",
            duration_ms=int((time.time() - t0) * 1000),
        )

    if dist > 20:
        return RouteScoreResponse(
            request_id=request_id,
            routes=[],
            advisory="⚠️ Route too long for walking (>20km). Consider a ride.",
            destination=request.destination_name or "Unknown",
            duration_ms=int((time.time() - t0) * 1000),
        )

    # Fetch routes from OSRM
    osrm_routes = await fetch_osrm_routes(
        request.start.lng, request.start.lat,
        request.end.lng, request.end.lat,
    )

    if not osrm_routes:
        return RouteScoreResponse(
            request_id=request_id,
            routes=[],
            advisory="❌ No walkable routes found between these points.",
            destination=request.destination_name or "Unknown",
            duration_ms=int((time.time() - t0) * 1000),
        )

    # Score each route
    scored = []
    for i, route in enumerate(osrm_routes):
        coords = route["geometry"]["coordinates"]
        result = score_route(coords, grid)
        dist_km = round(route["distance"] / 1000, 2)
        dur_min = round(route["duration"] / 60)

        scored.append(ScoredRoute(
            id=f"route_alt_{i}" if i > 0 else "route_fast",
            label=f"Alternative Route {i}" if i > 0 else "Fastest Route",
            coordinates=coords,
            distance_km=dist_km,
            duration_min=dur_min,
            safety_score=result["score"],
            reason=result["reason"],
            warning=result["warning"],
            details=ScoreDetails(**result["details"]),
        ))

    # Sort by safety score descending
    scored.sort(key=lambda r: r.safety_score, reverse=True)
    if scored:
        scored[0].id = "route_safe"
        scored[0].label = "Safest Route"

    all_unsafe = all(r.safety_score < 30 for r in scored)
    advisory = (
        "⚠️ All routes have low safety scores. We strongly recommend a ride service."
        if all_unsafe
        else None
    )

    return RouteScoreResponse(
        request_id=request_id,
        routes=scored,
        advisory=advisory,
        destination=request.destination_name or "Unknown",
        duration_ms=int((time.time() - t0) * 1000),
    )


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """System health check endpoint."""
    return HealthResponse(
        status="healthy" if grid and len(grid.cells) > 0 else "degraded",
        version="1.0.0",
        service="SICHER Safety Engine",
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        grid_cells=len(grid.cells) if grid else 0,
        uptime_seconds=round(time.time() - start_time, 1),
    )


@app.get("/grid/stats")
async def grid_stats():
    """Safety grid statistics."""
    if not grid:
        raise HTTPException(status_code=503, detail="Grid not loaded")

    cells = grid.cells
    total = len(cells)

    avg_lighting = sum(c["lighting"] for c in cells) / total if total else 0
    avg_activity = sum(c["activity"] for c in cells) / total if total else 0
    avg_cctv = sum(c["cctv"] for c in cells) / total if total else 0
    avg_emergency = sum(c["emergency_proximity"] for c in cells) / total if total else 0

    return {
        "total_cells": total,
        "grid_size": grid.grid_size,
        "averages": {
            "lighting": round(avg_lighting, 2),
            "activity": round(avg_activity, 2),
            "cctv": round(avg_cctv, 2),
            "emergency_proximity": round(avg_emergency, 2),
        },
        "weights": grid.weights,
    }


async def fetch_osrm_routes(
    start_lng: float, start_lat: float,
    end_lng: float, end_lat: float,
) -> list:
    """Fetch walking routes from OSRM."""
    url = (
        f"{OSRM_BASE_URL}/route/v1/foot/"
        f"{start_lng},{start_lat};{end_lng},{end_lat}"
        f"?alternatives=true&overview=full&geometries=geojson&steps=false"
    )
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") == "Ok":
                return data.get("routes", [])[:3]
            return []
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="OSRM timed out")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OSRM error: {str(e)}")
