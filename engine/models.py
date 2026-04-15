"""
SICHER — Pydantic Models for FastAPI Safety Engine

Defines strict request/response schemas with built-in validation.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional


class Coordinate(BaseModel):
    """A geographic coordinate pair."""
    lat: float = Field(..., ge=-90, le=90, description="Latitude (-90 to 90)")
    lng: float = Field(..., ge=-180, le=180, description="Longitude (-180 to 180)")


class RouteScoreRequest(BaseModel):
    """Request body for the /score endpoint."""
    start: Coordinate = Field(..., description="Starting point coordinates")
    end: Coordinate = Field(..., description="Destination coordinates")
    destination_name: Optional[str] = Field(
        default="Unknown",
        max_length=200,
        description="Human-readable destination name"
    )

    @field_validator('destination_name')
    @classmethod
    def sanitize_destination(cls, v):
        """Strip potentially dangerous characters from destination name."""
        if v:
            # Allow alphanumeric, spaces, commas, periods, hyphens
            import re
            v = re.sub(r'[^\w\s,.\-]', '', v)
        return v


class SegmentScore(BaseModel):
    """Safety score for a single route segment."""
    from_coord: list[float] = Field(..., description="[lng, lat] start of segment")
    score: int = Field(..., ge=0, le=100, description="Safety score 0-100")


class ScoreDetails(BaseModel):
    """Detailed breakdown of the scoring computation."""
    scored_points: int = Field(..., ge=0)
    unscored_points: int = Field(..., ge=0)
    coverage_pct: int = Field(..., ge=0, le=100)
    avg_lighting: float = Field(..., ge=0, le=10)
    avg_activity: float = Field(..., ge=0, le=10)
    avg_cctv: float = Field(..., ge=0, le=10)
    avg_emergency: float = Field(..., ge=0, le=10)


class ScoredRoute(BaseModel):
    """A single route with its safety assessment."""
    id: str
    label: str
    coordinates: list[list[float]] = Field(..., description="Array of [lng, lat] pairs")
    distance_km: float
    duration_min: int
    safety_score: int = Field(..., ge=0, le=100)
    reason: str
    warning: bool = False
    details: ScoreDetails


class RouteScoreResponse(BaseModel):
    """Response body from the /score endpoint."""
    request_id: str
    routes: list[ScoredRoute]
    advisory: Optional[str] = None
    destination: str = "Unknown"
    duration_ms: int


class HealthResponse(BaseModel):
    """Response body from the /health endpoint."""
    status: str
    version: str
    service: str
    timestamp: str
    grid_cells: int
    uptime_seconds: float
