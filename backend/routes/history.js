/**
 * SICHER — History Endpoint
 * 
 * Manages the last 10 route checks in checks.json.
 * GET  /api/history — Read all entries
 * POST /api/history — Add a new entry (auto-caps at 10)
 * DELETE /api/history — Clear all history
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const CHECKS_FILE = path.join(__dirname, '..', 'data', 'checks.json');
const MAX_ENTRIES = 10;

/**
 * Read checks.json safely with corruption recovery.
 * @returns {Array} Array of check entries
 */
function readChecks() {
  try {
    if (!fs.existsSync(CHECKS_FILE)) {
      fs.writeFileSync(CHECKS_FILE, '[]', 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(CHECKS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('[SICHER] checks.json was not an array — resetting');
      fs.writeFileSync(CHECKS_FILE, '[]', 'utf-8');
      return [];
    }
    return parsed;
  } catch (err) {
    console.error('[SICHER] checks.json corrupted — rebuilding:', err.message);
    fs.writeFileSync(CHECKS_FILE, '[]', 'utf-8');
    return [];
  }
}

/**
 * Write checks array to file atomically.
 * @param {Array} checks - Array of check entries
 */
function writeChecks(checks) {
  const tempFile = CHECKS_FILE + '.tmp';
  fs.writeFileSync(tempFile, JSON.stringify(checks, null, 2), 'utf-8');
  fs.renameSync(tempFile, CHECKS_FILE);
}

/**
 * GET /api/history
 * Returns all stored check entries.
 */
router.get('/', (_req, res) => {
  const checks = readChecks();
  res.json({
    count: checks.length,
    max: MAX_ENTRIES,
    checks,
  });
});

/**
 * POST /api/history
 * Adds a new check entry. Auto-removes oldest if > 10 entries.
 * 
 * Body: {
 *   destination: string,
 *   start: { lat, lng },
 *   end: { lat, lng },
 *   top_score: number,
 *   route_count: number,
 *   advisory: string|null
 * }
 */
router.post('/', (req, res) => {
  const { destination, start, end, top_score, route_count, advisory } = req.body;

  if (!destination || !start || !end) {
    return res.status(400).json({ error: 'Missing required fields: destination, start, end' });
  }

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    destination: String(destination).substring(0, 200),
    start: { lat: parseFloat(start.lat), lng: parseFloat(start.lng) },
    end: { lat: parseFloat(end.lat), lng: parseFloat(end.lng) },
    top_score: parseInt(top_score) || 0,
    route_count: parseInt(route_count) || 0,
    advisory: advisory || null,
  };

  const checks = readChecks();
  checks.unshift(entry); // Add to front (newest first)

  // Cap at MAX_ENTRIES
  while (checks.length > MAX_ENTRIES) {
    checks.pop();
  }

  writeChecks(checks);

  console.log(JSON.stringify({
    severity: 'INFO',
    message: 'History entry added',
    entry_id: entry.id,
    destination: entry.destination,
    total_entries: checks.length,
  }));

  res.status(201).json({ message: 'Check saved', entry, total: checks.length });
});

/**
 * DELETE /api/history
 * Clears all history entries.
 */
router.delete('/', (_req, res) => {
  writeChecks([]);
  console.log(JSON.stringify({
    severity: 'INFO',
    message: 'History cleared',
  }));
  res.json({ message: 'History cleared', count: 0 });
});

module.exports = router;
