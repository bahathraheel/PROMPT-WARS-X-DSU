/**
 * SICHER — Unit Tests: Express Route Handlers
 */

const request = require('supertest');
const app = require('../../backend/server');

describe('POST /api/route', () => {

  test('returns 400 for missing coordinates', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({});
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.details).toBeInstanceOf(Array);
  });

  test('returns 400 for invalid latitude (out of range)', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({
        start_lat: 100, // Invalid: > 90
        start_lng: 77.2090,
        end_lat: 28.6129,
        end_lng: 77.2295,
      });
    
    expect(res.statusCode).toBe(400);
  });

  test('returns 400 for invalid longitude (out of range)', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({
        start_lat: 28.6139,
        start_lng: 200, // Invalid: > 180
        end_lat: 28.6129,
        end_lng: 77.2295,
      });
    
    expect(res.statusCode).toBe(400);
  });

  test('returns advisory for same start and end', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({
        start_lat: 28.6139,
        start_lng: 77.2090,
        end_lat: 28.6139,
        end_lng: 77.2090,
      });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.advisory).toContain('already there');
    expect(res.body.routes).toHaveLength(0);
  });

  test('returns advisory for extremely long route (>20km)', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({
        start_lat: 28.6139,
        start_lng: 77.2090,
        end_lat: 28.8139, // ~22km away
        end_lng: 77.4090,
      });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.advisory).toContain('long');
    expect(res.body.routes).toHaveLength(0);
  });

  test('returns request_id in response', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({
        start_lat: 28.6139,
        start_lng: 77.2090,
        end_lat: 28.6139,
        end_lng: 77.2090,
      });
    
    expect(res.body.request_id).toBeDefined();
    expect(typeof res.body.request_id).toBe('string');
  });

  test('returns 400 for non-numeric coordinates', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({
        start_lat: 'not a number',
        start_lng: 77.2090,
        end_lat: 28.6129,
        end_lng: 77.2295,
      });
    
    expect(res.statusCode).toBe(400);
  });
});
