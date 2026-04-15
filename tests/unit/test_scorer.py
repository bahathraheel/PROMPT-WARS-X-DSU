"""
SICHER — Unit Tests: Safety Scoring Algorithm
"""

import json
import os
import pytest
import sys

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from engine.scorer import (
    SafetyGrid,
    score_route,
    haversine,
    sample_route_points,
    generate_reason,
)


@pytest.fixture
def sample_grid():
    """Create a minimal test grid."""
    grid_data = {
        "grid_size": 0.002,
        "weights": {"lighting": 3, "activity": 2, "cctv": 2, "emergency_proximity": 1},
        "cells": [
            {"lat": 28.614, "lng": 77.209, "lighting": 9, "activity": 8, "cctv": 8, "emergency_proximity": 9},
            {"lat": 28.615, "lng": 77.209, "lighting": 7, "activity": 6, "cctv": 6, "emergency_proximity": 7},
            {"lat": 28.616, "lng": 77.209, "lighting": 3, "activity": 2, "cctv": 2, "emergency_proximity": 3},
            {"lat": 28.614, "lng": 77.211, "lighting": 8, "activity": 8, "cctv": 7, "emergency_proximity": 8},
            {"lat": 28.615, "lng": 77.211, "lighting": 5, "activity": 4, "cctv": 4, "emergency_proximity": 5},
        ],
    }
    return SafetyGrid(grid_data)


@pytest.fixture
def safe_route():
    """Route through well-lit areas."""
    return [
        [77.209, 28.614],
        [77.210, 28.614],
        [77.211, 28.614],
    ]


@pytest.fixture
def unsafe_route():
    """Route through poorly lit areas."""
    return [
        [77.209, 28.616],
        [77.210, 28.616],
        [77.211, 28.616],
    ]


class TestHaversine:
    """Test haversine distance calculation."""

    def test_known_distance(self):
        """Distance between two known points (Delhi to Agra ~200km)."""
        dist = haversine(28.6139, 77.2090, 27.1767, 78.0081)
        assert 180 < dist < 220

    def test_same_point(self):
        """Distance to itself should be 0."""
        dist = haversine(28.6139, 77.2090, 28.6139, 77.2090)
        assert dist == 0.0

    def test_equator(self):
        """Test on equator."""
        dist = haversine(0, 0, 0, 1)
        assert 110 < dist < 112  # ~111km per degree at equator

    def test_symmetry(self):
        """Distance A→B should equal B→A."""
        d1 = haversine(28.6139, 77.2090, 28.6129, 77.2295)
        d2 = haversine(28.6129, 77.2295, 28.6139, 77.2090)
        assert abs(d1 - d2) < 0.001


class TestSampleRoutePoints:
    """Test route coordinate sampling."""

    def test_empty_route(self):
        assert sample_route_points([]) == []

    def test_single_point(self):
        result = sample_route_points([[77.209, 28.614]])
        assert len(result) == 1

    def test_includes_start_and_end(self):
        coords = [[77.209, 28.614], [77.210, 28.614], [77.211, 28.614]]
        result = sample_route_points(coords, interval_km=0.01)
        assert result[0] == coords[0]
        assert result[-1] == coords[-1]


class TestScoring:
    """Test the safety scoring algorithm."""

    def test_safe_route_scores_high(self, sample_grid, safe_route):
        result = score_route(safe_route, sample_grid)
        assert result["score"] >= 60
        assert not result["warning"]

    def test_unsafe_route_scores_low(self, sample_grid, unsafe_route):
        result = score_route(unsafe_route, sample_grid)
        assert result["score"] < 40

    def test_warning_flag_when_low(self, sample_grid, unsafe_route):
        result = score_route(unsafe_route, sample_grid)
        assert result["warning"] == (result["score"] < 30)

    def test_score_range(self, sample_grid, safe_route):
        result = score_route(safe_route, sample_grid)
        assert 0 <= result["score"] <= 100

    def test_has_reason(self, sample_grid, safe_route):
        result = score_route(safe_route, sample_grid)
        assert isinstance(result["reason"], str)
        assert len(result["reason"]) > 10

    def test_has_details(self, sample_grid, safe_route):
        result = score_route(safe_route, sample_grid)
        details = result["details"]
        assert "scored_points" in details
        assert "coverage_pct" in details
        assert 0 <= details["avg_lighting"] <= 10
        assert 0 <= details["avg_activity"] <= 10

    def test_empty_route(self, sample_grid):
        result = score_route([], sample_grid)
        assert result["score"] == 0

    def test_outside_grid(self, sample_grid):
        """Route far from any grid cells should have low coverage."""
        far_route = [[0.0, 0.0], [0.001, 0.001]]
        result = score_route(far_route, sample_grid)
        assert result["details"]["coverage_pct"] < 50


class TestReasonGeneration:
    """Test natural language reason generation."""

    def test_high_score_reason(self):
        reason = generate_reason(85, 8.0, 8.0, 7.0, 8.0, 0)
        assert "Recommended" in reason

    def test_medium_score_reason(self):
        reason = generate_reason(50, 4.0, 4.0, 4.0, 5.0, 0)
        assert "Caution" in reason

    def test_low_score_reason(self):
        reason = generate_reason(20, 2.0, 2.0, 2.0, 2.0, 5)
        assert "Warning" in reason
        assert "ride service" in reason

    def test_includes_specifics(self):
        reason = generate_reason(85, 9.0, 3.0, 8.0, 8.0, 0)
        assert "well-lit" in reason


class TestSafetyGrid:
    """Test the SafetyGrid spatial index."""

    def test_find_nearest_exact(self, sample_grid):
        cell = sample_grid.find_nearest(28.614, 77.209)
        assert cell is not None
        assert cell["lighting"] == 9

    def test_find_nearest_nearby(self, sample_grid):
        cell = sample_grid.find_nearest(28.6141, 77.2091)
        assert cell is not None

    def test_find_nearest_too_far(self, sample_grid):
        cell = sample_grid.find_nearest(0.0, 0.0)  # Way outside grid
        assert cell is None

    def test_grid_cell_count(self, sample_grid):
        assert len(sample_grid.cells) == 5
