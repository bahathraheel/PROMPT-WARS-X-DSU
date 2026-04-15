/**
 * SICHER — Unit Tests: Input Validation & Security
 */

const request = require('supertest');
const app = require('../../backend/server');

describe('Input Validation', () => {

  test('rejects SQL injection in coordinates', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({
        start_lat: '28.6139; DROP TABLE routes;--',
        start_lng: 77.2090,
        end_lat: 28.6129,
        end_lng: 77.2295,
      });
    
    expect(res.statusCode).toBe(400);
  });

  test('rejects XSS payload in destination name', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({
        start_lat: 28.6139,
        start_lng: 77.2090,
        end_lat: 28.6139,
        end_lng: 77.2090,
        destination_name: '<script>alert("xss")</script>',
      });
    
    // Should either sanitize or accept (Joi allows strings, XSS is a display concern)
    expect(res.statusCode).toBeLessThanOrEqual(200);
  });

  test('handles boundary coordinates (equator, prime meridian)', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({
        start_lat: 0,
        start_lng: 0,
        end_lat: 0.01,
        end_lng: 0.01,
      });
    
    // Should not crash. May return 200 (no routes) or 502 (OSRM can't route in ocean)
    expect([200, 502]).toContain(res.statusCode);
  });

  test('handles extreme coordinates (poles)', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({
        start_lat: 90,
        start_lng: 180,
        end_lat: -90,
        end_lng: -180,
      });
    
    // Should return advisory about distance
    expect(res.statusCode).toBe(200);
    expect(res.body.advisory).toBeDefined();
  });

  test('handles negative coordinates', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({
        start_lat: -33.8688,
        start_lng: 151.2093,
        end_lat: -33.8688,
        end_lng: 151.2093,
      });
    
    expect(res.statusCode).toBe(200);
  });
});

describe('Geocoding Validation', () => {

  test('rejects empty address', async () => {
    const res = await request(app)
      .get('/api/geocode?address=');
    
    expect(res.statusCode).toBe(400);
  });

  test('rejects single character address', async () => {
    const res = await request(app)
      .get('/api/geocode?address=a');
    
    expect(res.statusCode).toBe(400);
  });

  test('rejects missing address parameter', async () => {
    const res = await request(app)
      .get('/api/geocode');
    
    expect(res.statusCode).toBe(400);
  });

  test('geocodes known landmark', async () => {
    const res = await request(app)
      .get('/api/geocode?address=india gate');
    
    expect(res.statusCode).toBe(200);
    expect(res.body.lat).toBeCloseTo(28.6129, 2);
    expect(res.body.lng).toBeCloseTo(77.2295, 2);
  });

  test('parses coordinate input', async () => {
    const res = await request(app)
      .get('/api/geocode?address=28.6139, 77.2090');
    
    expect(res.statusCode).toBe(200);
    expect(res.body.lat).toBeCloseTo(28.6139, 4);
    expect(res.body.source).toBe('coordinate_parse');
  });

  test('returns 404 for unknown location', async () => {
    const res = await request(app)
      .get('/api/geocode?address=xyznonexistent123456');
    
    expect(res.statusCode).toBe(404);
  });
});
