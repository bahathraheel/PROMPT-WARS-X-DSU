"""
SICHER — Safety Scoring Algorithm (Python Implementation)

Scores walking routes by cross-referencing sampled coordinates against
a spatial grid of simulated safety data (lighting, activity, CCTV, emergency).

Uses numpy for efficient array math and a hash-based spatial index for O(1) lookups.
"""

import math
import json
from pathlib import Path
from typing import Optional

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

# Default scoring weights
DEFAULT_WEIGHTS = {
    "lighting": 3,
    "activity": 2,
    "cctv": 2,
    "emergency_proximity": 1,
}


class SafetyGrid:
    """Spatial index over safety grid cells for O(1) coordinate lookups."""

    def __init__(self, grid_data: dict):
        self.grid_size = grid_data.get("grid_size", 0.002)
        self.weights = grid_data.get("weights", DEFAULT_WEIGHTS)
        self.cells = grid_data.get("cells", [])
        self._index: dict = {}
        self._build_index()

    def _build_index(self):
        """Build hash-based spatial index from grid cells."""
        precision = 1000  # ~111m resolution
        for cell in self.cells:
            key = (round(cell["lat"] * precision), round(cell["lng"] * precision))
            self._index[key] = cell

    def find_nearest(self, lat: float, lng: float, max_dist_km: float = 0.5):
        """
        Find the nearest grid cell to a coordinate.

        Args:
            lat: Latitude
            lng: Longitude
            max_dist_km: Maximum search radius in km

        Returns:
            dict or None: Nearest cell data, or None if none within radius
        """
        precision = 1000
        base_lat = round(lat * precision)
        base_lng = round(lng * precision)
        search_radius = 3

        best_cell = None
        best_dist = float("inf")

        for d_lat in range(-search_radius, search_radius + 1):
            for d_lng in range(-search_radius, search_radius + 1):
                key = (base_lat + d_lat, base_lng + d_lng)
                cell = self._index.get(key)
                if cell:
                    dist = haversine(lat, lng, cell["lat"], cell["lng"])
                    if dist < best_dist:
                        best_dist = dist
                        best_cell = cell

        return best_cell if best_dist <= max_dist_km else None


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate haversine distance between two points in km."""
    R = 6371  # Earth radius km
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def sample_route_points(coordinates: list, interval_km: float = 0.05) -> list:
    """
    Sample points along a route at regular intervals (~50m).

    Args:
        coordinates: List of [lng, lat] pairs
        interval_km: Sampling interval in km

    Returns:
        List of sampled [lng, lat] pairs
    """
    if not coordinates:
        return []

    sampled = [coordinates[0]]
    accumulated = 0.0

    for i in range(1, len(coordinates)):
        lng1, lat1 = coordinates[i - 1]
        lng2, lat2 = coordinates[i]
        seg_dist = haversine(lat1, lng1, lat2, lng2)
        accumulated += seg_dist

        if accumulated >= interval_km:
            sampled.append(coordinates[i])
            accumulated = 0.0

    # Always include the last point
    if sampled[-1] != coordinates[-1]:
        sampled.append(coordinates[-1])

    return sampled


def score_route(
    coordinates: list,
    grid: SafetyGrid,
    weights: Optional[dict] = None,
) -> dict:
    """
    Score a single route based on safety grid data.

    Args:
        coordinates: List of [lng, lat] pairs
        grid: SafetyGrid instance
        weights: Optional weight overrides

    Returns:
        dict with score, reason, segments, warning, details
    """
    w = weights or grid.weights
    total_weight = (
        w["lighting"] + w["activity"] + w["cctv"] + w["emergency_proximity"]
    )

    sampled = sample_route_points(coordinates)
    segments = []
    scores = []
    unscored = 0

    # Component accumulators
    total_lighting = 0.0
    total_activity = 0.0
    total_cctv = 0.0
    total_emergency = 0.0
    scored_count = 0

    for lng, lat in sampled:
        cell = grid.find_nearest(lat, lng)
        if cell:
            point_score = (
                w["lighting"] * cell["lighting"]
                + w["activity"] * cell["activity"]
                + w["cctv"] * cell["cctv"]
                + w["emergency_proximity"] * cell["emergency_proximity"]
            ) / total_weight

            scores.append(point_score)
            total_lighting += cell["lighting"]
            total_activity += cell["activity"]
            total_cctv += cell["cctv"]
            total_emergency += cell["emergency_proximity"]
            scored_count += 1

            segments.append({"from_coord": [lng, lat], "score": round(point_score * 10)})
        else:
            unscored += 1
            scores.append(3.0)  # Cautious default
            segments.append({"from_coord": [lng, lat], "score": 30})

    # Calculate final score
    if HAS_NUMPY:
        avg_score = float(np.mean(scores)) if scores else 0.0
    else:
        avg_score = sum(scores) / len(scores) if scores else 0.0

    final_score = round(avg_score * 10)
    final_score = max(0, min(100, final_score))

    # Component averages
    safe_div = max(scored_count, 1)
    avg_l = round(total_lighting / safe_div, 1)
    avg_a = round(total_activity / safe_div, 1)
    avg_c = round(total_cctv / safe_div, 1)
    avg_e = round(total_emergency / safe_div, 1)

    reason = generate_reason(final_score, avg_l, avg_a, avg_c, avg_e, unscored)

    return {
        "score": final_score,
        "reason": reason,
        "segments": segments,
        "warning": final_score < 30,
        "details": {
            "scored_points": scored_count + unscored,
            "unscored_points": unscored,
            "coverage_pct": round((scored_count / max(scored_count + unscored, 1)) * 100),
            "avg_lighting": avg_l,
            "avg_activity": avg_a,
            "avg_cctv": avg_c,
            "avg_emergency": avg_e,
        },
    }


def generate_reason(
    score: int,
    lighting: float,
    activity: float,
    cctv: float,
    emergency: float,
    unscored: int,
) -> str:
    """Generate human-readable safety assessment."""
    parts = []

    if score >= 70:
        if lighting >= 7:
            parts.append("well-lit streets")
        if activity >= 7:
            parts.append("high pedestrian activity")
        if cctv >= 7:
            parts.append("good CCTV coverage")
        if emergency >= 7:
            parts.append("near emergency services")
        if not parts:
            parts.append("generally safe conditions")
        return f"Recommended: {', '.join(parts)}."

    if score >= 40:
        if lighting < 5:
            parts.append("some poorly lit sections")
        if activity < 5:
            parts.append("low foot traffic in parts")
        if cctv < 5:
            parts.append("limited surveillance")
        if not parts:
            parts.append("moderate safety conditions")
        return f"Caution: {', '.join(parts)}."

    # Low score
    if lighting < 4:
        parts.append("poorly lit area")
    if activity < 3:
        parts.append("minimal foot traffic")
    if cctv < 3:
        parts.append("no surveillance coverage")
    if unscored > 3:
        parts.append("unmapped zones along route")
    if not parts:
        parts.append("generally unsafe conditions")
    return f"Warning: {', '.join(parts)}. Consider a ride service instead."


def load_grid_from_file(filepath: str = None) -> SafetyGrid:
    """Load safety grid from JSON file."""
    if filepath is None:
        filepath = str(
            Path(__file__).parent.parent / "backend" / "data" / "safety_grid.json"
        )
    with open(filepath, "r") as f:
        data = json.load(f)
    return SafetyGrid(data)
