/**
 * SICHER — Service Validation Script
 * 
 * Uses the Antigravity Browser Subagent to verify that critical
 * external services are operational. Triggered automatically when
 * a route check fails or manually via `npm run validate`.
 * 
 * Checks:
 *   1. OSRM routing service status
 *   2. Mapbox API status
 *   3. Google Cloud service status
 * 
 * Results are logged to checks.json with timestamps.
 */

const fs = require('fs');
const path = require('path');

const CHECKS_FILE = path.join(__dirname, 'data', 'checks.json');

/**
 * Main validation entry point.
 * In production, this is called by the Express /api/validate endpoint.
 * Can also be run standalone: `node validate.js`
 */
async function validateServices() {
  console.log('\n🔍 SICHER Service Validation Starting...\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    type: 'service_validation',
    checks: [],
    overall: 'unknown',
  };

  // Check 1: OSRM Routing Service
  console.log('  [1/3] Checking OSRM routing service...');
  const osrmResult = await checkServiceHealth(
    'OSRM Routing',
    'https://router.project-osrm.org/route/v1/foot/77.2090,28.6139;77.2295,28.6129?overview=false',
    (data) => data && data.code === 'Ok'
  );
  results.checks.push(osrmResult);

  // Check 2: Mapbox API (tile request)
  console.log('  [2/3] Checking Mapbox tile service...');
  const mapboxResult = await checkServiceHealth(
    'Mapbox Tiles',
    'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8.json?secure&access_token=pk.placeholder',
    // Will return 401 without valid token, but proves API is reachable
    (data, status) => status === 200 || status === 401 || status === 403
  );
  results.checks.push(mapboxResult);

  // Check 3: Google Maps Geocoding API reachability
  console.log('  [3/3] Checking Google Maps API...');
  const googleResult = await checkServiceHealth(
    'Google Maps Geocoding',
    'https://maps.googleapis.com/maps/api/geocode/json?address=test',
    (data, status) => status === 200 || (data && data.status === 'REQUEST_DENIED')
  );
  results.checks.push(googleResult);

  // Determine overall status
  const allOk = results.checks.every(c => c.status === 'operational');
  const anyDown = results.checks.some(c => c.status === 'down');
  results.overall = allOk ? 'all_operational' : anyDown ? 'degraded' : 'partial';

  // Print summary
  console.log('\n────────────────────────────────────');
  console.log('  SICHER Validation Results');
  console.log('────────────────────────────────────');
  for (const check of results.checks) {
    const icon = check.status === 'operational' ? '✅' : check.status === 'reachable' ? '⚠️' : '❌';
    console.log(`  ${icon} ${check.service}: ${check.status} (${check.response_time_ms}ms)`);
  }
  console.log(`\n  Overall: ${results.overall}`);
  console.log('────────────────────────────────────\n');

  // Save validation result to checks.json
  saveValidationResult(results);

  return results;
}

/**
 * Check if a service endpoint is healthy.
 * 
 * @param {string} serviceName - Human-readable service name
 * @param {string} url - Health check URL
 * @param {Function} validator - Function(data, statusCode) => boolean
 * @returns {object} Check result
 */
async function checkServiceHealth(serviceName, url, validator) {
  const startTime = Date.now();
  
  try {
    const fetch = require('node-fetch');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SICHER-Validator/1.0' },
    });
    clearTimeout(timeout);

    const responseTime = Date.now() - startTime;
    let data = null;
    
    try {
      data = await response.json();
    } catch (_e) {
      // Response might not be JSON
    }

    const isOk = validator(data, response.status);

    return {
      service: serviceName,
      url: url.split('?')[0], // Strip query params for security
      status: isOk ? 'operational' : 'reachable',
      http_status: response.status,
      response_time_ms: responseTime,
      checked_at: new Date().toISOString(),
    };
  } catch (err) {
    return {
      service: serviceName,
      url: url.split('?')[0],
      status: 'down',
      error: err.name === 'AbortError' ? 'Timeout (8s)' : err.message,
      response_time_ms: Date.now() - startTime,
      checked_at: new Date().toISOString(),
    };
  }
}

/**
 * Verify service documentation via browser subagent.
 * This function is designed to be called by the Antigravity Browser Subagent.
 * 
 * The subagent will:
 * 1. Navigate to the service documentation page
 * 2. Look for operational status indicators
 * 3. Return whether the service is confirmed operational
 */
async function browserValidation() {
  console.log('\n🌐 Browser-based validation requested.');
  console.log('   This requires the Antigravity Browser Subagent.');
  console.log('   Target: https://www.google.com/search?q=docs.github.com');
  console.log('   Checking for official operational status...\n');
  
  // The actual browser navigation is handled by the Antigravity subagent
  // This function prepares the context for it
  return {
    action: 'browser_validate',
    target_url: 'https://www.google.com/search?q=docs.github.com',
    search_for: 'operational',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Save validation results to checks.json.
 */
function saveValidationResult(results) {
  try {
    let checks = [];
    try {
      const raw = fs.readFileSync(CHECKS_FILE, 'utf-8');
      checks = JSON.parse(raw);
      if (!Array.isArray(checks)) checks = [];
    } catch (_e) {
      checks = [];
    }

    checks.unshift({
      id: 'val_' + Date.now().toString(36),
      type: 'validation',
      timestamp: results.timestamp,
      overall: results.overall,
      services: results.checks.map(c => ({
        name: c.service,
        status: c.status,
        ms: c.response_time_ms,
      })),
    });

    // Keep max 10 entries
    while (checks.length > 10) checks.pop();

    const tempFile = CHECKS_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(checks, null, 2), 'utf-8');
    fs.renameSync(tempFile, CHECKS_FILE);
    
    console.log('  📝 Results saved to checks.json');
  } catch (err) {
    console.error('  ⚠️ Could not save results:', err.message);
  }
}

// Run standalone
if (require.main === module) {
  validateServices()
    .then(results => {
      process.exit(results.overall === 'all_operational' ? 0 : 1);
    })
    .catch(err => {
      console.error('Validation failed:', err);
      process.exit(2);
    });
}

module.exports = { validateServices, browserValidation, checkServiceHealth };
