/**
 * SICHER Safety Scoring Engine (JavaScript implementation)
 * 
 * Scores walking routes by cross-referencing coordinates against
 * a simulated safety grid. Uses weighted averaging of:
 *   - Lighting (weight: 3)
 *   - Pedestrian Activity (weight: 2)
 *   - CCTV Coverage (weight: 2)
 *   - Emergency Service Proximity (weight: 1)
 */

const path = require('path');
const fs = require('fs');

// Load and index the safety grid
let gridData = null;
let gridIndex = null;

/**
 * Load the safety grid from JSON file and build a spatial index.
 * Uses a simple hash-based grid for O(1) lookups.
 */
function loadGrid() {
  const gridPath = path.join(__dirname, '..', 'data', 'safety_grid.json');
  const raw = fs.readFileSync(gridPath, 'utf-8');
  gridData = JSON.parse(raw);

  // Build spatial hash index for fast lookups
  gridIndex = new Map();
  const precision = 1000; // ~111m resolution

  for (const cell of gridData.cells) {
    const key = `${Math.round(cell.lat * precision)},${Math.round(cell.lng * precision)}`;
    gridIndex.set(key, cell);
  }

  console.log(`[SICHER] Safety grid loaded: ${gridData.cells.length} cells indexed`);
  return gridData;
}

/**
 * Find the nearest grid cell to a coordinate.
 * Uses spatial hash with expanding search radius.
 * 
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {object|null} Nearest grid cell or null if too far
 */
function findNearestCell(lat, lng) {
  if (!gridIndex) loadGrid();

  const precision = 1000;
  const searchRadius = 3; // search ±3 hash cells

  let bestCell = null;
  let bestDist = Infinity;

  const baseLat = Math.round(lat * precision);
  const baseLng = Math.round(lng * precision);

  for (let dLat = -searchRadius; dLat <= searchRadius; dLat++) {
    for (let dLng = -searchRadius; dLng <= searchRadius; dLng++) {
      const key = `${baseLat + dLat},${baseLng + dLng}`;
      const cell = gridIndex.get(key);
      if (cell) {
        const dist = haversineDistance(lat, lng, cell.lat, cell.lng);
        if (dist < bestDist) {
          bestDist = dist;
          bestCell = cell;
        }
      }
    }
  }

  // Only return cells within 500m
  if (bestDist > 0.5) return null;
  return bestCell;
}

/**
 * Calculate haversine distance between two coordinates in km.
 * 
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Sample points along a route at regular intervals (~50m).
 * 
 * @param {Array} coordinates - Array of [lng, lat] pairs
 * @returns {Array} Sampled [lng, lat] pairs
 */
function sampleRoutePoints(coordinates) {
  if (!coordinates || coordinates.length === 0) return [];
  
  const sampleDistKm = 0.05; // 50 meters
  const sampled = [coordinates[0]];
  let accumulated = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const [lng1, lat1] = coordinates[i - 1];
    const [lng2, lat2] = coordinates[i];
    const segDist = haversineDistance(lat1, lng1, lat2, lng2);
    accumulated += segDist;

    if (accumulated >= sampleDistKm) {
      sampled.push(coordinates[i]);
      accumulated = 0;
    }
  }

  // Always include last point
  if (sampled[sampled.length - 1] !== coordinates[coordinates.length - 1]) {
    sampled.push(coordinates[coordinates.length - 1]);
  }

  return sampled;
}

/**
 * Score a single route based on safety grid data.
 * 
 * @param {Array} coordinates - Array of [lng, lat] pairs
 * @param {object} [weights] - Optional weight overrides
 * @returns {Promise<object>} Score result { score, reason, segments, warning }
 */
async function scoreRoute(coordinates, weights = null) {
  if (!gridData) loadGrid();

  const w = weights || gridData.weights;
  const totalWeight = w.lighting + w.activity + w.cctv + w.emergency_proximity;

  const sampledPoints = sampleRoutePoints(coordinates);
  const segments = [];
  let totalScore = 0;
  let scoredPoints = 0;
  let unscoredPoints = 0;

  // Track component averages for reason generation
  let totalLighting = 0;
  let totalActivity = 0;
  let totalCctv = 0;
  let totalEmergency = 0;

  for (const [lng, lat] of sampledPoints) {
    const cell = findNearestCell(lat, lng);
    if (cell) {
      const pointScore =
        (w.lighting * cell.lighting +
          w.activity * cell.activity +
          w.cctv * cell.cctv +
          w.emergency_proximity * cell.emergency_proximity) /
        totalWeight;

      totalScore += pointScore;
      totalLighting += cell.lighting;
      totalActivity += cell.activity;
      totalCctv += cell.cctv;
      totalEmergency += cell.emergency_proximity;
      scoredPoints++;

      segments.push({
        from: [lng, lat],
        score: Math.round(pointScore * 10),
      });
    } else {
      unscoredPoints++;
      // Assign a cautious default score of 3 for unscored areas
      totalScore += 3;
      scoredPoints++;
      segments.push({
        from: [lng, lat],
        score: 30,
      });
    }
  }

  // Calculate final normalized score (0-100)
  const avgScore = scoredPoints > 0 ? totalScore / scoredPoints : 0;
  const finalScore = Math.round(avgScore * 10);

  // Calculate component averages
  const realScored = scoredPoints - unscoredPoints;
  const avgLighting = realScored > 0 ? (totalLighting / realScored).toFixed(1) : 0;
  const avgActivity = realScored > 0 ? (totalActivity / realScored).toFixed(1) : 0;
  const avgCctv = realScored > 0 ? (totalCctv / realScored).toFixed(1) : 0;
  const avgEmergency = realScored > 0 ? (totalEmergency / realScored).toFixed(1) : 0;

  // Generate human-readable reason — use AI if key available, otherwise fallback
  let reason;
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (geminiKey && geminiKey !== 'your_google_maps_key_here') {
    reason = await generateAIReason(finalScore, {
      lighting: avgLighting,
      activity: avgActivity,
      cctv: avgCctv,
      emergency: avgEmergency,
      unscored: unscoredPoints
    }, geminiKey);
  } else {
    reason = generateReason(finalScore, avgLighting, avgActivity, avgCctv, avgEmergency, unscoredPoints);
  }

  return {
    score: finalScore,
    reason,
    segments,
    warning: finalScore < 30,
    details: {
      scored_points: scoredPoints,
      unscored_points: unscoredPoints,
      coverage_pct: Math.round((realScored / (scoredPoints || 1)) * 100),
      avg_lighting: parseFloat(avgLighting),
      avg_activity: parseFloat(avgActivity),
      avg_cctv: parseFloat(avgCctv),
      avg_emergency: parseFloat(avgEmergency),
    },
  };
}

/**
 * Generate an AI-powered safety assessment using Google Gemini.
 */
async function generateAIReason(score, factors, apiKey) {
  const fetch = require('node-fetch');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

  const prompt = `
    As a neighborhood safety assistant, analyze this walking route:
    - Safety Score: ${score}/100
    - Lighting: ${factors.lighting}/10 (0=dark, 10=bright)
    - Activity: ${factors.activity}/10 (0=isolated, 10=busy)
    - CCTV: ${factors.cctv}/10
    - Emergency Services: ${factors.emergency}/10
    - Unmapped regions: ${factors.unscored} points
    
    Provide a concise, professional 1-2 sentence safety assessment for a traveler. 
    If score < 40, recommend a taxi. If score > 70, mention why it's safe.
    Don't use lists. Just natural speech.
  `;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || generateReason(score, factors.lighting, factors.activity, factors.cctv, factors.emergency, factors.unscored);
  } catch (err) {
    console.error('[SICHER] Gemini AI error:', err.message);
    return generateReason(score, factors.lighting, factors.activity, factors.cctv, factors.emergency, factors.unscored);
  }
}

/**
 * Generate a human-readable safety assessment.
 * 
 * @param {number} score - Final safety score (0-100)
 * @param {number} lighting - Average lighting score
 * @param {number} activity - Average activity score
 * @param {number} cctv - Average CCTV score
 * @param {number} emergency - Average emergency proximity score
 * @param {number} unscored - Number of unscored points
 * @returns {string} Natural language reason
 */
function generateReason(score, lighting, activity, cctv, emergency, unscored) {
  const parts = [];

  if (score >= 70) {
    if (lighting >= 7) parts.push('well-lit streets');
    if (activity >= 7) parts.push('high pedestrian activity');
    if (cctv >= 7) parts.push('good CCTV coverage');
    if (emergency >= 7) parts.push('near emergency services');
    if (parts.length === 0) parts.push('generally safe conditions');
    return `Recommended: ${parts.join(', ')}.`;
  }

  if (score >= 40) {
    if (lighting < 5) parts.push('some poorly lit sections');
    if (activity < 5) parts.push('low foot traffic in parts');
    if (cctv < 5) parts.push('limited surveillance');
    if (parts.length === 0) parts.push('moderate safety conditions');
    return `Caution: ${parts.join(', ')}.`;
  }

  // Low score
  if (lighting < 4) parts.push('poorly lit area');
  if (activity < 3) parts.push('minimal foot traffic');
  if (cctv < 3) parts.push('no surveillance coverage');
  if (unscored > 3) parts.push('unmapped zones along route');
  if (parts.length === 0) parts.push('generally unsafe conditions');
  return `Warning: ${parts.join(', ')}. Consider a ride service instead.`;
}

/**
 * Calculate route distance in km from coordinate array.
 * 
 * @param {Array} coordinates - Array of [lng, lat] pairs
 * @returns {number} Total distance in kilometers
 */
function calculateDistanceKm(coordinates) {
  let total = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const [lng1, lat1] = coordinates[i - 1];
    const [lng2, lat2] = coordinates[i];
    total += haversineDistance(lat1, lng1, lat2, lng2);
  }
  return Math.round(total * 100) / 100;
}

/**
 * Estimate walking duration in minutes (avg 5 km/h).
 * 
 * @param {number} distanceKm - Distance in kilometers
 * @returns {number} Estimated minutes
 */
function estimateWalkingMinutes(distanceKm) {
  return Math.round((distanceKm / 5) * 60);
}

// Pre-load grid on module import
try {
  loadGrid();
} catch (err) {
  console.warn('[SICHER] Could not pre-load safety grid:', err.message);
}

module.exports = {
  scoreRoute,
  calculateDistanceKm,
  estimateWalkingMinutes,
  findNearestCell,
  haversineDistance,
  sampleRoutePoints,
  loadGrid,
};
