/**
 * SICHER — Main Route Endpoint
 * 
 * POST /api/route
 * Accepts start/end coordinates, fetches alternative routes from OSRM,
 * scores each route for safety, returns ranked results.
 */

const express = require('express');
const Joi = require('joi');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const { scoreRoute, calculateDistanceKm, estimateWalkingMinutes } = require('../lib/scorer');

const router = express.Router();

// Input validation schema
const routeSchema = Joi.object({
  start_lat: Joi.number().min(-90).max(90).required()
    .messages({ 'number.min': 'Latitude must be between -90 and 90' }),
  start_lng: Joi.number().min(-180).max(180).required()
    .messages({ 'number.min': 'Longitude must be between -180 and 180' }),
  end_lat: Joi.number().min(-90).max(90).required(),
  end_lng: Joi.number().min(-180).max(180).required(),
  destination_name: Joi.string().max(200).optional().default('Unknown'),
});

/**
 * POST /api/route
 * 
 * Body: { start_lat, start_lng, end_lat, end_lng, destination_name? }
 * Returns: { routes: [...], advisory?, request_id }
 */
router.post('/', async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    // Validate input
    const { error, value } = routeSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const err = new Error('Invalid input');
      err.statusCode = 400;
      err.details = error.details.map(d => d.message);
      return next(err);
    }

    const { start_lat, start_lng, end_lat, end_lng, destination_name } = value;

    // Edge case: same start and end
    const dist = haversineQuick(start_lat, start_lng, end_lat, end_lng);
    if (dist < 0.05) {
      return res.json({
        request_id: requestId,
        routes: [],
        advisory: '🎉 You\'re already there! Your start and end points are the same location.',
        duration_ms: Date.now() - startTime,
      });
    }

    // Edge case: very long route (>200km)
    if (dist > 200) {
      return res.json({
        request_id: requestId,
        routes: [],
        advisory: '⚠️ This route is extremely long (>200km). Please choose a closer destination.',
        duration_ms: Date.now() - startTime,
      });
    }

    // Fetch routes from OSRM
    const osrmRoutes = await fetchOSRMRoutes(start_lng, start_lat, end_lng, end_lat);

    if (!osrmRoutes || osrmRoutes.length === 0) {
      return res.json({
        request_id: requestId,
        routes: [],
        advisory: '❌ No walkable routes found between these points. Try different locations.',
        duration_ms: Date.now() - startTime,
      });
    }

    // Score each route
    const scoredRoutes = osrmRoutes.map((route, index) => {
      const coordinates = route.geometry.coordinates;
      const scoreResult = scoreRoute(coordinates);
      const distKm = route.distance / 1000;
      const durationMin = Math.round(route.duration / 60);

      return {
        id: index === 0 ? 'route_fast' : `route_alt_${index}`,
        label: index === 0 ? 'Fastest Route' : `Alternative Route ${index}`,
        coordinates,
        distance_km: Math.round(distKm * 100) / 100,
        duration_min: durationMin,
        safety_score: scoreResult.score,
        reason: scoreResult.reason,
        warning: scoreResult.warning,
        details: scoreResult.details,
      };
    });

    // Sort by safety score (highest first) and relabel
    scoredRoutes.sort((a, b) => b.safety_score - a.safety_score);
    if (scoredRoutes.length > 0) {
      scoredRoutes[0].id = 'route_safe';
      scoredRoutes[0].label = 'Safest Route';
    }

    // Check if ALL routes are unsafe
    const allUnsafe = scoredRoutes.every(r => r.safety_score < 30);
    const advisory = allUnsafe
      ? '⚠️ All available routes have low safety scores. We strongly recommend using a ride service instead of walking.'
      : null;

    const response = {
      request_id: requestId,
      routes: scoredRoutes,
      advisory,
      destination: destination_name,
      duration_ms: Date.now() - startTime,
    };

    // Log structured request data
    console.log(JSON.stringify({
      severity: 'INFO',
      message: 'Route scored',
      request_id: requestId,
      routes_count: scoredRoutes.length,
      top_score: scoredRoutes[0]?.safety_score,
      advisory_triggered: !!advisory,
      latency_ms: Date.now() - startTime,
    }));

    res.json(response);
  } catch (err) {
    err.requestId = requestId;
    next(err);
  }
});

/**
 * Fetch alternative walking routes from OSRM demo server.
 * Returns up to 3 route alternatives.
 */
async function fetchOSRMRoutes(startLng, startLat, endLng, endLat) {
  const baseUrl = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
  const url = `${baseUrl}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?alternatives=true&overview=full&geometries=geojson&steps=false`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`OSRM returned ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes) {
      return [];
    }

    // Return up to 3 routes
    return data.routes.slice(0, 3);
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[SICHER] OSRM request timed out');
      const error = new Error('Routing service timed out. Please try again.');
      error.statusCode = 504;
      throw error;
    }
    console.error('[SICHER] OSRM error:', err.message);
    const error = new Error('Routing service unavailable. Please try again later.');
    error.statusCode = 502;
    throw error;
  }
}

/**
 * Quick haversine approximation (km) for edge case checks.
 */
function haversineQuick(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = router;
