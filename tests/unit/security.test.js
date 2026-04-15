/**
 * SICHER — Unit Tests: Security Middleware
 */

const request = require('supertest');
const app = require('../../backend/server');

describe('Security Headers', () => {

  test('sets X-Content-Type-Options header', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('sets X-Frame-Options header', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  test('sets Content-Security-Policy header', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  test('does NOT expose X-Powered-By', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('sets Strict-Transport-Security header', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['strict-transport-security']).toBeDefined();
  });
});

describe('CORS', () => {

  test('allows requests without origin (curl, mobile)', async () => {
    const res = await request(app)
      .get('/api/health');
    
    expect(res.statusCode).toBe(200);
  });
});

describe('Health Check', () => {

  test('returns healthy status', async () => {
    const res = await request(app).get('/api/health');
    
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBeDefined();
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.service).toBe('SICHER');
    expect(res.body.uptime_seconds).toBeGreaterThanOrEqual(0);
    expect(res.body.memory_mb).toBeGreaterThan(0);
    expect(res.body.components).toBeDefined();
    expect(res.body.components.safety_grid.cells).toBeGreaterThan(0);
    expect(res.body.components.node_version).toBeDefined();
  });
});

describe('Error Handling', () => {

  test('returns 404 JSON for unknown API endpoints', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  test('returns structured error for malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/route')
      .set('Content-Type', 'application/json')
      .send('{ invalid json !!!');
    
    expect(res.statusCode).toBe(400);
  });
});

describe('Rate Limiting', () => {

  test('includes rate limit headers', async () => {
    const res = await request(app).get('/api/health');
    // express-rate-limit v7 uses standard headers
    expect(
      res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit']
    ).toBeDefined();
  });
});
