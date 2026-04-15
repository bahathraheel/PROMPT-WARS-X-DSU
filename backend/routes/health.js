/**
 * SICHER — Health Check Endpoint
 * 
 * GET /api/health
 * Returns system health status for Cloud Run probes.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

router.get('/', (_req, res) => {
  const gridPath = path.join(__dirname, '..', 'data', 'safety_grid.json');
  const checksPath = path.join(__dirname, '..', 'data', 'checks.json');

  let gridCells = 0;
  let gridOk = false;
  try {
    const grid = JSON.parse(fs.readFileSync(gridPath, 'utf-8'));
    gridCells = grid.cells?.length || 0;
    gridOk = gridCells > 0;
  } catch (_e) {
    gridOk = false;
  }

  let checksCount = 0;
  let checksOk = false;
  try {
    const checks = JSON.parse(fs.readFileSync(checksPath, 'utf-8'));
    checksCount = Array.isArray(checks) ? checks.length : -1;
    checksOk = checksCount >= 0;
  } catch (_e) {
    checksOk = false;
  }

  const overall = gridOk && checksOk ? 'healthy' : 'degraded';

  res.status(overall === 'healthy' ? 200 : 503).json({
    status: overall,
    version: '1.0.0',
    service: 'SICHER',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round(process.uptime()),
    memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    components: {
      safety_grid: { status: gridOk ? 'ok' : 'error', cells: gridCells },
      checks_store: { status: checksOk ? 'ok' : 'error', entries: checksCount },
      node_version: process.version,
    },
  });
});

module.exports = router;
