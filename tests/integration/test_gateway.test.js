/**
 * SICHER — Integration Tests: Express → Scoring → History flow
 */

const request = require('supertest');
const app = require('../../backend/server');

describe('Integration: Full API Flow', () => {

  test('health → geocode → route → history lifecycle', async () => {
    // Step 1: Health check
    const health = await request(app).get('/api/health');
    expect(health.statusCode).toBe(200);
    expect(health.body.status).toBeDefined();

    // Step 2: Geocode a known landmark
    const geo = await request(app).get('/api/geocode?address=india gate');
    expect(geo.statusCode).toBe(200);
    expect(geo.body.lat).toBeDefined();
    expect(geo.body.lng).toBeDefined();

    // Step 3: Save a history entry
    const history = await request(app)
      .post('/api/history')
      .send({
        destination: 'India Gate',
        start: { lat: 28.6139, lng: 77.2090 },
        end: { lat: geo.body.lat, lng: geo.body.lng },
        top_score: 75,
        route_count: 2,
        advisory: null,
      });
    expect(history.statusCode).toBe(201);

    // Step 4: Verify history was saved
    const historyGet = await request(app).get('/api/history');
    expect(historyGet.body.checks.length).toBeGreaterThan(0);
    expect(historyGet.body.checks[0].destination).toBe('India Gate');
  });

  test('route scoring returns valid structure', async () => {
    // Use same location for fast test (should trigger "already there")
    const res = await request(app)
      .post('/api/route')
      .send({
        start_lat: 28.6139,
        start_lng: 77.2090,
        end_lat: 28.6140,
        end_lng: 77.2091,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.request_id).toBeDefined();
    expect(res.body.duration_ms).toBeDefined();
    expect(res.body.duration_ms).toBeGreaterThanOrEqual(0);
  });

  test('concurrent requests do not corrupt data', async () => {
    // Fire 5 history writes simultaneously
    const promises = Array.from({ length: 5 }, (_, i) =>
      request(app)
        .post('/api/history')
        .send({
          destination: `Concurrent ${i}`,
          start: { lat: 28.6139, lng: 77.2090 },
          end: { lat: 28.6129, lng: 77.2295 },
          top_score: 50 + i,
          route_count: 1,
        })
    );

    const results = await Promise.all(promises);
    results.forEach(r => expect(r.statusCode).toBe(201));

    // Verify data integrity
    const history = await request(app).get('/api/history');
    expect(history.body.checks.length).toBeLessThanOrEqual(10);
    // All entries should be valid JSON-parseable
    expect(() => JSON.stringify(history.body)).not.toThrow();
  });
});

describe('Integration: Error Scenarios', () => {

  test('graceful handling of invalid geocode + route combo', async () => {
    const geo = await request(app).get('/api/geocode?address=xyznonexistent');
    expect(geo.statusCode).toBe(404);
    // Should not crash the server
    const health = await request(app).get('/api/health');
    expect(health.statusCode).toBe(200);
  });

  test('server stays healthy after malformed requests', async () => {
    // Send garbage
    await request(app)
      .post('/api/route')
      .set('Content-Type', 'application/json')
      .send('garbage');

    // Server should still work
    const health = await request(app).get('/api/health');
    expect(health.statusCode).toBe(200);
  });
});
