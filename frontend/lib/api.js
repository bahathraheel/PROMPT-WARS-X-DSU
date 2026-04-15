/**
 * SICHER — API Client Library
 * 
 * Fetch wrappers for all backend endpoints with error handling.
 */

const API_BASE = typeof window !== 'undefined'
  ? (window.location.port === '3001' ? 'http://localhost:8080' : '')
  : '';

/**
 * Fetch scored routes from the backend.
 * First geocodes the destination, then requests route scoring.
 * 
 * @param {object} start - { lat, lng } user's current location
 * @param {string} destination - Destination query string
 * @returns {object} Route score response
 */
export async function fetchRoute(start, destination) {
  // Step 1: Geocode destination
  let endCoords;

  // Check if destination is already coordinates
  const coordMatch = destination.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (coordMatch) {
    endCoords = { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
  } else {
    // Send user's current location to bias geocoding to nearby places
    const geocodeUrl = `${API_BASE}/api/geocode?address=${encodeURIComponent(destination)}&lat=${start.lat}&lng=${start.lng}`;
    const geoRes = await fetch(geocodeUrl);
    if (!geoRes.ok) {
      const err = await geoRes.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to geocode destination');
    }
    endCoords = await geoRes.json();
  }

  // Step 2: Score routes
  const res = await fetch(`${API_BASE}/api/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start_lat: start.lat,
      start_lng: start.lng,
      end_lat: endCoords.lat,
      end_lng: endCoords.lng,
      destination_name: destination,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Request failed (${res.status})`);
  }

  return res.json();
}

/**
 * Fetch route check history.
 * @returns {object} { count, max, checks: [...] }
 */
export async function fetchHistory() {
  const res = await fetch(`${API_BASE}/api/history`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

/**
 * Save a route check to history.
 * @param {object} entry - Check entry data
 * @returns {object} Save response
 */
export async function saveHistory(entry) {
  const res = await fetch(`${API_BASE}/api/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error('Failed to save history');
  return res.json();
}

/**
 * Clear all history.
 * @returns {object} Clear response
 */
export async function clearHistory() {
  const res = await fetch(`${API_BASE}/api/history`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear history');
  return res.json();
}

/**
 * Trigger service validation.
 * @returns {object} Validation results
 */
export async function triggerValidation() {
  const res = await fetch(`${API_BASE}/api/validate`);
  if (!res.ok) throw new Error('Validation failed');
  return res.json();
}
