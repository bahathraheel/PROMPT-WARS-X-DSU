/**
 * SICHER — Geocoding Endpoint
 * 
 * GET /api/geocode?address=...
 * Proxies address lookups to Google Maps Geocoding API.
 * Falls back to a simple coordinate parser if no API key.
 */

const express = require('express');
const Joi = require('joi');

const router = express.Router();

const geocodeSchema = Joi.object({
  address: Joi.string().min(2).max(200).required()
    .messages({ 'string.min': 'Address must be at least 2 characters' }),
});

/**
 * GET /api/geocode
 * Query: { address: string }
 * Returns: { lat, lng, formatted_address, source }
 */
router.get('/', async (req, res, next) => {
  try {
    const { error, value } = geocodeSchema.validate(req.query);
    if (error) {
      const err = new Error('Invalid address query');
      err.statusCode = 400;
      err.details = error.details.map(d => d.message);
      return next(err);
    }

    const { address } = value;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (apiKey && apiKey !== 'your_google_maps_key_here') {
      // Use Google Maps Geocoding API
      const result = await googleGeocode(address, apiKey);
      return res.json(result);
    }

    // Fallback: try to parse as coordinates (lat, lng)
    const coordMatch = address.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      return res.json({
        lat: parseFloat(coordMatch[1]),
        lng: parseFloat(coordMatch[2]),
        formatted_address: `${coordMatch[1]}, ${coordMatch[2]}`,
        source: 'coordinate_parse',
      });
    }

    // Fallback Geocoding (OpenStreetMap Nominatim for free usage globally)
    const fetch = require('node-fetch');
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    
    const osResponse = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'SICHER-Platform/1.0' } // Nominatim requires User-Agent
    });
    const osData = await osResponse.json();

    if (osData && osData.length > 0) {
      const result = osData[0];
      return res.json({
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        formatted_address: result.display_name,
        source: 'osm_nominatim',
      });
    }

    // No match
    return res.status(404).json({
      error: 'Could not geocode address.',
      suggestion: 'Try using format: Lat, Lng or a more specific place name.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Call Google Maps Geocoding API.
 */
async function googleGeocode(address, apiKey) {
  const fetch = require('node-fetch');
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status === 'OK' && data.results.length > 0) {
    const result = data.results[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted_address: result.formatted_address,
      source: 'google_maps',
    };
  }

  if (data.status === 'ZERO_RESULTS') {
    const err = new Error('No results found for this address.');
    err.statusCode = 404;
    throw err;
  }

  const err = new Error(`Geocoding failed: ${data.status}`);
  err.statusCode = 502;
  throw err;
}

module.exports = router;
