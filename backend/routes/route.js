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

    // Fetch routes — Prioritize Google Maps if API key is available
    let routesData;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (apiKey && apiKey !== 'your_google_maps_key_here') {
      routesData = await fetchGoogleRoutes(start_lat, start_lng, end_lat, end_lng, apiKey);
    } else {
      routesData = await fetchOSRMRoutes(start_lng, start_lat, end_lng, end_lat);
    }

    if (!routesData || routesData.length === 0) {
      return res.json({
        request_id: requestId,
        routes: [],
        advisory: '❌ No suitable routes found between these points. Try different locations.',
        duration_ms: Date.now() - startTime,
      });
    }

    // Score each route
    const scoredRoutes = await Promise.all(routesData.map(async (route, index) => {
      const coordinates = route.coordinates;
      const scoreResult = await scoreRoute(coordinates);

      return {
        id: index === 0 ? 'route_fast' : `route_alt_${index}`,
        label: index === 0 ? (apiKey ? 'Google Recommended' : 'Fastest Route') : `Alternative Route ${index}`,
        coordinates,
        distance_km: route.distance_km,
        duration_min: route.duration_min,
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
 * Fetch alternative routes from OSRM demo server.
 */
async function fetchOSRMRoutes(startLng, startLat, endLng, endLat) {
  const baseUrl = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
  const url = `${baseUrl}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?alternatives=true&overview=full&geometries=geojson&steps=false`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OSRM returned ${response.status}`);
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes) return [];

    return data.routes.map(r => ({
      coordinates: r.geometry.coordinates,
      distance_km: Math.round((r.distance / 1000) * 100) / 100,
      duration_min: Math.round(r.duration / 60),
    }));
  } catch (err) {
    console.error('[SICHER] OSRM error:', err.message);
    return [];
  }
}

/**
 * Fetch routes from Google Maps Directions API.
 */
async function fetchGoogleRoutes(startLat, startLng, endLat, endLng, apiKey) {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${startLat},${startLng}&destination=${endLat},${endLng}&alternatives=true&key=${apiKey}&mode=walking`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.routes) {
      console.warn('[SICHER] Google Directions Status:', data.status);
      return [];
    }

    return data.routes.map(route => {
      // Decode polyline to coordinates
      const points = decodePolyline(route.overview_polyline.points);
      const leg = route.legs[0];
      
      return {
        coordinates: points.map(p => [p.lng, p.lat]), // Convert to [lng, lat] for GeoJSON
        distance_km: Math.round((leg.distance.value / 1000) * 100) / 100,
        duration_min: Math.round(leg.duration.value / 60),
      };
    });
  } catch (err) {
    console.error('[SICHER] Google Directions error:', err.message);
    return [];
  }
}

/**
 * Helper to decode Google's encoded polyline string.
 */
function decodePolyline(encoded) {
  if (!encoded) return [];
  let poly = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return poly;
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
