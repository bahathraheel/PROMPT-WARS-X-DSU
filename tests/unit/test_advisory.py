"""
SICHER — Unit Tests: Advisory Logic

Tests the edge case where ALL routes have low safety scores
and the system should recommend alternative transportation.
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from engine.scorer import SafetyGrid, score_route


@pytest.fixture
def dangerous_grid():
    """Grid where ALL cells have very low safety scores."""
    return SafetyGrid({
        "grid_size": 0.002,
        "weights": {"lighting": 3, "activity": 2, "cctv": 2, "emergency_proximity": 1},
        "cells": [
            {"lat": 28.614, "lng": 77.209, "lighting": 1, "activity": 1, "cctv": 1, "emergency_proximity": 1},
            {"lat": 28.615, "lng": 77.209, "lighting": 2, "activity": 1, "cctv": 1, "emergency_proximity": 2},
            {"lat": 28.616, "lng": 77.209, "lighting": 1, "activity": 1, "cctv": 1, "emergency_proximity": 1},
            {"lat": 28.614, "lng": 77.211, "lighting": 2, "activity": 2, "cctv": 1, "emergency_proximity": 1},
            {"lat": 28.615, "lng": 77.211, "lighting": 1, "activity": 1, "cctv": 1, "emergency_proximity": 1},
        ],
    })


@pytest.fixture
def safe_grid():
    """Grid where ALL cells are perfectly safe."""
    return SafetyGrid({
        "grid_size": 0.002,
        "weights": {"lighting": 3, "activity": 2, "cctv": 2, "emergency_proximity": 1},
        "cells": [
            {"lat": 28.614, "lng": 77.209, "lighting": 10, "activity": 10, "cctv": 10, "emergency_proximity": 10},
            {"lat": 28.615, "lng": 77.209, "lighting": 10, "activity": 10, "cctv": 10, "emergency_proximity": 10},
            {"lat": 28.616, "lng": 77.209, "lighting": 10, "activity": 10, "cctv": 10, "emergency_proximity": 10},
        ],
    })


@pytest.fixture
def route_through_grid():
    return [[77.209, 28.614], [77.209, 28.615], [77.209, 28.616]]


class TestAllRoutesUnsafe:
    """Tests for when all routes have terrible safety scores."""

    def test_all_routes_below_30_triggers_warning(self, dangerous_grid, route_through_grid):
        """When every route scores < 30, each should have warning=True."""
        result = score_route(route_through_grid, dangerous_grid)
        assert result["score"] < 30
        assert result["warning"] is True

    def test_warning_reason_suggests_ride(self, dangerous_grid, route_through_grid):
        """Warning reason should suggest alternative transport."""
        result = score_route(route_through_grid, dangerous_grid)
        assert "ride service" in result["reason"].lower() or "unsafe" in result["reason"].lower()

    def test_advisory_determination(self, dangerous_grid, route_through_grid):
        """Simulate checking multiple routes for advisory."""
        routes = [
            score_route(route_through_grid, dangerous_grid),
            score_route(route_through_grid, dangerous_grid),
        ]
        all_unsafe = all(r["score"] < 30 for r in routes)
        assert all_unsafe is True


class TestAllRoutesSafe:
    """Tests for when routes are perfectly safe."""

    def test_safe_routes_no_warning(self, safe_grid, route_through_grid):
        result = score_route(route_through_grid, safe_grid)
        assert result["score"] >= 70
        assert result["warning"] is False

    def test_safe_reason_is_positive(self, safe_grid, route_through_grid):
        result = score_route(route_through_grid, safe_grid)
        assert "Recommended" in result["reason"]


class TestEdgeCasesAt30:
    """Tests for scores exactly at the warning threshold (30)."""

    def test_borderline_grid(self):
        """Create a grid that produces exactly borderline scores."""
        borderline_grid = SafetyGrid({
            "grid_size": 0.002,
            "weights": {"lighting": 1, "activity": 1, "cctv": 1, "emergency_proximity": 1},
            "cells": [
                {"lat": 28.614, "lng": 77.209, "lighting": 3, "activity": 3, "cctv": 3, "emergency_proximity": 3},
            ],
        })
        route = [[77.209, 28.614]]
        result = score_route(route, borderline_grid)
        # Score of 3/10 → 30. warning is True if score < 30
        assert result["score"] == 30
        assert result["warning"] is False  # 30 is NOT below 30


class TestMixedScoring:
    """Tests with routes that have mixed safe/unsafe segments."""

    def test_mixed_route_average(self, dangerous_grid, safe_grid, route_through_grid):
        """Safe grid should score higher than dangerous grid."""
        safe_result = score_route(route_through_grid, safe_grid)
        danger_result = score_route(route_through_grid, dangerous_grid)
        assert safe_result["score"] > danger_result["score"]

    def test_custom_weights(self, dangerous_grid, route_through_grid):
        """Custom weights should affect scoring."""
        heavy_lighting = {"lighting": 10, "activity": 1, "cctv": 1, "emergency_proximity": 1}
        result = score_route(route_through_grid, dangerous_grid, weights=heavy_lighting)
        assert result["score"] >= 0  # Just verify it doesn't crash
