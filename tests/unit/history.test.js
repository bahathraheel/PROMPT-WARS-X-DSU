/**
 * SICHER — Unit Tests: History CRUD
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../../backend/server');

const CHECKS_FILE = path.join(__dirname, '..', '..', 'backend', 'data', 'checks.json');

// Backup and restore checks.json around tests
let originalContent;

beforeAll(() => {
  try {
    originalContent = fs.readFileSync(CHECKS_FILE, 'utf-8');
  } catch {
    originalContent = '[]';
  }
});

afterAll(() => {
  fs.writeFileSync(CHECKS_FILE, originalContent, 'utf-8');
});

beforeEach(() => {
  // Reset to empty for each test
  fs.writeFileSync(CHECKS_FILE, '[]', 'utf-8');
});

describe('GET /api/history', () => {
  test('returns empty array initially', async () => {
    const res = await request(app).get('/api/history');
    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.checks).toEqual([]);
    expect(res.body.max).toBe(10);
  });
});

describe('POST /api/history', () => {
  test('adds entry successfully', async () => {
    const entry = {
      destination: 'India Gate',
      start: { lat: 28.6139, lng: 77.2090 },
      end: { lat: 28.6129, lng: 77.2295 },
      top_score: 85,
      route_count: 2,
    };

    const res = await request(app)
      .post('/api/history')
      .send(entry);

    expect(res.statusCode).toBe(201);
    expect(res.body.entry.destination).toBe('India Gate');
    expect(res.body.entry.top_score).toBe(85);
    expect(res.body.entry.id).toBeDefined();
    expect(res.body.entry.timestamp).toBeDefined();
  });

  test('caps at 10 entries', async () => {
    // Add 12 entries
    for (let i = 0; i < 12; i++) {
      await request(app)
        .post('/api/history')
        .send({
          destination: `Place ${i}`,
          start: { lat: 28.6139, lng: 77.2090 },
          end: { lat: 28.6129, lng: 77.2295 },
          top_score: 50 + i,
          route_count: 1,
        });
    }

    const res = await request(app).get('/api/history');
    expect(res.body.count).toBe(10);
    // Newest should be first
    expect(res.body.checks[0].destination).toBe('Place 11');
  });

  test('returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/history')
      .send({ top_score: 50 }); // Missing destination, start, end

    expect(res.statusCode).toBe(400);
  });

  test('truncates long destination names', async () => {
    const longName = 'A'.repeat(300);
    const res = await request(app)
      .post('/api/history')
      .send({
        destination: longName,
        start: { lat: 28.6139, lng: 77.2090 },
        end: { lat: 28.6129, lng: 77.2295 },
        top_score: 50,
        route_count: 1,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.entry.destination.length).toBe(200);
  });
});

describe('DELETE /api/history', () => {
  test('clears all entries', async () => {
    // Add an entry first
    await request(app)
      .post('/api/history')
      .send({
        destination: 'Test',
        start: { lat: 28.6139, lng: 77.2090 },
        end: { lat: 28.6129, lng: 77.2295 },
        top_score: 50,
        route_count: 1,
      });

    const delRes = await request(app).delete('/api/history');
    expect(delRes.statusCode).toBe(200);
    expect(delRes.body.count).toBe(0);

    // Verify empty
    const getRes = await request(app).get('/api/history');
    expect(getRes.body.count).toBe(0);
  });
});

describe('Corruption Recovery', () => {
  test('recovers from corrupted checks.json', async () => {
    // Write invalid JSON
    fs.writeFileSync(CHECKS_FILE, 'NOT VALID JSON!!!', 'utf-8');

    const res = await request(app).get('/api/history');
    expect(res.statusCode).toBe(200);
    expect(res.body.checks).toEqual([]);
  });

  test('recovers from non-array checks.json', async () => {
    fs.writeFileSync(CHECKS_FILE, '{"not": "an array"}', 'utf-8');

    const res = await request(app).get('/api/history');
    expect(res.statusCode).toBe(200);
    expect(res.body.checks).toEqual([]);
  });
});
